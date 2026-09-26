export type Cell = {x:number,y:number};
export type Group = 'common'|'small'|'large';
export type Shape = {id:string,group:Group,cells:Cell[]};
const shape=(id:string,group:Group,rows:string[]):Shape=>({id,group,cells:rows.flatMap((row,y)=>[...row].flatMap((v,x)=>v==='#'?[{x,y}]:[]))});
export const SHAPES:Shape[]=[
  shape('I','common',['####']),shape('L','common',['#','#','##']),shape('J','common',['.#','.#','##']),
  shape('T','common',['###','.#']),shape('W','common',['#','##','.##']),shape('Step','common',['.#','##','#','#']),
  shape('Dot','small',['#']),shape('Domino','small',['##']),shape('Line3','small',['###']),shape('Elbow','small',['#','##']),
  shape('Long','large',['######']),shape('Cup','large',['#.#','###']),shape('Cross','large',['.#','###','.#'])
];
export const key=(c:Cell)=>`${c.x},${c.y}`;
export const cell=(k:string):Cell=>{const [x,y]=k.split(',').map(Number);return {x,y};};
export const same=(a:Cell,b:Cell)=>a.x===b.x&&a.y===b.y;
export const neighbors=(c:Cell):Cell[]=>[{x:c.x,y:c.y-1},{x:c.x+1,y:c.y},{x:c.x,y:c.y+1},{x:c.x-1,y:c.y}];
export function rotated(cells:Cell[],turns:number):Cell[]{
  let result=cells.map(p=>({...p}));
  for(let i=0;i<((turns%4)+4)%4;i++)result=result.map(p=>({x:-p.y,y:p.x}));
  const minX=Math.min(...result.map(p=>p.x)),minY=Math.min(...result.map(p=>p.y));
  return result.map(p=>({x:p.x-minX,y:p.y-minY}));
}
export const translated=(cells:Cell[],origin:Cell)=>cells.map(p=>({x:p.x+origin.x,y:p.y+origin.y}));
export function placementError(board:Set<string>,cells:Cell[],size:number):string|undefined {
  if(!cells.length||cells.some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=size||p.y>=size))return 'OFF THE BOARD';
  if(new Set(cells.map(key)).size!==cells.length||cells.some(p=>board.has(key(p))))return 'RUNWAY OVERLAP';
  if(!cells.some(p=>neighbors(p).some(n=>board.has(key(n)))))return 'CONNECT TO THE RUNWAY';
  return undefined;
}
export function randomStep(state:number):{state:number,value:number}{
  state=(state+0x6D2B79F5)>>>0;
  let v=state;v=Math.imul(v^(v>>>15),v|1);v^=v+Math.imul(v^(v>>>7),v|61);
  return {state,value:((v^(v>>>14))>>>0)/4294967296};
}
/** Block the deciding square so an exit cannot simply backtrack through it.
 * A loop's shared territory is counted once per exit, not once per path. */
export function freshReach(board:Set<string>,visited:Set<string>,entry:Cell,blocked:Cell):number {
  const seen=new Set([key(blocked)]),stack=[entry];let score=0;
  while(stack.length){const p=stack.pop()!,k=key(p);if(seen.has(k)||!board.has(k))continue;
    seen.add(k);if(!visited.has(k))score++;stack.push(...neighbors(p));}
  return score;
}
export function chooseNext(board:Set<string>,visited:Set<string>,at:Cell,previous:Cell|undefined,rng:number,reverse=false):{next?:Cell,rng:number,weights:{cell:Cell,weight:number}[]} {
  let options=neighbors(at).filter(p=>board.has(key(p)));
  if(reverse&&previous&&options.some(p=>same(p,previous)))return {next:previous,rng,weights:[]};
  // Normal travel never immediately doubles back if another exit exists.
  if(options.length>1&&previous)options=options.filter(p=>!same(p,previous));
  const weights=options.map(p=>({cell:p,weight:freshReach(board,visited,p,at)}));
  if(!weights.length)return {rng,weights};
  const best=Math.max(...weights.map(w=>w.weight)),ties=weights.filter(w=>w.weight===best);
  if(ties.length===1)return {next:ties[0].cell,rng,weights};
  const draw=randomStep(rng);return {next:ties[Math.floor(draw.value*ties.length)].cell,rng:draw.state,weights};
}
