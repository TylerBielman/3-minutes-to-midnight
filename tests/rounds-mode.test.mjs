import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,DEFAULTS,TUNING} from '../.test-build/game.js';
import {BUILTIN_ROUNDS,parseRoundSet,roundRadius,ringTimeline} from '../.test-build/rounds.js';
import {runReport} from '../.test-build/stats.js';
import {isRankedReport,localBoard,cheer} from '../.test-build/leaderboard.js';

const phases=[{fraction:1/3,speed:.5,pulseMs:1400,weights:[1,1,1,1,1,0]},{fraction:4/9,speed:.875,pulseMs:900,weights:[1,1,1,1,1,0]},{fraction:2/9,speed:2,pulseMs:550,weights:[1,1,1,1,1,0]}];
const round=extra=>({name:'R',duration:60,hopMs:450,nodeCount:4,openingFives:0,phases,boost:{ms:4000,speed:1.5},freeze:{ms:3000},...extra});
const testSet=(extra={})=>parseRoundSet({id:'test',name:'Test',rounds:[round({goal:3}),round({goal:5,hopMs:300,nodeCount:6}),round({name:'Midnight',goal:null,hopMs:250})],...extra});
// Jerboa at 9,9 on a straight road east to 13,9; his first hop lands on 10,9.
function roundsGame(set=testSet()){
  const g=new Game({seed:5},set);g.board=new Set(['9,9','10,9','11,9','12,9']);g.visited=new Set(['9,9']);g.nodes.clear();g.movers.clear();
  g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:13,y:9});return g;
}
const FULL=19/2-.25;

test('scoring the goal clears the round at once: full Ring, next round, fresh nodes; the road and draft stay',()=>{
  const g=roundsGame();g.ringMs=30000;g.ringTotalMs=30000;g.nodes.set('10,9',5);
  const board=[...g.board].sort(),draft=JSON.stringify(g.draft);assert.ok(g.radius<FULL);
  g.advance(450);
  assert.equal(g.roundIndex,1);assert.equal(g.roundsCleared,1);assert.equal(g.roundScore,0,'points past the goal don’t carry over');assert.equal(g.score,5);
  assert.deepEqual(g.roundLog,[{round:1,goal:3,score:5,atMs:450,ringMs:30450}]);
  assert.equal(g.ringMs,0);assert.equal(g.radius,FULL);assert.equal(g.goal,5);assert.equal(g.ringHeld,true);
  assert.equal(g.nodes.size,6,'the new round’s full set');assert.deepEqual([...g.board].sort(),board);assert.equal(JSON.stringify(g.draft),draft);
  assert.ok(g.visited.has('10,9'));assert.equal(g.hop.duration,300,'the new hop speed starts with the next hop');
  assert.equal(g.pickups.at(-1).kind,'round');assert.ok(g.events.some(e=>e.type==='round-clear'));
  g.advance(1900);assert.equal(g.ringMs,0,'the Ring holds at full');g.advance(600);assert.ok(g.ringMs>0&&g.ringMs<=600);
  assert.ok(Math.abs(g.ringTotalMs-(30450+g.ringMs))<1e-9,'Ring time adds up across rounds');
});
test('missing the goal ends the run on capture; the finale never clears',()=>{
  const g=roundsGame();g.ringMs=59000;g.advance(3000);assert.equal(g.over,true);assert.equal(g.roundIndex,0);assert.equal(g.roundsCleared,0);
  const h=roundsGame();h.roundIndex=2;h.nodes.set('10,9',5);h.nodes.set('11,9',5);h.advance(900);
  assert.equal(h.score,10);assert.equal(h.roundIndex,2);assert.equal(h.goal,null);assert.equal(h.roundsCleared,0);
  const direct=new Game({seed:1},{v:1,id:'raw',name:'Raw',rounds:[round({goal:1})]});direct.board=new Set(['9,9','10,9']);direct.nodes.clear();direct.nodes.set('10,9',3);
  direct.draft[0]={shapeId:'Dot',turns:0};direct.place(0,{x:11,y:9});direct.advance(450);assert.equal(direct.roundIndex,0,'an unparsed set can’t clear past its last round');
});
test('a freeze carries over a clear, and the Ring jumping away is not a close escape',()=>{
  const g=roundsGame();let ms=0;while(roundRadius(ms,19,g.round)>1.45)ms+=100;g.ringMs=ms;g.nodes.set('10,9',3);
  g.freezeUntil=g.elapsed+5000;
  g.advance(440);assert.equal(g.nearMisses,0);
  g.advance(10);assert.equal(g.roundIndex,1);assert.equal(g.frozen,true,'still frozen');
  assert.deepEqual(g.events.map(e=>e.type).filter(t=>t==='danger-enter'||t==='round-clear'),['danger-enter','round-clear'],'he was in danger when the round cleared');
  g.advance(1000);assert.equal(g.nearMisses,0);assert.ok(!g.events.some(e=>e.type==='near-miss'));
});
test('Rounds reports carry the mode and never rank; the device boards keep Classic and Rounds apart',()=>{
  const classic=new Game({seed:2}),rounds=new Game({seed:2},BUILTIN_ROUNDS),custom=new Game({seed:2},{...testSet(),id:'custom'});
  const c=runReport(classic,'c','2026-09-28T10:00:00Z','caught'),r=runReport(rounds,'r','2026-09-28T10:01:00Z','caught'),u=runReport(custom,'u','2026-09-28T10:02:00Z','caught');
  assert.deepEqual([c.mode,c.round,c.roundsTotal,c.roundsCleared,c.roundSet],['classic',1,1,0,null]);
  assert.deepEqual([r.mode,r.round,r.roundsTotal,r.roundSet.id,r.roundSet.rounds],['rounds',1,4,'rounds',undefined]);
  assert.equal(u.roundSet.rounds.length,3,'a custom set is kept whole');
  assert.equal(isRankedReport(c,DEFAULTS),true);assert.equal(isRankedReport(r,DEFAULTS),false);assert.equal(isRankedReport({settings:DEFAULTS},DEFAULTS),true,'older reports are Classic');
  c.score=10;r.score=50;
  const reports=[c,r,u],build=c.build;
  assert.deepEqual(localBoard(reports,'c',build,DEFAULTS).entries.map(e=>e.score),[10]);
  const rb=localBoard(reports,'r',build,DEFAULTS,'rounds');assert.deepEqual(rb.entries.map(e=>e.score),[50]);assert.equal(rb.label,'Your best Rounds runs · this device');
  assert.equal(cheer(rb,50).headline,'FIRST ROUNDS RUN!','an unranked trial never claims a ranked run');
});
test('the spawner keeps to its limit, the round’s powerups and its timing',()=>{
  const only=testSet();only.rounds[0].spawner={firstMs:1000,everyMs:1000,max:1,weights:{boost:1,freeze:0}};
  const g=roundsGame(only);g.advance(900);assert.equal(g.boostNode,undefined);g.advance(200);assert.ok(g.boostNode,'first at firstMs');
  g.advance(5000);assert.equal(g.freezeNode,undefined,'freeze has no weight here');
  const both=testSet();both.rounds[0].spawner={firstMs:500,everyMs:500,max:2,weights:{boost:1,freeze:1}};
  const h=roundsGame(both);h.advance(1200);assert.ok(h.boostNode&&h.freezeNode,'two kinds, two on the board');
  const none=testSet();none.rounds[0].freeze=null;none.rounds[0].spawner={firstMs:0,everyMs:500,max:2,weights:{boost:0,freeze:1}};
  const k=roundsGame(none);k.advance(3000);assert.equal(k.freezeNode,undefined,'a kind the round lacks never spawns');
  const classic=new Game({seed:5});classic.running=true;classic.advance(TUNING.boostFirstMs+50);assert.ok(classic.boostNode,'Classic keeps its timers');
});
test('Rounds play the same for the same seed',()=>{
  const run=()=>{const g=new Game({seed:8},BUILTIN_ROUNDS);g.draft[0]={shapeId:'Long',turns:0};g.place(0,{x:10,y:9});
    for(let i=0;i<400&&!g.over;i++)g.advance(i%7===0?250:16);return JSON.stringify([g.score,g.roundIndex,g.ringTotalMs,[...g.nodes].sort(),g.events]);};
  assert.equal(run(),run());
});
test('the built-in Rounds: goals 20, 40, 60 and a Midnight finale, each round quicker; the timeline restarts each round',()=>{
  const set=parseRoundSet(BUILTIN_ROUNDS);assert.ok(set);
  assert.deepEqual(BUILTIN_ROUNDS.rounds.map(r=>r.goal),[20,40,60,null]);assert.equal(BUILTIN_ROUNDS.rounds.at(-1).name,'Midnight');
  const d=BUILTIN_ROUNDS.rounds.map(r=>r.duration),h=BUILTIN_ROUNDS.rounds.map(r=>r.hopMs);
  for(let i=1;i<d.length;i++){assert.ok(d[i]<d[i-1]);assert.ok(h[i]<h[i-1]);}
  assert.deepEqual(BUILTIN_ROUNDS.rounds.map(r=>Object.keys(r.spawner.weights).filter(k=>r.spawner.weights[k]>0)),[['boost'],['boost','freeze'],['boost','freeze'],['boost','freeze']]);
  for(const r of BUILTIN_ROUNDS.rounds)assert.ok(Math.abs(r.phases.reduce((a,p)=>a+p.fraction*p.speed,0)-1)<1e-12);
  const line=ringTimeline(BUILTIN_ROUNDS,19);assert.equal(line[0][1],FULL);assert.equal(line.at(-1)[0],d.reduce((a,b)=>a+b,0));
  const starts=line.filter((p,i)=>i>0&&p[2]!==line[i-1][2]);assert.equal(starts.length,3);for(const p of starts)assert.equal(p[1],FULL);
});
test('share links carry a set through base64url and come back validated',async()=>{
  const {encodeRoundSet,decodeRoundSet}=await import('../.test-build/rounds.js');
  const set={...testSet(),name:'Mitternacht ✦ 3'},code=encodeRoundSet(set);
  assert.match(code,/^[\w-]+$/,'URL-safe');assert.deepEqual(decodeRoundSet(code),parseRoundSet(set));
  assert.equal(decodeRoundSet('not-a-set'),null);assert.equal(decodeRoundSet(encodeRoundSet({v:1,id:'x',name:'x',rounds:[]})),null);
});
