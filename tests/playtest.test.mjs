import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../.test-build/game.js';
import {SHAPES,key,freshReach} from '../.test-build/runway.js';
import {gestureMode,downwardSwipe} from '../.test-build/input.js';
import {runReport,readHistory,saveReport,exportHistory,HISTORY_KEY} from '../.test-build/stats.js';
const dot=(g,x,y)=>{g.draft[0]={shapeId:'Dot',turns:0};assert.equal(g.place(0,{x,y}),undefined);};

test('Step is three vertical squares, one across, one up; W replaces the other short zigzag',()=>{
  assert.ok(!SHAPES.some(s=>['S','Z'].includes(s.id)));
  assert.deepEqual(SHAPES.find(s=>s.id==='Step').cells.map(key).sort(),['0,1','0,2','0,3','1,0','1,1']);
  assert.equal(SHAPES.find(s=>s.id==='W').cells.length,5);
  assert.deepEqual(SHAPES.find(s=>s.id==='Line3').cells,[{x:0,y:0},{x:1,y:0},{x:2,y:0}]);
});
test('downward discard is easy to arm, sideways does not discard, dragging cannot become discard',()=>{
  assert.equal(gestureMode('pending',5,31),'discard');assert.equal(downwardSwipe(5,31),true);
  assert.equal(gestureMode('pending',70,4),'pending');assert.equal(downwardSwipe(70,4),false);
  assert.equal(gestureMode('pending',3,-25),'drag');assert.equal(gestureMode('drag',0,90),'drag');
  assert.equal(gestureMode('discard',0,0),'discard');assert.equal(downwardSwipe(0,0),false);
});
test('retirement preserves current hop and all connections, then removes oldest eligible tail on placement',()=>{
  const g=new Game({roadLimit:4});for(let x=10;x<=13;x++)dot(g,x,9);
  assert.equal(g.board.size,5);assert.equal(g.removedSquares,0);assert.deepEqual(g.hop.to,{x:10,y:9});
  g.advance(900);dot(g,14,9);
  assert.deepEqual([...g.board],['11,9','12,9','13,9','14,9']);assert.equal(g.removedSquares,2);
  assert.ok(g.board.has(key(g.hop.from)));assert.ok(g.board.has(key(g.hop.to)));
  assert.equal(freshReach(g.board,new Set(),g.at,{x:-1,y:-1}),g.board.size);
  assert.ok(!g.visited.has('9,9'));assert.ok(!g.visited.has('10,9'));
  const forecast=g.preview();g.advance(g.settings.hopMs);assert.deepEqual(g.at,forecast[1]);
});
test('retirement removes whole pieces and skips an old bridge rather than disconnecting road',()=>{
  const g=new Game({roadLimit:4});g.draft[0]={shapeId:'I',turns:0};g.place(0,{x:10,y:9});
  g.advance(1800);dot(g,13,8); // At far end, in-flight return protects the I.
  assert.ok(g.pieces.some(p=>p.shapeId==='I'));assert.ok(g.board.size>4);
  g.reverse();g.advance(900); // At the branch, next hop goes up.
  g.advance(450);dot(g,13,7);
  assert.ok(g.board.has(key(g.at)));assert.ok(g.board.has(key(g.hop.to)));
  // A separate leaf I may be removed in its entirety while the hop stays in the seed branch.
  const h=new Game({roadLimit:6});h.draft[0]={shapeId:'I',turns:0};h.place(0,{x:10,y:9});
  h.advance(900);h.reverse();h.advance(1350); // Back at start heading right; redirect only on landing.
  // Check whole-piece behavior with explicit safe actor state on the start.
  h.at={x:9,y:9};h.hop=undefined;h.previous=undefined;
  dot(h,9,8);dot(h,9,7);
  assert.equal(h.removedSquares,4);assert.equal(h.removedPieces,1);
  assert.ok(!h.pieces.some(p=>p.shapeId==='I'));assert.ok(h.board.has('9,9'));
});
test('unlimited mode retains all road and illegal placement never triggers retirement',()=>{
  const g=new Game({roadLimit:0});for(let x=10;x<=18;x++)dot(g,x,9);
  assert.equal(g.board.size,10);assert.equal(g.removedSquares,0);
  const before=[...g.board];g.settings.roadLimit=2;g.draft[0]={shapeId:'Dot',turns:0};
  assert.equal(g.place(0,{x:9,y:9}),'RUNWAY OVERLAP');assert.deepEqual([...g.board],before);
});
test('forgiving footprint survives a corner which catches original footprint, but still captures at contact',()=>{
  const a=new Game({hitRadius:.1}),b=new Game({hitRadius:.24});
  for(const g of [a,b]){g.at={x:15,y:15};g.board=new Set([key(g.at)]);g.running=true;g.elapsed=22000;g.advance(1);}
  assert.equal(a.over,false);assert.equal(b.over,true);a.advance(10000);assert.equal(a.over,true);
});
test('run reports preserve actionable counters, events and settings without mutating simulation',()=>{
  const g=new Game({seed:42});g.rotate(0);dot(g,10,9);g.discard(0);g.advance(100);g.reverse();g.advance(350);
  g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:9,y:9});
  const r=runReport(g,'id','2026-09-25T00:00:00Z','active');
  assert.equal(r.rotations,1);assert.equal(r.discards,1);assert.equal(r.reversals,1);assert.equal(r.hops,1);assert.equal(r.invalidDrops,1);
  assert.ok(r.events.some(e=>e.type==='hop'));assert.equal(r.settings.roadLimit,25);
  const parsed=JSON.parse(exportHistory([r]));assert.deepEqual(parsed.runs[0],r);
  g.rotate(0);assert.equal(r.events.length,g.events.length-1);
});
test('history upserts run ID, caps retention, survives corrupt and unavailable storage, reduces on quota',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const g=new Game(),report=id=>runReport(g,id,'2026-09-25T00:00:00Z','caught');
  data.set(HISTORY_KEY,'broken');assert.deepEqual(readHistory(storage),[]);
  for(let i=0;i<55;i++)assert.equal(saveReport(storage,report(String(i))),true);
  assert.equal(readHistory(storage).length,50);saveReport(storage,{...report('54'),score:5});
  assert.equal(readHistory(storage).length,50);assert.equal(readHistory(storage)[0].score,5);
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.deepEqual(readHistory(blocked),[]);assert.equal(saveReport(blocked,report('new')),false);
  const quota={...storage,setItem(k,v){if(JSON.parse(v).length>2)throw Error('quota');data.set(k,v);}};
  assert.equal(saveReport(quota,report('new')),true);assert.equal(readHistory(storage).length,2);
});
