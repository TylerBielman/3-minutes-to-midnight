// Gametronyx integration (gametronyx repo docs/DESIGN.md §5.6 and §6).
// Launch handoff: gametronyx.com opens the game as `…/#gtx_handoff=<code>`, a one-time 60 s code that the shared
// player-accounts API trades for a session token, kept only to attribute feedback. Feedback: after every N completed
// runs a free-text popup asks how it went; the API files it as a GitHub issue under the player's username.
// Pure helpers only (fetch and storage are passed in) so node --test covers them; main.ts owns the DOM.

export const TOKEN_KEY='gtx_auth_token_v1',COUNT_KEY='gtx_feedback_runs_v1',GAME_SLUG='jerboa',DEFAULT_EVERY=3,MAX_FEEDBACK=4000;
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
