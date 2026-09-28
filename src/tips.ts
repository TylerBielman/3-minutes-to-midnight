// Reverse tips (docs/DECISIONS.md U38). Players didn't know they can tap the jerboa to turn him back, so a tip shows at the
// start of a run and a flash appears when his route is about to cross the Ring, until the player has reversed in
// TIP_RUNS runs on this device. Pure helpers only (storage is passed in) so node --test covers them; main.ts draws the tips.
import {type Cell} from './runway.js';

export const TIPS_KEY='jerboa_reverse_tips_v1',TIP_RUNS=2;
type Store=Pick<Storage,'getItem'|'setItem'>;

function readRuns(store:Store):string[]{
  try{const runs=(JSON.parse(store.getItem(TIPS_KEY)??'{}') as {runs?:unknown})?.runs;return Array.isArray(runs)?runs.filter((r):r is string=>typeof r==='string'):[];}
  catch{return [];}
}

/** True until the player has reversed in TIP_RUNS runs here. Without storage the tips always show. */
export function reverseTipsWanted(store:Store|undefined):boolean{return !store||readRuns(store).length<TIP_RUNS;}

/** Count a run in which the player reversed; the same run counts once. Returns how many runs have counted. */
export function noteReversal(store:Store|undefined,runId:string):number{
  if(!store)return 0;
  const runs=readRuns(store);if(!runs.includes(runId)&&runs.length<TIP_RUNS)runs.push(runId);
  try{store.setItem(TIPS_KEY,JSON.stringify({runs}));}catch{/* Storage may be full or disabled. */}
  return runs.length;
}

/** Index of the first cell of his forecast route (route[0] is the cell he is leaving) where his ground footprint would
 *  touch the Ring, looking at most `lookahead` hops ahead; -1 if none. `radiusAt(i)` is the Ring's expected radius when
 *  he reaches route[i]. Cell centres are enough: distance from the centre is convex along a straight hop, so a hop
 *  between two safe cells stays safe. Index 1 is the hop already in flight, which a reverse can no longer change. */
export function routeCrossesRing(route:Cell[],center:number,radiusAt:(i:number)=>number,hitRadius:number,lookahead=4):number{
  for(let i=1;i<route.length&&i<=lookahead;i++){const p=route[i];if(Math.hypot(p.x-center,p.y-center)+hitRadius>=radiusAt(i))return i;}
  return -1;
}
