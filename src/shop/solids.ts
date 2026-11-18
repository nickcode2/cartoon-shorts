// Solid volumes of the SUPERMARKET hall (gondola shelves, counter, pillars, walls) for the QA gate: the camera must never sit inside one of them.
export type V3 = [number, number, number];
export interface Solid {name: string; min: V3; max: V3}
const gz: [number, number][] = [[-6.2, -1.2], [0.2, 5.2], [6.6, 11.6], [13, 15.6]], gzR: [number, number][] = [[0.2, 5.2], [6.6, 11.6], [13, 15.6]];
export const SHOP_SOLIDS: Solid[] = [
  ...gz.map(([a, b]): Solid => ({name: 'left gondola', min: [-3.25, 0, a], max: [-2.15, 1.85, b]})),
  ...gzR.map(([a, b]): Solid => ({name: 'right gondola', min: [2.15, 0, a], max: [3.25, 1.85, b]})),
  {name: 'counter', min: [2.9, 0, -5.7], max: [3.95, 1.15, -1.9]},
  ...[-0.5, 5.9, 12.3].flatMap((z) => [-2.7, 2.7].filter((x) => !(z < 0 && x > 0)).map((x): Solid => ({name: 'pillar', min: [x - 0.32, 0, z - 0.32], max: [x + 0.32, 3.8, z + 0.32]}))),
];
/** '' when the point is inside the hall air, else the reason. */
export function shopInside(p: V3): string {
  const [x, y, z] = p;
  if (y < 0.04) return 'below the floor';
  if (y > 3.55) return 'above the ceiling';
  if (Math.abs(x) > 4.6) return 'in a side wall';
  if (z < -8.6) return 'in the entrance wall';
  if (z > 15.6) return 'in the back wall';
  for (const s of SHOP_SOLIDS) if (x > s.min[0] && x < s.max[0] && y > s.min[1] && y < s.max[1] && z > s.min[2] && z < s.max[2]) return `inside a ${s.name}`;
  return '';
}
const L: [number, number][] = Array.from({length: 9}, (_, i) => [0, -7 + i * 2.9] as [number, number]);
/** ceiling lamps (globes) the camera must not hide behind: AABBs [name, centre, half size] */
export const SHOP_LAMPS: {name: string; c: V3; h: V3}[] = [...L.map(([x, z]) => ({name: 'lamp', c: [x, 3.1, z] as V3, h: [0.2, 0.55, 0.2] as V3})), ...[-3.9, 3.9].flatMap((x) => [-6, -1.5, 3, 7.5, 12].map((z) => ({name: 'lamp', c: [x, 3.3, z] as V3, h: [0.14, 0.4, 0.14] as V3})))];
