// Gametronyx integration (gametronyx repo docs/DESIGN.md §5.6 and §6).
// Launch handoff: gametronyx.com opens the game as `…/#gtx_handoff=<code>`, a one-time 60 s code that the shared
// player-accounts API trades for a session token, kept only to attribute feedback and scores. Feedback: after every N completed
// runs a free-text popup asks how it went; the API files it as a GitHub issue under the player's username. Leaderboard:
// ranked runs are posted under the same username and the reply is the end screen's board (src/leaderboard.ts).
// Pure helpers only (fetch and storage are passed in) so node --test covers them; main.ts owns the DOM.

import {parseBoard,type Board} from './leaderboard.js';
import {type RunReport} from './stats.js';

export const TOKEN_KEY='gtx_auth_token_v1',COUNT_KEY='gtx_feedback_runs_v1',PENDING_KEY='gtx_pending_scores_v1',GAME_SLUG='jerboa',DEFAULT_EVERY=3,MAX_FEEDBACK=4000,MAX_PENDING=10,SCORE_TIMEOUT_MS=5000;
export type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Fetch=(input:string,init?:RequestInit)=>Promise<Response>;

export function readHandoffCode(hash:string):string|null{
  const value=new URLSearchParams(hash.replace(/^#/,'')).get('gtx_handoff');
  return value&&value.trim()?value.trim():null;
}

export function loadToken(store:Store|undefined):string|null{try{return store?.getItem(TOKEN_KEY)??null;}catch{return null;}}
export function saveToken(store:Store|undefined,token:string|null){try{if(token)store?.setItem(TOKEN_KEY,token);else store?.removeItem(TOKEN_KEY);}catch{/* Storage may be disabled. */}}

/** Trade a launch code for a session token; null when it's expired, used or the network is down. */
export async function redeemHandoff(fetchFn:Fetch,api:string,code:string):Promise<string|null>{
  try{
    const r=await fetchFn(`${api}/api/auth/handoff/redeem`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
    if(!r.ok)return null;const data=await r.json();return typeof data?.access_token==='string'?data.access_token:null;
  }catch{return null;}
}

/** The popup cadence set in Gametronyx admin; null if unavailable. */
export async function fetchCadence(fetchFn:Fetch,api:string):Promise<number|null>{
  try{
    const r=await fetchFn(`${api}/api/games`);if(!r.ok)return null;
    const game=(await r.json() as {slug:string,feedback_every_n_runs?:number|null}[]).find(g=>g.slug===GAME_SLUG);
    const every=game?.feedback_every_n_runs;return typeof every==='number'&&every>=1?Math.floor(every):null;
  }catch{return null;}
}

type Counts={since:number,total:number};
function readCounts(store:Store):Counts{
  try{const raw=JSON.parse(store.getItem(COUNT_KEY)??'{}');return{since:Math.max(0,Number(raw.since)||0),total:Math.max(0,Number(raw.total)||0)};}catch{return{since:0,total:0};}
}

/** Count one completed run (caught by the Ring). `prompt` is true on every `every`-th run; the cadence counter then
 *  restarts, so Send and Skip (or closing the tab) all wait another `every` runs. */
export function countCompletedRun(store:Store|undefined,every=DEFAULT_EVERY):{prompt:boolean,total:number}{
  if(!store)return{prompt:false,total:0};
  const c=readCounts(store);c.since+=1;c.total+=1;const prompt=c.since>=Math.max(1,every);if(prompt)c.since=0;
  try{store.setItem(COUNT_KEY,JSON.stringify(c));}catch{/* Storage may be full. */}
  return{prompt,total:c.total};
}

export type FeedbackResult={ok:true}|{ok:false,expired:boolean,message:string};

/** POST the feedback; `expired` means the Gametronyx session is no longer valid. */
export async function sendFeedback(fetchFn:Fetch,api:string,token:string,input:{text:string,build:string,runs:number,ua:string,viewport:string}):Promise<FeedbackResult>{
  const body={game_slug:GAME_SLUG,text:input.text.trim().slice(0,MAX_FEEDBACK),build_sha:input.build.slice(0,64),runs:input.runs,client:{ua:input.ua.slice(0,300),viewport:input.viewport.slice(0,40)}};
  try{
    const r=await fetchFn(`${api}/api/feedback`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
    if(r.ok)return{ok:true};
    if(r.status===401||r.status===403)return{ok:false,expired:true,message:'Your Gametronyx session has ended. Launch Jerboa from gametronyx.com to send feedback.'};
    if(r.status===429)return{ok:false,expired:false,message:'That’s a lot of feedback at once. Try again in a bit.'};
    let detail='';try{const data=await r.json();if(typeof data?.detail==='string')detail=data.detail;}catch{/* not JSON */}
    return{ok:false,expired:false,message:detail||`Couldn’t send (${r.status}). Try again.`};
  }catch{return{ok:false,expired:false,message:'Couldn’t reach Gametronyx. Check your connection and try again.'};}
}

// Leaderboard: each ranked, completed run is posted under the player's username. The response is the board the end
// screen shows. The run ID makes a resend harmless, so runs that fail to post wait in PENDING_KEY and retry later.
export type ScoreRun={run_id:string,score:number,nodes:number,hops:number,seconds:number,ring_seconds:number,boosts:number,freezes:number,near_misses:number,build:string,build_sha:string,settings:Record<string,unknown>};
export type ScoreResult={ok:true,board:Board}|{ok:false,reason:'expired'|'offline'|'limited'|'unavailable'|'rejected'};

export function scoreRun(report:RunReport,buildSha:string):ScoreRun{
  return {run_id:report.id,score:report.score,nodes:report.nodes,hops:report.hops,seconds:report.seconds,ring_seconds:report.ringSeconds,
    boosts:report.boosts,freezes:report.freezes,near_misses:report.nearMisses,build:report.build,build_sha:buildSha.slice(0,64),settings:{...report.settings}};
}

/** POST one run. `expired`: the session is gone. `offline`/`limited`: worth retrying. `unavailable`: no leaderboard
 *  (switched off in admin, or not deployed). `rejected`: the server refused this run, so don't resend it. */
export async function submitScore(fetchFn:Fetch,api:string,token:string,run:ScoreRun,timeoutMs=SCORE_TIMEOUT_MS):Promise<ScoreResult>{
  try{
    const signal=typeof AbortSignal!=='undefined'&&'timeout' in AbortSignal?AbortSignal.timeout(timeoutMs):undefined;
    const r=await fetchFn(`${api}/api/games/${GAME_SLUG}/scores`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(run),signal});
    if(r.status===401||r.status===403)return{ok:false,reason:'expired'};
    if(r.status===429)return{ok:false,reason:'limited'};
    if(r.status===404)return{ok:false,reason:'unavailable'};
    if(r.status>=500)return{ok:false,reason:'offline'};
    if(!r.ok)return{ok:false,reason:'rejected'};
    const board=parseBoard(await r.json().catch(()=>null));
    return board?{ok:true,board}:{ok:false,reason:'unavailable'};
  }catch{return{ok:false,reason:'offline'};}
}

function readPending(store:Store):ScoreRun[]{
  try{const v:unknown=JSON.parse(store.getItem(PENDING_KEY)??'[]');return Array.isArray(v)?v.filter((r):r is ScoreRun=>typeof r?.run_id==='string'&&typeof r?.score==='number'):[];}catch{return [];}
}
function writePending(store:Store,runs:ScoreRun[]){try{if(runs.length)store.setItem(PENDING_KEY,JSON.stringify(runs));else store.removeItem(PENDING_KEY);}catch{/* Storage may be full. */}}

/** Keep a run to resend. Newest first; the oldest drop once MAX_PENDING wait. */
export function queueScore(store:Store|undefined,run:ScoreRun){
  if(store)writePending(store,[run,...readPending(store).filter(r=>r.run_id!==run.run_id)].slice(0,MAX_PENDING));
}

/** Resend waiting runs, oldest first. Stops at the first retryable failure; drops runs the server settled either way. */
export async function flushPending(fetchFn:Fetch,api:string,token:string,store:Store|undefined):Promise<number>{
  if(!store)return 0;
  const waiting=readPending(store).reverse();let sent=0;
  for(const run of waiting){
    const result=await submitScore(fetchFn,api,token,run);
    if(!result.ok&&(result.reason==='offline'||result.reason==='limited'||result.reason==='expired'))break;
    sent++;writePending(store,readPending(store).filter(r=>r.run_id!==run.run_id));
  }
  return sent;
}
