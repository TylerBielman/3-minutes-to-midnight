import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,DEFAULTS,TUNING,classicSet,classicRound,ringRadius,phaseAt,ringBeats,nodeValue} from '../.test-build/game.js';
import {NODE_VALUES,parseRoundSet,roundRadius,roundPhaseAt,roundBeats,pickValue} from '../.test-build/rounds.js';

const pace=r=>r.phases.reduce((a,p)=>a+p.fraction*p.speed,0);
const round=(extra={})=>({name:'R',goal:20,duration:60,hopMs:400,nodeCount:8,openingFives:1,
  phases:[{fraction:.5,speed:1,pulseMs:900,weights:[10,10,10,10,10,1]},{fraction:.5,speed:1,pulseMs:600,weights:[1,1,1,1,1,1]}],
  boost:{firstMs:5000,respawnMs:10000,ms:5000,speed:1.5},freeze:null,...extra});

test('Classic is one round with no goal, built from the settings and TUNING',()=>{
  const set=classicSet(DEFAULTS),r=set.rounds[0];
  assert.equal(set.id,'classic');assert.equal(set.rounds.length,1);assert.equal(r.goal,null);
  assert.equal(r.duration,DEFAULTS.duration);assert.equal(r.hopMs,DEFAULTS.hopMs);assert.equal(r.nodeCount,DEFAULTS.nodeCount);assert.equal(r.openingFives,TUNING.startingFives);
  assert.deepEqual(r.phases.map(p=>[p.fraction,p.speed,p.pulseMs,p.weights]),TUNING.phaseFractions.map((f,i)=>[f,TUNING.phaseSpeeds[i],TUNING.ringPulseMs[i],TUNING.phaseValueWeights[i]]));
  assert.deepEqual(r.boost,{firstMs:TUNING.boostFirstMs,respawnMs:TUNING.boostRespawnMs,ms:DEFAULTS.boostMs,speed:DEFAULTS.boostSpeed});
  assert.deepEqual(r.freeze,{firstMs:TUNING.freezeFirstMs,respawnMs:TUNING.freezeRespawnMs,ms:DEFAULTS.freezeMs});
  assert.ok(Math.abs(pace(r)-1)<1e-12);assert.deepEqual(NODE_VALUES,TUNING.nodeValues);
  const tuned=classicRound({...DEFAULTS,duration:60,hopMs:300,nodeCount:4});assert.deepEqual([tuned.duration,tuned.hopMs,tuned.nodeCount],[60,300,4]);
});
test('the Classic helpers and the round functions agree exactly',()=>{
  for(const s of [DEFAULTS,{...DEFAULTS,duration:60,grid:15}]){
    const r=classicRound(s);
    for(let ms=-500;ms<=s.duration*1000+500;ms+=137.3){
      assert.equal(ringRadius(ms,s),roundRadius(ms,s.grid,r));assert.equal(phaseAt(ms,s),roundPhaseAt(ms,r));assert.equal(ringBeats(ms,s),roundBeats(ms,r));
    }
  }
  for(let roll=0;roll<1;roll+=.0137)for(const phase of [0,1,2,3,4])assert.equal(nodeValue(phase,roll),pickValue(TUNING.phaseValueWeights[Math.max(1,Math.min(3,phase))-1],roll));
  const g=new Game({seed:9});assert.equal(g.set.id,'classic');assert.equal(g.radius,ringRadius(0,g.settings));assert.equal(g.ringLeftMs,180000);
});
test('a game plays the round it is given: its hop speed, node count, opening 5s and powerups',()=>{
  const set=parseRoundSet({id:'t',name:'Test',rounds:[round(),round({goal:null})]});
  const g=new Game({seed:3},set);assert.equal(g.round.nodeCount,8);assert.equal(g.nodes.size,8);
  assert.equal([...g.nodes.values()].filter(v=>v===5).length>=1,true);
  g.board=new Set(['9,9','10,9']);g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:11,y:9});
  assert.equal(g.hop.duration,400);assert.equal(g.ringLeftMs,60000);
  g.advance(5100);assert.ok(g.boostNode,'x2 on the round timer');assert.equal(g.freezeNode,undefined);
  g.advance(30000);assert.equal(g.freezeNode,undefined,'this round has no freeze');
});
test('round sets from outside are clamped, normalized, and never end on a goal',()=>{
  for(const bad of [null,7,'x',{},{rounds:[]},{rounds:Array(13).fill(round())},{rounds:[{...round(),phases:[]}]},
    {rounds:[round({phases:[{fraction:1,speed:1,pulseMs:900,weights:[1,2,3]}]})]},
    {rounds:[round({phases:[{fraction:1,speed:1,pulseMs:900,weights:[0,0,0,0,0,0]}]})]},{rounds:[null]}])
    assert.equal(parseRoundSet(bad),null,JSON.stringify(bad)?.slice(0,60));
  const set=parseRoundSet({id:'my set!',rounds:[round({duration:5,hopMs:5,nodeCount:99,goal:-4,phases:[
    {fraction:2,speed:3,pulseMs:50,weights:[1,0,0,0,0,-5]},{fraction:2,speed:1,pulseMs:9000,weights:[0,0,0,0,1,0]}]}),round({goal:40})]});
  const [a,b]=set.rounds;
  assert.equal(set.id,'my-set-');assert.equal(set.name,'Custom rounds');
  assert.deepEqual([a.duration,a.hopMs,a.nodeCount,a.goal],[15,120,20,1]);assert.equal(b.goal,null,'the last round ends in capture');
  assert.deepEqual(a.phases.map(p=>p.fraction),[.5,.5]);assert.ok(Math.abs(pace(a)-1)<1e-12,'the Ring still closes on time');
  assert.deepEqual(a.phases.map(p=>p.pulseMs),[200,3000]);assert.deepEqual(a.phases[0].weights,[1,0,0,0,0,0]);
  assert.equal(roundRadius(a.duration*1000,19,a),0);assert.ok(roundRadius(a.duration*1000-100,19,a)>0);
  assert.equal(parseRoundSet({rounds:[round({boost:{},freeze:'no'})]}).rounds[0].freeze,null);
});
