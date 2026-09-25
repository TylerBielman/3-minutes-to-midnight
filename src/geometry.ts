import type { Vec2 } from './types';

export function rotate(v: Vec2, r: number): Vec2 {
  const c=Math.cos(r), s=Math.sin(r);
  return {x:v.x*c-v.y*s, y:v.x*s+v.y*c};
}
export function transform(poly: Vec2[], x:number, y:number, r:number): Vec2[] {
  return poly.map(p=>{ const q=rotate(p,r); return {x:q.x+x,y:q.y+y}; });
}
function project(poly:Vec2[], axis:Vec2): [number,number] {
  let min=Infinity,max=-Infinity;
  for(const p of poly){ const d=p.x*axis.x+p.y*axis.y; min=Math.min(min,d); max=Math.max(max,d); }
  return [min,max];
}
export function polygonsOverlap(a:Vec2[], b:Vec2[], epsilon=0.75): boolean {
  for(const poly of [a,b]){
    for(let i=0;i<poly.length;i++){
      const p=poly[i], q=poly[(i+1)%poly.length];
      const edge={x:q.x-p.x,y:q.y-p.y};
      const len=Math.hypot(edge.x,edge.y)||1;
      const axis={x:-edge.y/len,y:edge.x/len};
      const [amin,amax]=project(a,axis), [bmin,bmax]=project(b,axis);
      if(Math.min(amax,bmax)-Math.max(amin,bmin) <= epsilon) return false;
    }
  }
  return true;
}
export function insideCircle(poly:Vec2[], cx:number,cy:number,r:number): boolean {
  return poly.every(p=>Math.hypot(p.x-cx,p.y-cy) <= r);
}
