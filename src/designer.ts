// Round designer (docs/DECISIONS.md U44): edit the round set that the Rounds trial plays, see the Ring across the whole
// run, and play it, export it or share it. Every set that leaves this page goes through parseRoundSet, like any set
// from outside. Plays are unranked. Nothing here changes Classic.
import {BUILTIN_ROUNDS,CUSTOM_ROUNDS_KEY,NODE_VALUES,parseRoundSet,encodeRoundSet,decodeRoundSet,ringTimeline,roundPhaseAt,type Round,type RoundSet} from './rounds.js';
import {DEFAULTS} from './game.js';
import './designer.css';

const GRID=DEFAULTS.grid,FULL=GRID/2-.25,MAX_ROUNDS=12;
const root=document.querySelector<HTMLDivElement>('#designer')!;
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const fresh=():RoundSet=>({...clone(BUILTIN_ROUNDS),id:'custom',name:'My rounds'});
const clock=(s:number)=>`${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}`;
function el<K extends keyof HTMLElementTagNameMap>(tag:K,props:Record<string,unknown>={},...children:(Node|string)[]):HTMLElementTagNameMap[K]{
  const node=Object.assign(document.createElement(tag),props);node.append(...children);return node;
}

function loadSet():{set:RoundSet,note:string}{
  const shared=new URLSearchParams(location.hash.slice(1)).get('set');
  if(shared){const set=decodeRoundSet(shared);history.replaceState(null,'',location.pathname+location.search);
    if(set)return {set:{...set,id:'custom'},note:'Loaded the shared round set.'};
    return {set:fresh(),note:'That share link couldn’t be read, so this is the built-in set.'};}
  try{const set=parseRoundSet(JSON.parse(localStorage.getItem(CUSTOM_ROUNDS_KEY)??'null'));if(set)return {set:{...set,id:'custom'},note:''};}catch{/* Storage may be disabled. */}
  return {set:fresh(),note:''};
}
let {set,note:startNote}=loadSet();

root.innerHTML=`<header class="top"><a class="back" href="./index.html">‹ Back to the game</a>
  <h1>Round designer</h1><p class="lede">Build the rounds for the Rounds trial: each round's goal, Ring, hop speed, nodes and powerups. <b>Play</b> runs your set on this device. Rounds runs aren't ranked.</p></header>
  <label class="set-name">Set name<input id="set-name" maxlength="40"></label>
  <div class="actions"><button id="play" class="primary" type="button">Play these rounds</button><button id="share" type="button">Copy share link</button><button id="export" type="button">Export JSON</button><label class="button" for="import">Import JSON</label><input id="import" type="file" accept="application/json,.json" hidden><button id="reset" type="button">Reset to built-in</button></div>
  <p id="status" class="status" role="status" aria-live="polite"></p><input id="share-url" class="share-url" readonly hidden aria-label="Share link">
  <section class="card chart-card" aria-labelledby="chart-title"><h2 id="chart-title">The Ring across the run</h2>
    <p class="sub">Radius in cells on the ${GRID}×${GRID} board if every round runs its full length. A round ends early when its goal is scored; the Ring then starts full again.</p>
    <div class="chart" id="chart"></div>
    <details><summary>Table</summary><table id="summary"><thead><tr><th>Round</th><th>Starts</th><th>Length</th><th>Goal</th><th>Hop</th><th>Nodes</th><th>Powerups</th></tr></thead><tbody></tbody></table></details>
  </section>
  <div id="rounds"></div>
  <button id="add" class="add" type="button">Add a round</button>`;

const $=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>(`#${id}`)!;
const status=(text:string,bad=false)=>{const s=$('status');s.textContent=text;s.classList.toggle('bad',bad);};
const nameInput=$<HTMLInputElement>('set-name');nameInput.value=set.name;nameInput.addEventListener('input',()=>{set.name=nameInput.value;save();});

/** The set as the game will read it, or a message saying what to fix. */
function checked():RoundSet|string{
  for(const [i,r] of set.rounds.entries())for(const [j,p] of r.phases.entries())
    if(!p.weights.some(w=>w>0))return `Round ${i+1}, phase ${j+1}: give at least one point value a weight.`;
  const parsed=parseRoundSet(set);return parsed?{...parsed,id:'custom'}:'This set can’t be played. Check the numbers.';
}
// Keep the working set on this device so a reload doesn't lose it; Play reads the same key.
function save(){const ok=checked();if(typeof ok!=='string')try{localStorage.setItem(CUSTOM_ROUNDS_KEY,JSON.stringify(ok));}catch{/* Storage may be full or disabled. */}}

// ---- chart: one series (the Ring's radius), a crosshair and tooltip, round boundaries labelled directly ----
// Drawn at the container's real width so text stays at its intended pixel size on a phone.
const CH={w:640,h:220,l:30,r:10,t:30,b:24};
function drawChart(){
  const box=$('chart');CH.w=Math.max(280,Math.round(box.clientWidth||640));box.replaceChildren();
  const points=ringTimeline(set,GRID,500),total=points[points.length-1][0];
  const x=(t:number)=>CH.l+(t/total)*(CH.w-CH.l-CH.r),y=(r:number)=>CH.t+(1-r/FULL)*(CH.h-CH.t-CH.b);
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${CH.w} ${CH.h}`);svg.setAttribute('role','img');svg.setAttribute('tabindex','0');
  svg.setAttribute('aria-label',`Ring radius over ${clock(total)} across ${set.rounds.length} rounds. Use the arrow keys to read values.`);
  const add=(tag:string,attrs:Record<string,string|number>,text?:string)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;svg.append(n);return n;};
  for(const r of [0,3,6,9].filter(v=>v<=FULL)){add('line',{x1:CH.l,x2:CH.w-CH.r,y1:y(r),y2:y(r),class:'grid'});add('text',{x:CH.l-6,y:y(r)+4,class:'tick','text-anchor':'end'},String(r));}
  const every=total/60>(CH.w-CH.l)/44?120:60;
  for(let t=every;t<total;t+=every)add('text',{x:x(t),y:CH.h-6,class:'tick','text-anchor':'middle'},clock(t));
  // Round boundaries, and each round's name and goal above its span when it fits.
  let start=0;
  set.rounds.forEach((r,i)=>{
    if(i)add('line',{x1:x(start),x2:x(start),y1:CH.t-6,y2:CH.h-CH.b,class:'divider'});
    // Name and goal when they fit over the round's span, else the goal (or name) alone.
    const span=x(start+r.duration)-x(start),long=r.goal===null?`${r.name} · no goal`:`${r.name} · goal ${r.goal}`,short=r.goal===null?r.name:`goal ${r.goal}`;
    const label=[long,short].find(l=>span>l.length*6.4+6);
    if(label)add('text',{x:x(start)+span/2,y:CH.t-12,class:'round-label','text-anchor':'middle'},label);
    start+=r.duration;
  });
  // A vertical drop at each boundary is the Ring starting full again, not a jump in time.
  const path=points.map(([t,r],i)=>`${i&&points[i-1][2]!==points[i][2]?'M':i?'L':'M'}${x(t).toFixed(1)},${y(r).toFixed(1)}`).join('');
  const segments=set.rounds.map((_,i)=>points.filter(p=>p[2]===i));
  for(const seg of segments)add('path',{d:`M${x(seg[0][0])},${y(0)}${seg.map(([t,r])=>`L${x(t).toFixed(1)},${y(r).toFixed(1)}`).join('')}L${x(seg[seg.length-1][0])},${y(0)}Z`,class:'area'});
  add('path',{d:path,class:'line'});
  const cross=add('line',{y1:CH.t,y2:CH.h-CH.b,class:'cross',visibility:'hidden'}),dot=add('circle',{r:4,class:'dot',visibility:'hidden'});
  const tip=el('div',{className:'tip',hidden:true});box.append(svg,tip);
  let at=-1;
  const show=(i:number)=>{
    at=Math.max(0,Math.min(points.length-1,i));const [t,r,ri]=points[at],round=set.rounds[ri];
    const into=t-set.rounds.slice(0,ri).reduce((a,q)=>a+q.duration,0);
    cross.setAttribute('x1',String(x(t)));cross.setAttribute('x2',String(x(t)));dot.setAttribute('cx',String(x(t)));dot.setAttribute('cy',String(y(r)));
    cross.setAttribute('visibility','visible');dot.setAttribute('visibility','visible');
    tip.replaceChildren(el('strong',{textContent:`${r.toFixed(1)} cells`}),el('span',{textContent:`${round.name} · ${clock(into)} in · phase ${roundPhaseAt(into*1000,round)} of ${round.phases.length}`}));
    tip.hidden=false;const rect=svg.getBoundingClientRect(),px=x(t)/CH.w*rect.width;
    tip.style.left=`${Math.min(Math.max(px,70),rect.width-70)}px`;tip.style.top=`${y(r)/CH.h*rect.height}px`;
  };
  const hide=()=>{cross.setAttribute('visibility','hidden');dot.setAttribute('visibility','hidden');tip.hidden=true;};
  svg.addEventListener('pointermove',e=>{const rect=svg.getBoundingClientRect(),t=((e.clientX-rect.left)/rect.width*CH.w-CH.l)/(CH.w-CH.l-CH.r)*total;
    let best=0;for(let i=1;i<points.length;i++)if(Math.abs(points[i][0]-t)<Math.abs(points[best][0]-t))best=i;show(best);});
  svg.addEventListener('pointerleave',hide);svg.addEventListener('blur',hide);
  svg.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();show((at<0?0:at)+(e.key==='ArrowRight'?10:-10));}});
  // Table view: the same numbers without hovering.
  const body=root.querySelector('#summary tbody')!;body.replaceChildren();start=0;
  set.rounds.forEach((r,i)=>{
    const kinds=[r.boost&&(r.spawner?.weights.boost??0)>0?'x2':'',r.freeze&&(r.spawner?.weights.freeze??0)>0?'freeze':''].filter(Boolean).join(', ')||'none';
    body.append(el('tr',{},...[`${i+1}. ${r.name}`,clock(start),`${r.duration} s`,r.goal===null?'none':String(r.goal),`${r.hopMs} ms`,String(r.nodeCount),kinds].map(v=>el('td',{textContent:v}))));
    start+=r.duration;
  });
}

// ---- round editor ----
type Field={label:string,get:()=>number,set:(v:number)=>void,min:number,max:number,step:number,unit?:string,hint?:string};
function slider(f:Field){
  const range=el('input',{type:'range',min:String(f.min),max:String(f.max),step:String(f.step),value:String(f.get())});
  const num=el('input',{type:'number',min:String(f.min),max:String(f.max),step:String(f.step),value:String(f.get()),className:'num'});
  const sync=(v:number)=>{if(!Number.isFinite(v))return;v=Math.max(f.min,Math.min(f.max,v));f.set(v);range.value=num.value=String(v);changed();};
  range.addEventListener('input',()=>sync(Number(range.value)));num.addEventListener('change',()=>sync(Number(num.value)));
  range.setAttribute('aria-label',f.label);
  return el('label',{className:'field'},el('span',{className:'name'},f.label,f.unit?el('small',{textContent:` (${f.unit})`}):''),el('span',{className:'pair'},range,num),f.hint?el('small',{className:'hint',textContent:f.hint}):'');
}
const numberBox=(label:string,value:number,min:number,max:number,step:number,onChange:(v:number)=>void,aria?:string)=>{
  const input=el('input',{type:'number',min:String(min),max:String(max),step:String(step),value:String(value)});
  if(aria)input.setAttribute('aria-label',aria);
  input.addEventListener('change',()=>{const v=Math.max(min,Math.min(max,Number(input.value)||0));input.value=String(v);onChange(v);changed();});
  return label?el('label',{className:'mini'},el('span',{textContent:label}),input):input;
};
// Sequential gold ramp for point values 1 → 10 (magnitude: light to dark on the dark surface = dim to bright).
const VALUE_TINTS=['#6b5a2a','#8a7433','#a88e3c','#c7a845','#e6c24e','#ffdc73'];
function valueBar(weights:number[]){
  const total=weights.reduce((a,b)=>a+b,0)||1,bar=el('div',{className:'values-bar'});
  weights.forEach((w,i)=>{if(!w)return;const pct=w/total*100,seg=el('span',{title:`${NODE_VALUES[i]}: ${pct.toFixed(0)}%`});
    seg.style.flexGrow=String(w);seg.style.background=VALUE_TINTS[i];if(pct>=9)seg.textContent=String(NODE_VALUES[i]);if(i>=4)seg.classList.add('ink');bar.append(seg);});
  const text=el('small',{className:'hint',textContent:weights.map((w,i)=>`${NODE_VALUES[i]}: ${Math.round(w/total*100)}%`).join(' · ')});
  return el('div',{},bar,text);
}

function roundCard(r:Round,i:number){
  const last=i===set.rounds.length-1,card=el('fieldset',{className:'card round'});
  const title=el('input',{value:r.name,maxLength:24,className:'round-name'});title.setAttribute('aria-label',`Round ${i+1} name`);
  title.addEventListener('input',()=>{r.name=title.value||`Round ${i+1}`;changed();});
  const move=(to:number)=>{const [x]=set.rounds.splice(i,1);set.rounds.splice(to,0,x);fixGoals();rebuild();};
  const tools=el('div',{className:'round-tools'},
    el('button',{type:'button',textContent:'↑',title:'Move up',disabled:i===0,onclick:()=>move(i-1)}),
    el('button',{type:'button',textContent:'↓',title:'Move down',disabled:last,onclick:()=>move(i+1)}),
    el('button',{type:'button',textContent:'Duplicate',disabled:set.rounds.length>=MAX_ROUNDS,onclick:()=>{set.rounds.splice(i+1,0,clone(r));fixGoals();rebuild();}}),
    el('button',{type:'button',textContent:'Remove',disabled:set.rounds.length<=1,onclick:()=>{set.rounds.splice(i,1);fixGoals();rebuild();}}));
  tools.querySelectorAll('button').forEach(b=>b.setAttribute('aria-label',`${b.title||b.textContent} round ${i+1}`));
  card.append(el('legend',{},`Round ${i+1}`),el('div',{className:'round-head'},title,tools));
  card.append(last?el('p',{className:'finale',textContent:'Final round: no goal. The Ring closes fully and the run ends when it catches him.'})
    :slider({label:'Goal',unit:'points this round',get:()=>r.goal??20,set:v=>{r.goal=v;},min:1,max:300,step:1}));
  card.append(
    slider({label:'Ring length',unit:'s',get:()=>r.duration,set:v=>{r.duration=v;},min:15,max:300,step:5,hint:'Time for the Ring to close completely.'}),
    slider({label:'Hop',unit:'ms per hop',get:()=>r.hopMs,set:v=>{r.hopMs=v;},min:120,max:1000,step:10,hint:'Lower is faster.'}),
    slider({label:'Point nodes',get:()=>r.nodeCount,set:v=>{r.nodeCount=v;},min:1,max:20,step:1,hint:'At full size; fewer as the Ring closes.'}),
    slider({label:'Opening 5s',get:()=>r.openingFives,set:v=>{r.openingFives=v;},min:0,max:5,step:1}));
  // Phases: share of the round, pace, and point values.
  const phases=el('details',{className:'group'},el('summary',{textContent:'Ring phases and point values'}),
    el('p',{className:'hint',textContent:'Each phase: its share of the round and its pace (the Ring is rescaled to still close on time), and how likely each point value is. The 10 moves.'}));
  r.phases.forEach((p,j)=>{
    const values=el('div',{className:'weights'});
    const bar=el('div',{});const redraw=()=>bar.replaceChildren(valueBar(p.weights));
    p.weights.forEach((w,k)=>values.append(numberBox(String(NODE_VALUES[k]),w,0,100,1,v=>{p.weights[k]=v;redraw();},`Round ${i+1} phase ${j+1} weight for ${NODE_VALUES[k]}`)));
    redraw();
    phases.append(el('div',{className:'phase'},el('h4',{textContent:`Phase ${j+1}`}),
      el('div',{className:'row'},numberBox('Share %',Math.round(p.fraction*1000)/10,1,100,.1,v=>{p.fraction=v/100;}),numberBox('Pace ×',Math.round(p.speed*100)/100,.05,10,.05,v=>{p.speed=v;})),
      values,bar));
  });
  // Powerups, all through one spawner.
  r.spawner??={firstMs:8000,everyMs:12000,max:2,weights:{}};
  const sp=r.spawner;
  const kind=(label:string,key:'boost'|'freeze',extra:()=>HTMLElement[])=>{
    const on=el('input',{type:'checkbox',checked:!!r[key]&&(sp.weights[key]??0)>0});
    on.addEventListener('change',()=>{
      if(on.checked){if(key==='boost')r.boost??={firstMs:0,respawnMs:0,ms:7000,speed:1.4};else r.freeze??={firstMs:0,respawnMs:0,ms:6000};if(!(sp.weights[key]??0))sp.weights[key]=1;}
      else sp.weights[key]=0;
      changed();rebuild();
    });
    const body=on.checked?extra():[];
    return el('div',{className:'kind'},el('label',{className:'check'},on,` ${label}`),...body);
  };
  const power=el('details',{className:'group'},el('summary',{textContent:'Powerups'}),
    el('div',{className:'row'},numberBox('First (s)',sp.firstMs/1000,0,300,1,v=>{sp.firstMs=v*1000;}),numberBox('Every (s)',sp.everyMs/1000,1,300,1,v=>{sp.everyMs=v*1000;}),numberBox('Most at once',sp.max,1,4,1,v=>{sp.max=v;})),
    kind('x2 (double points, faster)','boost',()=>[el('div',{className:'row'},numberBox('Weight',sp.weights.boost??1,0,100,1,v=>{sp.weights.boost=v;}),numberBox('Lasts (s)',r.boost!.ms/1000,.5,30,.5,v=>{r.boost!.ms=v*1000;}),numberBox('Speed ×',r.boost!.speed,1,3,.1,v=>{r.boost!.speed=v;}))]),
    kind('❄ Freeze (time stops)','freeze',()=>[el('div',{className:'row'},numberBox('Weight',sp.weights.freeze??1,0,100,1,v=>{sp.weights.freeze=v;}),numberBox('Lasts (s)',r.freeze!.ms/1000,.5,30,.5,v=>{r.freeze!.ms=v*1000;}))]));
  card.append(phases,power);
  return card;
}
function fixGoals(){set.rounds.forEach((r,i)=>{if(i===set.rounds.length-1)r.goal=null;else r.goal??=20*(i+1);});}
function rebuild(){
  const open=[...root.querySelectorAll<HTMLDetailsElement>('#rounds details')].map(d=>d.open);
  const list=$('rounds');list.replaceChildren(...set.rounds.map(roundCard));
  root.querySelectorAll<HTMLDetailsElement>('#rounds details').forEach((d,i)=>{d.open=open[i]??false;});
  $<HTMLButtonElement>('add').disabled=set.rounds.length>=MAX_ROUNDS;changed();
}
function changed(){drawChart();save();}

$('add').addEventListener('click',()=>{const last=set.rounds[set.rounds.length-1];set.rounds.splice(set.rounds.length-1,0,{...clone(last),name:`Round ${set.rounds.length}`});fixGoals();rebuild();});
$('play').addEventListener('click',()=>{
  const ok=checked();if(typeof ok==='string'){status(ok,true);return;}
  try{localStorage.setItem(CUSTOM_ROUNDS_KEY,JSON.stringify(ok));}catch{status('This browser won’t save the set, so it can’t be played from here. Use Copy share link instead.',true);return;}
  location.href='./index.html?mode=rounds&set=custom';
});
$('share').addEventListener('click',async()=>{
  const ok=checked();if(typeof ok==='string'){status(ok,true);return;}
  const url=`${location.origin}${location.pathname}#set=${encodeRoundSet(ok)}`,box=$<HTMLInputElement>('share-url');
  box.value=url;box.hidden=false;box.select();
  try{await navigator.clipboard.writeText(url);status('Share link copied. Opening it loads this set in the designer.');}catch{status('Copy the share link below.');}
});
$('export').addEventListener('click',()=>{
  const ok=checked();if(typeof ok==='string'){status(ok,true);return;}
  const url=URL.createObjectURL(new Blob([JSON.stringify(ok,null,2)],{type:'application/json'}));
  const a=el('a',{href:url,download:`jerboa-rounds-${ok.name.replace(/[^\w-]+/g,'-').toLowerCase()}.json`});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  status('Exported.');
});
$<HTMLInputElement>('import').addEventListener('change',async e=>{
  const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;
  let next:RoundSet|null=null;try{next=parseRoundSet(JSON.parse(await file.text()));}catch{/* reported below */}
  (e.target as HTMLInputElement).value='';
  if(!next){status('That file isn’t a round set this designer can read.',true);return;}
  set={...next,id:'custom'};nameInput.value=set.name;rebuild();status(`Imported “${set.name}”.`);
});
$('reset').addEventListener('click',()=>{if(!confirm('Replace your rounds with the built-in set?'))return;set=fresh();nameInput.value=set.name;rebuild();status('Back to the built-in rounds.');});
window.addEventListener('resize',()=>drawChart());

rebuild();if(startNote)status(startNote,startNote.includes('couldn’t'));
