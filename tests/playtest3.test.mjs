import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,DEFAULTS,TUNING,ringBeats,nodeValue} from '../.test-build/game.js';
import {key,randomStep} from '../.test-build/runway.js';
const dot=(g,x,y)=>{g.draft[0]={shapeId:'Dot',turns:0};assert.equal(g.place(0,{x,y}),undefined);};
function lineGame(settings={}){
  const g=new Game({seed:5,...settings});g.board=new Set(['9,9','10,9','11,9','12,9']);g.visited=new Set(['9,9']);g.nodes.clear();
  g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:13,y:9});return g;
}

test('discard is locked until the first placement starts the clock',()=>{
  const g=new Game({seed:3}),before=JSON.stringify(g.draft);
  assert.equal(g.discard(0),false);assert.equal(JSON.stringify(g.draft),before);assert.equal(g.discards,0);
  dot(g,10,9);assert.equal(g.discard(1),true);assert.equal(g.discards,1);
});
test('starting board holds at least two 5s (guaranteed) among the opening nodes',()=>{
  for(let seed=1;seed<40;seed++){const g=new Game({seed});assert.equal([...g.nodes.values()].filter(v=>v===5).length>=2,true);assert.equal(g.nodes.size,DEFAULTS.nodeCount);}
  assert.equal([...new Game({seed:7,nodeCount:1}).nodes.values()][0],5);
});
test('node values span 1-5 and 10; each phase shifts the mix toward 5s',()=>{
  const counts=[1,2,3].map(phase=>{const c={1:0,2:0,3:0,4:0,5:0,10:0};let r={state:99};for(let i=0;i<20000;i++){r=randomStep(r.state);c[nodeValue(phase,r.value)]++;}return c;});
  for(const c of counts)for(const v of [1,2,3,4,5,10])assert.ok(c[v]>0);
  assert.ok(counts[0][5]<counts[0][1]/3,'5s are rare in phase 1');
  assert.ok(counts[0][1]>counts[1][1]&&counts[1][1]>counts[2][1],'fewer 1s each phase');
  assert.ok(counts[0][5]<counts[1][5]&&counts[1][5]<counts[2][5],'more 5s each phase');
});
test('Ring heartbeat quickens each phase and is continuous across phase changes',()=>{
  const s={...DEFAULTS},starts=[0,60000,140000];
  const rate=p=>(ringBeats(starts[p-1]+20000,s)-ringBeats(starts[p-1]+10000,s))/10;
  assert.ok(rate(1)<rate(2)&&rate(2)<rate(3));
  for(const t of starts.slice(1))assert.ok(Math.abs(ringBeats(t+1e-6,s)-ringBeats(t-1e-6,s))<1e-6);
  assert.equal(ringBeats(0,s),0);assert.ok(Math.abs(ringBeats(60000,s)-60000/TUNING.ringPulseMs[0])<1e-9);
});
test('x2 spawns after the opening delay, speeds hops and doubles points for its duration',()=>{
  const g=lineGame();
  assert.equal(g.boostNode,undefined);g.advance(TUNING.boostFirstMs-100);assert.equal(g.boostNode,undefined);
  g.advance(200);assert.ok(g.boostNode);assert.ok(!g.nodes.has(key(g.boostNode)));
  // Put the x2 and a point node on his path.
  const h=lineGame({boostSpeed:1.5,boostMs:2000});h.boostNode={x:10,y:9};h.nodes.set('11,9',3);
  h.advance(h.settings.hopMs);assert.equal(h.boosted,true);assert.equal(h.boosts,1);assert.equal(h.boostNode,undefined);
  assert.ok(Math.abs(h.hop.duration-h.settings.hopMs/1.5)<1e-9);
  h.advance(h.hop.duration);assert.equal(h.score,6);assert.deepEqual(h.pickups.map(p=>[p.kind,p.points,p.boosted]),[['boost',0,true],['point',6,true]]);
  h.advance(2500);assert.equal(h.boosted,false);h.nodes.set(key(h.hop.to),4);const before=h.score;h.advance(h.hop.duration);assert.equal(h.score,before+4);
});
test('x2 never spawns while boosted and respawns after collection',()=>{
  const g=lineGame({boostMs:20000});g.boostNode={x:10,y:9};g.advance(g.settings.hopMs);assert.equal(g.boosted,true);
  g.advance(19000);assert.equal(g.boostNode,undefined);
  g.advance(1500);assert.equal(g.boosted,false);assert.ok(g.boostNode,'respawn delay already elapsed');
});
test('freeze stops the Ring and its clock for its duration, then the Ring resumes',()=>{
  const g=lineGame({freezeMs:3000});g.freezeNode={x:10,y:9};
  g.advance(g.settings.hopMs);assert.equal(g.frozen,true);assert.equal(g.freezes,1);assert.equal(g.freezeNode,undefined);
  const radius=g.radius,ring=g.ringMs,phase=g.phase;g.advance(2900);
  assert.equal(g.radius,radius);assert.equal(g.ringMs,ring);assert.equal(g.phase,phase);
  g.advance(200);assert.equal(g.frozen,false);assert.ok(g.radius<radius);assert.ok(g.ringMs>ring);
  assert.ok(Math.abs(g.elapsed-g.ringMs-3000)<=TUNING.simulationStep,'ring clock lags real time by the freeze');
});
test('freeze spawns after its opening delay, not while frozen, and never on top of x2',()=>{
  const g=lineGame({freezeMs:30000});g.advance(TUNING.freezeFirstMs+50);assert.ok(g.freezeNode);
  if(g.boostNode)assert.notDeepEqual(g.boostNode,g.freezeNode);
  const h=lineGame({freezeMs:30000});h.freezeNode={x:10,y:9};h.advance(h.settings.hopMs);
  h.advance(TUNING.freezeRespawnMs+100);assert.equal(h.freezeNode,undefined,'still frozen, no respawn');
});
test('defaults: x2 lasts 7 seconds and freeze lasts 6 seconds',()=>{
  assert.equal(DEFAULTS.boostMs,7000);assert.equal(DEFAULTS.freezeMs,6000);
});
test('powerups spawn safely inside the Ring, not on its edge',()=>{
  const safe=(g,p)=>{const c=(g.settings.grid-1)/2;return Math.hypot(p.x-c,p.y-c)+TUNING.nodeRadius<g.radius-TUNING.powerupRingMargin+.05;};
  for(let seed=1;seed<30;seed++){const g=new Game({seed,duration:60});g.board=new Set(['9,9','10,9']);g.running=true;
    g.advance(TUNING.boostFirstMs+20);assert.ok(g.boostNode&&safe(g,g.boostNode),`x2 seed ${seed}`);
    g.advance(TUNING.freezeFirstMs-TUNING.boostFirstMs);assert.ok(g.freezeNode&&safe(g,g.freezeNode),`freeze seed ${seed}`);}
});
