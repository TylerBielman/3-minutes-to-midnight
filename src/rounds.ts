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
  const goal=x.goal===null||x.goal===undefined?null:whole(x.goal,1,100000,20);
  return {name:label(x.name,`Round ${i+1}`,24),goal,duration:clamp(x.duration,15,600,60),phases,hopMs:whole(x.hopMs,120,2000,450),
    nodeCount:whole(x.nodeCount,1,20,10),openingFives:whole(x.openingFives,0,5,0),
    boost:b&&{...b,speed:clamp((x.boost as Loose).speed,1,3,1.4)},freeze:f};
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
