import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readHandoffCode,loadToken,saveToken,redeemHandoff,fetchCadence,countCompletedRun,sendFeedback,scoreRun,submitScore,queueScore,flushPending,TOKEN_KEY,COUNT_KEY,PENDING_KEY,MAX_PENDING} from '../.test-build/gtx.js';

const memoryStore=()=>{const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m};};
const brokenStore={getItem(){throw Error('denied');},setItem(){throw Error('denied');},removeItem(){throw Error('denied');}};
const reply=(status,body)=>async()=>new Response(JSON.stringify(body),{status});

test('launch code comes from the fragment only',()=>{
  assert.equal(readHandoffCode('#gtx_handoff=abc123'),'abc123');
  assert.equal(readHandoffCode('#seed=4&gtx_handoff=x'),'x');
  assert.equal(readHandoffCode('#gtx_handoff=%20'),null);assert.equal(readHandoffCode(''),null);
});

test('token storage survives disabled storage',()=>{
  const s=memoryStore();saveToken(s,'t');assert.equal(loadToken(s),'t');assert.equal(s.m.get(TOKEN_KEY),'t');
  saveToken(s,null);assert.equal(loadToken(s),null);
  assert.equal(loadToken(brokenStore),null);assert.doesNotThrow(()=>saveToken(brokenStore,'t'));assert.equal(loadToken(undefined),null);
});

test('redeem trades a code for a token and fails soft',async()=>{
  const calls=[];const ok=async(url,init)=>{calls.push([url,init]);return new Response(JSON.stringify({access_token:'jwt'}),{status:200});};
  assert.equal(await redeemHandoff(ok,'https://api.test','code-1'),'jwt');
  assert.equal(calls[0][0],'https://api.test/api/auth/handoff/redeem');assert.equal(calls[0][1].body,JSON.stringify({code:'code-1'}));
  assert.equal(await redeemHandoff(reply(400,{detail:'expired'}),'https://api.test','old'),null);
  assert.equal(await redeemHandoff(async()=>{throw TypeError('offline');},'https://api.test','x'),null);
});

test('feedback prompts on every third completed run, and the cadence restarts after each prompt',()=>{
  const s=memoryStore();const prompts=[];
  for(let run=1;run<=9;run++)if(countCompletedRun(s,3).prompt)prompts.push(run);
  assert.deepEqual(prompts,[3,6,9]);assert.equal(JSON.parse(s.m.get(COUNT_KEY)).total,9);
  const t=memoryStore();assert.deepEqual([1,2].map(()=>countCompletedRun(t,2).prompt),[false,true]);
  assert.equal(countCompletedRun(t,1).prompt,true,'cadence 1 prompts every run');
});

test('corrupt counter storage starts over instead of throwing',()=>{
  const s=memoryStore();s.setItem(COUNT_KEY,'{not json');
  assert.deepEqual(countCompletedRun(s,3),{prompt:false,total:1});
  assert.deepEqual(countCompletedRun(undefined,3),{prompt:false,total:0});
});

test('cadence comes from the Gametronyx games list',async()=>{
  assert.equal(await fetchCadence(reply(200,[{slug:'red-ring',feedback_every_n_runs:null},{slug:'jerboa',feedback_every_n_runs:5}]),'https://api.test'),5);
  assert.equal(await fetchCadence(reply(200,[{slug:'jerboa',feedback_every_n_runs:null}]),'https://api.test'),null);
  assert.equal(await fetchCadence(async()=>{throw TypeError('offline');},'https://api.test'),null);
});

test('feedback is sent with the session token and trimmed fields',async()=>{
  let seen;const fetchFn=async(url,init)=>{seen={url,init};return new Response('{"ok":true}',{status:201});};
  const result=await sendFeedback(fetchFn,'https://api.test','tok',{text:'  Fun!  ',build:'abc1234',runs:6,ua:'UA',viewport:'390x844'});
  assert.deepEqual(result,{ok:true});assert.equal(seen.url,'https://api.test/api/feedback');
  assert.equal(seen.init.headers.Authorization,'Bearer tok');
  assert.deepEqual(JSON.parse(seen.init.body),{game_slug:'jerboa',text:'Fun!',build_sha:'abc1234',runs:6,client:{ua:'UA',viewport:'390x844'}});
});

test('feedback failures explain themselves; an ended session is flagged',async()=>{
  const input={text:'x',build:'b',runs:3,ua:'u',viewport:'v'};
  assert.equal((await sendFeedback(reply(401,{detail:'Could not validate credentials'}),'a','t',input)).expired,true);
  const limited=await sendFeedback(reply(429,{}),'a','t',input);assert.equal(limited.expired,false);assert.match(limited.message,/a lot of feedback/);
  assert.equal((await sendFeedback(reply(400,{detail:'Write something first'}),'a','t',input)).message,'Write something first');
  assert.match((await sendFeedback(async()=>{throw TypeError('offline');},'a','t',input)).message,/Couldn’t reach Gametronyx/);
});

const report={id:'run-1',build:'P1-playtest-6',score:142,nodes:31,hops:260,seconds:184.2,ringSeconds:180,boosts:2,freezes:1,nearMisses:4,settings:{duration:180,seed:7}};
const boardReply={season:'Playtest 6',players:23,rank:4,previous_rank:7,best:142,previous_best:120,personal_best:true,entries:[{rank:1,username:'ada',score:212}],me:{rank:4,username:'tyler',score:142}};
const pendingIds=s=>JSON.parse(s.m.get(PENDING_KEY)??'[]').map(r=>r.run_id);

test('a finished run posts under the session and the reply is the board',async()=>{
  let seen;const fetchFn=async(url,init)=>{seen={url,init};return new Response(JSON.stringify(boardReply),{status:201});};
  const run=scoreRun(report,'x'.repeat(80));
  assert.deepEqual(run,{run_id:'run-1',score:142,nodes:31,hops:260,seconds:184.2,ring_seconds:180,boosts:2,freezes:1,near_misses:4,build:'P1-playtest-6',build_sha:'x'.repeat(64),settings:{duration:180,seed:7}});
  const result=await submitScore(fetchFn,'https://api.test','tok',run);
  assert.equal(seen.url,'https://api.test/api/leaderboards/jerboa/scores');assert.equal(seen.init.method,'POST');
  assert.equal(seen.init.headers.Authorization,'Bearer tok');assert.deepEqual(JSON.parse(seen.init.body),run);
  assert.equal(seen.init.keepalive,true,'the post survives a tap on a Gametronyx link');
  assert.equal(result.ok,true);assert.equal(result.board.rank,4);assert.equal(result.board.entries.at(-1).name,'tyler');
});

test('score failures say whether to retry',async()=>{
  const run=scoreRun(report,'sha');
  const reason=async fetchFn=>(await submitScore(fetchFn,'a','t',run)).reason;
  assert.equal(await reason(reply(401,{})),'expired');assert.equal(await reason(reply(403,{})),'expired');
  assert.equal(await reason(reply(429,{})),'limited');assert.equal(await reason(reply(503,{})),'offline');
  assert.equal(await reason(async()=>{throw TypeError('offline');}),'offline');
  assert.equal(await reason(reply(404,{detail:'Unknown game'})),'unavailable','no leaderboard yet, or switched off');
  assert.equal(await reason(reply(200,{unexpected:true})),'unavailable');
  assert.equal(await reason(reply(422,{detail:'Not ranked'})),'rejected');
});

test('runs that fail to post wait, capped, and resend once Gametronyx answers',async()=>{
  const s=memoryStore();
  for(let i=1;i<=MAX_PENDING+2;i++)queueScore(s,{...scoreRun(report,'sha'),run_id:`r${i}`});
  queueScore(s,{...scoreRun(report,'sha'),run_id:'r12'});
  assert.equal(pendingIds(s).length,MAX_PENDING);assert.equal(pendingIds(s)[0],'r12');assert.ok(!pendingIds(s).includes('r1'),'the oldest drop first');
  const sent=[];let calls=0;
  const flaky=async(url,init)=>{calls++;if(calls===3)throw TypeError('offline');sent.push(JSON.parse(init.body).run_id);return new Response(JSON.stringify(boardReply),{status:201});};
  assert.equal(await flushPending(flaky,'a','t',s),2);assert.deepEqual(sent,['r3','r4'],'oldest first');
  assert.equal(pendingIds(s).length,MAX_PENDING-2);assert.ok(pendingIds(s).includes('r5'),'the failed run keeps waiting');
  assert.equal(await flushPending(reply(422,{}),'a','t',s),MAX_PENDING-2);assert.equal(s.m.has(PENDING_KEY),false,'refused runs are not resent forever');
  assert.equal(await flushPending(reply(201,boardReply),'a','t',undefined),0);
  assert.doesNotThrow(()=>queueScore(brokenStore,scoreRun(report,'sha')));
});
