import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,DEFAULTS,TUNING,ringRadius,phaseAt,shapeLength} from '../.test-build/game.js';
import {SHAPES,key} from '../.test-build/runway.js';

test('phases run 60 / 80 / 40 s, the Ring closes exactly on time, and phase 3 is the fastest',()=>{
  const s={...DEFAULTS};
  assert.ok(Math.abs(TUNING.phaseFractions.reduce((a,f,i)=>a+f*TUNING.phaseSpeeds[i],0)-1)<1e-12);
  assert.equal(phaseAt(59999,s),1);assert.equal(phaseAt(60000,s),2);assert.equal(phaseAt(139999,s),2);assert.equal(phaseAt(140000,s),3);
  assert.equal(ringRadius(180000,s),0);assert.ok(ringRadius(179000,s)>0);
  const speed=(a,b)=>(ringRadius(a,s)-ringRadius(b,s))/(b-a);
  assert.ok(speed(150000,160000)>speed(10000,20000)*3,'phase 3 closes much faster than phase 1');
  assert.ok(speed(150000,160000)>1.5/.875*speed(80000,90000)*.99,'phase 3 is faster than phase 2');
});
test('pieces longer than the Ring is wide are never dealt, down to single squares',()=>{
  const g=new Game({seed:4});g.running=true;
  for(const ms of [0,150000,160000,170000,176000]){
    g.ringMs=ms;const max=g.maxPieceLength;
    for(let i=0;i<300;i++){assert.equal(g.discard(0),true);assert.ok(shapeLength(g.draft[0].shapeId)<=max,`${g.draft[0].shapeId} at ${ms}`);}
  }
  g.ringMs=179500;assert.equal(g.maxPieceLength,1);g.discard(0);assert.equal(g.draft[0].shapeId,'Dot');
});
test('draft pieces that outgrow the Ring are swapped, except the one being dragged',()=>{
  const g=new Game({seed:8});g.running=true;g.draft=[{shapeId:'Long',turns:0},{shapeId:'Long',turns:1},{shapeId:'Dot',turns:0}];
  assert.deepEqual(g.replaceOutgrown(),[]);
  g.ringMs=165000;assert.ok(g.maxPieceLength<6);
  assert.deepEqual(g.replaceOutgrown(1),[0]);assert.notEqual(g.draft[0].shapeId,'Long');assert.equal(g.draft[1].shapeId,'Long');
  assert.deepEqual(g.replaceOutgrown(),[1]);assert.equal(g.draft[2].shapeId,'Dot');
});
test('runway cap shrinks with the Ring in the endgame and never below the minimum',()=>{
  const g=new Game();assert.equal(g.roadLimit,25);
  g.ringMs=100000;assert.equal(g.roadLimit,25);
  g.ringMs=150000;assert.ok(g.roadLimit<25&&g.roadLimit>TUNING.minRoadLimit);
  g.ringMs=178000;assert.equal(g.roadLimit,TUNING.minRoadLimit);
  assert.equal(new Game({roadLimit:0}).roadLimit,0);
});
test('endgame placement retires road outside the Ring first, then the oldest',()=>{
  const g=new Game({seed:2,roadLimit:25});g.running=true;g.nodes.clear();
  // A long straight road through the start; the jerboa sits in the middle.
  g.board=new Set();g.pieces=[];
  for(let x=2;x<=16;x++){const c={x,y:9};g.board.add(key(c));g.pieces.push({cells:[c],shapeId:'Dot'});}
  g.at={x:9,y:9};g.hop=undefined;g.previous=undefined;g.ringMs=150000; // radius ~3.1: x<=5 and x>=13 are outside
  const limit=g.roadLimit;g.draft[0]={shapeId:'Dot',turns:0};assert.equal(g.place(0,{x:9,y:8}),undefined);
  assert.ok(g.board.size<=limit);
  const c=(g.settings.grid-1)/2;
  for(const p of g.lastRemoved)assert.ok(Math.hypot(p.x-c,p.y-c)>=g.radius,`removed inside cell ${key(p)}`);
  assert.ok(g.board.has('9,9')&&g.board.has('9,8'));
});
test('large pool adds V5, T5 and Y as the chart shows them',()=>{
  const cells=id=>SHAPES.find(s=>s.id===id).cells.map(key).sort();
  assert.deepEqual(cells('V5'),['0,0','0,1','0,2','1,2','2,2']);
  assert.deepEqual(cells('T5'),['0,0','1,0','1,1','1,2','2,0']);
  assert.deepEqual(cells('Y'),['0,1','1,0','1,1','1,2','1,3']);
  assert.deepEqual(SHAPES.filter(s=>s.group==='large').map(s=>s.id),['Long','Cup','Cross','V5','T5','Y']);
  assert.equal(shapeLength('V5'),3);assert.equal(shapeLength('T5'),3);assert.equal(shapeLength('Y'),4);
});
