// End-of-run screen (docs/DECISIONS.md, Leaderboard end screen). It replaces the canvas "caught" panel: a cheer sized
// to the news, the score counting up, the leaderboard with the player's row lit, and Play again. main.ts decides what to
// show; this module only renders it.
import {boardRows,anchorScroll,type Board,type Cheer,type Tier} from './leaderboard.js';

export type FinaleRun={id:string,score:number,nodes:number,seconds:number,escapes:number,round?:string};
// armMs: Play again ignores taps this long, so a finger still on the draft tray at capture can't skip the celebration.
const FX={countMs:900,armMs:700,settleMs:1800,confettiMs:3600,confetti:{top:64,best:56,first:48,tied:24,close:24,run:14,tuned:10} as Record<Tier,number>};
const CONFETTI=['#ffdc73','#69e6dc','#c77dff','#5aa9ff','#ff5273','#f5a84a'];
const MEDALS=['🥇','🥈','🥉'];

const clock=(s:number)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const when=(iso?:string)=>{if(!iso)return '';const d=new Date(iso);return `${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})} · ${d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`;};

/** `site` is the Gametronyx home page: "More games" links there, and so does "gametronyx.com" in a note. */
export function createFinale(root:HTMLElement,onPlay:()=>void,site:string){
  const $=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>(`#${id}`)!;
  const headline=$('finale-headline'),points=$('finale-points'),stats=$('finale-stats'),detail=$('finale-detail'),board=$('finale-board');
  const title=$('finale-board-title'),rows=$<HTMLOListElement>('finale-rows'),note=$('finale-note'),play=$<HTMLButtonElement>('play-again'),confetti=$('finale-confetti');
  const more=$<HTMLAnchorElement>('more-games');more.href=site;
  let runId:string|null=null,armedAt=0,timers:number[]=[];
  const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const later=(ms:number,fn:()=>void)=>{timers.push(window.setTimeout(fn,ms));};
  play.addEventListener('click',()=>{if(performance.now()>=armedAt)onPlay();});
  // The same guard keeps a finger still on the draft tray from leaving the game.
  more.addEventListener('click',event=>{if(performance.now()<armedAt)event.preventDefault();});
  /** The note as text, with "gametronyx.com" linking to the site. */
  function setNote(message:string){
    const at=message.indexOf('gametronyx.com');
    if(at<0){note.textContent=message;return;}
    const link=document.createElement('a');link.href=site;link.textContent='gametronyx.com';
    note.replaceChildren(message.slice(0,at),link,message.slice(at+'gametronyx.com'.length));
  }
  // Fades at the list's edges say there is more board above or below.
  const edges=()=>{rows.classList.toggle('more-above',rows.scrollTop>2);rows.classList.toggle('more-below',rows.scrollTop+rows.clientHeight<rows.scrollHeight-2);};
  rows.addEventListener('scroll',edges,{passive:true});

  function countUp(id:string,score:number){
    if(calm()||score<=0){points.textContent=String(score);return;}
    const start=performance.now();
    const step=(now:number)=>{if(runId!==id)return;const t=Math.min(1,(now-start)/FX.countMs);points.textContent=String(Math.round(score*(1-Math.pow(1-t,3))));if(t<1)requestAnimationFrame(step);};
    requestAnimationFrame(step);
  }
  function burst(tier:Tier){
    confetti.replaceChildren();if(calm())return;
    for(let i=0;i<FX.confetti[tier];i++){
      const bit=document.createElement('i');
      bit.style.cssText=`left:${Math.random()*100}%;background:${CONFETTI[i%CONFETTI.length]};--delay:${Math.round(Math.random()*450)}ms;--fall:${Math.round(1700+Math.random()*1300)}ms;--drift:${Math.round((Math.random()-.5)*90)}px;--spin:${Math.round(360+Math.random()*540)*(Math.random()<.5?-1:1)}deg`;
      confetti.append(bit);
    }
    later(FX.confettiMs,()=>confetti.replaceChildren());
  }
  function renderRows(b:Board){
    rows.replaceChildren();
    const shown=boardRows(b);
    if(!shown.length){const li=document.createElement('li');li.className='empty';li.textContent='No ranked runs yet. This could be the first!';rows.append(li);edges();return;}
    shown.forEach(row=>{
      const li=document.createElement('li');
      if(row==='gap'){li.className='gap';li.textContent='⋯';li.setAttribute('aria-hidden','true');rows.append(li);return;}
      if(row.me)li.className='me';
      const rank=document.createElement('span'),name=document.createElement('span'),score=document.createElement('span');
      rank.className='rank';rank.textContent=MEDALS[row.rank-1]??`#${row.rank}`;rank.setAttribute('aria-label',`Rank ${row.rank}`);
      const who=document.createElement('span');who.textContent=b.source==='local'?(row.me?'This run':when(row.at)):row.name;
      name.className='name';name.append(who);
      if(row.me&&b.source==='gtx'){const you=document.createElement('b');you.textContent='YOU';name.append(you);}
      score.className='score';score.textContent=String(row.score);
      li.append(rank,name,score);rows.append(li);
    });
    // The player's row always shows, a third of the way down; rows enter in order from the top of the view.
    const mine=rows.querySelector<HTMLElement>('li.me'),items=[...rows.children] as HTMLElement[];
    rows.scrollTop=mine?anchorScroll(mine.offsetTop,rows.clientHeight,rows.scrollHeight):0;
    const first=Math.max(0,items.findIndex(li=>li.offsetTop+li.offsetHeight>rows.scrollTop));
    items.forEach((li,i)=>li.style.setProperty('--i',String(Math.max(0,i-first))));
    edges();
  }

  /** The run just ended: count the score up and wait for the board. */
  function show(run:FinaleRun){
    timers.forEach(clearTimeout);timers=[];runId=run.id;armedAt=performance.now()+FX.armMs;
    root.dataset.tier='';root.classList.add('waiting');root.hidden=false;
    headline.textContent='';detail.textContent='';note.textContent='';title.textContent='LEADERBOARD';rows.replaceChildren();
    stats.textContent=[run.round??'',`${run.nodes} node${run.nodes===1?'':'s'}`,`${clock(run.seconds)} survived`,run.escapes?`${run.escapes} close escape${run.escapes===1?'':'s'}`:''].filter(Boolean).join(' · ');
    points.textContent='0';countUp(run.id,run.score);
    play.focus({preventScroll:true});
  }
  /** Fill in the cheer and the board; `onSettled` runs once the celebration has played out. Late replies for an
   *  earlier run are ignored. */
  function fill(id:string,b:Board,c:Cheer,message:string,onSettled?:()=>void){
    if(id!==runId)return;
    root.classList.remove('waiting');root.dataset.tier=c.tier;
    headline.textContent=c.headline;detail.textContent=c.detail;setNote(message);
    title.textContent=b.source==='gtx'?(b.season?`LEADERBOARD · ${b.season}`:'LEADERBOARD'):(b.label??'Your best runs · this device').toUpperCase();
    board.dataset.source=b.source;renderRows(b);burst(c.tier);
    if(onSettled)later(FX.settleMs,()=>{if(runId===id)onSettled();});
  }
  function hide(){timers.forEach(clearTimeout);timers=[];runId=null;root.hidden=true;confetti.replaceChildren();}
  return {show,fill,hide,get open(){return runId!==null;}};
}
