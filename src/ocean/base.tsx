// OVERBOARD_SURVIVOR shared scene pieces: take start frames (timeline.json), where the ship / the swimmer / the shark are at any frame, the sea + sky + lights wrapper, idle poses, small helpers.
// WORLD: the swimmer's splash point is the world origin; the cruise ship sails along +x at 9 m/s and passes it with its +z side 2.8 m away (ship centre z = -11); the camera usually sits on +z.
import React from 'react';
import {V3, Pose} from '../kit/kit';
import {CX} from '../kit/rickRig';
import {clamp, mix} from '../shop/shots';
import {Ocean, Ripple, SkyDome, WorldLights, WorldMode, ringsFor} from './ocean';
import TL from './timeline.json';
export {clamp, mix};
export type {Ctx} from '../shop/shots';
export const START: Record<string, number> = Object.fromEntries(TL.cuts.map((c) => [c.id, c.f]));
export const FRAMES = TL.frames, FPS = TL.fps;
export const sm = (x: number) => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u); };
export const ramp = (g: number, a: number, b: number) => sm((g - a) / (b - a));
export const lerp3 = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const SHIP_V = 9, SHIP_Z = -11;
export const shipX = (g: number) => 3 + (SHIP_V * (g - 147)) / 30;
export const shipPos = (g: number): V3 => [shipX(g), 0, SHIP_Z];
/** swimmer (world x, z) over the whole video: floats at the origin, swims away from the jellyfish (12b), is dragged by the current (13), flees the fin (14b), then treads in place */
export function swimXZ(g: number): [number, number] {
  const s = (a: number, b: number) => sm((g - a) / (b - a));
  return [2.8 * s(1000, 1052) + 4.6 * s(1047, 1157) + 2.2 * s(1222, 1250), 0.5 * s(1047, 1157) - 0.4 * s(1222, 1250)];
}
/** the fin circles the swimmer (centre lags him a little) */
export function finState(g: number): {p: V3; yaw: number; r: number} {
  const c = swimXZ(g - 14), th = 0.9 + 0.043 * (g - 1157), r = 3.6 - 0.6 * sm((g - 1157) / 100), x = c[0] + Math.cos(th) * r, z = c[1] + Math.sin(th) * r * 0.9;
  return {p: [x, 0, z], yaw: Math.atan2(Math.cos(th), Math.sin(th)), r};
}
export const rippleSrc = (g: number): Ripple[] => ringsFor(g / 30, (t0) => swimXZ(t0 * 30), 0.9, 1);
/** Sea + sky + lights for a take. `focus` centres the key light's shadow box. */
export const Sea: React.FC<{mode: WorldMode; g: number; ripples?: Ripple[]; amp?: number; clear?: number; fogNear?: number; fogFar?: number; moon?: boolean; focus?: V3; ss?: number; dome?: boolean}> = ({mode, g, ripples = [], amp = 0.8, clear = 1, fogNear, fogFar, moon = true, focus = [0, 0, 0], ss = 1024, dome = true}) => (
  <>
    <WorldLights mode={mode} ss={ss} focus={focus} />
    {dome && <SkyDome mode={mode} moon={moon} />}
    <Ocean mode={mode} t={g / 30} amp={amp} ripples={ripples} clear={clear} fogNear={fogNear} fogFar={fogFar} />
  </>
);
export const WarmPoint: React.FC<{p: V3; color?: string; i?: number; d?: number}> = ({p, color = '#FFC878', i = 7, d = 8}) => <pointLight position={p} color={color} intensity={i} distance={d} decay={2} />;
/** a standing pose with a tiny weight shift: arms hang with a slight elbow bend and sway, head drifts */
export function idleExtra(g: number, seed: number, k = 1) { const a = g * 0.07 + seed * 1.7; return {armSw: [0.06 * Math.sin(a) * k, -0.06 * Math.sin(a + 0.6) * k] as [number, number], lean: 0.02 * Math.sin(a * 0.7) * k, headRoll: 0.03 * Math.sin(a * 0.5) * k, headDx: 2 * Math.sin(a * 0.4) * k}; }
export const camFacing = (c: Pose) => c.p;
export const HANDS_UP = (g: number, seed = 0): {hands: [number, number][]; handsZ: [number, number]} => ({hands: [[CX - 200 + 20 * Math.sin(g * 0.45 + seed), 150 + 40 * Math.sin(g * 0.6 + seed)], [CX + 200 - 20 * Math.sin(g * 0.5 + seed), 140 + 40 * Math.cos(g * 0.55 + seed)]], handsZ: [20, 20]});
