// Golden replay: a deterministic bot plays whole Classic runs through the public API, and the outcome must match the
// recorded snapshot exactly. It guards refactors that must not change ranked play (Playtest 7 plan, Stage 2 onward).
// After an intended gameplay change, rewrite the snapshot with UPDATE_GOLDEN=1 npm test and say why in the commit.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {Game} from '../.test-build/game.js';
import {key,placementError} from '../.test-build/runway.js';
import {routeCrossesRing} from '../.test-build/tips.js';

const GOLDEN=new URL('./golden/replay-v1.json',import.meta.url);
// Uneven frame times, including long stalls, so slicing and catch-up are exercised too.
const STEPS=[16,17,33,7,250,16,1000];
const CASES={
  'seed 1':{seed:1},'seed 42':{seed:42},'seed 12345':{seed:12345},
  'tuned: 60 s, fast hops, 15 grid, 3 slots, no road limit':{seed:7,duration:60,hopMs:300,grid:15,slots:3,roadLimit:0},
};

function fnv(text){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16);}

/** Every 700 ms of play: place the first slot that fits at the legal origin that keeps the piece closest to the board's
 *  centre (so runs reach the endgame); otherwise rotate, and after four rotations discard. Reverse when his route meets
 *  the Ring 2+ hops ahead. */
function play(settings){
  const g=new Game(settings),grid=g.settings.grid,center=(grid-1)/2;
  let nextAction=0,rotations=0,frame=0;
  const origins=[];for(let y=-5;y<grid;y++)for(let x=-5;x<grid;x++)origins.push({x,y});
  const reach=cells=>Math.max(...cells.map(p=>Math.hypot(p.x-center,p.y-center)));
  const tryPlace=()=>{
    for(let slot=0;slot<g.draft.length;slot++){
      let best=null,bestReach=Infinity;
      for(const o of origins){const cells=g.cells(slot,o);if(placementError(g.board,cells,grid))continue;const r=reach(cells);if(r<bestReach){best=o;bestReach=r;}}
      if(best)return g.place(slot,best)===undefined;
    }
    return false;
  };
  while(!g.over&&frame<20000){
    if(!g.running||g.elapsed>=nextAction){
      nextAction=g.elapsed+700;
      if(tryPlace())rotations=0;else if(rotations<4){g.rotate(0);rotations++;}else{g.discard(0);rotations=0;}
      const left=g.hop?g.hop.duration-g.hop.elapsed:0,each=g.hop?.duration??g.settings.hopMs;
      if(!g.reverseQueued&&routeCrossesRing(g.preview(),center,i=>g.radiusIn(left+(i-1)*each),g.settings.hitRadius)>=2)g.reverse();
    }
    g.advance(STEPS[frame++%STEPS.length]);
  }
  return {score:g.score,collected:g.collected,hops:g.hops,placements:g.placements,rotations:g.rotations,discards:g.discards,
    reversals:g.reversals,boosts:g.boosts,freezes:g.freezes,nearMisses:g.nearMisses,moversCollected:g.moversCollected,
    removedSquares:g.removedSquares,over:g.over,elapsed:g.elapsed,ringMs:g.ringMs,at:key(g.at),
    board:[...g.board].sort(),nodes:[...g.nodes].sort(),events:g.events.length,eventsHash:fnv(JSON.stringify(g.events))};
}

test('golden replay: whole Classic runs play out exactly as recorded',()=>{
  const actual=Object.fromEntries(Object.entries(CASES).map(([name,settings])=>[name,play(settings)]));
  for(const run of Object.values(actual)){assert.equal(run.over,true,'every run ends in capture');assert.ok(run.placements>5&&run.hops>50);}
  if(process.env.UPDATE_GOLDEN){mkdirSync(new URL('./golden/',import.meta.url),{recursive:true});writeFileSync(GOLDEN,JSON.stringify(actual,null,1)+'\n');return;}
  assert.ok(existsSync(GOLDEN),'No golden file: run UPDATE_GOLDEN=1 npm test');
  const expected=JSON.parse(readFileSync(GOLDEN,'utf8'));
  for(const name of Object.keys(CASES))assert.deepEqual(actual[name],expected[name],name);
});
test('the replay bot is deterministic',()=>{assert.deepEqual(play(CASES['seed 42']),play(CASES['seed 42']));});
