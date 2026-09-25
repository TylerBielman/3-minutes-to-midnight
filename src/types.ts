export type GameColor = 'red' | 'blue' | 'green' | 'yellow';

export interface Vec2 { x: number; y: number }

export interface DockDef extends Vec2 {
  id: string;
  color: GameColor;
}

export interface PieceDef {
  id: string;
  color: GameColor | 'neutral';
  value?: number;
  polygon: Vec2[];
  docks: DockDef[];
}
