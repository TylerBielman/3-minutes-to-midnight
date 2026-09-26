import {SHAPES,key,same,rotated,translated,placementError,randomStep,chooseNext,freshReach,type Cell,type Group} from './runway.js';
export type Settings={duration:number,grid:number,hopMs:number,nodeCount:number,seed:number,spawn:'random'|'uncovered',roadLimit:number,hitRadius:number,boostSpeed:number,boostMs:number,freezeMs:number};
export const DEFAULTS:Settings={duration:180,grid:19,hopMs:450,nodeCount:6,seed:12345,spawn:'random',roadLimit:25,hitRadius:.10,boostSpeed:1.4,boostMs:7000,freezeMs:6000};
export const TUNING={groupWeights:{common:.70,small:.15,large:.15},phaseSpeeds:[.5,1,1.5],nodeRadius:.32,previewLimit:64,simulationStep:16,
  // Point values 1-5. Relative weights per Ring phase; later phases shift toward 5s.
  nodeValues:[1,2,3,4,5],phaseValueWeights:[[30,28,22,14,6],[15,20,25,22,18],[6,12,22,28,32]],startingFives:2,
  // x2 powerup: one on the board at a time, never during an active boost.
  boostFirstMs:10000,boostRespawnMs:15000,
  // Freeze powerup: stops the Ring (and its clock) for freezeMs. One at a time, never while frozen.
  freezeFirstMs:25000,freezeRespawnMs:25000,
  // Powerups spawn at least this many cells inside the Ring so they are not swallowed at once.
  powerupRingMargin:2,
  // Ring heartbeat period per phase (ms). Faster beats signal rising tension.
  ringPulseMs:[1400,900,550]};
export type Pickup={seq:number,ms:number,at:Cell,points:number,kind:'point'|'boost'|'freeze',boosted:boolean};
export type Draft={shapeId:string,turns:number};
type Hop={from:Cell,to:Cell,elapsed:number,duration:number};
export function ringRadius(elapsedMs:number,settings:Settings):number {
  const initial=settings.grid/2-.25,phaseMs=settings.duration*1000/3;
  let remaining=Math.max(0,elapsedMs),distance=0;
  for(const speed of TUNING.phaseSpeeds){const time=Math.min(phaseMs,remaining);distance+=initial/ (settings.duration*1000)*speed*time;remaining-=time;}
  return Math.max(0,initial-distance);
}
/** Continuous heartbeat count; the fractional part is the position within the current beat. */
export function ringBeats(elapsedMs:number,settings:Settings):number {
  const phaseMs=settings.duration*1000/3;let remaining=Math.max(0,elapsedMs),beats=0;
  for(const period of TUNING.ringPulseMs){const time=Math.min(phaseMs,remaining);beats+=time/period;remaining-=time;}
  return beats;
}
export function nodeValue(phase:number,roll:number):number {
  const weights=TUNING.phaseValueWeights[Math.max(1,Math.min(3,phase))-1],total=weights.reduce((a,b)=>a+b,0);
  let pick=roll*total;for(let i=0;i<weights.length;i++){pick-=weights[i];if(pick<0)return TUNING.nodeValues[i];}
  return TUNING.nodeValues[TUNING.nodeValues.length-1];
}
export class Game {
  readonly settings:Settings;
  board=new Set<string>();visited=new Set<string>();nodes=new Map<string,number>();
  draft:Draft[]=[];at:Cell;previous?:Cell;hop?:Hop;
  elapsed=0;running=false;over=false;score=0;collected=0;placements=0;discards=0;
  reverseQueued=false;revision=0;
  pieces:{cells:Cell[],shapeId:string}[]=[];lastRemoved:Cell[]=[];
  rotations=0;reversals=0;invalidDrops=0;hops=0;removedPieces=0;removedSquares=0;peakSquares=1;
  nearMisses=0;minClearance:number|null=null;private nearRing=false;
  boostNode?:Cell;boostUntil=0;boosts=0;private nextBoostAt=TUNING.boostFirstMs;private startingFives=TUNING.startingFives;
  /** Ring clock: advances with play except while frozen. Drives radius, phase, pulse and the countdown. */
  ringMs=0;freezeNode?:Cell;freezeUntil=0;freezes=0;private nextFreezeAt=TUNING.freezeFirstMs;
  pickups:Pickup[]=[];pickupSeq=0;
  events:{ms:number,type:string,data:unknown}[]=[];droppedEvents=0;
  record(type:string,data:unknown={}){if(this.events.length<5000)this.events.push({ms:Math.round(this.elapsed),type,data});else this.droppedEvents++;}
  private pieceRng:number;private nodeRng:number;private navRng:number;
  constructor(settings:Partial<Settings>={}){
    this.settings={...DEFAULTS,...settings};
    const s=this.settings;
    s.grid=Math.max(9,Math.min(31,Math.round(s.grid)));if(s.grid%2===0)s.grid++;
    s.duration=Math.max(15,Math.min(600,s.duration));s.hopMs=Math.max(120,Math.min(2000,s.hopMs));s.nodeCount=Math.max(1,Math.min(20,Math.round(s.nodeCount)));
    s.roadLimit=Number.isFinite(s.roadLimit)?Math.max(0,Math.min(961,Math.round(s.roadLimit))):25;
    s.hitRadius=Number.isFinite(s.hitRadius)?Math.max(0,Math.min(.5,s.hitRadius)):.10;
    s.boostSpeed=Number.isFinite(s.boostSpeed)?Math.max(1,Math.min(3,s.boostSpeed)):DEFAULTS.boostSpeed;
    s.boostMs=Number.isFinite(s.boostMs)?Math.max(500,Math.min(30000,s.boostMs)):DEFAULTS.boostMs;
    s.freezeMs=Number.isFinite(s.freezeMs)?Math.max(500,Math.min(30000,s.freezeMs)):DEFAULTS.freezeMs;
    s.seed=s.seed>>>0;this.pieceRng=s.seed;this.nodeRng=s.seed^0xA9E3779B;this.navRng=s.seed^0x71B54A35;
    this.at={x:Math.floor(s.grid/2),y:Math.floor(s.grid/2)};
    this.board.add(key(this.at));this.visited.add(key(this.at));
    this.pieces.push({cells:[{...this.at}],shapeId:'Start'});
    this.draft=[this.draw(),this.draw(),this.draw()];this.refillNodes();
  }
  get radius(){return ringRadius(this.ringMs,this.settings);}
  get frozen(){return this.elapsed<this.freezeUntil;}
  get boosted(){return this.elapsed<this.boostUntil;}
  get phase(){return Math.min(3,1+Math.floor(this.ringMs/(this.settings.duration*1000/3)));}
  get position():Cell{if(!this.hop)return {...this.at};const t=this.hop.elapsed/this.hop.duration;return {x:this.hop.from.x+(this.hop.to.x-this.hop.from.x)*t,y:this.hop.from.y+(this.hop.to.y-this.hop.from.y)*t};}
  private draw():Draft{
    let r=randomStep(this.pieceRng);this.pieceRng=r.state;
    const group:Group=r.value<TUNING.groupWeights.common?'common':r.value<TUNING.groupWeights.common+TUNING.groupWeights.small?'small':'large';
    r=randomStep(this.pieceRng);this.pieceRng=r.state;const pool=SHAPES.filter(s=>s.group===group);
    return {shapeId:pool[Math.floor(r.value*pool.length)].id,turns:0};
  }
  cells(slot:number,origin:Cell={x:0,y:0}):Cell[]{const p=this.draft[slot];return translated(rotated(SHAPES.find(s=>s.id===p.shapeId)!.cells,p.turns),origin);}
  rotate(slot:number){if(!this.over){this.draft[slot].turns=(this.draft[slot].turns+1)%4;this.rotations++;this.record('rotate',{slot,...this.draft[slot]});}}
  /** Rerolls unlock with the clock; before the first placement the draft is fixed. */
  discard(slot:number):boolean{if(this.over||!this.running)return false;this.record('discard',{slot,...this.draft[slot]});this.draft[slot]=this.draw();this.discards++;return true;}
  place(slot:number,origin:Cell):string|undefined{
    if(this.over)return 'RUN FINISHED';
    const cells=this.cells(slot,origin),error=placementError(this.board,cells,this.settings.grid);if(error){this.invalidDrops++;this.record('invalid-drop',{slot,origin,reason:error});return error;}
    this.record('place',{slot,...this.draft[slot],cells});
    this.pieces.push({cells,shapeId:this.draft[slot].shapeId});
    cells.forEach(p=>this.board.add(key(p)));this.draft[slot]=this.draw();this.placements++;this.running=true;this.revision++;
    this.retireRoad();this.peakSquares=Math.max(this.peakSquares,this.board.size);
    if(!this.hop)this.beginHop();return undefined;
  }
  reverse(){if(this.over||!this.running)return;if(this.hop||this.previous){if(!this.reverseQueued){this.reversals++;this.record('reverse');}this.reverseQueued=true;this.revision++;if(!this.hop)this.beginHop();}}
  private retireRoad(){
    this.lastRemoved=[];if(!this.settings.roadLimit)return;
    const newest=this.pieces[this.pieces.length-1];
    while(this.board.size>this.settings.roadLimit){
      const index=this.pieces.findIndex(piece=>{
        if(piece===newest||piece.cells.some(p=>same(p,this.at)||(this.hop&&(same(p,this.hop.from)||same(p,this.hop.to)))))return false;
        const rest=new Set(this.board);piece.cells.forEach(p=>rest.delete(key(p)));
        return freshReach(rest,new Set(),this.at,{x:-1,y:-1})===rest.size;
      });
      if(index<0)break;
      const [piece]=this.pieces.splice(index,1);
      piece.cells.forEach(p=>{this.board.delete(key(p));this.visited.delete(key(p));});
      this.lastRemoved.push(...piece.cells);this.removedPieces++;this.removedSquares+=piece.cells.length;
      this.record('retire',piece);
    }
  }
  private beginHop(){
    const result=chooseNext(this.board,this.visited,this.at,this.previous,this.navRng,this.reverseQueued);
    this.navRng=result.rng;this.reverseQueued=false;
    if(result.next)this.hop={from:{...this.at},to:result.next,elapsed:0,duration:this.boosted?this.settings.hopMs/this.settings.boostSpeed:this.settings.hopMs};
  }
  /** Preview consumes a copy of route RNG and visit memory. Rendering never rerolls a tie. */
  preview():Cell[]{
    let at={...this.at},previous=this.previous,rng=this.navRng,reverse=this.reverseQueued;
    const visited=new Set(this.visited),path:Cell[]=[at],seen=new Set([key(at)]);
    if(this.hop){previous=at;at=this.hop.to;path.push(at);visited.add(key(at));seen.add(key(at));}
    for(let i=0;i<TUNING.previewLimit;i++){
      const turning=reverse;
      const result=chooseNext(this.board,visited,at,previous,rng,reverse);reverse=false;rng=result.rng;
      if(!result.next||(!turning&&seen.has(key(result.next))))break;
      if(turning){seen.clear();seen.add(key(at));}
      previous=at;at=result.next;path.push(at);seen.add(key(at));visited.add(key(at));
    }
    return path;
  }
  private refillNodes(){
    const center=(this.settings.grid-1)/2;
    for(const k of this.nodes.keys()){const [x,y]=k.split(',').map(Number);if(Math.hypot(x-center,y-center)+TUNING.nodeRadius>=this.radius)this.nodes.delete(k);}
    if(this.boostNode&&Math.hypot(this.boostNode.x-center,this.boostNode.y-center)+TUNING.nodeRadius>=this.radius){this.boostNode=undefined;this.nextBoostAt=this.elapsed+TUNING.boostRespawnMs;this.record('boost-lost');}
    if(this.freezeNode&&Math.hypot(this.freezeNode.x-center,this.freezeNode.y-center)+TUNING.nodeRadius>=this.radius){this.freezeNode=undefined;this.nextFreezeAt=this.elapsed+TUNING.freezeRespawnMs;this.record('freeze-lost');}
    const eligible:Cell[]=[];
    for(let y=0;y<this.settings.grid;y++)for(let x=0;x<this.settings.grid;x++){
      const p={x,y},k=key(p);
      if(this.nodes.has(k)||(this.boostNode&&same(p,this.boostNode))||(this.freezeNode&&same(p,this.freezeNode))||same(p,this.at)||(this.hop&&same(p,this.hop.to)))continue;
      if(this.settings.spawn==='uncovered'&&this.board.has(k))continue;
      if(Math.hypot(x-center,y-center)+TUNING.nodeRadius<this.radius)eligible.push(p);
    }
    while(this.nodes.size<this.settings.nodeCount&&eligible.length){
      let r=randomStep(this.nodeRng);this.nodeRng=r.state;const [p]=eligible.splice(Math.floor(r.value*eligible.length),1);
      r=randomStep(this.nodeRng);this.nodeRng=r.state;
      // The opening board guarantees a couple of 5s to pull the player outward.
      const value=this.startingFives>0?5:nodeValue(this.phase,r.value);if(this.startingFives>0)this.startingFives--;
      this.nodes.set(key(p),value);
    }
    const center2=(this.settings.grid-1)/2;
    const powerupCells=()=>eligible.filter(p=>Math.hypot(p.x-center2,p.y-center2)+TUNING.nodeRadius<this.radius-TUNING.powerupRingMargin);
    let safe=powerupCells();
    if(!this.boostNode&&!this.boosted&&this.running&&this.elapsed>=this.nextBoostAt&&safe.length){
      const r=randomStep(this.nodeRng);this.nodeRng=r.state;[this.boostNode]=safe.splice(Math.floor(r.value*safe.length),1);this.record('boost-spawn',{at:this.boostNode});
    }
    if(!this.freezeNode&&!this.frozen&&this.running&&this.elapsed>=this.nextFreezeAt&&safe.length){
      const r=randomStep(this.nodeRng);this.nodeRng=r.state;[this.freezeNode]=safe.splice(Math.floor(r.value*safe.length),1);this.record('freeze-spawn',{at:this.freezeNode});
    }
  }
  advance(deltaMs:number){
    if(!this.running||this.over||!Number.isFinite(deltaMs)||deltaMs<=0)return;
    let remaining=deltaMs;
    while(remaining>0&&!this.over){
      const dt=Math.min(remaining,TUNING.simulationStep,this.hop?this.hop.duration-this.hop.elapsed:Infinity);
      remaining-=dt;if(!this.frozen)this.ringMs+=dt;this.elapsed+=dt;if(this.hop)this.hop.elapsed+=dt;
      const p=this.position,center=(this.settings.grid-1)/2;
      // Ground footprint, not the decorative vertical hop. Check before awarding pickups.
      const clearance=this.radius-Math.hypot(p.x-center,p.y-center)-this.settings.hitRadius;
      if(clearance<=0){this.over=true;this.running=false;this.revision++;this.record('capture',{position:p,radius:this.radius});break;}
      this.minClearance=Math.min(this.minClearance??Infinity,clearance);
      if(clearance<.5&&!this.nearRing){this.nearRing=true;this.record('danger-enter',{position:p});}
      if(clearance>.75&&this.nearRing){this.nearRing=false;this.nearMisses++;this.record('near-miss',{position:p});}
      if(this.hop&&this.hop.elapsed>=this.hop.duration){
        this.previous=this.hop.from;this.at=this.hop.to;this.hop=undefined;this.visited.add(key(this.at));this.hops++;this.record('hop',{at:this.at});
        if(this.boostNode&&same(this.boostNode,this.at)){
          this.boostNode=undefined;this.boostUntil=this.elapsed+this.settings.boostMs;this.nextBoostAt=this.elapsed+TUNING.boostRespawnMs;this.boosts++;
          this.record('boost',{at:this.at});this.pickups.push({seq:++this.pickupSeq,ms:this.elapsed,at:{...this.at},points:0,kind:'boost',boosted:true});
        }
        if(this.freezeNode&&same(this.freezeNode,this.at)){
          this.freezeNode=undefined;this.freezeUntil=this.elapsed+this.settings.freezeMs;this.nextFreezeAt=this.elapsed+TUNING.freezeRespawnMs;this.freezes++;
          this.record('freeze',{at:this.at});this.pickups.push({seq:++this.pickupSeq,ms:this.elapsed,at:{...this.at},points:0,kind:'freeze',boosted:this.boosted});
        }
        const value=this.nodes.get(key(this.at));
        if(value!==undefined){
          const boosted=this.boosted,points=boosted?value*2:value;this.score+=points;this.collected++;this.nodes.delete(key(this.at));
          this.record('collect',{at:this.at,value,points});this.pickups.push({seq:++this.pickupSeq,ms:this.elapsed,at:{...this.at},points,kind:'point',boosted});
        }
        if(this.pickups.length>20)this.pickups.splice(0,this.pickups.length-20);
        this.beginHop();this.revision++;
      }
      this.refillNodes();
    }
  }
}
