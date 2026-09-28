import {SHAPES,key,cell,same,neighbors,rotated,translated,placementError,randomStep,chooseNext,freshReach,type Cell,type Group} from './runway.js';
import {NODE_VALUES,POWER_KINDS,roundPhaseAt,roundRadius,roundMsForRadius,roundBeats,pickValue,phaseWeights,type PowerKind,type Round,type RoundSet} from './rounds.js';
export type Settings={duration:number,grid:number,hopMs:number,nodeCount:number,seed:number,spawn:'random'|'uncovered',roadLimit:number,hitRadius:number,boostSpeed:number,boostMs:number,freezeMs:number,slots:number};
export const DEFAULTS:Settings={duration:180,grid:19,hopMs:450,nodeCount:10,seed:12345,spawn:'random',roadLimit:25,hitRadius:.10,boostSpeed:1.4,boostMs:7000,freezeMs:6000,slots:2};
export const TUNING={groupWeights:{common:.65,small:.15,large:.20},// Ring phases: share of the run and speed relative to the average needed to close on time.
  // Sum of fraction×speed must be 1 so the Ring closes exactly at the time limit. 180 s run → 60 / 80 / 40 s.
  phaseFractions:[1/3,4/9,2/9],phaseSpeeds:[.5,.875,2],nodeRadius:.32,previewLimit:64,simulationStep:16,
  // Point values 1-5, plus a rare 10 that moves. Relative weights per Ring phase; later phases shift toward 5s and 10s.
  nodeValues:NODE_VALUES,phaseValueWeights:[[30,28,22,14,6,1],[15,20,25,22,18,3],[6,12,22,28,32,6]],startingFives:2,
  // Moving node (the 10): steps to a neighbouring cell every stepMs ± jitterMs of unfrozen time, within `range` cells
  // (Chebyshev) of where it spawned. It wobbles for wobbleMs before a step and slides for slideMs (presentation).
  mover:{value:10,stepMs:2000,jitterMs:400,wobbleMs:500,slideMs:180,range:1},
  // x2 powerup: one on the board at a time, never during an active boost.
  boostFirstMs:10000,boostRespawnMs:15000,
  // Freeze powerup: stops the Ring (and its clock) for freezeMs. One at a time, never while frozen.
  freezeFirstMs:25000,freezeRespawnMs:25000,
  // Powerups spawn at least this many cells inside the Ring so they are not swallowed at once.
  powerupRingMargin:2,
  // Ring heartbeat period per phase (ms). Faster beats signal rising tension.
  ringPulseMs:[1400,900,550],
  // Endgame: the runway cap shrinks with the Ring's area (cells) so old road clears faster late in the run.
  endgameRoadDensity:.3,minRoadLimit:6,
  // Point-node target shrinks in proportion to the Ring's radius, never below this.
  minNodes:2};
/** For the renderer: a point collected (`via` a sweep or magnet when not by landing), a powerup used, or a round cleared. */
export type Pickup={seq:number,ms:number,at:Cell,points:number,kind:'point'|'round'|PowerKind,boosted:boolean,via?:'sweep'|'magnet'};
export type RoundResult={round:number,goal:number,score:number,atMs:number,ringMs:number};
export type Draft={shapeId:string,turns:number};
/** A moving node's bookkeeping. Times are on the live clock (`Game.liveMs`), so movers stop while frozen. */
export type Mover={home:Cell,nextMoveAt:number,from:Cell|null,movedAt:number};
type Hop={from:Cell,to:Cell,elapsed:number,duration:number};
/** Classic is one round with no goal, built from the (clamped) settings and TUNING. Tune and URL overrides land here. */
export function classicRound(s:Settings):Round{
  return {name:'Classic',goal:null,duration:s.duration,
    phases:TUNING.phaseFractions.map((fraction,i)=>({fraction,speed:TUNING.phaseSpeeds[i],pulseMs:TUNING.ringPulseMs[i],weights:TUNING.phaseValueWeights[i]})),
    hopMs:s.hopMs,nodeCount:s.nodeCount,openingFives:TUNING.startingFives,
    boost:{firstMs:TUNING.boostFirstMs,respawnMs:TUNING.boostRespawnMs,ms:s.boostMs,speed:s.boostSpeed},
    freeze:{firstMs:TUNING.freezeFirstMs,respawnMs:TUNING.freezeRespawnMs,ms:s.freezeMs}};
}
export const classicSet=(s:Settings):RoundSet=>({v:1,id:'classic',name:'Classic',rounds:[classicRound(s)]});
// Classic helpers, kept for callers that only have settings.
export const phaseAt=(ringMs:number,settings:Settings)=>roundPhaseAt(ringMs,classicRound(settings));
export const ringRadius=(elapsedMs:number,settings:Settings)=>roundRadius(elapsedMs,settings.grid,classicRound(settings));
/** Longest side of a shape in any rotation, in cells. */
export const shapeLength=(id:string)=>{const cells=SHAPES.find(s=>s.id===id)!.cells;return Math.max(...cells.map(p=>p.x),...cells.map(p=>p.y))+1;};
/** Continuous heartbeat count; the fractional part is the position within the current beat. */
export const ringBeats=(elapsedMs:number,settings:Settings)=>roundBeats(elapsedMs,classicRound(settings));
export const nodeValue=(phase:number,roll:number)=>pickValue(TUNING.phaseValueWeights[Math.max(1,Math.min(3,phase))-1],roll);
/** Cells a moving node can step to from `at`: the four neighbours (fixed N/E/S/W order) that stay on the board, within
 *  `range` cells of `home`, and pass `ok`. */
export function moverSteps(at:Cell,home:Cell,range:number,grid:number,ok:(p:Cell)=>boolean):Cell[]{
  return neighbors(at).filter(p=>p.x>=0&&p.y>=0&&p.x<grid&&p.y<grid&&Math.max(Math.abs(p.x-home.x),Math.abs(p.y-home.y))<=range&&ok(p));
}
export class Game {
  readonly settings:Settings;
  board=new Set<string>();visited=new Set<string>();nodes=new Map<string,number>();
  draft:Draft[]=[];at:Cell={x:0,y:0};previous?:Cell;hop?:Hop;
  elapsed=0;running=false;over=false;score=0;collected=0;placements=0;discards=0;
  reverseQueued=false;revision=0;
  pieces:{cells:Cell[],shapeId:string}[]=[];
  /** Cells taken off the board by the latest placement, or the whole old road when a round clears (they flash amber). */
  lastRemoved:Cell[]=[];
  rotations=0;reversals=0;invalidDrops=0;hops=0;removedPieces=0;removedSquares=0;peakSquares=1;
  nearMisses=0;minClearance:number|null=null;private nearRing=false;
  /** Powerups on the board, keyed by cell. At most one of each kind. */
  powerNodes=new Map<string,PowerKind>();
  boosts=0;private nextBoostAt:number;private startingFives:number;
  /** x2 ends when the live clock reaches this, so a freeze pauses the x2 countdown too. */
  private boostEndsAt=0;
  /** Ring clock: advances with play except while frozen. Drives radius, phase, pulse and the countdown. */
  ringMs=0;freezeUntil=0;freezes=0;private nextFreezeAt:number;
  /** Rounds-only powerups (DECISIONS U45). Magnet and speed run on the live clock, so a freeze pauses them. */
  expands=0;ringRewoundMs=0;sweeps=0;sweptNodes=0;magnets=0;magnetNodes=0;speeds=0;cherries=0;cherrySets=0;
  private magnetEndsAt=0;private speedEndsAt=0;
  /** Live clock: play time that a freeze stops (the x2 countdown, moving nodes). Unlike ringMs it is never reset. */
  liveMs=0;
  /** Moving nodes, keyed by their current cell (a subset of `nodes`). */
  movers=new Map<string,Mover>();moversCollected=0;
  pickups:Pickup[]=[];pickupSeq=0;
  events:{ms:number,type:string,data:unknown}[]=[];droppedEvents=0;
  record(type:string,data:unknown={}){if(this.events.length<5000)this.events.push({ms:Math.round(this.elapsed),type,data});else this.droppedEvents++;}
  private pieceRng:number;private nodeRng:number;private navRng:number;private moverRng:number;
  /** The rounds this run plays, and which one is in play. Classic unless a set is given. */
  readonly set:RoundSet;roundIndex=0;
  /** Points scored in this round (toward its goal), rounds cleared, and how each cleared round went. */
  roundScore=0;roundsCleared=0;roundLog:RoundResult[]=[];
  /** Ring time over the whole run (ringMs restarts each round). */
  ringTotalMs=0;
  private nextPowerAt:number;private powerRng:number;
  get round():Round{return this.set.rounds[this.roundIndex];}
  constructor(settings:Partial<Settings>={},set?:RoundSet){
    this.settings={...DEFAULTS,...settings};
    const s=this.settings;
    s.grid=Math.max(9,Math.min(31,Math.round(s.grid)));if(s.grid%2===0)s.grid++;
    s.duration=Math.max(15,Math.min(600,s.duration));s.hopMs=Math.max(120,Math.min(2000,s.hopMs));s.nodeCount=Math.max(1,Math.min(20,Math.round(s.nodeCount)));
    s.slots=Number.isFinite(s.slots)?Math.max(1,Math.min(3,Math.round(s.slots))):DEFAULTS.slots;
    s.roadLimit=Number.isFinite(s.roadLimit)?Math.max(0,Math.min(961,Math.round(s.roadLimit))):25;
    s.hitRadius=Number.isFinite(s.hitRadius)?Math.max(0,Math.min(.5,s.hitRadius)):.10;
    s.boostSpeed=Number.isFinite(s.boostSpeed)?Math.max(1,Math.min(3,s.boostSpeed)):DEFAULTS.boostSpeed;
    s.boostMs=Number.isFinite(s.boostMs)?Math.max(500,Math.min(30000,s.boostMs)):DEFAULTS.boostMs;
    s.freezeMs=Number.isFinite(s.freezeMs)?Math.max(500,Math.min(30000,s.freezeMs)):DEFAULTS.freezeMs;
    s.seed=s.seed>>>0;this.pieceRng=s.seed;this.nodeRng=s.seed^0xA9E3779B;this.navRng=s.seed^0x71B54A35;this.moverRng=s.seed^0x3C6EF372;this.powerRng=s.seed^0x6A09E667;
    this.set=set??classicSet(s);
    this.nextBoostAt=this.round.boost?.firstMs??Infinity;this.nextFreezeAt=this.round.freeze?.firstMs??Infinity;this.startingFives=this.round.openingFives;
    this.nextPowerAt=this.round.spawner?.firstMs??Infinity;
    this.setUp();
  }
  /** A fresh board: one square at the centre with him on it, a new opening hand and the round's point nodes. The run
   *  starts this way, and so does each round after a clear. */
  private setUp(){
    const s=this.settings;
    this.at={x:Math.floor(s.grid/2),y:Math.floor(s.grid/2)};this.previous=undefined;this.hop=undefined;this.reverseQueued=false;
    this.board=new Set([key(this.at)]);this.visited=new Set([key(this.at)]);
    this.pieces=[{cells:[{...this.at}],shapeId:'Start'}];
    // The opening hand never repeats a shape; redraw (deterministically, same seed) until each slot differs.
    this.draft=[];
    while(this.draft.length<s.slots){let d=this.draw();for(let i=0;i<50&&this.draft.some(o=>o.shapeId===d.shapeId);i++)d=this.draw();this.draft.push(d);}this.refillNodes();
  }
  get radius(){return roundRadius(this.ringMs,this.settings.grid,this.round);}
  get frozen(){return this.elapsed<this.freezeUntil;}
  get boosted(){return this.liveMs<this.boostEndsAt;}
  get magnetActive(){return this.liveMs<this.magnetEndsAt;}
  get magnetLeft(){return Math.max(0,this.magnetEndsAt-this.liveMs);}
  get sped(){return this.liveMs<this.speedEndsAt;}
  get speedLeft(){return Math.max(0,this.speedEndsAt-this.liveMs);}
  /** Where a powerup of this kind is on the board, if anywhere. */
  powerAt(kind:PowerKind):Cell|undefined{for(const [k,v] of this.powerNodes)if(v===kind)return cell(k);return undefined;}
  private placePower(kind:PowerKind,at?:Cell){for(const [k,v] of this.powerNodes)if(v===kind)this.powerNodes.delete(k);if(at)this.powerNodes.set(key(at),kind);}
  get boostNode(){return this.powerAt('boost');}
  set boostNode(at:Cell|undefined){this.placePower('boost',at);}
  get freezeNode(){return this.powerAt('freeze');}
  set freezeNode(at:Cell|undefined){this.placePower('freeze',at);}
  /** x2 time left (ms); it stands still while frozen. */
  get boostLeft(){return Math.max(0,this.boostEndsAt-this.liveMs);}
  /** x2 and freeze together: double points while the Ring and the x2 countdown both wait. */
  get doubleBonus(){return this.boosted&&this.frozen;}
  /** The Ring's radius `ms` from now, allowing for the rest of any freeze. */
  radiusIn(ms:number){return roundRadius(this.ringMs+Math.max(0,ms-Math.max(0,this.freezeUntil-this.elapsed)),this.settings.grid,this.round);}
  get phase(){return roundPhaseAt(this.ringMs,this.round);}
  /** Points still needed this round, or null in a round without a goal. */
  get goal(){return this.round.goal;}
  /** Heartbeat count for the Ring's pulse (presentation). */
  get beats(){return roundBeats(this.ringMs,this.round);}
  /** Ring time left in this round (ms); the countdown. */
  get ringLeftMs(){return Math.max(0,this.round.duration*1000-this.ringMs);}
  /** Pieces longer than the Ring is wide are not dealt. */
  get maxPieceLength(){return Math.max(1,Math.floor(this.radius*2));}
  /** Soft runway cap: the Tune setting, lowered in the endgame as the Ring's area shrinks. 0 = unlimited. */
  /** Point nodes kept on the board: the Tune count at full size, shrinking with the Ring's radius. */
  get nodeTarget(){
    const full=this.settings.grid/2-.25;
    const count=this.round.nodeCount;
    return Math.min(count,Math.max(TUNING.minNodes,Math.ceil(count*this.radius/full)));
  }
  get roadLimit(){
    if(!this.settings.roadLimit)return 0;
    const byArea=Math.floor(Math.PI*this.radius*this.radius*TUNING.endgameRoadDensity);
    return Math.min(this.settings.roadLimit,Math.max(TUNING.minRoadLimit,byArea));
  }
  get position():Cell{if(!this.hop)return {...this.at};const t=this.hop.elapsed/this.hop.duration;return {x:this.hop.from.x+(this.hop.to.x-this.hop.from.x)*t,y:this.hop.from.y+(this.hop.to.y-this.hop.from.y)*t};}
  private draw():Draft{
    let r=randomStep(this.pieceRng);this.pieceRng=r.state;
    const group:Group=r.value<TUNING.groupWeights.common?'common':r.value<TUNING.groupWeights.common+TUNING.groupWeights.small?'small':'large';
    r=randomStep(this.pieceRng);this.pieceRng=r.state;
    const fits=SHAPES.filter(s=>shapeLength(s.id)<=this.maxPieceLength),inGroup=fits.filter(s=>s.group===group);
    const pool=inGroup.length?inGroup:fits.length?fits:SHAPES.filter(s=>s.id==='Dot');
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
  /** Swap out draft pieces that have outgrown the Ring. Skips the slot being dragged. Returns replaced slots. */
  replaceOutgrown(skipSlot=-1):number[]{
    if(this.over)return [];
    const replaced:number[]=[];
    this.draft.forEach((d,i)=>{if(i!==skipSlot&&shapeLength(d.shapeId)>this.maxPieceLength){this.record('outgrown',{slot:i,...d});this.draft[i]=this.draw();replaced.push(i);}});
    return replaced;
  }
  reverse(){if(this.over||!this.running)return;if(this.hop||this.previous){if(!this.reverseQueued){this.reversals++;this.record('reverse');}this.reverseQueued=true;this.revision++;if(!this.hop)this.beginHop();}}
  private retireRoad(){
    this.lastRemoved=[];const limit=this.roadLimit;if(!limit)return;
    const newest=this.pieces[this.pieces.length-1],center=(this.settings.grid-1)/2;
    const outside=(piece:{cells:Cell[]})=>piece.cells.every(p=>Math.hypot(p.x-center,p.y-center)>=this.radius);
    const removable=(piece:{cells:Cell[]})=>{
      if(piece===newest||piece.cells.some(p=>same(p,this.at)||(this.hop&&(same(p,this.hop.from)||same(p,this.hop.to)))))return false;
      const rest=new Set(this.board);piece.cells.forEach(p=>rest.delete(key(p)));
      return freshReach(rest,new Set(),this.at,{x:-1,y:-1})===rest.size;
    };
    while(this.board.size>limit){
      // Road already swallowed by the Ring goes first, then the oldest eligible piece.
      let index=this.pieces.findIndex(piece=>outside(piece)&&removable(piece));
      if(index<0)index=this.pieces.findIndex(removable);
      if(index<0)break;
      const [piece]=this.pieces.splice(index,1);
      piece.cells.forEach(p=>{this.board.delete(key(p));this.visited.delete(key(p));});
      this.lastRemoved.push(...piece.cells);this.removedPieces++;this.removedSquares+=piece.cells.length;
      this.record('retire',piece);
    }
  }
  /** x2 and speed both quicken hops; together the faster one wins (they don't multiply). */
  private get hopSpeed(){return Math.max(this.boosted&&this.round.boost?this.round.boost.speed:1,this.sped&&this.round.speed?this.round.speed.speed:1);}
  private beginHop(){
    const result=chooseNext(this.board,this.visited,this.at,this.previous,this.navRng,this.reverseQueued);
    this.navRng=result.rng;this.reverseQueued=false;
    if(result.next)this.hop={from:{...this.at},to:result.next,elapsed:0,duration:this.hopSpeed>1?this.round.hopMs/this.hopSpeed:this.round.hopMs};
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
  /** Put a point node on a cell. A 10 becomes a moving node; its first step time comes from the mover stream. */
  addNode(p:Cell,value:number){
    const k=key(p);this.nodes.set(k,value);this.movers.delete(k);
    if(value===TUNING.mover.value)this.movers.set(k,{home:{...p},nextMoveAt:this.nextMoverStep(),from:null,movedAt:-Infinity});
  }
  /** Every node removal goes through here, so a later node on the same cell never inherits mover state. */
  private dropNode(k:string){this.nodes.delete(k);this.movers.delete(k);}
  private nextMoverStep(){
    const r=randomStep(this.moverRng);this.moverRng=r.state;
    return this.liveMs+TUNING.mover.stepMs+(r.value*2-1)*TUNING.mover.jitterMs;
  }
  /** Due movers step to a random allowed neighbour. A mover never leaves, or steps onto, the cell he is hopping to. */
  private stepMovers(){
    if(!this.movers.size||this.frozen)return;
    const center=(this.settings.grid-1)/2;
    const ok=(p:Cell)=>{
      const k=key(p);
      if(this.nodes.has(k)||this.powerNodes.has(k)||same(p,this.at)||(this.hop&&same(p,this.hop.to)))return false;
      if(this.settings.spawn==='uncovered'&&this.board.has(k))return false;
      return Math.hypot(p.x-center,p.y-center)+TUNING.nodeRadius<this.radius;
    };
    for(const [k,m] of [...this.movers]){
      if(m.nextMoveAt>this.liveMs)continue;
      const at=cell(k);
      const steps=this.hop&&same(this.hop.to,at)?[]:moverSteps(at,m.home,TUNING.mover.range,this.settings.grid,ok);
      if(!steps.length){m.nextMoveAt=this.nextMoverStep();continue;}
      const r=randomStep(this.moverRng);this.moverRng=r.state;const to=steps[Math.floor(r.value*steps.length)],value=this.nodes.get(k)!;
      this.nodes.delete(k);this.movers.delete(k);this.nodes.set(key(to),value);
      this.movers.set(key(to),{home:m.home,nextMoveAt:this.nextMoverStep(),from:at,movedAt:this.liveMs});
      this.record('node-move',{from:at,to});
    }
  }
  private refillNodes(){
    const center=(this.settings.grid-1)/2;
    for(const k of this.nodes.keys()){const [x,y]=k.split(',').map(Number);if(Math.hypot(x-center,y-center)+TUNING.nodeRadius>=this.radius)this.dropNode(k);}
    for(const kind of POWER_KINDS){
      const at=this.powerAt(kind);if(!at||Math.hypot(at.x-center,at.y-center)+TUNING.nodeRadius<this.radius)continue;
      this.placePower(kind);this.record(`${kind}-lost`);
      if(kind==='boost')this.nextBoostAt=this.elapsed+(this.round.boost?.respawnMs??0);
      if(kind==='freeze')this.nextFreezeAt=this.elapsed+(this.round.freeze?.respawnMs??0);
    }
    const eligible:Cell[]=[];
    for(let y=0;y<this.settings.grid;y++)for(let x=0;x<this.settings.grid;x++){
      const p={x,y},k=key(p);
      if(this.nodes.has(k)||this.powerNodes.has(k)||same(p,this.at)||(this.hop&&same(p,this.hop.to)))continue;
      if(this.settings.spawn==='uncovered'&&this.board.has(k))continue;
      if(Math.hypot(x-center,y-center)+TUNING.nodeRadius<this.radius)eligible.push(p);
    }
    while(this.nodes.size<this.nodeTarget&&eligible.length){
      let r=randomStep(this.nodeRng);this.nodeRng=r.state;const [p]=eligible.splice(Math.floor(r.value*eligible.length),1);
      r=randomStep(this.nodeRng);this.nodeRng=r.state;
      // The opening board guarantees a couple of 5s to pull the player outward.
      const value=this.startingFives>0?5:pickValue(phaseWeights(this.round,this.phase),r.value);if(this.startingFives>0)this.startingFives--;
      this.addNode(p,value);
    }
    const center2=(this.settings.grid-1)/2;
    const powerupCells=()=>eligible.filter(p=>Math.hypot(p.x-center2,p.y-center2)+TUNING.nodeRadius<this.radius-TUNING.powerupRingMargin);
    let safe=powerupCells();
    if(this.round.spawner){this.spawnPowerup(safe);return;}
    if(this.round.boost&&!this.boostNode&&!this.boosted&&this.running&&this.elapsed>=this.nextBoostAt&&safe.length){
      const r=randomStep(this.nodeRng);this.nodeRng=r.state;[this.boostNode]=safe.splice(Math.floor(r.value*safe.length),1);this.record('boost-spawn',{at:this.boostNode});
    }
    if(this.round.freeze&&!this.freezeNode&&!this.frozen&&this.running&&this.elapsed>=this.nextFreezeAt&&safe.length){
      const r=randomStep(this.nodeRng);this.nodeRng=r.state;[this.freezeNode]=safe.splice(Math.floor(r.value*safe.length),1);this.record('freeze-spawn',{at:this.freezeNode});
    }
  }
  /** Rounds mode: one spawner for all powerups (see Spawner in src/rounds.ts). It has its own random stream. */
  private spawnPowerup(safe:Cell[]){
    const sp=this.round.spawner!;
    if(!this.running||this.elapsed<this.nextPowerAt)return;
    this.nextPowerAt=this.elapsed+sp.everyMs;
    const open=POWER_KINDS.filter(k=>(sp.weights[k]??0)>0&&this.canSpawn(k)).map(k=>[k,sp.weights[k]!] as [PowerKind,number]);
    if(this.powerNodes.size>=sp.max||!open.length||!safe.length)return;
    let r=randomStep(this.powerRng);this.powerRng=r.state;
    let pick=r.value*open.reduce((a,[,w])=>a+w,0),kind=open[open.length-1][0];
    for(const [k,w] of open){pick-=w;if(pick<0){kind=k;break;}}
    r=randomStep(this.powerRng);this.powerRng=r.state;const [at]=safe.splice(Math.floor(r.value*safe.length),1);
    this.placePower(kind,at);this.record(`${kind}-spawn`,{at});
  }
  /** This round has the powerup (its settings, and a spawner weight in Rounds). */
  private roundHas(kind:PowerKind){
    const r=this.round,has=kind==='sweep'||!!r[kind];
    return r.spawner?has&&(r.spawner.weights[kind]??0)>0:has&&(kind==='boost'||kind==='freeze');
  }
  /** A kind can be placed when the round has it, none is on the board, and its effect isn't running. */
  private canSpawn(kind:PowerKind){
    if(!this.roundHas(kind)||this.powerAt(kind))return false;
    return !(kind==='boost'&&this.boosted||kind==='freeze'&&this.frozen||kind==='magnet'&&this.magnetActive||kind==='speed'&&this.sped);
  }
  /** Score a point node: by landing on it, a sweep or the magnet. x2 doubles it either way. */
  private collect(k:string,via:'hop'|'sweep'|'magnet'){
    const value=this.nodes.get(k)!,at=cell(k),boosted=this.boosted,points=boosted?value*2:value;
    this.score+=points;this.roundScore+=points;this.collected++;
    if(this.movers.has(k))this.moversCollected++;this.dropNode(k);
    if(via==='sweep')this.sweptNodes++;if(via==='magnet')this.magnetNodes++;
    this.record('collect',via==='hop'?{at,value,points}:{at,value,points,via});
    this.pickups.push({seq:++this.pickupSeq,ms:this.elapsed,at,points,kind:'point',boosted,...(via==='hop'?{}:{via})});
  }
  /** He landed on a powerup. */
  private usePower(kind:PowerKind){
    const at={...this.at},r=this.round,note=(points=0)=>this.pickups.push({seq:++this.pickupSeq,ms:this.elapsed,at:{...at},points,kind,boosted:this.boosted});
    if(kind==='boost'){this.boostEndsAt=this.liveMs+(r.boost?.ms??0);this.nextBoostAt=this.elapsed+(r.boost?.respawnMs??0);this.boosts++;this.record('boost',{at});note();}
    else if(kind==='freeze'){this.freezeUntil=this.elapsed+(r.freeze?.ms??0);this.nextFreezeAt=this.elapsed+(r.freeze?.respawnMs??0);this.freezes++;this.record('freeze',{at});note();}
    else if(kind==='expand'){
      // Push the Ring back out by a fixed distance by rewinding its clock; the phase may drop back.
      const before=this.ringMs,full=this.settings.grid/2-.25;
      this.ringMs=roundMsForRadius(Math.min(full,this.radius+(r.expand?.cells??0)),this.settings.grid,r);
      this.ringRewoundMs+=before-this.ringMs;this.expands++;this.nearRing=false;this.record('expand',{at,from:Math.round(before),to:Math.round(this.ringMs)});note();
    }
    else if(kind==='sweep'){
      this.sweeps++;this.record('sweep',{at});note();
      const low=Math.min(...this.nodes.values());
      for(const [k,v] of [...this.nodes])if(v===low)this.collect(k,'sweep');
    }
    else if(kind==='magnet'){this.magnetEndsAt=this.liveMs+(r.magnet?.ms??0);this.magnets++;this.record('magnet',{at});note();}
    else if(kind==='speed'){this.speedEndsAt=this.liveMs+(r.speed?.ms??0);this.speeds++;this.record('speed',{at});note();}
    else if(kind==='cherry'){
      this.cherries++;let points=0;
      if(r.cherry&&this.cherries>=r.cherry.set){this.cherries-=r.cherry.set;this.cherrySets++;points=r.cherry.bonus;this.score+=points;this.roundScore+=points;}
      this.record('cherry',{at,points});note(points);
    }
  }
  /** The round's goal is reached. Like a new level: the board clears (nodes left on it are not scored), powerups and
   *  their effects end, and the next round starts on a fresh board with a full Ring, waiting for its first placement
   *  (DECISIONS U48). The score, counters and round log carry on. */
  private clearRound(){
    const at={...this.at};
    this.roundLog.push({round:this.roundIndex+1,goal:this.round.goal!,score:this.roundScore,atMs:Math.round(this.elapsed),ringMs:Math.round(this.ringMs)});
    this.record('round-clear',{round:this.roundIndex+1,score:this.roundScore,left:this.nodes.size});
    this.roundIndex++;this.roundsCleared++;this.roundScore=0;this.ringMs=0;this.running=false;
    for(const k of [...this.nodes.keys()])this.dropNode(k);
    this.powerNodes.clear();this.boostEndsAt=0;this.freezeUntil=0;this.magnetEndsAt=0;this.speedEndsAt=0;this.cherries=0;
    // The Ring jumps away: that is not a close escape.
    this.startingFives=this.round.openingFives;this.nearRing=false;
    // Powerup timers count from the new round's first placement (the clock waits until then).
    this.nextBoostAt=this.elapsed+(this.round.boost?.firstMs??0);this.nextFreezeAt=this.elapsed+(this.round.freeze?.firstMs??0);
    this.nextPowerAt=this.elapsed+(this.round.spawner?.firstMs??0);
    const road=[...this.board].map(cell);
    this.setUp();
    this.lastRemoved=road.filter(p=>!this.board.has(key(p)));
    this.pickups.push({seq:++this.pickupSeq,ms:this.elapsed,at,points:0,kind:'round',boosted:false});
    this.revision++;
  }
  advance(deltaMs:number){
    if(!this.running||this.over||!Number.isFinite(deltaMs)||deltaMs<=0)return;
    let remaining=deltaMs;
    while(remaining>0&&!this.over){
      const dt=Math.min(remaining,TUNING.simulationStep,this.hop?this.hop.duration-this.hop.elapsed:Infinity);
      remaining-=dt;
      if(!this.frozen){this.ringMs+=dt;this.ringTotalMs+=dt;this.liveMs+=dt;}
      this.elapsed+=dt;if(this.hop)this.hop.elapsed+=dt;
      const p=this.position,center=(this.settings.grid-1)/2;
      // Ground footprint, not the decorative vertical hop. Check before awarding pickups.
      const clearance=this.radius-Math.hypot(p.x-center,p.y-center)-this.settings.hitRadius;
      if(clearance<=0){this.over=true;this.running=false;this.revision++;this.record('capture',{position:p,radius:this.radius});break;}
      this.minClearance=Math.min(this.minClearance??Infinity,clearance);
      if(clearance<.5&&!this.nearRing){this.nearRing=true;this.record('danger-enter',{position:p});}
      if(clearance>.75&&this.nearRing){this.nearRing=false;this.nearMisses++;this.record('near-miss',{position:p});}
      if(this.hop&&this.hop.elapsed>=this.hop.duration){
        this.previous=this.hop.from;this.at=this.hop.to;this.hop=undefined;this.visited.add(key(this.at));this.hops++;this.record('hop',{at:this.at});
        const here=key(this.at),power=this.powerNodes.get(here);
        if(power){this.powerNodes.delete(here);this.usePower(power);}
        if(this.nodes.has(here))this.collect(here,'hop');
        // The magnet also collects every node within its range of where he lands.
        if(this.magnetActive&&this.round.magnet)for(const k of [...this.nodes.keys()]){const p=cell(k);if(Math.hypot(p.x-this.at.x,p.y-this.at.y)<=this.round.magnet.range)this.collect(k,'magnet');}
        const cleared=this.round.goal!==null&&this.roundScore>=this.round.goal&&this.roundIndex<this.set.rounds.length-1;
        if(cleared)this.clearRound();
        if(this.pickups.length>40)this.pickups.splice(0,this.pickups.length-40);
        // A cleared round waits, like the start of a run, for its first placement.
        if(cleared)break;
        this.beginHop();this.revision++;
      }
      // After beginHop, so a mover knows the cell he is now committed to.
      this.stepMovers();
      this.refillNodes();
    }
  }
}
