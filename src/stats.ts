import {type Game} from './game.js';
export const BUILD='P1-playtest-7';
export const HISTORY_KEY='3mtm-runs-v1';
export type Outcome='active'|'caught'|'restarted'|'interrupted';
export function runReport(game:Game,id:string,startedAt:string,outcome:Outcome){
  return {schema:1,build:BUILD,id,startedAt,savedAt:new Date().toISOString(),outcome,
    settings:{...game.settings},score:game.score,nodes:game.collected,seconds:Math.round(game.elapsed)/1000,
    placements:game.placements,rotations:game.rotations,discards:game.discards,invalidDrops:game.invalidDrops,
    reversals:game.reversals,hops:game.hops,boosts:game.boosts,freezes:game.freezes,moversCollected:game.moversCollected,ringSeconds:Math.round(game.ringMs)/1000,nearMisses:game.nearMisses,minClearance:game.minClearance,
    squares:game.board.size,peakSquares:game.peakSquares,removedPieces:game.removedPieces,removedSquares:game.removedSquares,
    board:[...game.board],nodesRemaining:[...game.nodes],position:game.position,events:[...game.events],droppedEvents:game.droppedEvents};
}
export type RunReport=ReturnType<typeof runReport>;
type StorageLike=Pick<Storage,'getItem'|'setItem'>;
export function readHistory(storage:StorageLike):RunReport[]{
  try{const value:unknown=JSON.parse(storage.getItem(HISTORY_KEY)??'[]');
    return Array.isArray(value)?value.filter((r):r is RunReport=>r?.schema===1&&typeof r.id==='string'&&typeof r.seconds==='number'&&typeof r.score==='number'&&Array.isArray(r.events)).slice(0,50):[];
  }catch{return [];}
}
export function saveReport(storage:StorageLike,report:RunReport):boolean{
  const runs=[report,...readHistory(storage).filter(r=>r.id!==report.id)].slice(0,50);
  // Under quota pressure keep the newest complete reports; never interrupt play.
  while(runs.length){try{storage.setItem(HISTORY_KEY,JSON.stringify(runs));return true;}catch{runs.pop();}}
  return false;
}
export function exportHistory(runs:RunReport[]){return JSON.stringify({schema:1,build:BUILD,exportedAt:new Date().toISOString(),runs},null,2);}
