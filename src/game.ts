import {SHAPES,key,same,rotated,translated,placementError,randomStep,chooseNext,freshReach,type Cell,type Group} from './runway.js';
export type Settings={duration:number,grid:number,hopMs:number,nodeCount:number,seed:number,spawn:'random'|'uncovered',roadLimit:number,hitRadius:number};
export const DEFAULTS:Settings={duration:180,grid:19,hopMs:450,nodeCount:6,seed:12345,spawn:'random',roadLimit:25,hitRadius:.10};
export const TUNING={groupWeights:{common:.70,small:.15,large:.15},phaseSpeeds:[.5,1,1.5],nodeRadius:.32,previewLimit:64,simulationStep:16};
export type Draft={shapeId:string,turns:number};
type Hop={from:Cell,to:Cell,elapsed:number};
export function ringRadius(elapsedMs:number,settings:Settings):number {
  const initial=settings.grid/2-.25,phaseMs=settings.duration*1000/3;
  let remaining=Math.max(0,elapsedMs),distance=0;
  for(const speed of TUNING.phaseSpeeds){const time=Math.min(phaseMs,remaining);distance+=initial/ (settings.duration*1000)*speed*time;remaining-=time;}
  return Math.max(0,initial-distance);
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
    s.seed=s.seed>>>0;this.pieceRng=s.seed;this.nodeRng=s.seed^0xA9E3779B;this.navRng=s.seed^0x71B54A35;
    this.at={x:Math.floor(s.grid/2),y:Math.floor(s.grid/2)};
    this.board.add(key(this.at));this.visited.add(key(this.at));
    this.pieces.push({cells:[{...this.at}],shapeId:'Start'});
    this.draft=[this.draw(),this.draw(),this.draw()];this.refillNodes();
  }
  get radius(){return ringRadius(this.elapsed,this.settings);}
  get phase(){return Math.min(3,1+Math.floor(this.elapsed/(this.settings.duration*1000/3)));}
  get position():Cell{if(!this.hop)return {...this.at};const t=this.hop.elapsed/this.settings.hopMs;return {x:this.hop.from.x+(this.hop.to.x-this.hop.from.x)*t,y:this.hop.from.y+(this.hop.to.y-this.hop.from.y)*t};}
  private draw():Draft{
    let r=randomStep(this.pieceRng);this.pieceRng=r.state;
    const group:Group=r.value<TUNING.groupWeights.common?'common':r.value<TUNING.groupWeights.common+TUNING.groupWeights.small?'small':'large';
    r=randomStep(this.pieceRng);this.pieceRng=r.state;const pool=SHAPES.filter(s=>s.group===group);
    return {shapeId:pool[Math.floor(r.value*pool.length)].id,turns:0};
  }
  cells(slot:number,origin:Cell={x:0,y:0}):Cell[]{const p=this.draft[slot];return translated(rotated(SHAPES.find(s=>s.id===p.shapeId)!.cells,p.turns),origin);}
  rotate(slot:number){if(!this.over){this.draft[slot].turns=(this.draft[slot].turns+1)%4;this.rotations++;this.record('rotate',{slot,...this.draft[slot]});}}
  discard(slot:number){if(this.over)return;this.record('discard',{slot,...this.draft[slot]});this.draft[slot]=this.draw();this.discards++;}
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
    if(result.next)this.hop={from:{...this.at},to:result.next,elapsed:0};
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
    const eligible:Cell[]=[];
    for(let y=0;y<this.settings.grid;y++)for(let x=0;x<this.settings.grid;x++){
      const p={x,y},k=key(p);
      if(this.nodes.has(k)||same(p,this.at)||(this.hop&&same(p,this.hop.to)))continue;
      if(this.settings.spawn==='uncovered'&&this.board.has(k))continue;
      if(Math.hypot(x-center,y-center)+TUNING.nodeRadius<this.radius)eligible.push(p);
    }
    while(this.nodes.size<this.settings.nodeCount&&eligible.length){
      let r=randomStep(this.nodeRng);this.nodeRng=r.state;const [p]=eligible.splice(Math.floor(r.value*eligible.length),1);
      r=randomStep(this.nodeRng);this.nodeRng=r.state;this.nodes.set(key(p),[1,3,5][Math.floor(r.value*3)]);
    }
  }
  advance(deltaMs:number){
    if(!this.running||this.over||!Number.isFinite(deltaMs)||deltaMs<=0)return;
    let remaining=deltaMs;
    while(remaining>0&&!this.over){
      const dt=Math.min(remaining,TUNING.simulationStep,this.hop?this.settings.hopMs-this.hop.elapsed:Infinity);
      remaining-=dt;this.elapsed+=dt;if(this.hop)this.hop.elapsed+=dt;
      const p=this.position,center=(this.settings.grid-1)/2;
      // Ground footprint, not the decorative vertical hop. Check before awarding pickups.
      const clearance=this.radius-Math.hypot(p.x-center,p.y-center)-this.settings.hitRadius;
      if(clearance<=0){this.over=true;this.running=false;this.revision++;this.record('capture',{position:p,radius:this.radius});break;}
      this.minClearance=Math.min(this.minClearance??Infinity,clearance);
      if(clearance<.5&&!this.nearRing){this.nearRing=true;this.record('danger-enter',{position:p});}
      if(clearance>.75&&this.nearRing){this.nearRing=false;this.nearMisses++;this.record('near-miss',{position:p});}
      if(this.hop&&this.hop.elapsed>=this.settings.hopMs){
        this.previous=this.hop.from;this.at=this.hop.to;this.hop=undefined;this.visited.add(key(this.at));this.hops++;this.record('hop',{at:this.at});
        const value=this.nodes.get(key(this.at));if(value!==undefined){this.score+=value;this.collected++;this.nodes.delete(key(this.at));this.record('collect',{at:this.at,value});}
        this.beginHop();this.revision++;
      }
      this.refillNodes();
    }
  }
}
