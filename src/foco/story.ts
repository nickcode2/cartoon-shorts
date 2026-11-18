// ZUMBIS_PARTE_10 story paths (metres, seconds of the trimmed narration). Everything that more than one shot needs lives here so the shots stay consistent.
//   The group runs -z down the avenue toward the tower (TOWER_Z = -150). Bruno stops at z = STOP_Z at 22.4 s, runs back (+z) with the radio, the swarm follows him to the crossing (z = -60),
//   the path opens, the four run to the base of the tower and through the rain curtain into the door (z = DOOR_Z).
import {V3} from '../kit/kit';
import TL from './timeline.json';
import {DOOR_Z, TOWER_Z} from './sets';

export const FPS = 30;
export const cutF = (id: string): number => TL.cuts.find((c) => c.id === id)!.f;
export const cutT = (id: string): number => cutF(id) / FPS;
export const RUN_V = 5.2, Z0 = 14, STOP_T = cutT('7');
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Formation of the group (x offset, extra z behind the leader), the leader is Caio. Lanes are >= 0.9 m apart so nobody touches. */
export const FORM: Record<string, [number, number]> = {caio: [0.0, 0.0], ana: [-1.05, 0.95], bruno: [1.15, 0.55], davi: [-0.45, 2.05], lia: [2.4, 2.15]};
/** Run distance at time t when the runner brakes (cosine ramp of `a` s) and is stopped at tS: smooth deceleration, no sudden stop. */
export const runDist = (t: number, tS: number, a = 0.45, v = RUN_V): number => { const t0 = tS - a; if (t <= t0) return v * t; const u = Math.min(a, t - t0); return v * (t0 + (2 * a / Math.PI) * Math.sin((Math.PI * u) / (2 * a))); };
/** 1 while running, ramps to 0 over the braking time (feeds the gait amplitude). */
export const runK = (t: number, tS: number, a = 0.45): number => (t <= tS - a ? 1 : t >= tS ? 0 : Math.cos((Math.PI * (t - (tS - a))) / (2 * a)));
/** Bruno brakes at STOP_T + 0.3, the others one step later (STOP_T + 1.0). */
export const T_STOP_B = STOP_T + 0.3, T_STOP_O = STOP_T + 1.0;
export const tStop = (role: string) => (role === 'bruno' ? T_STOP_B : role === 'lia' ? T_STOP_B + 0.3 : T_STOP_O);
export const groupDist = (role: string, t: number) => runDist(t, tStop(role));
export const leaderZ = (t: number) => Z0 - runDist(t, T_STOP_O);
export const groupPos = (role: string, t: number, xShift = 0): V3 => [FORM[role][0] + xShift, 0, Z0 - runDist(t, tStop(role)) + FORM[role][1]];
export const BRUNO_STOP_Z = Z0 - runDist(1e3, T_STOP_B) + FORM.bruno[1], OTHERS_STOP_Z = Z0 - runDist(1e3, T_STOP_O);
export const STOP_Z = OTHERS_STOP_Z;
/** Bruno after the radio: runs back +z (drifting +x) from where he stopped at 'e corre' (shot 9b start), reaches the crossing (z = -60) around 32 s. */
export const RUN_BACK_T = cutT('9b'), BRUNO_V = 6.0;
export const brunoDist = (t: number): number => { const u = Math.max(0, t - RUN_BACK_T), a = 0.5; return BRUNO_V * (u < a ? (u * u) / (2 * a) : u - a / 2); };
export const brunoBack = (t: number): V3 => [FORM.bruno[0] + Math.min(3.0, 0.5 * Math.max(0, t - RUN_BACK_T)), 0, BRUNO_STOP_Z + brunoDist(t)];
/** The four (without Bruno) run to the door after the path opens (start at 'caminho abre' = shot 12), stop at the base of the tower (r = 24 from the tower axis), then run through the curtain at shot 18. */
export const FOUR_T0 = cutT('12'), STOP2_Z = -126, FOUR_V = 5.6;
export const FOUR_FORM: Record<string, [number, number]> = {caio: [0.0, 0.0], lia: [0.2, 1.35], ana: [0.4, 2.7], davi: [0.6, 4.05]};
export const fourPos = (role: string, t: number): V3 => {
  const f = FOUR_FORM[role], run = Math.max(0, t - FOUR_T0), z0 = OTHERS_STOP_Z + f[1], z = Math.max(STOP2_Z + f[1], z0 - FOUR_V * run), tt = cutT('18'), through = Math.max(0, t - tt);
  const e = sstep(0, 2.0, through), lag = 0, zz = z - 7.2 * sstep(0, 2.3, through) + lag * e; // through the curtain to the door: they bunch into a single file (staggered along z)
  return [f[0] * (1 - 0.6 * e), 0, zz];
};
export const PLAZA = {z: TOWER_Z, doorZ: DOOR_Z};
