import Phaser from 'phaser';
import { COLORS, PIECES, SEED } from './data';
import type { DockDef, GameColor, PieceDef, Vec2 } from './types';
import { insideCircle, polygonsOverlap, rotate, transform } from './geometry';

const W=390, H=844;
const PLAY={x:0,y:130,size:390,cx:195,cy:325,ring:184};
const FLOAT_Y=54;
const SNAP_RADIUS=58;

type DockState={def:DockDef, owner:PieceView, used:boolean, glow:boolean};

class PieceView extends Phaser.GameObjects.Container {
  def:PieceDef;
  bodyGraphics:Phaser.GameObjects.Graphics;
  dockGraphics:Phaser.GameObjects.Graphics;
  label?:Phaser.GameObjects.Text;
  docks:DockState[]=[];
  placed=false;
  sourceSlot=-1;
  dragging=false;
  candidate?:{target:DockState, source:DockState, x:number,y:number,r:number, legal:boolean};

  constructor(scene:Phaser.Scene, def:PieceDef, x:number,y:number){
    super(scene,x,y); this.def=def;
    this.bodyGraphics=scene.add.graphics(); this.add(this.bodyGraphics);
    this.dockGraphics=scene.add.graphics(); this.add(this.dockGraphics);
    if(def.value!=null){ this.label=scene.add.text(0,0,String(def.value),{fontFamily:'Arial',fontSize:'26px',color:'#ffffff',fontStyle:'bold'}).setOrigin(.5); this.add(this.label); }
    this.docks=def.docks.map(d=>({def:d,owner:this,used:false,glow:false}));
    scene.add.existing(this); this.redraw();
    const hit=new Phaser.Geom.Polygon(def.polygon.map(p=>new Phaser.Geom.Point(p.x,p.y)));
    this.setInteractive(hit, Phaser.Geom.Polygon.Contains);
  }
  redraw(){
    const fill=(COLORS as any)[this.def.color];
    this.bodyGraphics.clear().fillStyle(fill,1).lineStyle(2,0x15171b,1);
    this.bodyGraphics.beginPath(); const p=this.def.polygon; this.bodyGraphics.moveTo(p[0].x,p[0].y); for(let i=1;i<p.length;i++)this.bodyGraphics.lineTo(p[i].x,p[i].y); this.bodyGraphics.closePath().fillPath().strokePath();
    this.dockGraphics.clear();
    for(const d of this.docks){
      if(d.used) continue;
      const c=(COLORS as any)[d.def.color];
      if(d.glow){ this.dockGraphics.fillStyle(c,.18).fillCircle(d.def.x,d.def.y,13); this.dockGraphics.lineStyle(3,0xffffff,.9).strokeCircle(d.def.x,d.def.y,9); }
      this.dockGraphics.fillStyle(c,1).lineStyle(2,0x111111,1).fillCircle(d.def.x,d.def.y,6).strokeCircle(d.def.x,d.def.y,6);
    }
  }
  worldDock(d:DockState):Vec2 { const q=rotate(d.def,this.rotation); return {x:this.x+q.x,y:this.y+q.y}; }
  worldPoly():Vec2[]{ return transform(this.def.polygon,this.x,this.y,this.rotation); }
}

class MainScene extends Phaser.Scene {
  structure:PieceView[]=[];
  draft:PieceView[]=[];
  seams!:Phaser.GameObjects.Graphics;
  hint!:Phaser.GameObjects.Text;
  active?:PieceView;

  constructor(){ super('main'); }
  create(){
    this.cameras.main.setBackgroundColor('#111318');
    this.seams=this.add.graphics();
    this.drawUI();
    const seed=new PieceView(this,SEED,PLAY.cx,PLAY.cy); seed.placed=true; seed.disableInteractive(); this.structure.push(seed);
    this.spawnDraft();
    this.hint=this.add.text(W/2,816,'Drag one piece upward. Matching docks glow.',{fontFamily:'Arial',fontSize:'13px',color:'#aeb5bf'}).setOrigin(.5);
  }
  drawUI(){
    const g=this.add.graphics();
    g.lineStyle(2,0x4a515c,1).strokeRect(0,0,W,110);
    this.add.text(18,18,'INTERACTION SANDBOX',{fontFamily:'Arial',fontSize:'13px',color:'#9da6b2'});
    this.add.text(18,45,'Build 0.1',{fontFamily:'Arial',fontSize:'28px',color:'#ffffff',fontStyle:'bold'});
    this.add.text(370,26,'ONE HAND',{fontFamily:'Arial',fontSize:'12px',color:'#7ee0a1'}).setOrigin(1,0);
    g.lineStyle(2,0x5d6673,1).strokeRect(PLAY.x,PLAY.y,PLAY.size,PLAY.size);
    g.lineStyle(3,0xe7a83b,1).strokeCircle(PLAY.cx,PLAY.cy,PLAY.ring);
    g.lineStyle(2,0x4a515c,1).strokeRect(0,540,W,284);
    this.add.text(16,553,'DRAFT — literal pieces, gameplay scale',{fontFamily:'Arial',fontSize:'13px',color:'#b8c0ca'});
  }
  spawnDraft(){
    const xs=[68,195,322], y=692;
    PIECES.forEach((def,i)=>{
      const p=new PieceView(this,def,xs[i],y); p.sourceSlot=i; this.draft.push(p);
      p.on('pointerdown',(pointer:Phaser.Input.Pointer)=>this.startDrag(p,pointer));
    });
    this.input.on('pointermove',(pointer:Phaser.Input.Pointer)=>this.moveDrag(pointer));
    this.input.on('pointerup',()=>this.endDrag());
  }
  startDrag(p:PieceView,pointer:Phaser.Input.Pointer){
    if(p.placed) return;
    this.active=p; p.dragging=true; p.setDepth(30);
    p.x=pointer.x; p.y=pointer.y-FLOAT_Y;
    this.setGlow(p.def.color as GameColor,true);
    this.hint.setText('Orbit around a glowing dock to pivot. Bright ghost = legal fit.');
  }
  setGlow(color:GameColor,on:boolean){
    for(const p of this.structure) for(const d of p.docks){ d.glow=on && !d.used && d.def.color===color; p.redraw(); }
  }
  moveDrag(pointer:Phaser.Input.Pointer){
    const p=this.active; if(!p) return;
    const free={x:pointer.x,y:pointer.y-FLOAT_Y};
    p.candidate=undefined;
    let best:any; let bestDist=Infinity;
    for(const owner of this.structure){
      for(const td of owner.docks){
        if(td.used || td.def.color!==p.def.color) continue;
        const tw=owner.worldDock(td); const dist=Math.hypot(free.x-tw.x,free.y-tw.y);
        if(dist>SNAP_RADIUS) continue;
        for(const sd of p.docks){
          if(sd.used || sd.def.color!==td.def.color) continue;
          const alpha=Math.atan2(free.y-tw.y,free.x-tw.x);
          const localAngle=Math.atan2(sd.def.y,sd.def.x);
          const rot=alpha+Math.PI-localAngle;
          const rd=rotate(sd.def,rot); const x=tw.x-rd.x, y=tw.y-rd.y;
          const poly=transform(p.def.polygon,x,y,rot);
          const legal=insideCircle(poly,PLAY.cx,PLAY.cy,PLAY.ring) && this.structure.every(other=>other===owner || !polygonsOverlap(poly,other.worldPoly()));
          const score=dist+(legal?0:1000);
          if(score<bestDist){bestDist=score;best={target:td,source:sd,x,y,r:rot,legal};}
        }
      }
    }
    if(best){ p.candidate=best; p.x=best.x;p.y=best.y;p.rotation=best.r; p.setAlpha(best.legal?1:.55); }
    else { p.x=free.x;p.y=free.y;p.setAlpha(1); }
  }
  endDrag(){
    const p=this.active; if(!p) return;
    const c=p.candidate;
    if(c?.legal){
      p.placed=true;p.dragging=false;p.setAlpha(1);p.disableInteractive();
      c.target.used=true;c.source.used=true;c.target.owner.redraw();p.redraw();
      this.structure.push(p); this.draft=this.draft.filter(x=>x!==p); this.drawSeam(c.target.owner.worldDock(c.target),p.def.color as GameColor);
      this.hint.setText('SNAP. Reload page for another pass — this build tests feel, not game loop.');
    } else {
      const slots=[68,195,322]; p.x=slots[p.sourceSlot];p.y=692;p.rotation=0;p.setAlpha(1);p.candidate=undefined;
      this.hint.setText('No legal fit. Try another glowing dock or orbit farther.');
    }
    this.setGlow(p.def.color as GameColor,false); p.setDepth(1); this.active=undefined;
  }
  drawSeam(pos:Vec2,color:GameColor){
    this.seams.fillStyle((COLORS as any)[color],1).fillCircle(pos.x,pos.y,5);
    this.time.delayedCall(100,()=>this.seams.clear());
  }
}

new Phaser.Game({
  type:Phaser.AUTO,
  parent:'app',
  width:W,height:H,
  backgroundColor:'#111318',
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  scene:[MainScene],
  input:{activePointers:1},
  render:{antialias:true,pixelArt:false}
});
