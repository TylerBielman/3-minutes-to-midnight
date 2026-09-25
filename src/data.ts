import type { PieceDef } from './types';

export const COLORS = {
  red: 0xd94a4a,
  blue: 0x4387d9,
  green: 0x4daf63,
  yellow: 0xd9b43f,
  neutral: 0x9aa0a8,
} as const;

export const SEED: PieceDef = {
  id: 'seed-a',
  color: 'neutral',
  polygon: [
    {x:-36,y:-24},{x:-25,y:-42},{x:2,y:-36},{x:26,y:-45},
    {x:39,y:-16},{x:31,y:12},{x:40,y:34},{x:6,y:40},
    {x:-18,y:30},{x:-38,y:10},
  ],
  docks: [
    {id:'s-r1', color:'red', x:-11, y:-40},
    {id:'s-b1', color:'blue', x:36, y:-10},
    {id:'s-g1', color:'green', x:18, y:36},
    {id:'s-y1', color:'yellow', x:-35, y:14},
    {id:'s-r2', color:'red', x:29, y:27},
    {id:'s-b2', color:'blue', x:-31, y:-18},
  ],
};

export const PIECES: PieceDef[] = [
  {
    id:'red-hook', color:'red', value:4,
    polygon:[{x:-30,y:-22},{x:-23,y:-39},{x:3,y:-34},{x:24,y:-43},{x:34,y:-13},{x:16,y:8},{x:26,y:31},{x:-3,y:38},{x:-31,y:20}],
    docks:[
      {id:'r-a',color:'red',x:-28,y:-18},
      {id:'r-b',color:'red',x:24,y:-39},
      {id:'r-c',color:'red',x:24,y:29},
    ],
  },
  {
    id:'blue-arc', color:'blue', value:3,
    polygon:[{x:-34,y:-12},{x:-22,y:-38},{x:7,y:-33},{x:31,y:-18},{x:23,y:7},{x:33,y:31},{x:1,y:39},{x:-18,y:21}],
    docks:[
      {id:'b-a',color:'blue',x:-30,y:-15},
      {id:'b-b',color:'blue',x:28,y:-17},
      {id:'b-c',color:'blue',x:27,y:27},
    ],
  },
  {
    id:'yellow-kite', color:'yellow', value:5,
    polygon:[{x:-32,y:-27},{x:-5,y:-38},{x:19,y:-25},{x:35,y:-2},{x:16,y:14},{x:23,y:35},{x:-7,y:39},{x:-28,y:17}],
    docks:[
      {id:'y-a',color:'yellow',x:-28,y:-24},
      {id:'y-b',color:'yellow',x:31,y:-2},
      {id:'y-c',color:'yellow',x:-3,y:37},
    ],
  },
];
