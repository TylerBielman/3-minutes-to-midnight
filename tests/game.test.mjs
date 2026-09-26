import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SHAPES,key,rotated,placementError,freshReach,chooseNext} from '../.test-build/runway.js';
import {Game,DEFAULTS,ringRadius} from '../.test-build/game.js';
const set=cells=>new Set(cells.map(([x,y])=>key({x,y})));
const shapeCells=id=>SHAPES.find(s=>s.id===id).cells;
function fixture(cells,at={x:9,y:9}){
 const g=new Game({seed:11,nodeCount:1});g.board=set(cells);g.at=at;g.visited=new Set([key(at)]);g.nodes.clear();return g;
}
test('sixteen connected authored shapes, no O, rotation preserves cells and returns after four taps',()=>{
 assert.equal(SHAPES.length,16);assert.equal(SHAPES.filter(s=>s.group==='common').length,6);
 for(const s of SHAPES){assert.equal(new Set(s.cells.map(key)).size,s.cells.length);assert.ok(!s.cells.some(c=>s.cells.some(d=>d.x===c.x+1&&d.y===c.y)&&s.cells.some(d=>d.x===c.x&&d.y===c.y+1)&&s.cells.some(d=>d.x===c.x+1&&d.y===c.y+1)));
 assert.equal(freshReach(new Set(s.cells.map(key)),new Set(),s.cells[0],{x:-1,y:-1}),s.cells.length);
 assert.deepEqual(rotated(s.cells,4),s.cells);assert.equal(rotated(s.cells,1).length,s.cells.length);}
});
test('placement rejects overlap, diagonal-only contact and board overflow; Ring is not a wall',()=>{
 const board=set([[4,4]]);
 assert.equal(placementError(board,[{x:4,y:4}],9),'RUNWAY OVERLAP');
 assert.equal(placementError(board,[{x:5,y:5}],9),'CONNECT TO THE RUNWAY');
 assert.equal(placementError(board,[{x:-1,y:0}],9),'OFF THE BOARD');
 assert.equal(placementError(board,[{x:5,y:4}],9),undefined);
 const g=fixture([[0,0]]);g.at={x:0,y:0};g.draft[0]={shapeId:'Dot',turns:0};assert.equal(g.place(0,{x:1,y:0}),undefined);
});
test('rotate reserves slot; failed placement does not refill or start clock; success does',()=>{
 const g=new Game({seed:9});g.draft[0]={shapeId:'L',turns:0};g.rotate(0);const before={...g.draft[0]};
 assert.equal(g.place(0,{x:9,y:9}),'RUNWAY OVERLAP');assert.deepEqual(g.draft[0],before);assert.equal(g.running,false);
 g.advance(5000);assert.equal(g.elapsed,0);
 g.draft[0]={shapeId:'Dot',turns:0};const slot=g.draft[0];assert.equal(g.place(0,{x:10,y:9}),undefined);
 assert.equal(g.running,true);assert.notEqual(g.draft[0],slot);assert.equal(g.placements,1);
});
test('greatest unique unvisited territory wins; incoming edge is not a normal U-turn',()=>{
 const board=set([[3,3],[3,4],[2,3],[1,3],[4,3],[5,3],[6,3],[6,2]]),visited=set([[3,3],[3,4]]);
 const result=chooseNext(board,visited,{x:3,y:3},{x:3,y:4},7);
 assert.deepEqual(result.next,{x:4,y:3});assert.deepEqual(result.weights.map(w=>w.weight),[4,2]);
});
test('loops count each reachable square once per exit and yield stable random ties',()=>{
 const board=set([[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]]),at={x:1,y:2};
 const a=chooseNext(board,new Set([key(at)]),at,undefined,42),b=chooseNext(board,new Set([key(at)]),at,undefined,42);
 assert.deepEqual(a,b);assert.deepEqual(a.weights.map(w=>w.weight),[7,7]);
});
test('forecast matches actual hops, dead end reverses, explored roads continue patrolling',()=>{
 const g=fixture([[9,9],[10,9],[11,9]]);g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:12,y:9});
 const preview=g.preview();assert.deepEqual(preview,[{x:9,y:9},{x:10,y:9},{x:11,y:9},{x:12,y:9}]);
 assert.deepEqual(g.preview(),preview);
 for(const expected of preview.slice(1)){g.advance(g.settings.hopMs);assert.deepEqual(g.at,expected);}
 g.advance(g.settings.hopMs);assert.deepEqual(g.at,{x:11,y:9});
 g.advance(g.settings.hopMs*4);assert.ok(!g.over);assert.ok(g.hop);
});
test('reverse queues for landing, updates forecast, then resumes exploration',()=>{
 const g=fixture([[9,9],[10,9],[11,9]]);g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:12,y:9});
 g.advance(100);const to={...g.hop.to};g.reverse();assert.deepEqual(g.hop.to,to);assert.equal(g.reverseQueued,true);
 assert.deepEqual(g.preview().slice(0,3),[{x:9,y:9},{x:10,y:9},{x:9,y:9}]);
 g.advance(350);assert.deepEqual(g.at,{x:10,y:9});assert.deepEqual(g.hop.to,{x:9,y:9});assert.equal(g.reverseQueued,false);
});
test('construction changes future route while airborne hop remains locked',()=>{
 const g=fixture([[9,9],[10,9],[11,9],[10,8]]);g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:12,y:9});
 const locked={...g.hop.to};assert.deepEqual(g.preview()[2],{x:11,y:9});
 g.draft[0]={shapeId:'I',turns:1};g.place(0,{x:10,y:4});assert.deepEqual(g.hop.to,locked);assert.deepEqual(g.preview()[2],{x:10,y:8});
 g.advance(g.settings.hopMs);assert.deepEqual(g.hop.to,{x:10,y:8});
});
test('node is collected only on landing, only once; replenishment includes explored runway',()=>{
 const g=fixture([[9,9]]);g.draft[0]={shapeId:'Dot',turns:0};g.nodes.set('10,9',5);g.place(0,{x:10,y:9});
 assert.equal(g.score,0);g.advance(449);assert.equal(g.score,0);g.advance(1);assert.equal(g.score,5);assert.equal(g.collected,1);assert.ok(!g.nodes.has('10,9'));
 const h=new Game({grid:9,nodeCount:20,seed:3});for(let y=0;y<9;y++)for(let x=0;x<9;x++)h.board.add(`${x},${y}`);
 h.nodes.clear();h.running=true;h.advance(1);assert.equal(h.nodes.size,20);assert.ok([...h.nodes.keys()].every(k=>h.board.has(k)));
});
test('Ring phases accelerate to zero; elapsed time starts on placement and roads survive death',()=>{
 const s={...DEFAULTS};assert.equal(ringRadius(0,s),9.25);assert.ok(Math.abs(ringRadius(60000,s)-9.25*5/6)<1e-8);assert.ok(Math.abs(ringRadius(140000,s)-9.25*4/9)<1e-8);assert.equal(ringRadius(180000,s),0);
 const g=fixture([[9,9],[10,9]]);g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:11,y:9});const road=[...g.board];g.advance(200000);
 assert.equal(g.over,true);assert.ok(g.elapsed<=180000);assert.deepEqual([...g.board],road);
});
test('navigation ignores Ring; large elapsed steps still detect death between landings',()=>{
 const g=fixture([[9,9],[10,9],[11,9],[12,9],[13,9],[14,9],[15,9],[16,9],[17,9]],{x:17,y:9});
 g.previous={x:16,y:9};g.visited=new Set(g.board);g.draft[0]={shapeId:'Dot',turns:0};g.place(0,{x:18,y:9});g.advance(60);assert.ok(!g.over);g.advance(10000);assert.equal(g.over,true);
});
test('deterministic draw groups approximate 65 / 15 / 20 and rotations do not advance random draws',()=>{
 const a=new Game({seed:19}),b=new Game({seed:19});a.running=b.running=true;a.rotate(0);a.discard(0);b.discard(0);assert.deepEqual(a.draft[0],b.draft[0]);
 const counts={common:0,small:0,large:0};for(let i=0;i<10000;i++){a.discard(0);counts[SHAPES.find(s=>s.id===a.draft[0].shapeId).group]++;}
 assert.ok(counts.common>6200&&counts.common<6800);assert.ok(counts.small>1300&&counts.small<1700);assert.ok(counts.large>1800&&counts.large<2200);
});
