import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../.test-build/game.js';
import {parseRoundSet,roundRadius,roundMsForRadius,roundPhaseAt,unlockedKinds,POWER_KINDS} from '../.test-build/rounds.js';

const phases=[{fraction:1/3,speed:.5,pulseMs:1400,weights:[1,1,1,1,1,0]},{fraction:4/9,speed:.875,pulseMs:900,weights:[1,1,1,1,1,0]},{fraction:2/9,speed:2,pulseMs:550,weights:[1,1,1,1,1,0]}];
const effects={boost:{ms:4000,speed:1.4},freeze:{ms:3000},expand:{cells:1.5},magnet:{ms:3000,range:2},speed:{ms:3000,speed:1.8},cherry:{set:2,bonus:10}};
const round=extra=>({name:'R',duration:90,hopMs:450,nodeCount:1,openingFives:0,phases,...effects,...extra});
const set=(extra={})=>parseRoundSet({id:'p',name:'P',rounds:[round({goal:100,...extra}),round({goal:null})]});
// Jerboa at 9,9 on a straight road east to 13,9 (landings at 10,9, 11,9, …). The round keeps one node on the board, so a
// parked 5 at 5,5 (out of everyone's way) stops random spawns; tests place the rest.
function powerGame(s=set()){
  const g=new Game({seed:5},s);g.board=new Set(['9,9','10,9','11,9','12,9']);g.visited=new Set(['9,9']);g.nodes.clear();g.movers.clear();g.nodes.set('5,5',5);
  g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:13,y:9});return g;
}
const hop=g=>g.advance(g.hop.duration-g.hop.elapsed);
const FULL=19/2-.25;

test('the Ring’s radius and its time invert each other, clamped to the round',()=>{
  const r=set().rounds[0];
  for(let ms=0;ms<=90000;ms+=1234.5)assert.ok(Math.abs(roundMsForRadius(roundRadius(ms,19,r),19,r)-ms)<1e-6,`at ${ms}`);
  assert.equal(roundMsForRadius(FULL+3,19,r),0);assert.equal(roundMsForRadius(-1,19,r),90000);
});
test('Expand pushes the Ring out 1.5 cells, never past full, and can drop it back a phase',()=>{
  const g=powerGame();g.ringMs=72000;const r=g.round;assert.equal(g.phase,3);
  g.powerNodes.set('10,9','expand');g.advance(g.hop.duration-g.hop.elapsed-1);const before=g.radius;g.advance(1);
  assert.ok(Math.abs(g.radius-(before+1.5))<.02,`${before} → ${g.radius}`);assert.equal(g.phase,2,'back to phase 2');
  assert.equal(g.expands,1);assert.ok(g.ringRewoundMs>0);assert.equal(roundPhaseAt(g.ringMs,r),2);
  const h=powerGame();h.ringMs=2000;h.powerNodes.set('10,9','expand');hop(h);assert.equal(h.ringMs,0);assert.equal(h.radius,FULL,'capped at full');
});
test('Sweep collects every node of the lowest value on the board, doubled by x2, and can clear the round',()=>{
  const g=powerGame();for(const [k,v] of [['4,4',1],['5,15',1],['14,4',3],['15,14',5]])g.nodes.set(k,v);
  g.powerNodes.set('10,9','sweep');hop(g);
  assert.equal(g.score,2);assert.equal(g.sweptNodes,2);assert.equal(g.collected,2);assert.deepEqual([...g.nodes.values()].sort(),[3,5,5]);
  assert.ok(!g.nodes.has('4,4')&&!g.nodes.has('5,15'));
  const x2=powerGame();x2.boostNode={x:10,y:9};x2.nodes.set('4,4',2);x2.nodes.set('14,14',2);x2.nodes.set('3,9',4);hop(x2);
  x2.powerNodes.set('11,9','sweep');hop(x2);assert.equal(x2.score,8,'two 2s, doubled');
  const goal=powerGame(set({goal:6}));goal.nodes.set('4,4',3);goal.nodes.set('14,14',3);goal.powerNodes.set('10,9','sweep');hop(goal);
  assert.equal(goal.roundIndex,1,'the sweep reached the goal');
});
test('Magnet: each landing collects nodes within 2 cells; it pauses while frozen and then runs out',()=>{
  const g=powerGame();g.powerNodes.set('10,9','magnet');hop(g);assert.equal(g.magnetActive,true);
  g.nodes.set('11,11',3);g.nodes.set('13,9',1);g.nodes.set('11,6',5);   // 2 below the next landing, 2 ahead, 3 above
  hop(g);assert.equal(g.score,4);assert.equal(g.magnetNodes,2);assert.ok(g.nodes.has('11,6'),'out of range');
  const left=g.magnetLeft;g.freezeUntil=g.elapsed+2000;g.advance(1500);assert.equal(g.magnetLeft,left,'waits while frozen');
  g.advance(500+left+100);assert.equal(g.magnetActive,false);g.nodes.set(`${g.hop.to.x},${g.hop.to.y+1}`,3);const before=g.score;hop(g);assert.equal(g.score,before,'no pull once it ends');
});
test('Speed: 1.8× hops with no points bonus; with x2 the faster one wins',()=>{
  const g=powerGame();g.powerNodes.set('10,9','speed');hop(g);assert.equal(g.sped,true);
  assert.ok(Math.abs(g.hop.duration-450/1.8)<1e-9);g.nodes.set('11,9',3);hop(g);assert.equal(g.score,3,'not doubled');
  const h=powerGame();h.boostNode={x:10,y:9};hop(h);h.powerNodes.set('11,9','speed');hop(h);
  assert.equal(h.boosted&&h.sped,true);assert.ok(Math.abs(h.hop.duration-450/1.8)<1e-9,'max(1.4, 1.8), not 2.52');
  const k=powerGame();k.powerNodes.set('10,9','speed');hop(k);k.advance(3100);assert.equal(k.sped,false);hop(k);assert.equal(k.hop.duration,450);
});
test('Cherries: every set of two pays a 10-point bonus (not doubled) toward the goal',()=>{
  const g=powerGame(set({goal:12}));g.boostNode={x:10,y:9};hop(g);
  g.powerNodes.set('11,9','cherry');hop(g);assert.deepEqual([g.cherries,g.cherrySets,g.score],[1,0,0]);
  g.powerNodes.set('12,9','cherry');hop(g);assert.deepEqual([g.cherries,g.cherrySets,g.score,g.roundScore],[0,1,10,10]);
  assert.equal(g.pickups.at(-1).kind,'cherry');assert.equal(g.pickups.at(-1).points,10);
  g.nodes.set('13,9',1);hop(g);assert.equal(g.roundIndex,1,'bonus + a doubled 1 reaches 12');
});
test('the spawner places the new kinds by weight, one of each, never while its effect runs, within the limit',()=>{
  const only=kind=>set({spawner:{firstMs:500,everyMs:500,max:2,weights:{[kind]:1}}});
  for(const kind of ['expand','sweep','magnet','speed','cherry']){const g=powerGame(only(kind));g.advance(700);assert.ok(g.powerAt(kind),kind);}
  const m=powerGame(only('magnet'));m.powerNodes.clear();m.powerNodes.set('10,9','magnet');hop(m);m.powerNodes.clear();m.advance(1000);
  assert.equal(m.powerAt('magnet'),undefined,'not while the magnet is on');
  const all=powerGame(set({spawner:{firstMs:0,everyMs:300,max:3,weights:Object.fromEntries(POWER_KINDS.map(k=>[k,1]))}}));
  for(let i=0;i<20;i++){all.advance(300);assert.ok(all.powerNodes.size<=3);assert.equal(new Set(all.powerNodes.values()).size,all.powerNodes.size,'one of each');}
  const none=parseRoundSet({rounds:[round({goal:null,magnet:null,spawner:{firstMs:0,everyMs:300,max:3,weights:{magnet:1}}})]});
  const n=powerGame(none);n.advance(3000);assert.equal(n.powerNodes.size,0,'a kind without its settings never spawns');
  assert.deepEqual(unlockedKinds(all.round),POWER_KINDS);
});
test('a clear takes every powerup off the board, the next round spawns only its own kinds; settings from outside are clamped',()=>{
  const s=parseRoundSet({rounds:[round({goal:3,spawner:{firstMs:99999,everyMs:99999,max:2,weights:{magnet:1,sweep:1}}}),round({goal:null,spawner:{firstMs:500,everyMs:500,max:2,weights:{sweep:1}}})]});
  const g=powerGame(s);g.powerNodes.set('9,7','magnet');g.powerNodes.set('9,11','sweep');g.nodes.set('10,9',3);hop(g);
  assert.equal(g.roundIndex,1);assert.equal(g.powerNodes.size,0);
  g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:10,y:9});g.advance(400);assert.equal(g.powerNodes.size,0,'its timer counts from the placement');
  g.advance(200);assert.deepEqual([...g.powerNodes.values()],['sweep']);
  const c=parseRoundSet({rounds:[round({goal:null,expand:{cells:99},magnet:{ms:1,range:9},speed:{speed:9},cherry:{set:0,bonus:1e6}})]}).rounds[0];
  assert.deepEqual([c.expand.cells,c.magnet.ms,c.magnet.range,c.speed.speed,c.cherry.set,c.cherry.bonus],[5,500,4,3,1,100]);
});
