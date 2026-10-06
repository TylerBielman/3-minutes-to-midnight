import {Game,DEFAULTS,TUNING,type Settings} from './game.js';
import {cell,key,placementError,type Cell} from './runway.js';
import {gestureMode,downwardSwipe,type GestureMode} from './input.js';
import {readHistory,saveReport,runReport,exportHistory,BUILD as RUN_BUILD,type Outcome,type RunReport} from './stats.js';
import {readHandoffCode,loadToken,saveToken,redeemHandoff,fetchCadence,countCompletedRun,sendFeedback,scoreRun,submitScore,queueScore,flushPending,DEFAULT_EVERY,MAX_FEEDBACK,type ScoreResult} from './gtx.js';
import {isRankedReport,localBoard,cheer} from './leaderboard.js';
import {BUILTIN_ROUNDS,CUSTOM_ROUNDS_KEY,parseRoundSet,unlockedKinds,type PowerKind,type RoundSet} from './rounds.js';
import {createFinale} from './finale.js';
import {reverseTipsWanted,noteReversal,routeCrossesRing} from './tips.js';
import './style.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<main class="game-shell">
  <div class="tools"><a id="gtx-home" class="home">‹ Gametronyx</a><span>P1 · PLAYTEST 7</span><button id="runs" type="button">Runs</button><button id="tune" type="button">Tune</button><button id="restart" type="button">New run</button></div>
  <div class="stage"><canvas id="game" width="390" height="626" aria-label="Jerboa runway game. Tap a draft piece to rotate, drag to connect runway, swipe down from the draft to discard. Tap the jerboa to reverse."></canvas>
    <section id="finale" class="finale" hidden aria-labelledby="finale-caught finale-headline"><div id="finale-confetti" class="confetti" aria-hidden="true"></div>
      <p id="finale-caught" class="finale-caught">The Ring caught him</p><h2 id="finale-headline" class="finale-headline"></h2>
      <p class="finale-score"><span id="finale-points">0</span><small>points</small></p><p id="finale-stats" class="finale-stats"></p><p id="finale-detail" class="finale-detail"></p>
      <div id="finale-board" class="finale-board"><h3 id="finale-board-title">Leaderboard</h3><p class="finale-wait">Posting your score…</p><ol id="finale-rows"></ol><p id="finale-note" class="finale-note"></p></div>
      <button id="play-again" class="play-again" type="button">Play again</button><a id="more-games" class="more-games">More games · Gametronyx</a>
    </section></div>
  <div id="announcement" class="sr-only" aria-live="polite"></div>
  <dialog id="settings"><form method="dialog"><h2>Playtest tuning</h2><p>Changes start a new run. Opening this panel does not pause an active run.</p>
    <label>Mode<select id="mode"><option value="rounds">Rounds · default, not ranked</option><option value="classic">Classic · ranked</option></select></label>
    <p id="rounds-help" hidden>Each round sets its own Ring length, hop speed, nodes and powerups, so those settings are greyed out. <a href="./designer.html">Design rounds…</a></p>
    <label>Run length<select id="duration"><option value="60">1 minute</option><option value="120">2 minutes</option><option value="180">3 minutes</option></select></label>
    <label>Board size<select id="grid"><option value="15">15 × 15</option><option value="19">19 × 19</option><option value="23">23 × 23</option></select></label>
    <label>Hop interval<select id="hop"><option value="300">Fast · 0.30 seconds</option><option value="450">Default · 0.45 seconds</option><option value="650">Slow · 0.65 seconds</option></select></label>
    <label>Draft slots<select id="slots"><option value="1">1</option><option value="2">2 · default</option><option value="3">3</option></select></label>
    <label>Point nodes at start (fewer as the Ring closes)<input id="nodes" type="number" min="1" max="20"></label>
    <label>Runway square limit (0 = unlimited)<input id="limit" type="number" min="0" max="961"></label>
    <label>Ring hit radius (cells)<select id="hit"><option value="0.1">Forgiving · 0.10</option><option value="0.24">Original · 0.24</option><option value="0">Center only · 0</option></select></label>
    <label>x2 speed multiplier<input id="boost-speed" type="number" min="1" max="3" step="0.1"></label>
    <label>x2 duration (seconds)<input id="boost-sec" type="number" min="0.5" max="30" step="0.5"></label>
    <label>Freeze duration (seconds)<input id="freeze-sec" type="number" min="0.5" max="30" step="0.5"></label>
    <label>Random seed<input id="seed" type="number" min="0" max="4294967295"></label>
    <label class="check"><input id="debug" type="checkbox"> Show designer grid</label>
    <div class="actions"><button value="cancel">Close</button><button id="apply" value="apply">Apply & restart</button></div>
  </form></dialog>
  <dialog id="history"><h2>Your playtest runs</h2><p>Saved on this browser and address only. No automatic uploads. Export the runs to share them for review. Up to 50 runs; saving may retain fewer if storage is full. Play continues while this panel is open.</p><p id="save-status"></p><div id="run-list"></div><div class="actions"><button id="export" type="button">Export runs</button><button id="close-history" type="button">Close</button></div><details id="export-fallback" hidden><summary>Copy the report if the download does not appear</summary><label>Run report<textarea id="report-text" readonly rows="6"></textarea></label></details></dialog>
  <dialog id="feedback"><form id="feedback-form"><h2>How was it?</h2><p id="feedback-lede"></p><label>Your feedback<textarea id="feedback-text" rows="6" maxlength="${MAX_FEEDBACK}" placeholder="Anything fun, confusing or broken?"></textarea></label><p id="feedback-status" role="status" aria-live="polite"></p><div class="actions"><button id="feedback-skip" type="button">Skip</button><button id="feedback-send" type="submit" disabled>Send</button></div></form></dialog>
</main>`;
const canvas=document.querySelector<HTMLCanvasElement>('#game')!,ctx=canvas.getContext('2d')!;
const dialog=document.querySelector<HTMLDialogElement>('#settings')!;
const input=(id:string)=>document.getElementById(id) as HTMLInputElement;
const query=new URLSearchParams(location.search);
const numeric=(name:string,fallback:number)=>{const value=Number(query.get(name));return query.has(name)&&Number.isFinite(value)?value:fallback;};
let settings:Settings={...DEFAULTS,duration:numeric('duration',180),grid:numeric('grid',19),hopMs:numeric('hop',450),nodeCount:numeric('nodes',DEFAULTS.nodeCount),slots:numeric('slots',DEFAULTS.slots),seed:numeric('seed',Math.floor(Math.random()*0xffffffff)),roadLimit:numeric('limit',25),hitRadius:numeric('hit',.10),boostSpeed:numeric('boost',DEFAULTS.boostSpeed),boostMs:numeric('boostSec',DEFAULTS.boostMs/1000)*1000,freezeMs:numeric('freezeSec',DEFAULTS.freezeMs/1000)*1000};
// Rounds is the default game. Classic remains available explicitly with ?mode=classic or from Tune.
// The designer can still launch a custom set with ?mode=rounds&set=custom.
type Mode='classic'|'rounds';
let mode:Mode=query.get('mode')==='classic'?'classic':'rounds',roundsNote='';
const useCustom=query.get('set')==='custom';
function roundSet():RoundSet|undefined{
  if(mode==='classic')return undefined;
  if(useCustom){
    let set:RoundSet|null=null;try{set=parseRoundSet(JSON.parse(localStorage.getItem(CUSTOM_ROUNDS_KEY)??'null'));}catch{/* Storage may be disabled. */}
    if(set)return {...set,id:'custom'};
    roundsNote='That round set couldn’t be loaded, so the built-in Rounds are playing.';
  }
  return BUILTIN_ROUNDS;
}
let game=new Game(settings,roundSet()),debug=query.has('debug');
const historyDialog=document.querySelector<HTMLDialogElement>('#history')!;
// Phone testing uses HTTP over LAN, where randomUUID may be unavailable.
const newRunId=()=>globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`;
let runId=newRunId(),startedAt=new Date().toISOString(),lastSave=0,storageOK=true;
const memoryRuns=new Map<string,RunReport>();
function storedRuns(){try{return readHistory(localStorage);}catch{return [];}}
// A prior checkpoint is an interrupted run, never a fabricated completed score.
for(const report of storedRuns().filter(r=>r.outcome==='active')){try{saveReport(localStorage,{...report,outcome:'interrupted'});}catch{/* Storage may be disabled. */}}
function checkpoint(outcome:Outcome=game.over?'caught':'active'){
  if(!game.placements)return;
  const report=runReport(game,runId,startedAt,outcome);memoryRuns.set(runId,report);
  if(memoryRuns.size>50)memoryRuns.delete(memoryRuns.keys().next().value!);
  try{storageOK=saveReport(localStorage,report);}catch{storageOK=false;}
  lastSave=performance.now();
}
function reports(){const merged=new Map(storedRuns().map(r=>[r.id,r]));for(const [id,r] of memoryRuns)merged.set(id,r);return [...merged.values()].sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).slice(0,50);}
function showRuns(){
  checkpoint();const runs=reports(),list=document.querySelector('#run-list')!;list.replaceChildren();
  document.querySelector('#save-status')!.textContent=storageOK?'Export includes settings, actions, hop trail and removal events.':'Browser saving is unavailable. Export now to keep this session.';
  if(!runs.length)list.textContent='Place your first piece to start recording a run.';
  for(const r of runs){const item=document.createElement('p');item.className='run-entry';item.textContent=`${new Date(r.startedAt).toLocaleString()} · ${r.outcome}\n${r.score} points · ${r.seconds.toFixed(1)}s · ${r.nodes} nodes\n${r.placements} placed · ${r.discards} discards · ${r.reversals} reverses · ${r.invalidDrops} invalid drops\n${r.nearMisses} escapes · ${r.removedSquares} squares cleared · peak ${r.peakSquares} squares · seed ${r.settings.seed}`;list.append(item);}
}
document.querySelector('#runs')!.addEventListener('click',()=>{cancel();showRuns();historyDialog.showModal();});
document.querySelector('#close-history')!.addEventListener('click',()=>historyDialog.close());
document.querySelector('#export')!.addEventListener('click',()=>{
  checkpoint();const contents=exportHistory(reports());
  (document.querySelector('#report-text') as HTMLTextAreaElement).value=contents;
  (document.querySelector('#export-fallback') as HTMLDetailsElement).hidden=false;
  const url=URL.createObjectURL(new Blob([contents],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`3mtm-runs-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
});
window.addEventListener('pagehide',()=>checkpoint(game.over?'caught':'interrupted'));
// Gametronyx: a launch from gametronyx.com carries a one-time code in the fragment. Strip it at once, trade it for a
// session (used only to attribute feedback and scores), and learn the feedback cadence set in admin.
// Both addresses are fixed at build time (DECISIONS G-06): a URL override could send the session token elsewhere.
const GTX_API=import.meta.env.VITE_GTX_API||'https://api.gametronyx.com',SCORES_API=import.meta.env.VITE_SCORES_API||'https://scores.gametronyx.com',BUILD=import.meta.env.VITE_BUILD_SHA||'dev';
// The way back to Gametronyx (top bar and end screen). Same tab: players arrive from there.
const GTX_SITE=import.meta.env.VITE_GTX_SITE||'https://gametronyx.com';
document.querySelector<HTMLAnchorElement>('#gtx-home')!.href=GTX_SITE;
const gtxStore=(()=>{try{return localStorage;}catch{return undefined;}})();
let feedbackEvery=DEFAULT_EVERY,feedbackRuns=0,feedbackDue=0;
const handoffCode=readHandoffCode(location.hash);
if(handoffCode){history.replaceState(history.state,'',location.pathname+location.search);void redeemHandoff(fetch,GTX_API,handoffCode).then(token=>{if(token){saveToken(gtxStore,token);void flushPending(fetch,SCORES_API,token,gtxStore);}});}
if(handoffCode||loadToken(gtxStore))void fetchCadence(fetch,GTX_API).then(every=>{if(every)feedbackEvery=every;});
const feedbackDialog=document.querySelector<HTMLDialogElement>('#feedback')!,feedbackText=document.querySelector<HTMLTextAreaElement>('#feedback-text')!;
const feedbackSend=document.querySelector<HTMLButtonElement>('#feedback-send')!,feedbackStatus=document.querySelector('#feedback-status')!;
function promptFeedback(total:number):boolean{
  if(feedbackDialog.open||dialog.open||historyDialog.open)return false;
  feedbackRuns=total;feedbackStatus.textContent='';feedbackSend.disabled=!feedbackText.value.trim();
  document.querySelector('#feedback-lede')!.textContent=`That’s ${total} runs. Anything fun, confusing or broken? Tyler reads every note. It’s posted to GitHub under your Gametronyx username.`;
  feedbackDialog.showModal();return true;
}
feedbackText.addEventListener('input',()=>{feedbackSend.disabled=!feedbackText.value.trim();});
document.querySelector('#feedback-skip')!.addEventListener('click',()=>feedbackDialog.close());
document.querySelector('#feedback-form')!.addEventListener('submit',async event=>{
  event.preventDefault();const token=loadToken(gtxStore);if(!token||!feedbackText.value.trim())return;
  feedbackSend.disabled=true;feedbackStatus.textContent='Sending…';
  const result=await sendFeedback(fetch,GTX_API,token,{text:feedbackText.value,build:BUILD,runs:feedbackRuns,ua:navigator.userAgent,viewport:`${innerWidth}x${innerHeight}`});
  if(result.ok){feedbackText.value='';feedbackStatus.textContent='Thanks! Sent to Tyler.';setTimeout(()=>feedbackDialog.close(),1200);return;}
  if(result.expired)saveToken(gtxStore,null);
  feedbackStatus.textContent=result.message;feedbackSend.disabled=result.expired;
});
// End of run: the celebration and leaderboard replace the caught panel. Ranked runs post under the Gametronyx username;
// without a session, or when that fails, the board is this device's own ranked runs.
const finale=createFinale(document.querySelector<HTMLElement>('#finale')!,()=>restart({...settings,seed:Math.floor(Math.random()*0xffffffff)}),GTX_SITE);
const SCORE_NOTES:Record<Exclude<ScoreResult,{ok:true}>['reason'],string>={
  expired:'Your Gametronyx session has ended. Launch Jerboa from gametronyx.com to post scores.',
  offline:'Couldn’t reach Gametronyx. This score will post next time.',limited:'Gametronyx is busy. This score will post next time.',
  unavailable:'The Gametronyx leaderboard isn’t open yet.',rejected:'This run couldn’t be ranked.'};
async function finishRun(){
  const id=runId,report=memoryRuns.get(id)??runReport(game,id,startedAt,'caught'),ranked=isRankedReport(report,DEFAULTS),token=loadToken(gtxStore);
  const rounds=report.mode==='rounds',last=report.round===report.roundsTotal;
  finale.show({id,score:report.score,nodes:report.nodes,seconds:report.seconds,escapes:report.nearMisses,
    round:rounds?(last?`${game.round.name} · final round`:`Round ${report.round} of ${report.roundsTotal}`):undefined});
  // Rounds is unranked, but its runs still have a best on this device to beat.
  let board=localBoard(reports(),id,RUN_BUILD,DEFAULTS,rounds?report.roundSet?.id:undefined),
    note=rounds?'Rounds isn’t on the leaderboard yet.':!ranked?'Only runs with default settings are ranked.':token?'':'Launch Jerboa from gametronyx.com to get on the leaderboard.';
  if(ranked&&token){
    const run=scoreRun(report,BUILD),result=await submitScore(fetch,SCORES_API,token,run);
    if(result.ok){board=result.board;void flushPending(fetch,SCORES_API,token,gtxStore);}
    else{note=SCORE_NOTES[result.reason];if(result.reason==='offline'||result.reason==='limited')queueScore(gtxStore,run);if(result.reason==='expired')saveToken(gtxStore,null);}
  }
  const c=cheer(ranked||rounds&&board.entries.some(e=>e.me)?board:null,report.score,rounds?'Rounds trial · not ranked':undefined);
  finale.fill(id,board,c,note,()=>{if(feedbackDue&&promptFeedback(feedbackDue))feedbackDue=0;});
  if(finale.open&&runId===id)announce(`${c.headline} ${report.score} point${report.score===1?'':'s'}. ${c.detail}`,color.points);
}
const W=390,H=626,BOARD_Y=64,BOARD_SIZE=386,BOARD_X=2,DRAFT_Y=528;
// Slot centers, spread evenly for 1-3 draft slots.
const slotX=(i:number)=>195+(i-(game.draft.length-1)/2)*129;
const color={bg:'#111820',road:'#354653',seam:'#667786',route:'#69e6dc',points:'#ffdc73',ring:'#f5a84a',red:'#ff5273',ink:'#f2f6f8',muted:'#a9bac5',boost:'#c77dff',freeze:'#5aa9ff'};
// Powerups: each has a colour and a glyph, so identity never rests on colour alone. x2 and freeze look as before.
const POWER_LOOK:Record<PowerKind,{tint:string,glyph:string,ink:string,size:number,dy:number,pulse:number,name:string,about:string}>={
  boost:{tint:color.boost,glyph:'x2',ink:'#1d1026',size:.5,dy:0,pulse:180,name:'x2',about:'double points, faster hops'},
  freeze:{tint:color.freeze,glyph:'❄',ink:'#0c1a2e',size:.58,dy:.5,pulse:220,name:'Freeze',about:'time stops'},
  expand:{tint:color.ring,glyph:'↔',ink:color.ring,size:.5,dy:0,pulse:200,name:'Expand',about:'pushes the Ring back'},
  sweep:{tint:'#eef3f6',glyph:'✦',ink:'#1a2530',size:.55,dy:.5,pulse:200,name:'Sweep',about:'takes every lowest-value node'},
  magnet:{tint:'#ff8fd1',glyph:'U',ink:'#3a0f28',size:.55,dy:.5,pulse:200,name:'Magnet',about:'he grabs points near him'},
  speed:{tint:'#c9f26b',glyph:'»',ink:'#1f2a08',size:.62,dy:-.5,pulse:200,name:'Speed',about:'faster hops, no bonus'},
  cherry:{tint:'#ff4d6d',glyph:'',ink:'',size:0,dy:0,pulse:200,name:'Cherries',about:'a set pays bonus points'},
};
/** A powerup at screen point (x,y), `s` pixels per cell. Expand is a ring (it pushes the Ring); cherries are drawn. */
function drawPower(kind:PowerKind,x:number,y:number,s:number,now:number){
  const look=POWER_LOOK[kind],glow=.5+.5*Math.sin(now/look.pulse);
  ctx.save();ctx.shadowColor=look.tint;ctx.shadowBlur=6+8*glow;
  if(kind==='cherry'){
    ctx.strokeStyle='#7ee081';ctx.lineWidth=Math.max(1.2,s*.07);ctx.beginPath();
    ctx.moveTo(x-s*.15,y+s*.06);ctx.quadraticCurveTo(x-s*.06,y-s*.24,x+s*.06,y-s*.32);ctx.moveTo(x+s*.15,y+s*.06);ctx.quadraticCurveTo(x+s*.1,y-s*.2,x+s*.06,y-s*.32);ctx.stroke();
    ctx.fillStyle=look.tint;for(const dx of [-.15,.15]){ctx.beginPath();ctx.arc(x+dx*s,y+s*.14,s*.17,0,Math.PI*2);ctx.fill();}
    ctx.restore();return;
  }
  if(kind==='expand'){ctx.strokeStyle=look.tint;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y,s*.36,0,Math.PI*2);ctx.stroke();}
  else{ctx.fillStyle=look.tint;ctx.beginPath();ctx.arc(x,y,s*.4,0,Math.PI*2);ctx.fill();}
  ctx.restore();text(look.glyph,x,y+look.dy,Math.max(10,s*look.size),look.ink,'center');
}
// Presentation-only tuning. Ring beat periods live in TUNING.ringPulseMs.
// tipStartMs: how long the start tip shows before the first placement; tipIntroMs: how long "tap him" shows after it
// (Tyler, Playtest 7: shorter, and at the top of the Ring). tipAnnouncements: danger announcements per run.
const FX={pulseWidth:[1.5,2.5,3.5],pulseGlow:[6,12,18],phaseSurgeMs:1400,roundSurgeMs:2800,burstMs:750,burstParticles:14,burstSpeed:.09,thawWarnMs:1500,tipStartMs:4000,tipIntroMs:3000,tipAnnouncements:3};
const startMessage=()=>game.goal!==null?`Round ${game.roundIndex+1}: score ${game.goal} to clear it. Drag a piece up to start.`
  :game.set.rounds.length>1?`${game.round.name}: no goal, score all you can. Drag a piece up to start.`:'Tap a piece to rotate. Drag up to start.';
let message=roundsNote||startMessage(),messageColor=roundsNote?color.red:color.muted;
let flashSlot=-1,flashUntil=0,lastTime=performance.now(),drawnRevision=-1,route:Cell[]=[];
let lastOver=false,removedUntil=0;
let lastPhase=1,phaseSurgeAt=-Infinity,roundSurgeAt=-Infinity,lastPickupSeq=0,roundNews='';
// Reverse tips (DECISIONS U38) are decided per run and stop once the player has reversed in two runs on this device.
let reverseTips=reverseTipsWanted(gtxStore),tipCounted=false,readyAt=performance.now(),firstPlacedAt=-Infinity,dangerIndex=-1,dangerAnnounced=0,wasDoubleBonus=false;
type Particle={x:number,y:number,vx:number,vy:number,born:number,tint:string};
type Floater={x:number,y:number,label:string,born:number,tint:string};
let particles:Particle[]=[],floaters:Floater[]=[];
function burst(at:Cell,tint:string,label:string,now:number,count=FX.burstParticles){
  const c=screen(at);
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2+Math.random()*.4,v=FX.burstSpeed*(.6+Math.random()*.8);particles.push({x:c.x,y:c.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,born:now,tint});}
  floaters.push({x:c.x,y:c.y-8,label,born:now,tint});
}
type Gesture={id:number,slot:number,start:Cell,now:Cell,mode:GestureMode,origin?:Cell};
let gesture:Gesture|undefined;
/** Screen readers get `text`; the canvas message line shows `shown` (shorter when `text` is long). */
function announce(text:string,tint=color.muted,shown=text){message=shown;messageColor=tint;document.querySelector('#announcement')!.textContent=text;}
function scale(){return BOARD_SIZE/game.settings.grid;}
function screen(p:Cell):Cell{return {x:BOARD_X+(p.x+.5)*scale(),y:BOARD_Y+(p.y+.5)*scale()};}
function text(label:string,x:number,y:number,size=13,fill=color.ink,align:CanvasTextAlign='left'){
  ctx.fillStyle=fill;ctx.font=`${size>=16?'600':'400'} ${size}px system-ui, sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(label,x,y);
}
function roundRect(x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}
}
function square(p:Cell,fill:string,outline?:string){const c=screen(p),s=scale();ctx.fillStyle=fill;ctx.fillRect(c.x-s/2+.6,c.y-s/2+.6,s-1.2,s-1.2);if(outline){ctx.strokeStyle=outline;ctx.lineWidth=2;ctx.strokeRect(c.x-s/2+1,c.y-s/2+1,s-2,s-2);}}
function pointer(event:PointerEvent):Cell{const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*W/rect.width,y:(event.clientY-rect.top)*H/rect.height};}
function origin(p:Cell,slot:number):Cell{
  const cells=game.cells(slot),width=Math.max(...cells.map(c=>c.x))+1,height=Math.max(...cells.map(c=>c.y))+1;
  return {x:Math.round((p.x-BOARD_X)/scale()-width/2),y:Math.round((p.y-44-BOARD_Y)/scale()-height/2)};
}
function cancel(){if(gesture){flashSlot=gesture.slot;flashUntil=performance.now()+650;announce('Returned to your slot.',color.red);gesture=undefined;}}
canvas.addEventListener('pointerdown',event=>{
  if(gesture||dialog.open||historyDialog.open||feedbackDialog.open)return;event.preventDefault();const p=pointer(event);
  if(game.over)return;
  const actor=screen(game.position);
  if(Math.hypot(p.x-actor.x,p.y-actor.y)<25){game.reverse();announce(game.running?'Turning back after this hop.':'Connect your first piece to begin.',color.route);return;}
  const slot=game.draft.findIndex((_,i)=>Math.abs(p.x-slotX(i))<59&&Math.abs(p.y-DRAFT_Y)<51);
  if(slot<0)return;gesture={id:event.pointerId,slot,start:p,now:p,mode:'pending'};canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;event.preventDefault();gesture.now=pointer(event);
  gesture.mode=gestureMode(gesture.mode,gesture.now.x-gesture.start.x,gesture.now.y-gesture.start.y);
  if(gesture.mode==='discard'&&!game.running){message='Discards unlock after your first placement';messageColor=color.red;}
  else if(gesture.mode==='discard'){message=downwardSwipe(gesture.now.x-gesture.start.x,gesture.now.y-gesture.start.y)?'RELEASE TO DISCARD ↓':'Pull down to discard · return to cancel';messageColor=color.points;}
  if(gesture.mode==='drag'){
    gesture.origin=origin(gesture.now,gesture.slot);
    const error=placementError(game.board,game.cells(gesture.slot,gesture.origin),game.settings.grid);
    message=error?`${error} · release to return`:'CONNECTED · release to place';messageColor=error?color.red:color.route;
  }
});
canvas.addEventListener('pointerup',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;event.preventDefault();
  const g=gesture,p=pointer(event);gesture=undefined;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(game.over)return;
  const dx=p.x-g.start.x,dy=p.y-g.start.y;
  const mode=gestureMode(g.mode,dx,dy);
  if(mode!=='drag'){
    if(mode==='discard'&&downwardSwipe(dx,dy)){
      if(game.discard(g.slot))announce('Discarded ↓ A new piece is ready.');
      else{flashSlot=g.slot;flashUntil=performance.now()+650;announce('Discards unlock after your first placement.',color.red);}
    }
    else if(mode==='pending'&&Math.hypot(dx,dy)<16){game.rotate(g.slot);announce('Rotated. Drag up when ready.');}
    else{flashSlot=g.slot;flashUntil=performance.now()+650;announce('Returned to your slot.');}
  }else{
    const error=game.place(g.slot,origin(p,g.slot));
    if(error){flashSlot=g.slot;flashUntil=performance.now()+800;announce(`${error} · returned to your slot`,color.red);}
    else{removedUntil=performance.now()+900;if(game.placements===1)firstPlacedAt=performance.now();announce(game.lastRemoved.length?`Placed · cleared ${game.lastRemoved.length} old squares`:'Runway placed. Tap the jerboa to reverse.',color.route);}
  }
  checkpoint();
});
canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);window.addEventListener('blur',cancel);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();checkpoint();}});
function restart(newSettings=settings){checkpoint(game.over?'caught':'restarted');finale.hide();settings={...newSettings};game=new Game(settings,roundSet());runId=newRunId();startedAt=new Date().toISOString();gesture=undefined;drawnRevision=-1;lastTime=performance.now();lastOver=false;removedUntil=0;lastPhase=1;phaseSurgeAt=-Infinity;roundSurgeAt=-Infinity;lastPickupSeq=0;roundNews='';particles=[];floaters=[];
  reverseTips=reverseTipsWanted(gtxStore);tipCounted=false;readyAt=performance.now();firstPlacedAt=-Infinity;dangerIndex=-1;dangerAnnounced=0;wasDoubleBonus=false;
  announce(startMessage());}
document.querySelector('#restart')!.addEventListener('click',()=>restart({...settings,seed:Math.floor(Math.random()*0xffffffff)}));
document.querySelector('#tune')!.addEventListener('click',()=>{
  cancel();input('duration').value=String(game.settings.duration);input('grid').value=String(game.settings.grid);input('hop').value=String(game.settings.hopMs);
  input('nodes').value=String(game.settings.nodeCount);input('slots').value=String(game.settings.slots);input('seed').value=String(game.settings.seed);input('debug').checked=debug;dialog.showModal();
  input('limit').value=String(game.settings.roadLimit);input('hit').value=String(game.settings.hitRadius);
  input('boost-speed').value=String(game.settings.boostSpeed);input('boost-sec').value=String(game.settings.boostMs/1000);input('freeze-sec').value=String(game.settings.freezeMs/1000);
  input('mode').value=mode;syncMode();
});
// In Rounds each round sets these itself.
const PER_ROUND=['duration','hop','nodes','boost-speed','boost-sec','freeze-sec'];
function syncMode(){const rounds=input('mode').value==='rounds';PER_ROUND.forEach(id=>{input(id).disabled=rounds;});document.querySelector<HTMLElement>('#rounds-help')!.hidden=!rounds;}
input('mode').addEventListener('change',syncMode);
document.querySelector('#apply')!.addEventListener('click',event=>{
  event.preventDefault();if(!dialog.querySelector('form')!.reportValidity())return;
  debug=input('debug').checked;mode=input('mode').value==='rounds'?'rounds':'classic';restart({...settings,duration:Number(input('duration').value),grid:Number(input('grid').value),hopMs:Number(input('hop').value),nodeCount:Number(input('nodes').value),slots:Number(input('slots').value),seed:Number(input('seed').value),roadLimit:Number(input('limit').value),hitRadius:Number(input('hit').value),boostSpeed:Number(input('boost-speed').value),boostMs:Number(input('boost-sec').value)*1000,freezeMs:Number(input('freeze-sec').value)*1000});dialog.close();
});
function draw(now:number){
  const dpr=Math.min(devicePixelRatio||1,3);if(canvas.width!==W*dpr){canvas.width=W*dpr;canvas.height=H*dpr;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle=color.bg;ctx.fillRect(0,0,W,H);
  // The end screen covers the finished run, so its HUD is not drawn underneath.
  if(!game.over){
    text(String(game.score)+' PTS',10,36,23);
    const seconds=Math.ceil(game.ringLeftMs/1000);
    text(`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,380,36,23,game.frozen?color.freeze:color.ink,'right');
    if(game.frozen){
      const left=(game.freezeUntil-game.elapsed)/(game.round.freeze?.ms||1);
      text(`❄ ${((game.freezeUntil-game.elapsed)/1000).toFixed(1)}s`,380,57,10,color.freeze,'right');roundRect(318-60*left,54,60*left,5,2.5,color.freeze);
    }
    // x2 during a freeze: the x2 countdown waits too (DECISIONS U40).
    if(game.doubleBonus)text('DOUBLE BONUS',195,39,11+Math.sin(now/140),color.boost,'center');
    else if(game.set.rounds.length>1){
      // Rounds: the round and its goal, with a gold progress bar along the top of the board.
      const goal=game.goal;
      text(goal===null?`${game.round.name.toUpperCase()} · FINAL ROUND`:`ROUND ${game.roundIndex+1}/${game.set.rounds.length} · ${game.roundScore}/${goal}`,195,39,11,goal===null?color.ring:color.points,'center');
      if(goal!==null)roundRect(BOARD_X,59,BOARD_SIZE*Math.min(1,game.roundScore/goal),3,1.5,color.points);
    }
    else text(game.running?`PHASE ${game.phase} / 3`:'READY',195,39,11,color.muted,'center');
    if(game.boosted){
      const left=game.boostLeft/(game.round.boost?.ms||1);
      text(`x2 ${game.frozen?'❄':'·'} ${(game.boostLeft/1000).toFixed(1)}s`,10,57,10,color.boost);roundRect(62,54,60*left,5,2.5,color.boost);
    }
    text(`${game.board.size}${game.roadLimit?` / ${game.roadLimit}`:''} SQUARES${game.roadLimit&&game.board.size>game.roadLimit?' · PROTECTED':''}`,195,56,9,game.roadLimit&&game.roadLimit<game.settings.roadLimit?color.ring:color.muted,'center');
  }
  ctx.save();ctx.beginPath();ctx.rect(BOARD_X,BOARD_Y,BOARD_SIZE,BOARD_SIZE);ctx.clip();
  if(debug){ctx.strokeStyle='#25343e';ctx.lineWidth=.5;for(let i=0;i<=game.settings.grid;i++){
    const n=i*scale();ctx.beginPath();ctx.moveTo(BOARD_X+n,BOARD_Y);ctx.lineTo(BOARD_X+n,BOARD_Y+BOARD_SIZE);ctx.moveTo(BOARD_X,BOARD_Y+n);ctx.lineTo(BOARD_X+BOARD_SIZE,BOARD_Y+n);ctx.stroke();}}
  for(const k of game.board)square(cell(k),color.road);
  if(now<removedUntil){ctx.save();ctx.globalAlpha=(removedUntil-now)/900;for(const p of game.lastRemoved)if(!game.board.has(key(p)))square(p,'#604632',color.points);ctx.restore();}
  if(drawnRevision!==game.revision){route=game.preview();drawnRevision=game.revision;}
  for(const p of route.slice(1))square(p,'#287a79');
  // Thin arrows make direction visible independently of route color.
  ctx.strokeStyle=color.route;ctx.lineWidth=2;
  for(let i=1;i<route.length;i++){
    const a=screen(route[i-1]),b=screen(route[i]),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
    const x=a.x+dx*.6,y=a.y+dy*.6;ctx.beginPath();ctx.moveTo(x-ux*4-uy*3,y-uy*4+ux*3);ctx.lineTo(x,y);ctx.lineTo(x-ux*4+uy*3,y-uy*4-ux*3);ctx.stroke();
  }
  for(const [k,kind] of game.powerNodes){const c=screen(cell(k));drawPower(kind,c.x,c.y,scale(),now);}
  const pointTint=game.boosted?color.boost:color.points;
  for(const [k,value] of game.nodes){
    let c=screen(cell(k));const mover=game.movers.get(k);
    if(mover){
      // A moving 10: it slides between cells and wobbles just before it steps (stopped while frozen).
      const t=(game.liveMs-mover.movedAt)/TUNING.mover.slideMs,until=mover.nextMoveAt-game.liveMs;
      if(mover.from&&t<1){const f=screen(mover.from),e=1-(1-t)*(1-t);c={x:f.x+(c.x-f.x)*e,y:f.y+(c.y-f.y)*e};}
      if(game.running&&!game.frozen&&until<TUNING.mover.wobbleMs)c={x:c.x+Math.sin(now/32)*2.4*(1-until/TUNING.mover.wobbleMs),y:c.y};
      ctx.save();ctx.shadowColor=pointTint;ctx.shadowBlur=10;ctx.fillStyle=pointTint;ctx.beginPath();ctx.arc(c.x,c.y,scale()*.44,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.strokeStyle='#fff7d1';ctx.lineWidth=2;ctx.beginPath();ctx.arc(c.x,c.y,scale()*.44,0,Math.PI*2);ctx.stroke();
    }else{ctx.fillStyle=pointTint;ctx.beginPath();ctx.arc(c.x,c.y,scale()*.34,0,Math.PI*2);ctx.fill();}
    const shown=game.boosted?value*2:value;text(String(shown),c.x,c.y,Math.max(shown>9?8:10,scale()*(shown>9?.42:.52)),'#21211b','center');
  }
  const center=screen({x:(game.settings.grid-1)/2,y:(game.settings.grid-1)/2}),radius=game.radius*scale();
  ctx.fillStyle='#070c1088';ctx.beginPath();ctx.rect(BOARD_X,BOARD_Y,BOARD_SIZE,BOARD_SIZE);ctx.arc(center.x,center.y,radius,0,Math.PI*2,true);ctx.fill('evenodd');
  // Heartbeat: sharp attack, eased decay. Beats quicken and strengthen each phase.
  const phaseIndex=game.phase-1,beat=game.running&&!game.frozen?Math.pow(1-(game.beats%1),2.2):0;
  // Frozen: steady blue ring that blinks during its last FX.thawWarnMs.
  const thawing=game.frozen&&game.freezeUntil-game.elapsed<FX.thawWarnMs&&Math.floor(now/150)%2===0;
  const ringColor=game.frozen&&!thawing?color.freeze:color.ring;
  ctx.save();ctx.strokeStyle=ringColor;ctx.lineWidth=3+beat*FX.pulseWidth[phaseIndex]+(game.frozen?1.5:0);ctx.shadowColor=ringColor;ctx.shadowBlur=game.frozen?14:beat*FX.pulseGlow[phaseIndex];
  ctx.beginPath();ctx.arc(center.x,center.y,radius,0,Math.PI*2);ctx.stroke();
  if(beat>.05){ctx.globalAlpha=beat*.45;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(center.x,center.y,Math.max(0,radius-(1-beat)*scale()*1.2),0,Math.PI*2);ctx.stroke();}
  ctx.restore();
  // Double bonus: a violet shimmer inside the frozen Ring.
  if(game.doubleBonus){ctx.save();ctx.globalAlpha=.55+.3*Math.sin(now/120);ctx.strokeStyle=color.boost;ctx.shadowColor=color.boost;ctx.shadowBlur=12;ctx.lineWidth=2;ctx.beginPath();ctx.arc(center.x,center.y,Math.max(0,radius-5),0,Math.PI*2);ctx.stroke();ctx.restore();}
  // Round cleared: the Ring blooms back out and the next round is announced.
  const bloom=(now-roundSurgeAt)/FX.roundSurgeMs;
  if(bloom>=0&&bloom<1){
    const e=1-(1-Math.min(1,bloom*2))**3,goal=game.goal;
    ctx.save();ctx.globalAlpha=bloom<.6?1:1-(bloom-.6)/.4;ctx.strokeStyle=color.points;ctx.lineWidth=5*(1-bloom)+1;ctx.shadowColor=color.points;ctx.shadowBlur=24;
    ctx.beginPath();ctx.arc(center.x,center.y,Math.max(0,radius*e),0,Math.PI*2);ctx.stroke();
    text(goal===null?game.round.name.toUpperCase():`ROUND ${game.roundIndex+1}`,195,BOARD_Y+BOARD_SIZE/2-12,30,color.points,'center');
    text(goal===null?'NO GOAL · SCORE ALL YOU CAN':`GOAL ${goal} · THE RING SPEEDS UP`,195,BOARD_Y+BOARD_SIZE/2+18,13,color.points,'center');
    if(roundNews)text(`NEW · ${roundNews}`,195,BOARD_Y+BOARD_SIZE/2+40,12,color.ink,'center');
    ctx.restore();
  }
  const surge=(now-phaseSurgeAt)/FX.phaseSurgeMs;
  if(surge>=0&&surge<1){
    ctx.save();ctx.globalAlpha=1-surge;ctx.strokeStyle=color.ring;ctx.lineWidth=6*(1-surge)+1;ctx.shadowColor=color.ring;ctx.shadowBlur=24;
    ctx.beginPath();ctx.arc(center.x,center.y,Math.max(0,radius-surge*scale()*4),0,Math.PI*2);ctx.stroke();
    text(`PHASE ${game.phase}`,195,BOARD_Y+BOARD_SIZE/2-12,30,color.ring,'center');text('THE RING QUICKENS',195,BOARD_Y+BOARD_SIZE/2+18,13,color.ring,'center');
    ctx.restore();
  }
  if(gesture?.mode==='drag'&&gesture.origin){
    const cells=game.cells(gesture.slot,gesture.origin),invalid=!!placementError(game.board,cells,game.settings.grid);
    for(const p of cells)square(p,invalid?'#b6264a':'#368776',invalid?color.red:color.route);
    if(invalid){const p=screen(cells[0]);text('×',p.x,p.y,24,color.ink,'center');}
  }
  const p=screen(game.position),hopT=game.hop?game.hop.elapsed/game.hop.duration:(now%700)/700;
  const bounce=game.over?0:Math.sin(hopT*Math.PI)*5;
  ctx.fillStyle='#080c1099';ctx.beginPath();ctx.ellipse(p.x,p.y+3,7,3,0,0,Math.PI*2);ctx.fill();
  // Fixed ground marker defines collision. Ears and visual bounce are decorative.
  ctx.strokeStyle=game.reverseQueued?color.points:color.ink;ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,game.settings.hitRadius*scale(),0,Math.PI*2);ctx.stroke();
  // Magnet: a faint ring shows how far he pulls.
  if(game.magnetActive&&game.round.magnet){ctx.save();ctx.globalAlpha=.35+.15*Math.sin(now/160);ctx.strokeStyle=POWER_LOOK.magnet.tint;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,(game.round.magnet.range+.3)*scale(),0,Math.PI*2);ctx.stroke();ctx.restore();}
  ctx.fillStyle=game.over?color.red:game.boosted?color.boost:game.sped?POWER_LOOK.speed.tint:color.ink;ctx.beginPath();ctx.arc(p.x,p.y-bounce,5,0,Math.PI*2);ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle=color.ink;ctx.beginPath();ctx.moveTo(p.x-2,p.y-bounce-3);ctx.lineTo(p.x-3,p.y-bounce-9);ctx.moveTo(p.x+2,p.y-bounce-3);ctx.lineTo(p.x+4,p.y-bounce-9);ctx.stroke();
  drawReverseTip(now,p,center.y-radius);
  particles=particles.filter(q=>now-q.born<FX.burstMs);floaters=floaters.filter(f=>now-f.born<FX.burstMs*1.4);
  for(const q of particles){const t=now-q.born,k=t/FX.burstMs;ctx.globalAlpha=1-k;ctx.fillStyle=q.tint;ctx.beginPath();ctx.arc(q.x+q.vx*t,q.y+q.vy*t,3*(1-k)+1,0,Math.PI*2);ctx.fill();}
  for(const f of floaters){const k=(now-f.born)/(FX.burstMs*1.4);ctx.globalAlpha=1-k*k;text(f.label,f.x,f.y-k*26,15+4*(1-k),f.tint,'center');}
  ctx.globalAlpha=1;
  ctx.restore();
  // Rounds powerups in the board's top corners (outside the Ring's circle): magnet and speed timers, and cherries.
  if(!game.over){
    let y=BOARD_Y+12;
    for(const [kind,left,total] of [['magnet',game.magnetLeft,game.round.magnet?.ms??1],['speed',game.speedLeft,game.round.speed?.ms??1]] as const){
      if(left<=0)continue;const look=POWER_LOOK[kind];
      text(`${look.glyph} ${look.name.toUpperCase()} ${game.frozen?'❄':''}${(left/1000).toFixed(1)}s`,BOARD_X+8,y,10,look.tint);roundRect(BOARD_X+8,y+7,56*left/total,3,1.5,look.tint);y+=22;
    }
    const cherry=game.round.cherry;
    if(cherry&&(game.cherries||unlockedKinds(game.round).includes('cherry'))){drawPower('cherry',BOARD_X+BOARD_SIZE-40,BOARD_Y+15,22,now);text(`${game.cherries}/${cherry.set}`,BOARD_X+BOARD_SIZE-8,BOARD_Y+16,11,color.ink,'right');}
  }
  text('TAP TO ROTATE · DRAG UP · SWIPE DOWN ↓ TO DISCARD',195,469,10,color.muted,'center');
  game.draft.forEach((draft,i)=>{
    const active=gesture?.slot===i,flash=flashSlot===i&&now<flashUntil;
    roundRect(slotX(i)-59,483,118,88,10,'#182630',flash?color.red:active&&gesture?.mode==='discard'?color.points:active?color.route:'#324652');
    if(!(active&&gesture?.mode==='drag')){
      const cells=game.cells(i),width=Math.max(...cells.map(p=>p.x))+1,height=Math.max(...cells.map(p=>p.y))+1;
      const unit=Math.min(scale(),96/width,54/height),left=slotX(i)-width*unit/2,top=DRAFT_Y-8-height*unit/2;
      cells.forEach(c=>{ctx.fillStyle='#8eabb9';ctx.fillRect(left+c.x*unit+.7,top+c.y*unit+.7,unit-1.4,unit-1.4);});
    }
    text(active&&gesture?.mode==='discard'?(game.running?'DISCARD ↓':'LOCKED'):active&&gesture?.mode==='drag'?'YOUR SLOT':`${draft.shapeId} · ${game.cells(i).length}`,slotX(i),558,11,color.muted,'center');
  });
  // The message line shrinks to fit rather than running off the canvas.
  ctx.font='400 11px system-ui, sans-serif';const fit=Math.max(8,Math.min(11,11*374/Math.max(1,ctx.measureText(message).width)));
  text(message,195,591,fit,messageColor,'center');text('CYAN ROUTE · GOLD PTS · VIOLET x2 · BLUE ❄ · TAP HIM = REVERSE',195,613,10,color.muted,'center');
}
/** Reverse tips (DECISIONS U38, U46): briefly before the start and just after it, near the top of the Ring so the first
 *  pieces' spots stay clear; and whenever his route is about to cross the Ring while a reverse can still save him, as a
 *  callout above him. Each comes with a ring around him. */
function drawReverseTip(now:number,p:Cell,ringTop:number){
  if(!reverseTips||game.over)return;
  const danger=game.running&&dangerIndex>=2&&!game.reverseQueued;
  // The start tip is for the start of the run only, not a round waiting after a clear.
  const shown=!game.running?(game.placements?Infinity:now-readyAt):now-firstPlacedAt,span=!game.running?FX.tipStartMs:FX.tipIntroMs;
  const intro=!danger&&shown<span&&!game.reversals;
  // Worded as an option, not a command (DECISIONS U47).
  const label=danger?'YOU CAN TAP HIM TO TURN HIM BACK!':!intro?'':game.running?'YOU CAN TAP HIM TO TURN HIM BACK':'ONCE HE’S MOVING, YOU CAN TAP HIM TO TURN HIM BACK';
  if(!label)return;
  const tint=danger?color.red:color.route,pulse=.5+.5*Math.sin(now/(danger?90:180));
  // The start tips fade over their last half second.
  ctx.save();ctx.globalAlpha=danger?1:Math.min(1,(span-shown)/500);
  ctx.save();ctx.globalAlpha*=.55+.45*pulse;ctx.strokeStyle=tint;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,14+5*pulse,0,Math.PI*2);ctx.stroke();ctx.restore();
  // Shrink the text to fit the board if a phone's font runs wide.
  ctx.font=`600 11px system-ui, sans-serif`;const size=Math.max(8,Math.min(11,11*(BOARD_SIZE-24)/ctx.measureText(label).width));
  ctx.font=`600 ${size}px system-ui, sans-serif`;const w=ctx.measureText(label).width+16,h=20;
  const x=Math.max(BOARD_X+4+w/2,Math.min(BOARD_X+BOARD_SIZE-4-w/2,danger?p.x:195));
  const y=danger?(p.y-36<BOARD_Y+h?p.y+34:p.y-36):Math.max(BOARD_Y+h,ringTop+24);
  roundRect(x-w/2,y-h/2,w,h,h/2,'#0b141c99',tint);text(label,x,y+.5,size,danger?color.red:color.ink,'center');
  ctx.restore();
}
function frame(now:number){
  game.advance(now-lastTime);lastTime=now;
  if(game.reversals&&!tipCounted){tipCounted=true;noteReversal(gtxStore,runId);}
  if(reverseTips&&game.running){
    // Look a few hops down his forecast route; index 1 is the hop in flight, which a reverse can no longer change.
    const left=game.hop?game.hop.duration-game.hop.elapsed:0,each=game.hop?.duration??game.round.hopMs;
    const i=routeCrossesRing(route,(game.settings.grid-1)/2,j=>game.radiusIn(left+(j-1)*each),game.settings.hitRadius);
    if(i>=2&&dangerIndex<2&&!game.reverseQueued&&dangerAnnounced<FX.tipAnnouncements){dangerAnnounced++;announce('Heading for the Ring · you can tap him to turn him back.',color.red);}
    dangerIndex=i;
  }
  if(game.over&&!lastOver){gesture=undefined;announce(`The Ring caught the jerboa. ${game.score} points.`,color.red);lastOver=true;checkpoint('caught');if(historyDialog.open)showRuns();
    // Feedback cadence only counts runs played with a Gametronyx session; the popup waits for the celebration.
    if(loadToken(gtxStore)){const {prompt,total}=countCompletedRun(gtxStore,feedbackEvery);if(prompt)feedbackDue=total;}
    void finishRun();}
  // Only a rising phase quickens the Ring; a new round starts back at phase 1 without the banner.
  if(game.running&&game.phase!==lastPhase){if(game.phase>lastPhase){phaseSurgeAt=now;announce(`Phase ${game.phase} · the Ring quickens.`,color.ring);}lastPhase=game.phase;}
  for(const pick of game.pickups)if(pick.seq>lastPickupSeq){
    lastPickupSeq=pick.seq;
    if(pick.kind==='round'){
      // A new level (DECISIONS U48): the old road flashes out and the next round waits for its first placement.
      roundSurgeAt=now;phaseSurgeAt=-Infinity;removedUntil=now+900;dangerIndex=-1;gesture=undefined;checkpoint();
      // Powerups this round unlocks (DECISIONS U45).
      const before=unlockedKinds(game.set.rounds[game.roundIndex-1]),fresh=unlockedKinds(game.round).filter(k=>!before.includes(k));
      roundNews=fresh.length===1?`${POWER_LOOK[fresh[0]].name.toUpperCase()} · ${POWER_LOOK[fresh[0]].about}`:fresh.map(k=>POWER_LOOK[k].name.toUpperCase()).join(' · ');
      const news=fresh.length?` New: ${fresh.map(k=>`${POWER_LOOK[k].name} (${POWER_LOOK[k].about})`).join(', ')}.`:'';
      const next=game.goal===null?game.round.name:`round ${game.roundIndex+1}`;
      announce(`Round ${game.roundIndex} clear! ${startMessage()}${news}`,color.points,`Round ${game.roundIndex} clear! Drag a piece up to start ${next}.`);
    }
    else if(pick.kind==='freeze'){burst(pick.at,color.freeze,'FREEZE!',now,20);announce(`The Ring is frozen for ${(game.round.freeze?.ms??0)/1000}s`,color.freeze);}
    else if(pick.kind==='boost'){burst(pick.at,color.boost,'x2!',now,20);announce(`x2 · faster and double points for ${(game.round.boost?.ms??0)/1000}s`,color.boost);}
    else if(pick.kind==='point')burst(pick.at,pick.via?POWER_LOOK[pick.via].tint:pick.boosted?color.boost:color.points,`+${pick.points}`,now);
    else if(pick.kind==='cherry'){
      const set=game.round.cherry?.set??2,look=POWER_LOOK.cherry;
      if(pick.points){burst(pick.at,look.tint,`+${pick.points}`,now,24);announce(`Cherries! +${pick.points} points.`,look.tint);}
      else{burst(pick.at,look.tint,`CHERRY ${game.cherries}/${set}`,now,12);announce(`Cherry ${game.cherries} of ${set}.`,look.tint);}
    }
    else{
      const look=POWER_LOOK[pick.kind],r=game.round;burst(pick.at,look.tint,`${look.name.toUpperCase()}!`,now,20);
      announce(pick.kind==='expand'?`The Ring is pushed back ${r.expand?.cells??0} cells.`:pick.kind==='sweep'?'Sweep! Every lowest-value node is yours.'
        :pick.kind==='magnet'?`Magnet: he grabs points within ${r.magnet?.range??0} cells for ${(r.magnet?.ms??0)/1000}s.`:`Speed: faster hops for ${(r.speed?.ms??0)/1000}s. No bonus.`,look.tint);
    }
  }
  // After the pickups, so this announcement wins when the freeze or x2 that starts it was just collected.
  if(game.doubleBonus&&!wasDoubleBonus){burst(game.position,color.boost,'DOUBLE BONUS!',now,24);announce('Double bonus! x2 waits while the Ring is frozen.',color.boost);}
  wasDoubleBonus=game.doubleBonus;
  // Pieces that no longer fit across the Ring are swapped out (never the one in your hand).
  for(const slot of game.replaceOutgrown(gesture?.slot??-1)){flashSlot=slot;flashUntil=now+650;announce('The Ring outgrew a piece · new piece dealt',color.ring);}
  if(game.running&&now-lastSave>5000)checkpoint();
  draw(now);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
