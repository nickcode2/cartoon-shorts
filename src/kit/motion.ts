// Character motion helpers for the hoodie man card (card px, 600x1000, ground y = 942). Pure functions of time/distance: no state,
// no allocations that touch the GPU. They return partial ManPose fields (feet, hands, body, nod, ...), see hoodieMan.tsx.
// Rules in STYLE_NOTES.md "ANIMATION v5".
import {ManPose} from './hoodieMan';
import {V3, clamp01, lerp} from './kit';
import {METERS_PER_PX, SOLE_Y} from '../guard';
import {RIG_GLOW, RIG_HOODIE, Rig} from './limbs';

type V2 = [number, number];
const TAU = Math.PI * 2;
export const easeInOut = (x: number) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInOutSine = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(x));
const overshoot = (x: number, a = 1.35) => { const t = clamp01(x) - 1; return 1 + (a + 1) * t * t * t + a * t * t; }; // easeOutBack

// ---------------------------------------------------------------------------------------------------------------
// Minimum action durations in seconds (30 fps). No snappy timing: use at least these, more when the narration allows.
export const MIN_SEC = {anticipate: 0.2, reach: 0.5, grip: 0.15, lift: 0.4, carryStep: 0.6, place: 0.45, release: 0.15, retreat: 0.45, turn: 0.4, doorOpen: 0.6, lower: 0.5, step: 0.5} as const;

// ---------------------------------------------------------------------------------------------------------------
// World <-> card space for one card (same math as HoodieMan: scale s, yaw about y). Used to aim hands at 3D objects.
export interface CardSpace {
  toCard: (w: V3) => V2; // world point -> card px
  toWorld: (c: V2, depth?: number) => V3; // card px -> world point (depth = metres toward the camera along the card normal)
}
export const cardSpace = (p: V3, s: number, yaw: number): CardSpace => {
  const k = METERS_PER_PX * s, cs = Math.cos(yaw), sn = Math.sin(yaw);
  return {
    toCard: (w) => {
      const dx = w[0] - p[0], dz = w[2] - p[2];
      return [300 + (dx * cs - dz * sn) / k, SOLE_Y - (w[1] - p[1]) / k];
    },
    toWorld: (c, depth = 0) => {
      const lx = (c[0] - 300) * k, ly = (SOLE_Y - c[1]) * k;
      return [p[0] + lx * cs + depth * sn, p[1] + ly, p[2] - lx * sn + depth * cs];
    },
  };
};

// ---------------------------------------------------------------------------------------------------------------
// WALK. Phase is driven by DISTANCE travelled (metres), not time, so the planted foot moves back exactly as fast as the body moves
// forward: no sliding. `dist` is the integral of the walker's ground speed (use the same function that places the card in the world).
// Works best when the walk direction is roughly across the screen (truck / orbit shots). Set yawK = 0 on the card for exact plants.
/** Typical step timing from the walk-cycle references: about 12 frames per step at 24 fps = 0.5 s per step, so ground speed = stride / 0.5 s. */
export const STEP_SEC = 0.5;
export interface WalkOpts {
  rig?: Rig; // character anchor geometry (default RIG_HOODIE; RIG_GLOW for the sun / universe)
  stride?: number; // metres per STEP. Default = 0.75 x the leg length in world metres (so the foot never has to reach farther than the leg)
  dir?: 1 | -1; // walking direction on the card (+1 = toward card right)
  scale?: number; // card scale `s` (default 0.84)
  lift?: number; // foot lift px (default 34)
  bob?: number; // extra downward bob px on top of the geometric hip drop (default 6)
  sway?: number; // hip sway px (default 9)
  armSwing?: number; // px (default 46)
  intensity?: number; // 0..1 blend from standing to walking (use easeInOut over >= 0.5 s when starting/stopping)
}
const GROUND = 942;
/** Default stride in metres for a rig: half-step offset of 0.375 x the leg length keeps the planted foot within reach with a slight knee bend. */
export const defaultStride = (rig: Rig, scale = 0.84) => 0.75 * (rig.leg[0] + rig.leg[1]) * METERS_PER_PX * scale;
export function walk(dist: number, o: WalkOpts = {}): Pick<ManPose, 'feet' | 'hands' | 'body' | 'face' | 'headRoll'> {
  const rig = o.rig ?? RIG_HOODIE;
  const dir = o.dir ?? 1, s = o.scale ?? 0.84, k = o.intensity ?? 1;
  const stride = o.stride ?? defaultStride(rig, s);
  const S = stride / (METERS_PER_PX * s); // step length in card px: stance foot travel per half cycle
  const L = rig.leg[0] + rig.leg[1];
  const lift = (o.lift ?? 34) * k, bobA = (o.bob ?? 6) * k, swayA = (o.sway ?? 9) * k, armA = (o.armSwing ?? 46) * k;
  const ph = dist / (2 * stride); // full cycle = 2 steps
  const cyc = ((ph % 1) + 1) % 1;
  const foot = (c: number): T3 => {
    // c in [0,1): 0..0.5 stance (foot slides back relative to the body at body speed), 0.5..1 swing (foot arcs forward)
    if (c < 0.5) return [dir * lerp(S / 2, -S / 2, c / 0.5) * k, 0, 0];
    const u = (c - 0.5) / 0.5, e = easeInOutSine(u);
    return [dir * lerp(-S / 2, S / 2, e) * k, -Math.sin(Math.PI * u) * lift, -dir * 0.3 * Math.sin(Math.PI * u) * k];
  };
  const fa = foot(cyc), fb = foot((cyc + 0.5) % 1);
  const dx = swayA * Math.sin(TAU * ph);
  // Hip height from the GEOMETRY: each planted foot must stay within 0.97 x the leg length of its hip, otherwise the IK would clamp and the
  // foot would slide. The hip therefore drops at contact (feet far apart) and rises at passing. An extra bob follows the classic 4 key poses
  // (lowest 1/8 cycle after contact = 'down', highest at 3/8 = 'up'), added downward only so it never breaks the reach limit.
  const vAvail = (fx: number, hx: number) => Math.sqrt(Math.max(1, (0.97 * L) ** 2 - (fx - hx) ** 2));
  const gA = fa[1] === 0 ? rig.ground - rig.hipY - vAvail(rig.stanceX[0] + fa[0], rig.hipX[0] + dx) : 0;
  const gB = fb[1] === 0 ? rig.ground - rig.hipY - vAvail(rig.stanceX[1] + fb[0], rig.hipX[1] + dx) : 0;
  const dy = Math.max(0, gA, gB) * k + (bobA * (1 + Math.cos(4 * Math.PI * (ph - 0.125)))) / 2;
  const lean = dir * 0.035 * k + 0.02 * Math.sin(TAU * ph);
  const sw = armA * Math.sin(TAU * ph); // opposite arm / leg: left arm swings with the right leg
  const feet: [T3, T3] = [[rig.stanceX[0] + fa[0], rig.ground + fa[1], fa[2]], [rig.stanceX[1] + fb[0], rig.ground + fb[1], fb[2]]];
  const [h0, h1] = rig.handRest;
  const hands: [V2, V2] = [[h0[0] + dir * sw, h0[1] - Math.max(0, dir * sw) * 0.35], [h1[0] - dir * sw, h1[1] - Math.max(0, -dir * sw) * 0.35]];
  return {feet, hands, body: {dx, dy, lean}, face: dir, headRoll: -1.2 * Math.sin(TAU * ph) * k};
}
type T3 = [number, number, number];

/** Standing feet, identical to the original static pose (pass as `feet` when a shot mixes standing and walking, so nothing pops). */
export const STAND_FEET: [T3, T3] = [[262, 942, 0], [338, 942, 0]];
export const standFeet = (rig: Rig): [T3, T3] => [[rig.stanceX[0], rig.ground, 0], [rig.stanceX[1], rig.ground, 0]];

/** Standing idle: weight shift, tiny sway and breathing so a standing character is never frozen. */
export function idle(t: number, seed = 0): Pick<ManPose, 'body' | 'headRoll'> {
  const a = t * 0.9 + seed * 3.1;
  return {body: {dx: 3 * Math.sin(a), dy: 2 * Math.sin(a * 2), lean: 0.012 * Math.sin(a * 0.7)}, headRoll: 1.2 * Math.sin(a * 0.6 + 1)};
}

// ---------------------------------------------------------------------------------------------------------------
// PHONE. Forearm raised, ball hand at the phone's lower edge, wrist tilt, small idle sway, head dipped toward the screen.
export function holdPhone(t: number, side: 0 | 1 = 1, k = 1, seed = 0, rig: Rig = RIG_HOODIE): Pick<ManPose, 'hands' | 'phone' | 'nod' | 'grip'> {
  const sg = side === 1 ? 1 : -1;
  const sx = Math.sin(t * 1.6 + seed) * 3 * k, sy = Math.sin(t * 2.1 + seed * 2) * 2.5 * k;
  const rest: V2 = rig.handRest[side === 1 ? 1 : 0];
  const sh = rig.shoulders[side === 1 ? 1 : 0];
  const up: V2 = [sh[0] + sg * 2 + sx, sh[1] + 132 + sy]; // forearm raised in front of the chest (132 px below the shoulder)
  const h: V2 = [lerp(rest[0], up[0], k), lerp(rest[1], up[1], k)];
  const hands: [V2 | null, V2 | null] = side === 1 ? [null, h] : [h, null];
  return {hands, phone: k > 0.02 ? {hand: side, tilt: sg * (10 + 4 * Math.sin(t * 0.9 + seed)) * k} : undefined, nod: 12 * k, grip: side === 1 ? [0, k] : [k, 0]};
}

// ---------------------------------------------------------------------------------------------------------------
// PICK / CARRY / PLACE. A hand path through anticipation, reach, grip, lift, carry (object follows with natural lag), lower, release,
// retreat. The object NEVER teleports: it is blended onto the hand at grip and off the hand at release.
// Everything is in WORLD space; use cardSpace().toCard to aim the arm. Waypoints may be functions of time (a moving carry anchor).
type P3 = V3 | ((t: number) => V3);
const at = (p: P3, t: number): V3 => (typeof p === 'function' ? p(t) : p);
export interface PickPlace {
  start: number; // seconds when the anticipation begins
  rest: P3; // free hand position (follows the body while walking)
  from: P3; // object grip point at the pickup (shelf item)
  to: P3; // object grip point at the target (counter, bag, cart)
  carry?: P3; // where the hand carries it in between (default: 0.25 m in front of `rest`)
  weight?: number; // 0 light .. 1 heavy: heavier objects drag further behind the hand (lag 0.05..0.14 s) and get a bigger anticipation dip
  lag?: number; // overrides the weight-based lag (seconds)
  dur?: Partial<Record<'anticipate' | 'reach' | 'grip' | 'lift' | 'carry' | 'lower' | 'release' | 'retreat', number>>;
  up?: number; // pre-grasp / pre-place clearance in metres (default 0.12)
}
export interface PickPlaceState {
  hand: V3; // world position of the hand
  grip: number; // 0..1 squeeze
  obj: V3; // world position of the object grip point
  holding: boolean;
  phase: 'idle' | 'anticipate' | 'reach' | 'grip' | 'lift' | 'carry' | 'lower' | 'release' | 'retreat' | 'done';
  lean: number; // 0..1 extra torso lean into the reach, add to body.lean
  dip: number; // 0..1 slight lowering of the body before the lift (anticipation): body.dy += dip * 12 * (0.5 + weight)
}
export function pickPlace(spec: PickPlace): (t: number) => PickPlaceState {
  const D = {anticipate: 0.25, reach: 0.6, grip: 0.18, lift: 0.45, carry: 0.7, lower: 0.5, release: 0.18, retreat: 0.5, ...spec.dur};
  for (const [k, v] of Object.entries(D)) {
    const m = (MIN_SEC as Record<string, number>)[k === 'carry' ? 'carryStep' : k === 'lower' ? 'place' : k];
    if (m !== undefined && v < m) throw new Error(`[motion] ${k} duration ${v}s is below the minimum ${m}s (no snappy timing)`);
  }
  const wt = spec.weight ?? 0.3;
  const up = spec.up ?? 0.12, lag = spec.lag ?? 0.05 + 0.09 * wt;
  const order = ['anticipate', 'reach', 'grip', 'lift', 'carry', 'lower', 'release', 'retreat'] as const;
  const t0: Record<string, number> = {};
  let acc = spec.start;
  for (const k of order) { t0[k] = acc; acc += D[k]; }
  const tEnd = acc;
  const above = (p: V3): V3 => [p[0], p[1] + up, p[2]];
  const carryP: P3 = spec.carry ?? ((t: number) => { const r = at(spec.rest, t); return [r[0], r[1] + 0.05, r[2] + 0.25]; });
  const mix = (a: V3, b: V3, e: number): V3 => [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e)];
  const handAt = (t: number): V3 => {
    const rest = (tt: number) => at(spec.rest, tt);
    const A = at(spec.from, t), B = at(spec.to, t);
    if (t <= t0.anticipate) return rest(t);
    if (t < t0.reach) { // anticipation: hand drifts back and slightly down away from the target, then the reach starts from there
      const u = easeInOutSine((t - t0.anticipate) / D.anticipate), r = rest(t);
      return [r[0], r[1] - 0.025 * u, r[2] - 0.03 * u];
    }
    if (t < t0.grip) { // reach: ease to the pre-grasp point above the item, then settle on it (overlap: the hand arrives slightly late)
      const u = (t - t0.reach) / D.reach, r = rest(t0.reach);
      const start: V3 = [r[0], r[1] - 0.025, r[2] - 0.03];
      return u < 0.75 ? mix(start, above(A), easeInOut(u / 0.75)) : mix(above(A), A, easeInOutSine((u - 0.75) / 0.25));
    }
    if (t < t0.lift) return A; // grip: hand holds on the item
    if (t < t0.carry) return mix(A, above(A), easeInOut((t - t0.lift) / D.lift)); // lift
    if (t < t0.lower) { // carry: from above the pickup, over to the carry anchor, then to above the target
      const u = (t - t0.carry) / D.carry, c = at(carryP, t);
      return u < 0.5 ? mix(above(A), c, easeInOut(u / 0.5)) : mix(c, above(B), easeInOut((u - 0.5) / 0.5));
    }
    if (t < t0.release) return mix(above(B), B, easeInOutSine((t - t0.lower) / D.lower)); // lower into place
    if (t < t0.retreat) return B; // release: hand stays while the fingers open
    const u = (t - t0.retreat) / D.retreat; // retreat: lift off first, then return to rest (overlap with the settling object)
    return mix(B, rest(t), easeInOut(u));
  };
  return (t) => {
    const hand = handAt(t);
    const A = at(spec.from, t), B = at(spec.to, t);
    let phase: PickPlaceState['phase'] = 'idle';
    for (const k of order) if (t >= t0[k]) phase = k;
    if (t >= tEnd) phase = 'done';
    const gripK = t < t0.grip ? 0 : t < t0.release ? clamp01((t - t0.grip) / D.grip) : 1 - clamp01((t - t0.release) / D.release);
    let obj: V3;
    const lagged = handAt(t - lag);
    if (t < t0.grip) obj = A;
    else if (t < t0.grip + D.grip) obj = mix(A, hand, easeInOutSine((t - t0.grip) / D.grip)); // attach: blend onto the hand
    else if (t < t0.release) obj = lagged;
    else if (t < t0.release + D.release + 0.1) obj = mix(lagged, B, easeOut((t - t0.release) / (D.release + 0.1))); // detach: settle at the target
    else obj = B;
    // tiny settle bounce after placing (object gets weight)
    if (t >= t0.release && t < t0.release + 0.3) obj = [obj[0], obj[1] + 0.012 * Math.sin(((t - t0.release) / 0.3) * Math.PI) * (1 - (t - t0.release) / 0.3), obj[2]];
    const lean = phase === 'reach' ? easeInOut((t - t0.reach) / D.reach) : phase === 'grip' ? 1 : phase === 'lift' ? 1 - easeInOut((t - t0.lift) / D.lift) : 0;
    // anticipation dip: body lowers slightly into the grip, recovers during the lift (references: lower the body before a lift)
    const dip = t < t0.grip ? 0 : t < t0.lift ? easeInOutSine((t - t0.grip) / D.grip) : t < t0.carry ? 1 - easeInOut((t - t0.lift) / D.lift) : 0;
    return {hand, grip: gripK, obj, holding: t >= t0.grip && t < t0.release + 0.05, phase, lean, dip};
  };
}
/** Convert a world hand target to the card hand slot. `side` 0 = left arm slot, 1 = right arm slot. Pass the result in `hands`. */
export const handSlot = (cs: CardSpace, w: V3, side: 0 | 1): ManPose['hands'] => (side === 0 ? [cs.toCard(w), null] : [null, cs.toCard(w)]);

// ---------------------------------------------------------------------------------------------------------------
// Mouth flap synced to speech. `series` = per-frame voice energy (0..1) measured once (e.g. visualizeAudio low bins). Smoothing over
// +-1 frame removes jitter, a noise gate closes the mouth in pauses, and the mouth LEADS the audio by `lead` frames (default 1).
export function flapFromSeries(series: number[], frame: number, lead = 1): number {
  const g = (i: number) => series[Math.min(series.length - 1, Math.max(0, i))] ?? 0;
  const f = frame + lead;
  const e = 0.25 * g(f - 1) + 0.5 * g(f) + 0.25 * g(f + 1);
  const gated = e < 0.05 ? 0 : (e - 0.05) / 0.95;
  return Math.round(clamp01(Math.sqrt(gated) * 1.15) * 12) / 12; // 12 mouth steps, no flicker
}

// ---------------------------------------------------------------------------------------------------------------
// SIT (v8). Reusable for every character that uses a rig (Sun, Universe, white extras: RIG_GLOW; hoodie man: RIG_HOODIE, untested there).
// The card is a frontal 2D plane, so the thighs go forward over the cushion toward the viewer: they are foreshortened to a short stub, the knee
// sits a little below the hip and slightly outward (one smooth arc, same minimum bend radius as every limb), the lower leg goes straight down
// and the foot is planted on the FLOOR in front of the cushion (the card plane stands in front of the seat, see seatCardDz in the airplane scenes).
// Hips sit on the cushion top. Estimates, untested numbers: knee stub (26, 18 px), hands rest on the thighs 42 px above the hips.
export interface SitOpts {
  rig?: Rig;
  seatTop: number; // cushion top above the floor, metres
  scale?: number; // card scale s (default 0.84)
  k?: number; // 0..1 blend from standing to sitting (ease it over >= 0.5 s when sitting down)
  handsOnLap?: boolean; // default true
  seed?: number;
  t?: number; // seconds (breathing)
}
export function sit(o: SitOpts): Pick<ManPose, 'feet' | 'knees' | 'body' | 'hands'> {
  const R = o.rig ?? RIG_GLOW, M = METERS_PER_PX * (o.scale ?? 0.84), k = o.k ?? 1, t = o.t ?? 0, sd = o.seed ?? 0;
  const hipY = SOLE_Y - o.seatTop / M - 8; // hip joint on the cushion
  const dy = (hipY - R.hipY) * k;
  const ank = R.ground;
  const shin = R.leg[1];
  if (ank - hipY < 45 || ank - hipY > R.leg[0] + shin) throw new Error(`[sit] seat height ${o.seatTop} m does not fit this rig (hip to ankle ${ank - hipY} px)`);
  const kneeY = Math.max(hipY + 18, ank - shin * 0.97);
  const feet: [[number, number, number], [number, number, number]] = [[R.stanceX[0] - 4, ank, 0], [R.stanceX[1] + 4, ank, 0]];
  const hx: [number, number] = [R.hipX[0], R.hipX[1]];
  const knees: [V2, V2] = [[hx[0] - 40, kneeY], [hx[1] + 40, kneeY]];
  const breathe = Math.sin(t * 1.6 + sd) * 1.2;
  const hands: [V2 | null, V2 | null] | undefined = o.handsOnLap === false ? undefined : [[hx[0] - 48, hipY - 42 + breathe], [hx[1] + 48, hipY - 42 - breathe]];
  const out: Pick<ManPose, 'feet' | 'knees' | 'body' | 'hands'> = {feet, knees: [[lerp(R.hipX[0] + 0, knees[0][0], k), lerp(R.hipY + 130, knees[0][1], k)], [lerp(R.hipX[1], knees[1][0], k), lerp(R.hipY + 130, knees[1][1], k)]], body: {dx: 0, dy, lean: 0}};
  if (hands && k > 0.6) out.hands = hands;
  return out;
}

export {RIG_GLOW, RIG_HOODIE};
