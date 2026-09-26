import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readHandoffCode,loadToken,saveToken,redeemHandoff,fetchCadence,countCompletedRun,sendFeedback,TOKEN_KEY,COUNT_KEY} from '../.test-build/gtx.js';

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
