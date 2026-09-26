import {Game,DEFAULTS,type Settings} from './game.js';
import {cell,key,placementError,type Cell} from './runway.js';
import {gestureMode,downwardSwipe,type GestureMode} from './input.js';
import {readHistory,saveReport,runReport,exportHistory,type Outcome,type RunReport} from './stats.js';
import './style.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<main class="game-shell">
  <div class="tools"><span>P1 · PLAYTEST 2</span><button id="runs" type="button">Runs</button><button id="tune" type="button">Tune</button><button id="restart" type="button">New run</button></div>
  <canvas id="game" width="390" height="626" aria-label="Jerboa runway game. Tap a draft piece to rotate, drag to connect runway, swipe down from the draft to discard. Tap the jerboa to reverse."></canvas>
  <div id="announcement" class="sr-only" aria-live="polite"></div>
  <dialog id="settings"><form method="dialog"><h2>Playtest tuning</h2><p>Changes start a new run. Opening this panel does not pause an active run.</p>
    <label>Run length<select id="duration"><option value="60">1 minute</option><option value="120">2 minutes</option><option value="180">3 minutes</option></select></label>
    <label>Board size<select id="grid"><option value="15">15 × 15</option><option value="19">19 × 19</option><option value="23">23 × 23</option></select></label>
    <label>Hop interval<select id="hop"><option value="300">Fast · 0.30 seconds</option><option value="450">Default · 0.45 seconds</option><option value="650">Slow · 0.65 seconds</option></select></label>
    <label>Active point nodes<input id="nodes" type="number" min="1" max="20"></label>
    <label>Runway square limit (0 = unlimited)<input id="limit" type="number" min="0" max="961"></label>
    <label>Ring hit radius (cells)<select id="hit"><option value="0.1">Forgiving · 0.10</option><option value="0.24">Original · 0.24</option><option value="0">Center only · 0</option></select></label>
    <label>Random seed<input id="seed" type="number" min="0" max="4294967295"></label>
    <label class="check"><input id="debug" type="checkbox"> Show designer grid</label>
    <div class="actions"><button value="cancel">Close</button><button id="apply" value="apply">Apply & restart</button></div>
  </form></dialog>
  <dialog id="history"><h2>Your playtest runs</h2><p>Saved on this browser and address only. No automatic uploads. Export the runs to share them for review. Up to 50 runs; saving may retain fewer if storage is full. Play continues while this panel is open.</p><p id="save-status"></p><div id="run-list"></div><div class="actions"><button id="export" type="button">Export runs</button><button id="close-history" type="button">Close</button></div><details id="export-fallback" hidden><summary>Copy the report if the download does not appear</summary><label>Run report<textarea id="report-text" readonly rows="6"></textarea></label></details></dialog>
</main>`;
const canvas=document.querySelector<HTMLCanvasElement>('#game')!,ctx=canvas.getContext('2d')!;
const dialog=document.querySelector<HTMLDialogElement>('#settings')!;
const input=(id:string)=>document.getElementById(id) as HTMLInputElement;
const query=new URLSearchParams(location.search);
const numeric=(name:string,fallback:number)=>{const value=Number(query.get(name));return query.has(name)&&Number.isFinite(value)?value:fallback;};
let settings:Settings={...DEFAULTS,duration:numeric('duration',180),grid:numeric('grid',19),hopMs:numeric('hop',450),nodeCount:numeric('nodes',6),seed:numeric('seed',Math.floor(Math.random()*0xffffffff)),roadLimit:numeric('limit',25),hitRadius:numeric('hit',.10)};
let game=new Game(settings),debug=query.has('debug');
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
const W=390,H=626,BOARD_Y=64,BOARD_SIZE=386,BOARD_X=2,DRAFT_Y=528,SLOTS=[66,195,324];
const color={bg:'#111820',road:'#354653',seam:'#667786',route:'#69e6dc',points:'#ffdc73',ring:'#f5a84a',red:'#ff5273',ink:'#f2f6f8',muted:'#a9bac5'};
let message='Tap a piece to rotate. Drag up to start.',messageColor=color.muted;
let flashSlot=-1,flashUntil=0,lastTime=performance.now(),drawnRevision=-1,route:Cell[]=[];
let lastOver=false,removedUntil=0;
type Gesture={id:number,slot:number,start:Cell,now:Cell,mode:GestureMode,origin?:Cell};
let gesture:Gesture|undefined;
function announce(text:string,tint=color.muted){message=text;messageColor=tint;document.querySelector('#announcement')!.textContent=text;}
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
  if(gesture||dialog.open||historyDialog.open)return;event.preventDefault();const p=pointer(event);
  if(game.over){if(p.y>240&&p.y<385)restart({...settings,seed:Math.floor(Math.random()*0xffffffff)});return;}
  const actor=screen(game.position);
  if(Math.hypot(p.x-actor.x,p.y-actor.y)<25){game.reverse();announce(game.running?'Turning back after this hop.':'Connect your first piece to begin.',color.route);return;}
  const slot=SLOTS.findIndex(x=>Math.abs(p.x-x)<59&&Math.abs(p.y-DRAFT_Y)<51);
  if(slot<0)return;gesture={id:event.pointerId,slot,start:p,now:p,mode:'pending'};canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;event.preventDefault();gesture.now=pointer(event);
  gesture.mode=gestureMode(gesture.mode,gesture.now.x-gesture.start.x,gesture.now.y-gesture.start.y);
  if(gesture.mode==='discard'){message=downwardSwipe(gesture.now.x-gesture.start.x,gesture.now.y-gesture.start.y)?'RELEASE TO DISCARD ↓':'Pull down to discard · return to cancel';messageColor=color.points;}
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
    if(mode==='discard'&&downwardSwipe(dx,dy)){game.discard(g.slot);announce('Discarded ↓ A new piece is ready.');}
    else if(mode==='pending'&&Math.hypot(dx,dy)<16){game.rotate(g.slot);announce('Rotated. Drag up when ready.');}
    else{flashSlot=g.slot;flashUntil=performance.now()+650;announce('Returned to your slot.');}
  }else{
    const error=game.place(g.slot,origin(p,g.slot));
    if(error){flashSlot=g.slot;flashUntil=performance.now()+800;announce(`${error} · returned to your slot`,color.red);}
    else{removedUntil=performance.now()+900;announce(game.lastRemoved.length?`Placed · cleared ${game.lastRemoved.length} old squares`:'Runway placed. Tap the jerboa to reverse.',color.route);}
  }
  checkpoint();
});
canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);window.addEventListener('blur',cancel);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();checkpoint();}});
function restart(newSettings=settings){checkpoint(game.over?'caught':'restarted');settings={...newSettings};game=new Game(settings);runId=newRunId();startedAt=new Date().toISOString();gesture=undefined;drawnRevision=-1;lastTime=performance.now();lastOver=false;removedUntil=0;announce('Tap a piece to rotate. Drag up to start.');}
document.querySelector('#restart')!.addEventListener('click',()=>restart({...settings,seed:Math.floor(Math.random()*0xffffffff)}));
document.querySelector('#tune')!.addEventListener('click',()=>{
  cancel();input('duration').value=String(game.settings.duration);input('grid').value=String(game.settings.grid);input('hop').value=String(game.settings.hopMs);
  input('nodes').value=String(game.settings.nodeCount);input('seed').value=String(game.settings.seed);input('debug').checked=debug;dialog.showModal();
  input('limit').value=String(game.settings.roadLimit);input('hit').value=String(game.settings.hitRadius);
});
document.querySelector('#apply')!.addEventListener('click',event=>{
  event.preventDefault();if(!dialog.querySelector('form')!.reportValidity())return;
  debug=input('debug').checked;restart({...settings,duration:Number(input('duration').value),grid:Number(input('grid').value),hopMs:Number(input('hop').value),nodeCount:Number(input('nodes').value),seed:Number(input('seed').value),roadLimit:Number(input('limit').value),hitRadius:Number(input('hit').value)});dialog.close();
});
function draw(now:number){
  const dpr=Math.min(devicePixelRatio||1,3);if(canvas.width!==W*dpr){canvas.width=W*dpr;canvas.height=H*dpr;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle=color.bg;ctx.fillRect(0,0,W,H);
  text('3 MINUTES TO MIDNIGHT',10,15,12,color.muted);text(String(game.score)+' PTS',10,40,23);
  const seconds=Math.max(0,Math.ceil((game.settings.duration*1000-game.elapsed)/1000));
  text(`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,380,38,23,color.ink,'right');
  text(game.running?`PHASE ${game.phase} / 3`:game.over?'CAUGHT':'READY',195,39,11,color.muted,'center');
  text(`${game.board.size}${game.settings.roadLimit?` / ${game.settings.roadLimit}`:''} SQUARES${game.settings.roadLimit&&game.board.size>game.settings.roadLimit?' · PROTECTED':''}`,195,56,9,color.muted,'center');
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
  for(const [k,value] of game.nodes){const c=screen(cell(k));ctx.fillStyle=color.points;ctx.beginPath();ctx.arc(c.x,c.y,scale()*.34,0,Math.PI*2);ctx.fill();text(String(value),c.x,c.y,Math.max(10,scale()*.52),'#21211b','center');}
  const center=screen({x:(game.settings.grid-1)/2,y:(game.settings.grid-1)/2}),radius=game.radius*scale();
  ctx.fillStyle='#070c1088';ctx.beginPath();ctx.rect(BOARD_X,BOARD_Y,BOARD_SIZE,BOARD_SIZE);ctx.arc(center.x,center.y,radius,0,Math.PI*2,true);ctx.fill('evenodd');
  ctx.strokeStyle=color.ring;ctx.lineWidth=3;ctx.beginPath();ctx.arc(center.x,center.y,radius,0,Math.PI*2);ctx.stroke();
  if(gesture?.mode==='drag'&&gesture.origin){
    const cells=game.cells(gesture.slot,gesture.origin),invalid=!!placementError(game.board,cells,game.settings.grid);
    for(const p of cells)square(p,invalid?'#b6264a':'#368776',invalid?color.red:color.route);
    if(invalid){const p=screen(cells[0]);text('×',p.x,p.y,24,color.ink,'center');}
  }
  const p=screen(game.position),hopT=game.hop?game.hop.elapsed/game.settings.hopMs:(now%700)/700;
  const bounce=game.over?0:Math.sin(hopT*Math.PI)*5;
  ctx.fillStyle='#080c1099';ctx.beginPath();ctx.ellipse(p.x,p.y+3,7,3,0,0,Math.PI*2);ctx.fill();
  // Fixed ground marker defines collision. Ears and visual bounce are decorative.
  ctx.strokeStyle=game.reverseQueued?color.points:color.ink;ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,game.settings.hitRadius*scale(),0,Math.PI*2);ctx.stroke();
  ctx.fillStyle=game.over?color.red:color.ink;ctx.beginPath();ctx.arc(p.x,p.y-bounce,5,0,Math.PI*2);ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle=color.ink;ctx.beginPath();ctx.moveTo(p.x-2,p.y-bounce-3);ctx.lineTo(p.x-3,p.y-bounce-9);ctx.moveTo(p.x+2,p.y-bounce-3);ctx.lineTo(p.x+4,p.y-bounce-9);ctx.stroke();
  ctx.restore();
  text('TAP TO ROTATE · DRAG UP · SWIPE DOWN ↓ TO DISCARD',195,469,10,color.muted,'center');
  game.draft.forEach((draft,i)=>{
    const active=gesture?.slot===i,flash=flashSlot===i&&now<flashUntil;
    roundRect(SLOTS[i]-59,483,118,88,10,'#182630',flash?color.red:active&&gesture?.mode==='discard'?color.points:active?color.route:'#324652');
    if(!(active&&gesture?.mode==='drag')){
      const cells=game.cells(i),width=Math.max(...cells.map(p=>p.x))+1,height=Math.max(...cells.map(p=>p.y))+1;
      const unit=Math.min(scale(),96/width,54/height),left=SLOTS[i]-width*unit/2,top=DRAFT_Y-8-height*unit/2;
      cells.forEach(c=>{ctx.fillStyle='#8eabb9';ctx.fillRect(left+c.x*unit+.7,top+c.y*unit+.7,unit-1.4,unit-1.4);});
    }
    text(active&&gesture?.mode==='discard'?'DISCARD ↓':active&&gesture?.mode==='drag'?'YOUR SLOT':`${draft.shapeId} · ${game.cells(i).length}`,SLOTS[i],558,11,color.muted,'center');
  });
  text(message,195,591,11,messageColor,'center');text('CYAN = HIS ROUTE     GOLD = POINTS     TAP HIM = REVERSE',195,613,10,color.muted,'center');
  if(game.over){
    ctx.fillStyle='#09121bba';ctx.fillRect(0,BOARD_Y,W,BOARD_SIZE);
    roundRect(34,222,322,167,18,'#182630','#526976');text('THE RING CAUGHT HIM',195,251,17,color.ink,'center');
    text(`${game.score} POINTS`,195,291,31,color.points,'center');
    text(`${game.collected} nodes · ${(game.elapsed/1000).toFixed(1)} seconds`,195,323,13,color.muted,'center');
    text('Tap here for another run',195,361,14,color.route,'center');
  }
}
function frame(now:number){
  game.advance(now-lastTime);lastTime=now;
  if(game.over&&!lastOver){gesture=undefined;announce(`The Ring caught the jerboa. ${game.score} points.`,color.red);lastOver=true;checkpoint('caught');if(historyDialog.open)showRuns();}
  if(game.running&&now-lastSave>5000)checkpoint();
  draw(now);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
