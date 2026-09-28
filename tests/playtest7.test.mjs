import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,TUNING,nodeValue,moverSteps,ringRadius} from '../.test-build/game.js';
import {key,cell,randomStep} from '../.test-build/runway.js';
import {routeCrossesRing,reverseTipsWanted,noteReversal,TIPS_KEY} from '../.test-build/tips.js';

// Jerboa at 9,9 on a straight road east to 13,9; the Dot placement starts the run and his first hop is to 10,9.
function lineGame(settings={}){
  const g=new Game({seed:5,...settings});g.board=new Set(['9,9','10,9','11,9','12,9']);g.visited=new Set(['9,9']);g.nodes.clear();g.movers.clear();
  g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:13,y:9});return g;
}
const memory=()=>{const m=new Map();return {m,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
const chebyshev=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));

test('freeze pauses the x2 countdown: double bonus, and hops stay boosted throughout',()=>{
  const g=lineGame({boostMs:2000,freezeMs:3000,boostSpeed:1.5});
  g.boostNode={x:10,y:9};g.advance(g.settings.hopMs);assert.equal(g.boosted,true);assert.equal(g.doubleBonus,false);
  g.freezeNode={x:11,y:9};g.advance(g.hop.duration);assert.equal(g.frozen,true);assert.equal(g.doubleBonus,true);
  const left=g.boostLeft;assert.ok(left>0&&left<2000);
  for(let t=0;t<2900;t+=100){
    g.advance(100);assert.equal(g.boostLeft,left,'x2 waits while frozen');assert.equal(g.boosted,true);
    if(g.hop)assert.ok(Math.abs(g.hop.duration-g.settings.hopMs/1.5)<1e-9);
  }
  g.advance(200);assert.equal(g.frozen,false);assert.ok(g.boostLeft<left,'x2 resumes at the thaw');
  g.advance(left);assert.equal(g.boosted,false);assert.equal(g.doubleBonus,false);
});
test('x2 collected during a freeze starts counting down at the thaw',()=>{
  const g=lineGame({boostMs:2000,freezeMs:3000});
  g.freezeNode={x:10,y:9};g.advance(g.settings.hopMs);assert.equal(g.frozen,true);
  g.boostNode={x:11,y:9};g.advance(g.hop.duration);assert.equal(g.doubleBonus,true);assert.equal(g.boostLeft,2000);
  g.advance(g.freezeUntil-g.elapsed-50);assert.equal(g.boostLeft,2000);
  g.advance(100);assert.ok(g.boostLeft<2000);g.advance(2000);assert.equal(g.boosted,false);
});
test('x2 never respawns while a freeze has stretched the boost',()=>{
  const g=lineGame({boostMs:10000,freezeMs:10000});
  g.boostNode={x:10,y:9};g.advance(g.settings.hopMs);
  g.freezeNode={x:11,y:9};g.advance(g.hop.duration);assert.equal(g.doubleBonus,true);
  // The 15 s respawn delay passes while the boost still runs (10 s frozen + 10 s of live time).
  g.advance(TUNING.boostRespawnMs+1000);assert.equal(g.boosted,true);assert.equal(g.boostNode,undefined);
  g.advance(5000);assert.equal(g.boosted,false);g.advance(50);assert.ok(g.boostNode,'respawns once the boost ends');
});
test('radiusIn looks ahead on the Ring clock and waits out a freeze',()=>{
  const h=lineGame();assert.equal(h.radiusIn(0),h.radius);assert.ok(Math.abs(h.radiusIn(1000)-ringRadius(h.ringMs+1000,h.settings))<1e-12);
  const g=lineGame({freezeMs:5000});g.freezeNode={x:10,y:9};g.advance(g.settings.hopMs);
  const r=g.radius;assert.equal(g.radiusIn(0),r);assert.equal(g.radiusIn(4000),r);assert.ok(g.radiusIn(8000)<r);
});
test('a rare 10 joins the node values and grows likelier each phase',()=>{
  assert.deepEqual(TUNING.nodeValues,[1,2,3,4,5,10]);assert.equal(TUNING.mover.value,10);
  const counts=[1,2,3].map(phase=>{const c=new Map();let r={state:7};for(let i=0;i<40000;i++){r=randomStep(r.state);const v=nodeValue(phase,r.value);c.set(v,(c.get(v)??0)+1);}return c;});
  for(const c of counts){assert.ok(c.get(10)>0);assert.ok(c.get(10)<c.get(5),'rarer than a 5');}
  assert.ok(counts[0].get(10)<counts[1].get(10)&&counts[1].get(10)<counts[2].get(10));
});
test('mover steps: four neighbours, on the board, within range of home',()=>{
  const all=()=>true;
  assert.deepEqual(moverSteps({x:5,y:5},{x:5,y:5},1,19,all),[{x:5,y:4},{x:6,y:5},{x:5,y:6},{x:4,y:5}]);
  assert.deepEqual(moverSteps({x:6,y:5},{x:5,y:5},1,19,all),[{x:6,y:4},{x:6,y:6},{x:5,y:5}]);
  assert.deepEqual(moverSteps({x:0,y:0},{x:0,y:0},1,19,all),[{x:1,y:0},{x:0,y:1}]);
  assert.deepEqual(moverSteps({x:5,y:5},{x:5,y:5},1,19,p=>p.x!==6),[{x:5,y:4},{x:5,y:6},{x:4,y:5}]);
});
test('a 10 wanders one cell around home, onto free cells inside the Ring, and only once the run has started',()=>{
  const g=new Game({seed:11,nodeCount:1});g.nodes.clear();g.movers.clear();
  const home={x:10,y:8};g.addNode(home,10);assert.ok(g.movers.has('10,8'));
  g.advance(10000);assert.ok(g.movers.has('10,8'),'nothing moves before the first placement');
  // Running, standing still at 9,9 (no road to hop to), so only the mover and the powerups change.
  g.running=true;
  let prev='10,8',moves=0;const c=(g.settings.grid-1)/2;
  for(let t=0;t<120000;t+=50){
    g.advance(50);
    const keys=[...g.movers.keys()];assert.equal(keys.length,1);const k=keys[0],p=cell(k);
    assert.equal(g.nodes.get(k),10);assert.ok(chebyshev(p,home)<=1,`left home: ${k}`);assert.notEqual(k,'9,9');
    if(g.boostNode)assert.notEqual(k,key(g.boostNode));if(g.freezeNode)assert.notEqual(k,key(g.freezeNode));
    assert.ok(Math.hypot(p.x-c,p.y-c)+TUNING.nodeRadius<g.radius);
    if(k!==prev){moves++;const q=cell(prev);assert.equal(Math.abs(p.x-q.x)+Math.abs(p.y-q.y),1,'one orthogonal step');assert.equal(g.movers.get(k).from.x,q.x);prev=k;}
  }
  assert.ok(moves>=45&&moves<=65,`about one step every 2 s: ${moves}`);
  assert.equal(g.events.filter(e=>e.type==='node-move').length,moves);
});
test('a 10 never leaves the cell he is hopping to, and pays 10, or 20 with x2',()=>{
  const g=lineGame();assert.deepEqual(g.hop.to,{x:10,y:9});
  g.addNode({x:10,y:9},10);g.movers.get('10,9').nextMoveAt=0;
  g.advance(100);assert.ok(g.movers.has('10,9'),'due to step, but he is hopping onto it');
  g.advance(g.hop.duration-g.hop.elapsed);assert.equal(g.score,10);assert.equal(g.moversCollected,1);assert.ok(!g.movers.has('10,9'));
  const h=lineGame();h.boostNode={x:10,y:9};h.addNode({x:11,y:9},10);h.movers.get('11,9').nextMoveAt=Infinity;
  h.advance(h.settings.hopMs);assert.equal(h.boosted,true);assert.deepEqual(h.hop.to,{x:11,y:9});
  h.movers.get('11,9').nextMoveAt=0;h.advance(h.hop.duration);assert.equal(h.score,20);
});
test('movers stand still while frozen and when boxed in',()=>{
  const g=lineGame({freezeMs:5000});g.freezeNode={x:10,y:9};g.advance(g.settings.hopMs);assert.equal(g.frozen,true);
  g.addNode({x:4,y:4},10);g.movers.get('4,4').nextMoveAt=0;g.advance(4000);assert.ok(g.movers.has('4,4'),'frozen');
  g.advance(1500);assert.ok(!g.movers.has('4,4'),'steps after the thaw');
  const h=new Game({seed:4,nodeCount:1});h.nodes.clear();h.running=true;
  h.addNode({x:12,y:8},10);for(const p of ['12,7','13,8','12,9','11,8'])h.nodes.set(p,1);
  h.movers.get('12,8').nextMoveAt=0;h.advance(100);assert.ok(h.movers.has('12,8'),'boxed in');assert.ok(h.movers.get('12,8').nextMoveAt>h.liveMs,'tries again later');
});
test('collection and the Ring leave no mover state behind, and movers draw from their own random stream',()=>{
  const g=lineGame();g.addNode({x:10,y:9},10);g.advance(g.settings.hopMs);assert.ok(!g.movers.has('10,9'));
  g.nodes.set('10,9',3);assert.ok(!g.movers.has('10,9'),'a later node on that cell stays still');
  const h=new Game({seed:6});h.running=true;h.nodes.clear();h.movers.clear();h.addNode({x:1,y:9},10);
  h.ringMs=40000;h.advance(20);assert.ok(!h.nodes.has('1,9'));assert.ok(!h.movers.has('1,9'),'swallowed by the Ring');
  const a=new Game({seed:3}),b=new Game({seed:3});a.addNode({x:2,y:2},10);b.addNode({x:2,y:2},3);
  assert.equal(a.nodeRng,b.nodeRng);assert.notEqual(a.moverRng,b.moverRng);
});
test('the same seed and actions move the 10s the same way',()=>{
  const run=()=>{const g=lineGame({seed:21});g.addNode({x:6,y:6},10);g.addNode({x:12,y:12},10);g.advance(60000);
    return JSON.stringify([[...g.nodes].sort(),[...g.movers.keys()].sort(),g.events.filter(e=>e.type==='node-move')]);};
  const a=run();assert.equal(run(),a);assert.ok(a.includes('node-move'));
});
test('the danger flash finds where his route meets the Ring, within the lookahead',()=>{
  const out=[{x:9,y:9},{x:10,y:9},{x:11,y:9},{x:12,y:9},{x:13,y:9},{x:14,y:9}];
  assert.equal(routeCrossesRing(out,9,()=>3.5,.1),4);
  assert.equal(routeCrossesRing(out,9,()=>3.5,.1,3),-1,'beyond the lookahead');
  assert.equal(routeCrossesRing([{x:9,y:9},{x:10,y:9},{x:9,y:9}],9,()=>3.5,.1),-1,'he turns back first');
  assert.equal(routeCrossesRing(out,9,()=>4.05,.1),4);assert.equal(routeCrossesRing(out,9,()=>4.05,0),-1,'hit radius counts');
  assert.equal(routeCrossesRing(out,9,i=>6-i,.1),3,'the Ring keeps closing hop by hop');
  assert.equal(routeCrossesRing([{x:9,y:9}],9,()=>1,.1),-1);
});
test('reverse tips stop after reversals in two runs, count each run once and survive broken storage',()=>{
  const s=memory();assert.equal(reverseTipsWanted(s),true);
  assert.equal(noteReversal(s,'a'),1);assert.equal(noteReversal(s,'a'),1);assert.equal(reverseTipsWanted(s),true);
  assert.equal(noteReversal(s,'b'),2);assert.equal(reverseTipsWanted(s),false);assert.equal(noteReversal(s,'c'),2);
  assert.deepEqual(JSON.parse(s.m.get(TIPS_KEY)).runs,['a','b']);
  const broken={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('full');}};
  assert.equal(reverseTipsWanted(broken),true);assert.doesNotThrow(()=>noteReversal(broken,'a'));
  s.m.set(TIPS_KEY,'not json');assert.equal(reverseTipsWanted(s),true);
  assert.equal(reverseTipsWanted(undefined),true);assert.equal(noteReversal(undefined,'a'),0);
});
