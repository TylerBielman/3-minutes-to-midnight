export type GestureMode='pending'|'drag'|'discard';
export function downwardSwipe(dx:number,dy:number){return dy>=30&&dy>Math.abs(dx)*1.15;}
export function gestureMode(mode:GestureMode,dx:number,dy:number):GestureMode{
  if(mode!=='pending')return mode;
  if(downwardSwipe(dx,dy))return 'discard';
  return dy < -24?'drag':'pending';
}
