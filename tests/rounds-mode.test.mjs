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

test('scoring the goal clears the round like a new level: fresh board and hand, full Ring, waiting for a placement',()=>{
  const g=roundsGame();g.ringMs=30000;g.ringTotalMs=30000;g.nodes.set('10,9',5);g.nodes.set('3,9',4);g.powerNodes.set('9,8','freeze');assert.ok(g.radius<FULL);
  g.advance(450);
  assert.equal(g.roundIndex,1);assert.equal(g.roundsCleared,1);assert.equal(g.roundScore,0,'points past the goal don’t carry over');
  assert.equal(g.score,5,'the 4 left on the board is not scored');assert.equal(g.collected,1);
  assert.deepEqual(g.roundLog,[{round:1,goal:3,score:5,atMs:450,ringMs:30450}]);
  assert.equal(g.ringMs,0);assert.equal(g.radius,FULL);assert.equal(g.goal,5);
  // The board is wiped back to the start square, with him on it and no hop, as at the start of a run.
  assert.equal(g.running,false);assert.deepEqual([...g.board],['9,9']);assert.deepEqual([...g.visited],['9,9']);
  assert.deepEqual(g.at,{x:9,y:9});assert.equal(g.hop,undefined);assert.equal(g.previous,undefined);assert.equal(g.pieces.length,1);
  assert.deepEqual(g.lastRemoved.map(p=>`${p.x},${p.y}`).sort(),['10,9','11,9','12,9','13,9'],'the old road flashes out');
  assert.equal(g.nodes.size,6,'the new round’s full set');assert.equal(g.powerNodes.size,0);
  assert.equal(g.draft.length,2);assert.notEqual(g.draft[0].shapeId,g.draft[1].shapeId,'a fresh opening hand');assert.ok(g.draft.every(d=>d.turns===0));
  assert.equal(g.pickups.at(-1).kind,'round');assert.deepEqual(g.pickups.at(-1).at,{x:10,y:9});
  const clear=g.events.find(e=>e.type==='round-clear').data;assert.deepEqual([clear.round,clear.score],[1,5]);assert.ok(clear.left>=1,'nodes left behind');
  // Nothing moves until the first placement, and discards wait for it too.
  const nodes=JSON.stringify([...g.nodes]);g.advance(5000);
  assert.deepEqual([g.elapsed,g.ringMs,g.ringTotalMs],[450,0,30450]);assert.equal(JSON.stringify([...g.nodes]),nodes);assert.equal(g.discard(0),false);
  g.draft[0]={shapeId:'Dot',turns:0};assert.equal(g.place(0,{x:10,y:9}),undefined);assert.equal(g.running,true);
  assert.equal(g.hop.duration,300,'the new round’s hop speed');assert.deepEqual(g.lastRemoved,[]);
  g.advance(100);assert.ok(Math.abs(g.ringMs-100)<1e-9);assert.ok(Math.abs(g.ringTotalMs-30550)<1e-9,'Ring time adds up across rounds');
});
test('missing the goal ends the run on capture; the finale never clears',()=>{
  const g=roundsGame();g.ringMs=59000;g.advance(3000);assert.equal(g.over,true);assert.equal(g.roundIndex,0);assert.equal(g.roundsCleared,0);
  const h=roundsGame();h.roundIndex=2;h.nodes.set('10,9',5);h.nodes.set('11,9',5);h.advance(900);
  assert.equal(h.score,10);assert.equal(h.roundIndex,2);assert.equal(h.goal,null);assert.equal(h.roundsCleared,0);
  const direct=new Game({seed:1},{v:1,id:'raw',name:'Raw',rounds:[round({goal:1})]});direct.board=new Set(['9,9','10,9']);direct.nodes.clear();direct.nodes.set('10,9',3);
  direct.draft[0]={shapeId:'Dot',turns:0};direct.place(0,{x:11,y:9});direct.advance(450);assert.equal(direct.roundIndex,0,'an unparsed set can’t clear past its last round');
});
test('a clear ends every powerup and effect, and the Ring jumping away is not a close escape',()=>{
  const g=roundsGame();let ms=0;while(roundRadius(ms,19,g.round)>1.45)ms+=100;g.ringMs=ms;
  g.nodes.set('10,9',3);g.powerNodes.set('10,9','boost');g.powerNodes.set('9,8','freeze');g.freezeUntil=g.elapsed+5000;g.cherries=1;
  g.advance(440);assert.equal(g.nearMisses,0);
  g.advance(10);assert.equal(g.roundIndex,1);assert.equal(g.score,6,'x2 doubled the last node');
  assert.deepEqual([g.frozen,g.boosted,g.doubleBonus,g.powerNodes.size,g.cherries],[false,false,false,0,0]);
  assert.deepEqual(g.events.map(e=>e.type).filter(t=>t==='danger-enter'||t==='round-clear'),['danger-enter','round-clear'],'he was in danger when the round cleared');
  g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:10,y:9});g.advance(1000);
  assert.equal(g.nearMisses,0);assert.ok(!g.events.some(e=>e.type==='near-miss'));assert.equal(g.hop.duration,300,'no x2 left over');
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
test('the built-in Rounds as Tyler tuned them: goals 30, 45, 60 and a Midnight finale; the timeline restarts each round',()=>{
  const set=parseRoundSet(BUILTIN_ROUNDS);assert.ok(set);assert.equal(BUILTIN_ROUNDS.rounds.at(-1).name,'Midnight');
  const d=BUILTIN_ROUNDS.rounds.map(r=>r.duration),h=BUILTIN_ROUNDS.rounds.map(r=>r.hopMs);
  // DECISIONS U49: Tyler's designer set.
  assert.deepEqual(BUILTIN_ROUNDS.rounds.map(r=>[r.goal,r.duration,r.hopMs,r.nodeCount,r.openingFives,r.boost.ms,r.freeze.ms]),
    [[30,90,450,8,2,7000,7000],[45,90,420,10,1,7000,6000],[60,80,390,10,1,7000,6000],[null,60,360,10,2,7000,6000]]);
  assert.deepEqual(BUILTIN_ROUNDS.rounds.map(r=>[r.spawner.firstMs,r.spawner.everyMs]),[[8000,12000],[6000,11000],[5000,10000],[4000,8000]]);
  // Powerups unlock round by round (U45).
  assert.deepEqual(BUILTIN_ROUNDS.rounds.map(r=>Object.keys(r.spawner.weights).filter(k=>r.spawner.weights[k]>0)),
    [['boost','freeze'],['boost','freeze','sweep'],['boost','freeze','sweep','magnet'],['boost','freeze','cherry','sweep','magnet','speed','expand']]);
  assert.deepEqual(set.rounds.map(r=>r.goal),[30,45,60,null],'parsing keeps the set as it is');
  // U50: each round paces its own Ring (phase speeds relative to the first), rescaled so it still closes on time.
  assert.deepEqual(BUILTIN_ROUNDS.rounds.map(r=>r.phases.map(p=>+(p.speed/r.phases[0].speed).toFixed(4))),[[1,1.25,1.9375],[1,1.3,1.7],[1,1.2308,1.6923],[1,1,1.3]]);
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
