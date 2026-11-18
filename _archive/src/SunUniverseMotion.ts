// Pure motion for SunUniverseTest (no GPU, no JSX). Rules: STYLE_NOTES.md "ANIMATION v5" and "CASTING RULES".
// Timing numbers are estimates (see STYLE_NOTES, untested): cadence 1.25 cycles/s, decel 0.2-0.75 s, settle 0.45 s.
import {ManPose, EXPR} from './kit/hoodieMan';
import {Pose, V3, lerp} from './kit/kit';
import {METERS_PER_PX} from './guard';
import {RIG_GLOW, cardSpace, defaultStride, easeInOut, idle, pickPlace, standFeet, walk} from './kit/motion';
import {listener} from './kit/reactions';
import {Target, eased, frameTargets} from './kit/camera';

type V2 = [number, number];
type T3 = [number, number, number];
export const FPS = 30;
export const FRAMES = 90; // exactly 3.0 s
export const HOLD_T = 2.4; // all motion time is clamped here: both characters hold still until the end
export const S = 0.84; // card scale
export const M = METERS_PER_PX * S; // metres per card px
export const CZ = 0.3; // card plane z (characters stand 0.3 m in front of the island)
export const UNI_X = -0.38;
export const SUN_X = 0.35; // where Sun stops
export const DIR = -1 as const; // Sun walks toward -x (screen left)
export const COUNTER_Y = 0.78;
export const CUP_Z = -0.18; // cup sits on the island top
export const CUP_X = 0.105; // cup centre
export const HANDLE_DX = 0.066; // handle grip point, +x of the cup centre (toward Sun)
export const CUP_Y = COUNTER_Y + 0.045;

// ------------------------------------------------------------------ camera: one slow push-in
const TARGETS: Target[] = [
  {p: [UNI_X, 0.8, CZ], half: [0.27, 0.9, 0.1], name: 'Universe'},
  {p: [SUN_X - 0.1, 0.8, CZ], half: [0.37, 0.9, 0.1], name: 'Sun'},
];
const END = frameTargets(TARGETS, {fov: 50, yaw: 0, pitch: 2, margin: 0.04});
const START: Pose = {...END, p: [END.l[0] + (END.p[0] - END.l[0]) * 1.07, END.l[1] + (END.p[1] - END.l[1]) * 1.07, END.l[2] + (END.p[2] - END.l[2]) * 1.07]};
export const CAM = eased(START, END);
export const CAM_TARGETS = TARGETS;

// ------------------------------------------------------------------ Sun walk (phase from distance, constant stride, only the cadence slows)
const STRIDE = defaultStride(RIG_GLOW, S);
const C0 = 1.25, TA = 0.2, TS = 0.75; // cycles per second, decel start, stop (passing pose)
const PHI_END = TA + (TS - TA) / 2;
const PH0 = (((0.25 - C0 * PHI_END) % 1) + 1) % 1; // phase at t=0 so the walk ends at cycle 0.25 (passing pose)
const F = (u: number) => u - (u ** 6 - 3 * u ** 5 + 2.5 * u ** 4); // integral of 1 - smootherstep
const phi = (t: number) => (t <= TA ? t : t >= TS ? PHI_END : TA + (TS - TA) * F((t - TA) / (TS - TA)));
export const sunPhase = (t: number) => PH0 + C0 * phi(t);
const travel = (t: number) => 2 * STRIDE * C0 * phi(t); // metres since t=0 (same quantity that drives the phase)
export const sunX = (t: number) => SUN_X - DIR * (travel(TS) - travel(t));
const walkAt = (t: number) => walk(2 * STRIDE * sunPhase(t), {rig: RIG_GLOW, dir: DIR, scale: S, intensity: 1});
const WALK_END = walkAt(TS);

const l2 = (a: V2, b: V2, k: number): V2 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const l3 = (a: T3, b: T3, k: number): T3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

// Re-project a point on the real cup depth onto the card plane along the camera ray (and back), so hand and cup meet on screen.
const toPlane = (R: V3, C: V3): V3 => {
  const k = (CZ - C[2]) / (R[2] - C[2]);
  return [C[0] + (R[0] - C[0]) * k, C[1] + (R[1] - C[1]) * k, CZ];
};
const fromPlane = (P: V3, C: V3): V3 => {
  const k = (CUP_Z - C[2]) / (CZ - C[2]);
  return [C[0] + (P[0] - C[0]) * k, C[1] + (P[1] - C[1]) * k, CUP_Z];
};
const camAt = (t: number) => CAM(Math.min(t, HOLD_T) / (FRAMES / FPS), t).p;
const HANDLE: V3 = [CUP_X + HANDLE_DX, CUP_Y, CUP_Z];
const CS = cardSpace([SUN_X, 0, CZ], S, 0);
const REST_W = CS.toWorld(RIG_GLOW.handRest[1], 0); // Sun looks card-left, so slot 1 (card-right arm) is the FRONT arm and does the pick-up
const PP = pickPlace({
  start: 1.0,
  rest: REST_W,
  from: (t) => toPlane(HANDLE, camAt(t)),
  to: (t) => toPlane(HANDLE, camAt(t)),
  up: 0.14,
  weight: 0.2,
  dur: {anticipate: 0.25, reach: 0.55, grip: 0.15, lift: 0.45}, // ends the lift exactly at 2.4 s; later phases are never reached
});

export interface SunState {pose: ManPose; x: number; cup: V3}
export function sunMotion(tIn: number): SunState {
  const t = Math.min(tIn, HOLD_T);
  const x = sunX(t);
  const id = idle(t, 0);
  const restBack: V2 = [RIG_GLOW.handRest[0][0] + Math.sin(t * 1.3) * 2, RIG_GLOW.handRest[0][1] + Math.sin(t * 1.7) * 1.5];
  let feet: [T3, T3], hands: [V2 | null, V2 | null], body: {dx: number; dy: number; lean: number}, headRoll: number;
  let nod = 0;
  const pp = PP(t);
  if (t < TS) {
    const w = walkAt(t);
    feet = w.feet!; hands = w.hands as [V2, V2]; body = w.body as typeof body; headRoll = w.headRoll!;
  } else {
    const sE = easeInOut((t - TS) / 0.45); // lifted foot lowers beside the planted one, body settles to the idle
    const sH = easeInOut((t - TS) / (1.0 - TS));
    const w = WALK_END, stand = standFeet(RIG_GLOW);
    feet = [l3(w.feet![0], stand[0], sE), l3(w.feet![1], stand[1], sE)];
    const wb = w.body as typeof body, ib = id.body as typeof body;
    body = {dx: lerp(wb.dx, ib.dx, sE), dy: lerp(wb.dy, ib.dy, sE), lean: lerp(wb.lean, ib.lean, sE)};
    headRoll = lerp(w.headRoll!, id.headRoll!, sE);
    const wh = w.hands as [V2, V2];
    const front: V2 = t < 1.0 ? l2(wh[1], RIG_GLOW.handRest[1], sH) : CS.toCard(PP(t).hand);
    hands = [l2(wh[0], restBack, sH), front];
    body = {...body, dy: body.dy + pp.dip * 12 * 0.7, lean: body.lean + DIR * 0.07 * pp.lean};
    nod = 8 * pp.lean; // head dips toward the cup while reaching
  }
  const o = fromPlane(pp.obj, camAt(t)); // the cup sits at its real spot before the grip, rides the hand after it
  const cup: V3 = [o[0] - HANDLE_DX, o[1], o[2]];
  const pose: ManPose = {t, expr: EXPR.neutral, turn: -0.9, feet, hands, body, face: DIR, headRoll, nod, grip: [0, pp.grip], blinkPhase: 0.6};
  return {pose, x, cup};
}

// ------------------------------------------------------------------ Universe: listener
export function universePose(tIn: number): ManPose {
  const t = Math.min(tIn, HOLD_T);
  const l = listener(t, {speaker: [SUN_X, 0, CZ], self: [UNI_X, 0, CZ], from: 0.15, to: 3.0, nods: [1.85], smileAt: 0.9, index: 1});
  const id = idle(t, 1);
  return {t, expr: l.expr!, turn: (l.turn ?? 0) * 0.85, nod: l.nod, headRoll: (l.headRoll ?? 0) + (id.headRoll ?? 0), body: id.body, blinkPhase: 3.1}; // blinks once, at 1.5 s
}
