// ZUMBIS_PARTE_10 swarm logic (pure maths, no GPU): the wall of hovering zombies round the tower base, the flock that turns on Bruno, chasers behind the runners, the zombies that hit the water.
// Rules (STYLE_NOTES "creature rules", applied to the flyers): the HEAD LEADS (forward = velocity direction whenever the zombie moves, otherwise it aims at its target), nobody moves backward,
// wings never overlap (formations keep >= 4.2 m between neighbours, the flock simulation has a separation force, `wingClearance` in zombie.tsx verifies it), at most MAX_ZOMBIES (80) per swarm.
import {V3, hash} from '../kit/kit';
import {MAX_ZOMBIES, ZState, norm3} from './zombie';
import {TOWER_Z} from './sets';
import {brunoBack, cutT, clamp01, leaderZ, mix, sstep} from './story';

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const FLAP = {amp: 0.5, freq: 12.5};

// ---------------------------------------------------------------- the WALL: rows of hovering zombies on an arc round the front of the tower base, facing outward
export interface WallZ {ang: number; r: number; y: number; ph: number; s: number; row: number}
export const WALL: WallZ[] = (() => {
  const rows = [6.5, 11.0, 15.5, 20.0], out: WallZ[] = [], R = 31, step = 7.0 / R; // zombies are 1.5 x life size here (wingspan about 4.8 m): arc spacing 7 m keeps the wings apart
  rows.forEach((y, row) => { const a0 = -1.42 + (row % 2) * step * 0.5; for (let a = a0; a <= 1.42 && out.length < 68; a += step) out.push({ang: a, r: R + (hash(out.length, 3) - 0.5) * 2.4, y: y + (hash(out.length, 4) - 0.5) * 0.8, ph: hash(out.length, 5) * 6.28, s: 1.45 + hash(out.length, 6) * 0.2, row}); });
  return out;
})();
export const wallBase = (z: WallZ): V3 => [Math.sin(z.ang) * z.r, z.y, TOWER_Z + Math.cos(z.ang) * z.r];
const wob = (i: number, t: number): V3 => [0.16 * Math.sin(t * 1.1 + i), 0.2 * Math.sin(t * 1.5 + i * 2.1), 0.16 * Math.cos(t * 0.9 + i * 1.3)];
const outward = (z: WallZ): V3 => norm3([Math.sin(z.ang), -0.18, Math.cos(z.ang)]);

// ---------------------------------------------------------------- the FLOCK that turns on Bruno: one joint simulation (30 fps), goals per phase, separation force, deterministic
interface Sim {pos: V3[][]; t0: number}
let SIM: Sim | null = null;
const SIM_T0 = cutT('9b') + 0.2, SIM_T1 = cutT('13') + 1; // the radio static (9a) wakes the wall: it starts to lift and turn while Bruno runs away (9b), the flock is flying by shot 10
export const SWIRL_C: V3 = [3.2, 5, -57]; // the dust cloud / the swirl over Bruno at the crossing
function sim(): Sim {
  if (SIM) return SIM;
  const dt = 1 / 30, n = WALL.length, steps = Math.ceil((SIM_T1 - SIM_T0) / dt) + 1, pos: V3[][] = Array.from({length: n}, () => []), p: V3[] = [], d: V3[] = [], v: number[] = [], started: boolean[] = [];
  const t0s = WALL.map((z, i) => SIM_T0 + 0.5 + sstep(-1.4, 1.4, z.ang) * 0.6 + hash(i, 9) * 0.6); // the radio static hits the front of the wall first
  for (let i = 0; i < n; i++) { p.push(add(wallBase(WALL[i]), wob(i, SIM_T0))); d.push(outward(WALL[i])); v.push(0); started.push(false); }
  for (let k = 0; k < steps; k++) {
    const t = SIM_T0 + k * dt;
    for (let i = 0; i < n; i++) {
      if (t < t0s[i]) { p[i] = add(wallBase(WALL[i]), wob(i, t)); d[i] = outward(WALL[i]); v[i] = 0; pos[i].push([...p[i]] as V3); continue; }
      const bt = brunoBack(t + 0.4), swallow = t > cutT('11') - 0.2, goal: V3 = swallow ? add(SWIRL_C, [Math.sin(t * 1.1 + i * 0.7) * 13, (i % 5) * 2.4, Math.cos(t * 1.1 + i * 0.7) * 13]) : [bt[0], 5 + (i % 5) * 1.8, bt[2]]; // dive on Bruno, then swirl over him
      let des = norm3(sub(goal, p[i]));
      for (let j = 0; j < n; j++) { if (j === i) continue; const q = sub(p[i], p[j]), dd = len(q); if (dd < 11 && dd > 1e-3) des = norm3(add(des, mul(q, (11 - dd) / (11 * dd) * 4.0))); } // separation
      if (p[i][1] < 3.4 && des[1] < 0) des = norm3([des[0], 0.1, des[2]]);
      const turn = 3.2, nd = norm3(add(d[i], mul(sub(des, d[i]), Math.min(1, turn * dt))));
      d[i] = nd; v[i] = Math.min(21 + (i % 5) * 0.8, v[i] + 14 * dt); if (swallow) v[i] = Math.min(v[i], 8.5);
      p[i] = add(p[i], mul(nd, v[i] * dt)); if (p[i][1] < 3.2) { p[i][1] = 3.2; d[i] = norm3([d[i][0], Math.max(0.05, d[i][1]), d[i][2]]); } pos[i].push([...p[i]] as V3);
    }
  }
  SIM = {pos, t0: SIM_T0}; return SIM;
}
/** Zombie i of the wall at global time t (s): hovering (before the radio), flying (flock sim), hovering again far away is not needed after the sim ends (the shots that follow do not show the wall). */
export function wallState(i: number, t: number, wet = 0): ZState {
  const z = WALL[i];
  if (t < SIM_T0 + 0.5 || t < 0 || i >= WALL.length) { const p = add(wallBase(z), wob(i, t)); return {p, fwd: outward(z), s: z.s, ph: z.ph, wet, amp: 0.38, freq: 11 + (i % 5) * 0.4}; }
  const S = sim(), k = Math.min(S.pos[i].length - 2, Math.max(0, (t - S.t0) * 30)), a = Math.floor(k), f = k - a, p0 = S.pos[i][a], p1 = S.pos[i][a + 1], p = add(p0, mul(sub(p1, p0), f));
  const q = S.pos[i][Math.min(S.pos[i].length - 1, a + 3)], r = S.pos[i][Math.max(0, a - 1)], v = sub(q, r), sp = len(v) / (4 / 30);
  const fwd = sp > 0.4 ? norm3(v) : outward(z), dir0 = a > 0 ? norm3(sub(S.pos[i][a + 1], S.pos[i][Math.max(0, a - 3)])) : fwd, yaw = Math.atan2(fwd[0], fwd[2]) - Math.atan2(dir0[0], dir0[2]);
  return {p, fwd, s: z.s, ph: z.ph, wet, roll: Math.max(-0.6, Math.min(0.6, -4 * Math.atan2(Math.sin(yaw), Math.cos(yaw)))), amp: 0.62, freq: 12.5 + (i % 4) * 0.5};
}
export const wallStates = (t: number, ids?: number[]): ZState[] => (ids ?? WALL.map((_, i) => i)).map((i) => wallState(i, t));
/** The wall after the swarm left: only the far dots (used for the empty-wall shot: the zombies that are still on their way out). */
export const wallRemaining = (t: number): ZState[] => WALL.map((_, i) => wallState(i, t)).filter((_, i) => i % 6 === 0);

// ---------------------------------------------------------------- chasers behind the runners (a formation that keeps its spacing and dives toward them)
export function chasers(t: number, n: number, seed: number, anchor: (t: number) => V3, o: {behind?: number; height?: number; dive?: number; wide?: number; wet?: number} = {}): ZState[] {
  const out: ZState[] = [], bh = o.behind ?? 14, hh = o.height ?? 9, dv = o.dive ?? 5, wd = o.wide ?? 5; // a staggered grid keeps every neighbour >= 4.2 m away
  const cols = Math.ceil(Math.sqrt(n * 1.6)), pos = (i: number, tt: number): V3 => { const c = i % cols, r = Math.floor(i / cols), a = anchor(tt), x = (c - (cols - 1) / 2) * 4.6 * (wd / 5) + (r % 2) * 2.3 + (hash(i, seed) - 0.5) * 0.4, back = bh + r * 5.2 + hash(i, seed + 1) * 2, drop = (r % 2) * 3.6 + hash(i, seed + 2) * 1.2, dive = sstep(0, 5, tt) * dv; return [a[0] + x, Math.max(2.6, hh + drop - dive + Math.sin(tt * 1.1 + i) * 0.4), a[2] - back * 0 + back]; };
  for (let i = 0; i < n; i++) { const p = pos(i, t), p2 = pos(i, t + 0.1), p0 = pos(i, t - 0.1), v = sub(p2, p0), sp = len(v) / 0.2, a = anchor(t), aim = norm3(sub([a[0], 1.4, a[2]], p)); out.push({p, fwd: sp > 0.4 ? norm3(v) : aim, s: 0.95 + hash(i, seed + 3) * 0.2, ph: hash(i, seed + 4) * 6.28, wet: o.wet ?? 0, roll: 0.08 * Math.sin(t * 0.9 + i), amp: 0.62, freq: 12.5 + (i % 4) * 0.5}); }
  return out.slice(0, MAX_ZOMBIES);
}

// ---------------------------------------------------------------- general fly path -> state (head leads by construction)
export interface Path {pos: (t: number) => V3; aim?: V3 | ((t: number) => V3); s?: number; ph?: number; wet?: (t: number) => number; amp?: number; freq?: number; vis?: (t: number) => number}
export function stateOf(p: Path, t: number): ZState {
  const a = p.pos(t - 0.05), b = p.pos(t + 0.05), v = sub(b, a), sp = len(v) / 0.1, pos = p.pos(t), aim = typeof p.aim === 'function' ? p.aim(t) : p.aim ?? add(pos, [0, 0, 1]), aimDir = norm3(sub(aim, pos));
  const w = sstep(0.25, 0.9, sp), fwd = norm3(add(mul(aimDir, 1 - w), mul(norm3(v), w))), c = p.pos(t + 0.25), e = p.pos(t - 0.25), yaw = Math.atan2(c[0] - pos[0], c[2] - pos[2]) - Math.atan2(pos[0] - e[0], pos[2] - e[2]), dy = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  return {p: pos, fwd, s: p.s ?? 1, ph: p.ph ?? 0, wet: p.wet ? p.wet(t) : 0, roll: Math.max(-0.7, Math.min(0.7, -2.2 * dy)), amp: p.amp ?? 0.6, freq: p.freq ?? 12.5, vis: p.vis ? p.vis(t) : 1};
}
/** A zombie that crosses the rain curtain at `tHit`: it flies toward `target`, its wings soak (wet 0 -> 1 in 0.45 s after the hit), it loses lift and falls head-first (gravity), hits the ground and lies there. */
export function faller(i: number, from: V3, target: V3, tHit: number, speed = 11, seed = 1): Path {
  const dir = norm3(sub(target, from)), tStart = tHit - len(sub(target, from)) / speed, ground = 0.32, h0 = target[1], tL = tHit + Math.sqrt(Math.max(0.05, (h0 - ground) / 4.5)), fwd: V3 = [dir[0], 0, dir[2]], fl = Math.hypot(fwd[0], fwd[2]) || 1;
  const at = (t: number): V3 => {
    if (t <= tHit) { const s = Math.max(0, (t - tStart) * speed); return [from[0] + dir[0] * s, from[1] + dir[1] * s, from[2] + dir[2] * s]; }
    const u = Math.min(t, tL + 0.2) - tHit, run = (0.5 * speed) * (1 - Math.exp(-2.2 * u)) / 2.2; // after the hit: half the speed, dragged by the water, gravity takes over (nose-down fall, head leads)
    return [target[0] + (fwd[0] / fl) * run, Math.max(ground, h0 - 4.5 * u * u), target[2] + (fwd[2] / fl) * run];
  };
  return {pos: at, aim: (t) => add(at(t), [fwd[0] / fl, t < tL ? -0.9 : -0.3, fwd[2] / fl]), s: 0.95 + hash(i, seed + 2) * 0.1, ph: hash(i, seed + 3) * 6.28, wet: (t) => clamp01((t - tHit) / 0.45), amp: 0.62, freq: 12.5};
}
/** Lying on the ground after the fall: the state is held (no flap) once the body reached the ground. */
export const mixV = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
export const leader = leaderZ;
