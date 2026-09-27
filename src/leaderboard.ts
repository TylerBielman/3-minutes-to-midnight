// End-of-run leaderboard and celebration (docs/DECISIONS.md, Leaderboard end screen).
// Pure helpers only so node --test covers them; src/finale.ts owns the DOM. A board comes from Gametronyx (players ranked
// by their best score, by username) or, without a session, from this device's own ranked runs.
import {type Settings} from './game.js';
import {type RunReport} from './stats.js';

export type Entry={rank:number,name:string,score:number,me:boolean,at?:string};
export type Board={source:'gtx'|'local',season:string|null,players:number,rank:number|null,previousRank:number|null,
  best:number|null,previousBest:number|null,personalBest:boolean,entries:Entry[]};
export type Tier='top'|'best'|'first'|'tied'|'close'|'run'|'tuned';
export type Cheer={tier:Tier,headline:string,detail:string};
export const BOARD_ROWS=10;

/** Only default settings rank; the seed may be anything. Tune and URL overrides still play, unranked. */
export function isRanked(settings:Settings|undefined,defaults:Settings):boolean{
  return !!settings&&typeof settings==='object'&&(Object.keys(defaults) as (keyof Settings)[]).every(k=>k==='seed'||settings[k]===defaults[k]);
}

const whole=(v:unknown):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=0;
const orNull=(v:unknown)=>whole(v)?v:null;

/** Validate the API's score response; null when it isn't a usable board. */
export function parseBoard(data:unknown):Board|null{
  if(!data||typeof data!=='object')return null;
  const d=data as Record<string,unknown>;
  if(!Array.isArray(d.entries)||!whole(d.players))return null;
  const entries:Entry[]=[];
  for(const e of d.entries as Record<string,unknown>[]){
    if(!e||!whole(e.rank)||!whole(e.score)||typeof e.username!=='string')return null;
    entries.push({rank:e.rank,name:e.username.slice(0,50),score:e.score,me:e.me===true});
  }
  const me=d.me&&typeof d.me==='object'?d.me as Record<string,unknown>:null;
  if(me&&whole(me.rank)&&whole(me.score)&&typeof me.username==='string'&&!entries.some(e=>e.me))
    entries.push({rank:me.rank,name:me.username.slice(0,50),score:me.score,me:true});
  return {source:'gtx',season:typeof d.season==='string'&&d.season.trim()?d.season.trim().slice(0,60):null,players:d.players,
    rank:orNull(d.rank),previousRank:orNull(d.previous_rank),best:orNull(d.best),previousBest:orNull(d.previous_best),
    personalBest:d.personal_best===true,entries:entries.sort((a,b)=>a.rank-b.rank)};
}

/** This device's completed, ranked runs of this build, best first; ties keep the earlier run ahead. */
export function localBoard(runs:RunReport[],currentId:string,build:string,defaults:Settings):Board{
  // Stored history may hold reports from older builds or damaged storage; skip anything incomplete.
  const ranked=runs.filter(r=>r.outcome==='caught'&&r.build===build&&typeof r.startedAt==='string'&&isRanked(r.settings,defaults))
    .sort((a,b)=>b.score-a.score||a.startedAt.localeCompare(b.startedAt));
  const current=ranked.find(r=>r.id===currentId),others=ranked.filter(r=>r.id!==currentId);
  const previousBest=others.length?others[0].score:null;
  let rank=0,last=-1;
  const entries=ranked.map((r,i)=>{if(r.score!==last){rank=i+1;last=r.score;}return {rank,name:'',score:r.score,me:r.id===currentId,at:r.startedAt};});
  return {source:'local',season:null,players:ranked.length,rank:entries.find(e=>e.me)?.rank??null,previousRank:null,
    best:ranked.length?ranked[0].score:null,previousBest,personalBest:!!current&&(previousBest===null||current.score>previousBest),entries};
}

/** Rows to show: the top of the board, and the player's own row after a gap when they sit below it. */
export function visibleRows(board:Board,limit=BOARD_ROWS):(Entry|'gap')[]{
  const mine=board.entries.find(e=>e.me);
  if(!mine||board.entries.indexOf(mine)<limit)return board.entries.slice(0,limit);
  return [...board.entries.slice(0,limit-2),'gap',mine];
}

const GENERIC=['NICE RUN!','GREAT HOPPING!','WELL PLAYED!'];
/** Every run gets a cheer. Better news gets a bigger one. */
export function cheer(board:Board|null,score:number):Cheer{
  const generic=GENERIC[score%GENERIC.length];
  if(!board)return {tier:'tuned',headline:generic,detail:'Tuned run · not ranked'};
  const online=board.source==='gtx',where=online?'':' on this device';
  const standing=online&&board.rank?`#${board.rank} of ${board.players}`:'';
  const climb=online&&board.rank&&board.previousRank&&board.rank<board.previousRank?`▲ ${board.previousRank-board.rank}`:'';
  const join=(...parts:string[])=>parts.filter(Boolean).join(' · ');
  if(board.personalBest&&online&&board.rank===1&&board.players>1)
    return {tier:'top',headline:'TOP OF THE BOARD!',detail:join(board.previousBest===null?'':`+${score-board.previousBest} on your best`,standing,climb)};
  if(board.personalBest&&board.previousBest===null)
    return {tier:'first',headline:online?'YOU’RE ON THE BOARD!':'FIRST RANKED RUN!',detail:online?standing:'Your first on this device'};
  if(board.personalBest)
    return {tier:'best',headline:'NEW PERSONAL BEST!',detail:join(`+${score-board.previousBest!} on your best${where}`,standing,climb)};
  const best=board.best??board.previousBest;
  if(best!==null&&score===best)return {tier:'tied',headline:'TIED YOUR BEST!',detail:join(`Your best${where}: ${best}`,standing)};
  if(best!==null&&score>=best*.9)return {tier:'close',headline:'SO CLOSE!',detail:join(`${best-score} short of your best${where}`,standing)};
  return {tier:'run',headline:generic,detail:join(best===null?'':`Your best${where}: ${best}`,standing)};
}
