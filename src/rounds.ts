// Round configs (docs/DECISIONS.md U43–U45). A run plays a set of rounds: Classic is one round with no points goal;
// Rounds mode is several, each with a goal, and the last is the Midnight finale with none. Everything that shapes a
// round lives here: the Ring's length, phases and pulse, hop speed, node count and values, and powerups.
// Pure and dependency-free (game.ts imports it, never the reverse), so the designer page and node --test can use it.

/** Point values a node can have. Each phase's `weights` lines up with this list. The 10 is the moving node. */
export const NODE_VALUES=[1,2,3,4,5,10];
/** One Ring phase: its share of the round, its speed relative to the average needed to close on time, its heartbeat
 *  period, and the relative weights of NODE_VALUES for nodes spawned during it. */
export type Phase={fraction:number,speed:number,pulseMs:number,weights:number[]};
/** A powerup on its own timer (Classic): first appearance, and delay after the previous one is collected or lost. */
export type Timer={firstMs:number,respawnMs:number};
export type PowerKind='boost'|'freeze';
export const POWER_KINDS:PowerKind[]=['boost','freeze'];
/** Rounds mode: one spawner for all powerups instead of a timer each. Every `everyMs` (first at `firstMs` into the
 *  round) it places one powerup, picked by weight among the kinds this round has that are neither on the board nor
 *  active, unless `max` are already on the board. */
export type Spawner={firstMs:number,everyMs:number,max:number,weights:Partial<Record<PowerKind,number>>};
export type Round={
  name:string,
  /** Points to score this round to clear it; null for a round that ends only in capture (Classic, the finale). */
  goal:number|null,
  /** Seconds for the Ring to close completely. */
  duration:number,
  phases:Phase[],hopMs:number,nodeCount:number,
  /** How many of the round's first nodes are 5s. */
  openingFives:number,
  boost:(Timer&{ms:number,speed:number})|null,
  freeze:(Timer&{ms:number})|null,
  /** Present in Rounds mode; replaces the per-powerup timers. */
  spawner?:Spawner|null,
};
export type RoundSet={v:1,id:string,name:string,rounds:Round[]};

const phaseLengths=(r:Round)=>r.phases.map(p=>p.fraction*r.duration*1000);
/** Phase number (1-based) at `ringMs` into the round. */
export function roundPhaseAt(ringMs:number,r:Round):number{
  let end=0;const lengths=phaseLengths(r);
  for(let i=0;i<lengths.length;i++){end+=lengths[i];if(ringMs<end)return i+1;}
  return lengths.length;
}
/** The Ring's radius (cells) `ringMs` into the round: piecewise linear from grid/2 - .25 to zero at `duration`. */
export function roundRadius(ringMs:number,grid:number,r:Round):number{
  const initial=grid/2-.25,lengths=phaseLengths(r);
  let remaining=Math.max(0,ringMs),distance=0;
  r.phases.forEach((p,i)=>{const time=Math.min(lengths[i],remaining);distance+=initial/(r.duration*1000)*p.speed*time;remaining-=time;});
  return Math.max(0,initial-distance);
}
/** Continuous heartbeat count; the fractional part is the position within the current beat. */
export function roundBeats(ringMs:number,r:Round):number{
  const lengths=phaseLengths(r);let remaining=Math.max(0,ringMs),beats=0;
  r.phases.forEach((p,i)=>{const time=Math.min(lengths[i],remaining);beats+=time/p.pulseMs;remaining-=time;});
  return beats;
}
/** A value drawn by weight: `roll` in [0,1). */
export function pickValue(weights:number[],roll:number,values=NODE_VALUES):number{
  const total=weights.reduce((a,b)=>a+b,0);
  let pick=roll*total;for(let i=0;i<weights.length;i++){pick-=weights[i];if(pick<0)return values[i];}
  return values[values.length-1];
}
/** Weights for nodes spawned in `phase` (clamped to the round's phases). */
export const phaseWeights=(r:Round,phase:number)=>r.phases[Math.max(1,Math.min(r.phases.length,phase))-1].weights;

const clamp=(v:unknown,lo:number,hi:number,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):fallback;
const whole=(v:unknown,lo:number,hi:number,fallback:number)=>Math.round(clamp(v,lo,hi,fallback));
const label=(v:unknown,fallback:string,max=40)=>typeof v==='string'&&v.trim()?v.trim().slice(0,max):fallback;
type Loose=Record<string,unknown>;

function parseRound(x:Loose,i:number):Round|null{
  if(!Array.isArray(x.phases)||!x.phases.length)return null;
  const raw=(x.phases as Loose[]).slice(0,5);
  const phases:Phase[]=[];
  for(const p of raw){
    if(!p||typeof p!=='object'||!Array.isArray(p.weights)||p.weights.length!==NODE_VALUES.length)return null;
    const weights=(p.weights as unknown[]).map(w=>clamp(w,0,1000,0));
    if(!weights.some(w=>w>0))return null;
    phases.push({fraction:clamp(p.fraction,.01,1,1/raw.length),speed:clamp(p.speed,.05,10,1),pulseMs:whole(p.pulseMs,200,3000,1000),weights});
  }
  // The phases share the whole round, and the Ring still closes exactly at `duration`: Σ fraction × speed = 1.
  const share=phases.reduce((a,p)=>a+p.fraction,0);phases.forEach(p=>{p.fraction/=share;});
  const pace=phases.reduce((a,p)=>a+p.fraction*p.speed,0);phases.forEach(p=>{p.speed/=pace;});
  const timer=(t:unknown,ms:[number,number,number])=>{
    if(!t||typeof t!=='object')return null;const o=t as Loose;
    return {firstMs:whole(o.firstMs,0,600000,10000),respawnMs:whole(o.respawnMs,1000,600000,15000),ms:whole(o.ms,ms[0],ms[1],ms[2])};
  };
  const b=timer(x.boost,[500,30000,7000]),f=timer(x.freeze,[500,30000,6000]);
  let spawner:Spawner|null=null;
  if(x.spawner&&typeof x.spawner==='object'){
    const o=x.spawner as Loose,w=(o.weights&&typeof o.weights==='object'?o.weights:{}) as Loose;
    spawner={firstMs:whole(o.firstMs,0,600000,8000),everyMs:whole(o.everyMs,1000,600000,12000),max:whole(o.max,1,4,2),
      weights:Object.fromEntries(POWER_KINDS.map(k=>[k,clamp(w[k],0,100,0)]))};
  }
  const goal=x.goal===null||x.goal===undefined?null:whole(x.goal,1,100000,20);
  return {name:label(x.name,`Round ${i+1}`,24),goal,duration:clamp(x.duration,15,600,60),phases,hopMs:whole(x.hopMs,120,2000,450),
    nodeCount:whole(x.nodeCount,1,20,10),openingFives:whole(x.openingFives,0,5,0),
    boost:b&&{...b,speed:clamp((x.boost as Loose).speed,1,3,1.4)},freeze:f,spawner};
}

/** A round set from untrusted JSON (designer, share links, storage), clamped to playable limits; null if unusable.
 *  The last round never has a goal: the run always ends in capture. */
export function parseRoundSet(raw:unknown):RoundSet|null{
  if(!raw||typeof raw!=='object')return null;
  const o=raw as Loose;
  if(!Array.isArray(o.rounds)||!o.rounds.length||o.rounds.length>12)return null;
  const rounds:Round[]=[];
  for(const [i,x] of (o.rounds as unknown[]).entries()){
    if(!x||typeof x!=='object')return null;
    const round=parseRound(x as Loose,i);if(!round)return null;rounds.push(round);
  }
  rounds[rounds.length-1].goal=null;
  return {v:1,id:label(o.id,'custom').replace(/[^\w-]/g,'-'),name:label(o.name,'Custom rounds'),rounds};
}

// The built-in Rounds trial (DECISIONS U43): goals 20 / 40 / 60, each round's Ring a little shorter and his hops a
// little quicker, freeze unlocked from round 2, and a Midnight finale with no goal. Starting values; tune in the designer.
const CLASSIC_SHAPE=[{fraction:1/3,speed:.5,pulseMs:1400},{fraction:4/9,speed:.875,pulseMs:900},{fraction:2/9,speed:2,pulseMs:550}];
const shaped=(weights:number[][])=>CLASSIC_SHAPE.map((p,i)=>({...p,weights:weights[i]}));
const x2={firstMs:0,respawnMs:0,ms:7000,speed:1.4},ice={firstMs:0,respawnMs:0,ms:6000};
export const BUILTIN_ROUNDS:RoundSet={v:1,id:'rounds',name:'Rounds',rounds:[
  {name:'Round 1',goal:20,duration:100,hopMs:450,nodeCount:10,openingFives:2,boost:x2,freeze:null,
    phases:shaped([[30,28,22,14,6,1],[15,20,25,22,18,3],[6,12,22,28,32,6]]),spawner:{firstMs:8000,everyMs:12000,max:2,weights:{boost:1}}},
  {name:'Round 2',goal:40,duration:90,hopMs:420,nodeCount:10,openingFives:1,boost:x2,freeze:ice,
    phases:shaped([[20,24,24,18,12,2],[12,18,24,24,18,4],[6,12,20,28,28,6]]),spawner:{firstMs:6000,everyMs:12000,max:2,weights:{boost:1,freeze:1}}},
  {name:'Round 3',goal:60,duration:80,hopMs:390,nodeCount:10,openingFives:1,boost:x2,freeze:ice,
    phases:shaped([[12,18,24,22,20,4],[8,14,22,26,24,6],[4,10,18,28,32,8]]),spawner:{firstMs:6000,everyMs:11000,max:2,weights:{boost:1,freeze:1}}},
  {name:'Midnight',goal:null,duration:60,hopMs:360,nodeCount:10,openingFives:2,boost:x2,freeze:ice,
    phases:shaped([[6,12,20,26,28,8],[4,10,18,28,30,10],[2,8,16,28,34,12]]),spawner:{firstMs:5000,everyMs:10000,max:2,weights:{boost:1,freeze:1}}},
]};

/** The Ring's radius across a whole run if every round lasts its full length: [time (s), radius (cells), round index]. */
export function ringTimeline(set:RoundSet,grid:number,stepMs=1000):[number,number,number][]{
  const points:[number,number,number][]=[];let start=0;
  set.rounds.forEach((r,i)=>{
    const end=r.duration*1000;
    for(let t=0;t<end;t+=stepMs)points.push([(start+t)/1000,roundRadius(t,grid,r),i]);
    points.push([(start+end)/1000,0,i]);start+=end;
  });
  return points;
}

/** Where the designer leaves a set for the game to play (`index.html?mode=rounds&set=custom`). */
export const CUSTOM_ROUNDS_KEY='jerboa_custom_rounds_v1';
/** A set as URL-safe base64 of its JSON, for share links (`designer.html#set=…`). */
export function encodeRoundSet(set:RoundSet):string{
  let binary='';for(const byte of new TextEncoder().encode(JSON.stringify(set)))binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
/** The set in a share link, validated like any outside set; null if it can't be read. */
export function decodeRoundSet(text:string):RoundSet|null{
  try{
    const binary=atob(text.replace(/-/g,'+').replace(/_/g,'/'));
    return parseRoundSet(JSON.parse(new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0)))));
  }catch{return null;}
}
