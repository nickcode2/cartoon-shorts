// Narration-driven camera: CENTER FRAME rule (STYLE_NOTES "CENTER FRAME") + reusable professional moves.
// All moves are eased (smootherstep by default). Build the CamFn once per shot (outside render), never per frame.
import {CamFn, Pose, V3, clamp01, lerp, lerp3} from './kit';

// ---------------------------------------------------------------------------------------------------------
// CENTER FRAME constants. Tweak here; the ?safe=1 overlay (finish.tsx) reads the same object.
/** Central box, fractions of the 1080x1920 frame (y from the top). The focal point of every beat sits inside it; a head must fit completely inside it. */
export const CENTER_BOX = {x0: 0.15, x1: 0.85, y0: 0.12, y1: 0.85};
/** Wide shots: a full-body character should be this fraction of the frame height (more medium shots too, see V2_LIMITS.minMediumShare). Informational: use `bodyHeightFrac` to measure. */
export const WIDE_BODY_FRAC: [number, number] = [0.3, 0.45];
/** How far past the box edge the focal point may drift, as a fraction of the box half size (0 = strictly inside). */
export const FOCAL_TOL = 0;
/** A head circle must stay at least this far from every frame edge, fraction of the frame (so a head never touches or crosses the edge). */
export const HEAD_EDGE_MARGIN = 0.03;
/** Group framing (`frameTargets` without a focal): the group's bounding box may use at most this fraction of the frame width/height, centred on the box. */
export const GROUP_FIT = 0.9;
const BOX_CX = (CENTER_BOX.x0 + CENTER_BOX.x1) / 2, BOX_CY = (CENTER_BOX.y0 + CENTER_BOX.y1) / 2; // frame fractions, y from the top

export const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
};
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeIn = (x: number) => Math.pow(clamp01(x), 3);
type Ease = (x: number) => number;

// ---------------------------------------------------------------------------------------------------------
// Framing: computed, not eyeballed. A focal point goes into the central box (`frameFocal`); a group is centred and fitted (`frameTargets`).
export interface Target {
  p: V3; // world centre (for a person: chest/face centre, not the feet)
  r?: number; // world half-extent as a sphere radius; use the full figure/prop size (person ~0.9, ambulance ~2.5)
  half?: V3; // alternative to r: half extents [x, y, z] of its box
  name?: string; // what the narration calls it
}
export interface FrameOpts {
  fov?: number; // vertical fov, degrees (default 50)
  yaw?: number; // degrees, direction the camera looks FROM: 0 = from +z looking toward -z, +90 = from +x
  pitch?: number; // degrees, positive = camera above looking down
  margin?: number; // group framing only: extra empty space around the group, fraction (default 0.12)
  roll?: number;
  minDist?: number;
}
const rad = (d: number) => (d * Math.PI) / 180;
const half = (t: Target): V3 => t.half ?? [t.r ?? 0.5, t.r ?? 0.5, t.r ?? 0.5];

/**
 * GROUP framing: centres ALL targets as one group on the central box and fits their bounding box into GROUP_FIT of the frame (with `margin`).
 * Use it for two characters side by side (nobody gets cropped in half) and for wide shots. With `focal` it delegates to `frameFocal`
 * (the focal point is framed, the targets may be cropped).
 */
export function frameTargets(targets: Target[], o: FrameOpts & {focal?: Focal; span?: number} = {}): Pose {
  if (o.focal) return frameFocal(o.focal, o);
  const fov = o.fov ?? 50, margin = o.margin ?? 0.12;
  const yaw = rad(o.yaw ?? 0), pitch = rad(o.pitch ?? 8);
  // view direction (from camera to look point) and camera basis
  const dir: V3 = [-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  const right: V3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up: V3 = [0, 0, 0]; // up = right x dir
  up[0] = right[1] * dir[2] - right[2] * dir[1];
  up[1] = right[2] * dir[0] - right[0] * dir[2];
  up[2] = right[0] * dir[1] - right[1] * dir[0];
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const ext = (axis: V3, t: Target) => {
    const h = half(t);
    return Math.abs(axis[0]) * h[0] + Math.abs(axis[1]) * h[1] + Math.abs(axis[2]) * h[2];
  };
  let rMin = Infinity, rMax = -Infinity, uMin = Infinity, uMax = -Infinity, dMax = 0;
  for (const t of targets) {
    const pr = dot(t.p, right), pu = dot(t.p, up), er = ext(right, t), eu = ext(up, t);
    rMin = Math.min(rMin, pr - er); rMax = Math.max(rMax, pr + er);
    uMin = Math.min(uMin, pu - eu); uMax = Math.max(uMax, pu + eu);
    dMax = Math.max(dMax, ext(dir, t));
  }
  const cr = (rMin + rMax) / 2, cu = (uMin + uMax) / 2;
  const wHalf = (rMax - rMin) / 2, hHalf = (uMax - uMin) / 2;
  const tv = Math.tan(rad(fov) / 2), th = tv * (1080 / 1920);
  // usable fraction of the frame, centred on the box centre (never more than fits on both sides of that centre)
  const sw = Math.min(GROUP_FIT * (1 - margin), 2 * Math.min(BOX_CX, 1 - BOX_CX)), sh = Math.min(GROUP_FIT * (1 - margin), 2 * Math.min(BOX_CY, 1 - BOX_CY));
  // visible half-width at distance d = d*th; the subject half-width must fit sw/2 of the frame width (frame half = 0.5)
  const dW = wHalf / (th * sw), dH = hHalf / (tv * sh);
  const dist = Math.max(dW, dH, o.minDist ?? 0) + dMax; // + depth of the nearest face
  // look point is shifted so the group centre lands on the centre of the central box
  const scx = BOX_CX - 0.5, scy = 0.5 - BOX_CY; // frame fractions, +x right, +y up
  const shiftR = scx * 2 * dist * th, shiftU = scy * 2 * dist * tv;
  const look: V3 = [0, 0, 0];
  // look point sits at the targets' mean depth
  let md = 0;
  for (const t of targets) md += dot(t.p, dir);
  md /= targets.length;
  for (let i = 0; i < 3; i++) look[i] = right[i] * (cr - shiftR) + up[i] * (cu - shiftU) + dir[i] * md;
  const p: V3 = [look[0] - dir[0] * dist, look[1] - dir[1] * dist, look[2] - dir[2] * dist];
  return {p, l: look, fov, roll: o.roll};
}

/** Project a world point to screen px (1080x1920) with a Pose. For tests and the debug overlay, not per frame. */
export function toScreen(pose: Pose, w: V3): {x: number; y: number; depth: number} {
  const fov = pose.fov ?? 60, tv = Math.tan(rad(fov) / 2), th = tv * (1080 / 1920);
  let f: V3 = [pose.l[0] - pose.p[0], pose.l[1] - pose.p[1], pose.l[2] - pose.p[2]];
  const fl = Math.hypot(...f);
  f = [f[0] / fl, f[1] / fl, f[2] / fl];
  let r: V3 = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; // f x worldUp(0,1,0)
  const rl = Math.hypot(...r) || 1;
  r = [r[0] / rl, r[1] / rl, r[2] / rl];
  const u: V3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const d: V3 = [w[0] - pose.p[0], w[1] - pose.p[1], w[2] - pose.p[2]];
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  const x = (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / (z * th);
  const y = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (z * tv);
  return {x: (x * 0.5 + 0.5) * 1080, y: (0.5 - y * 0.5) * 1920, depth: z};
}

/** GROUP check: every target box corner is inside the frame (nobody in a group is cropped by accident). Only for group shots made with `frameTargets`;
 *  a focal shot may crop everything except its focal point and head. */
export function targetsInFrame(pose: Pose, targets: Target[]): boolean {
  for (const t of targets) {
    const h = half(t);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const s = toScreen(pose, [t.p[0] + sx * h[0], t.p[1] + sy * h[1], t.p[2] + sz * h[2]]);
      if (s.depth <= 0.05 || s.x < 0 || s.x > 1080 || s.y < 0 || s.y > 1920) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------
// CENTER FRAME rule: the FOCAL POINT of a beat (what the narration talks about: a face, a window, a cup, the crack) sits inside CENTER_BOX.
// A speaking/reacting character's whole head fits inside the box (unless an extreme close-up on a face part). Everything else may be cropped.
export interface Focal {
  p: V3; // world point the viewer must look at
  r?: number; // metres around it that should stay readable (default 0.4); sets the zoom together with `span`
  name?: string;
  head?: boolean; // the focal point is a character's head, r = head radius: the whole head circle must fit inside CENTER_BOX
  crop?: boolean; // extreme close-up on a face part (the eye): the head may be cropped on purpose, only the focal point is checked
}
/** A character head (speaking or reacting) that must be completely inside CENTER_BOX. p = head centre, r = head radius in metres. */
export interface Head {
  p: V3;
  r: number;
  name?: string;
}
/** Pose that centres the focal point on the centre of CENTER_BOX. `span` = fraction of the box height that the focal radius circle (diameter 2 r)
 *  covers (default 0.5). Free zoom: a small r and a high span is a tight close-up, the rest of the object is simply cropped. */
export function frameFocal(focal: Focal, o: FrameOpts & {span?: number} = {}): Pose {
  const fov = o.fov ?? 50, yaw = rad(o.yaw ?? 0), pitch = rad(o.pitch ?? 8), r = focal.r ?? 0.4, span = o.span ?? 0.5;
  const dir: V3 = [-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  const right: V3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up: V3 = [right[1] * dir[2] - right[2] * dir[1], right[2] * dir[0] - right[0] * dir[2], right[0] * dir[1] - right[1] * dir[0]];
  const tv = Math.tan(rad(fov) / 2), th = tv * (1080 / 1920);
  const sh = CENTER_BOX.y1 - CENTER_BOX.y0, sw = CENTER_BOX.x1 - CENTER_BOX.x0;
  const dist = Math.max(r / (tv * sh * span), r / (th * sw * Math.min(1, span * 1.6)), o.minDist ?? 0.12);
  const scx = BOX_CX - 0.5, scy = 0.5 - BOX_CY;
  const shiftR = scx * 2 * dist * th, shiftU = scy * 2 * dist * tv;
  // look point = focal point moved so that the focal point lands on the centre of the box
  const look: V3 = [focal.p[0] - right[0] * shiftR - up[0] * shiftU, focal.p[1] - right[1] * shiftR - up[1] * shiftU, focal.p[2] - right[2] * shiftR - up[2] * shiftU];
  return {p: [look[0] - dir[0] * dist, look[1] - dir[1] * dist, look[2] - dir[2] * dist], l: look, fov, roll: o.roll};
}
/** Is the focal point inside CENTER_BOX (plus FOCAL_TOL)? Only the point is tested, not the object around it. */
export function focalInBox(pose: Pose, focal: Focal | V3, tol = FOCAL_TOL): boolean {
  const p = Array.isArray(focal) ? focal : focal.p;
  const s = toScreen(pose, p);
  if (s.depth <= 0.05) return false;
  const hw = ((CENTER_BOX.x1 - CENTER_BOX.x0) / 2) * (1 + tol) * 1080, hh = ((CENTER_BOX.y1 - CENTER_BOX.y0) / 2) * (1 + tol) * 1920;
  return Math.abs(s.x - BOX_CX * 1080) <= hw && Math.abs(s.y - BOX_CY * 1920) <= hh;
}
/** Old name, same check (kept so existing shots keep compiling). */
export const focalInSafe = focalInBox;
/** Is the WHOLE head (circle of radius r around p) inside CENTER_BOX and at least HEAD_EDGE_MARGIN away from every frame edge? */
export function headInBox(pose: Pose, head: Head): boolean {
  const s = toScreen(pose, head.p);
  if (s.depth <= 0.05) return false;
  const th = Math.tan(rad(pose.fov ?? 60) / 2) * (1080 / 1920), rpx = (head.r / (s.depth * th)) * 540; // screen radius in px
  const bx0 = CENTER_BOX.x0 * 1080, bx1 = CENTER_BOX.x1 * 1080, by0 = CENTER_BOX.y0 * 1920, by1 = CENTER_BOX.y1 * 1920;
  const ex = HEAD_EDGE_MARGIN * 1080, ey = HEAD_EDGE_MARGIN * 1920;
  return s.x - rpx >= bx0 && s.x + rpx <= bx1 && s.y - rpx >= by0 && s.y + rpx <= by1 && s.x - rpx >= ex && s.x + rpx <= 1080 - ex && s.y - rpx >= ey && s.y + rpx <= 1920 - ey;
}

// ---------------------------------------------------------------------------------------------------------
// Narration -> target plan. One row per sentence. checkPlan throws on a missing target / reason, so a shot list cannot skip it.
export type ShotType = 'wide' | 'medium' | 'close' | 'insert';
export type MoveKind = 'travel' | 'orbit' | 'follow' | 'push' | 'pull';
export interface PlanRow {
  line: string; // the narration sentence
  from: number; // frame the sentence starts (measure on the trimmed voice file)
  to: number;
  target: string; // what is being talked about (must also be what the camera frames)
  targets: Target[]; // geometry of that target(s), used by frameTargets / targetsInSafe
  focal: Focal; // REQUIRED: the focal point of this beat (it must stay inside CENTER_BOX; the rest may be cropped)
  heads?: Head[]; // speaking/reacting characters in the beat whose WHOLE head must fit inside CENTER_BOX (omit only for an extreme close-up)
  shot: ShotType; // wide / medium / close / insert (insert = tight close-up of a small handheld prop)
  moveKind: MoveKind; // travel (continuous path to a new target), orbit, follow (tracks a moving character), push, pull
  move: 'truck' | 'push-in' | 'pull-out' | 'diagonal' | 'parallax' | 'orbit' | 'hold-drift' | 'travel' | 'follow'; // helper used
  angle: string; // camera angle for this beat: front, side, behind, over-the-shoulder, high, low, orbit (rule: vary it from beat to beat)
  why: string; // reason for the move
}
const SMALL_PROP_SHOTS: ShotType[] = ['close', 'insert'];
export function checkPlan(rows: PlanRow[]): PlanRow[] {
  const shots: ShotType[] = ['wide', 'medium', 'close', 'insert'];
  const kinds: MoveKind[] = ['travel', 'orbit', 'follow', 'push', 'pull'];
  rows.forEach((r, i) => {
    if (!r.target.trim() || r.targets.length === 0) throw new Error(`[plan] sentence has no target: "${r.line}"`);
    if (!r.focal || !r.focal.p || r.focal.p.length !== 3 || r.focal.p.some((x) => !Number.isFinite(x))) throw new Error(`[plan] row has no focal point: "${r.line}"`);
    if (r.focal.r !== undefined && !(r.focal.r > 0)) throw new Error(`[plan] focal radius must be positive: "${r.line}"`);
    for (const h of r.heads ?? []) if (!(h.r > 0) || h.p.length !== 3) throw new Error(`[plan] invalid head (needs p and r > 0): "${r.line}"`);
    if (!r.why.trim()) throw new Error(`[plan] move has no reason: "${r.line}"`);
    if (!shots.includes(r.shot)) throw new Error(`[plan] missing/invalid shot type (wide|medium|close|insert): "${r.line}"`);
    if (!kinds.includes(r.moveKind)) throw new Error(`[plan] missing/invalid move kind (travel|orbit|follow|push|pull): "${r.line}"`);
    if (!r.angle || !r.angle.trim()) throw new Error(`[plan] missing camera angle: "${r.line}"`);
    // Rule 1: a close-up/insert is reached by a continuous move, never a cut. Only the first row of a video may start on one.
    if (SMALL_PROP_SHOTS.includes(r.shot) && i > 0 && r.moveKind !== 'travel' && r.moveKind !== 'push' && r.moveKind !== 'orbit')
      throw new Error(`[plan] close-up must be reached by travel/push/orbit, not a cut: "${r.line}"`);
    // Rule 2: do not stay on one angle.
    if (i > 0 && rows[i - 1].angle.trim().toLowerCase() === r.angle.trim().toLowerCase() && rows[i - 1].shot === r.shot)
      console.warn(`[plan] same angle and shot type as the previous beat (multi-angle coverage rule): "${r.line}"`);
  });
  return rows;
}

// ---------------------------------------------------------------------------------------------------------
// Camera moves. Each returns a CamFn (u 0..1 over the shot). Compose with frameTargets for the end poses.
/** Generic eased move between two poses (push-in / pull-out / diagonal depending on the poses). */
export const eased = (a: Pose, b: Pose, ease: Ease = easeInOut): CamFn => (u) => {
  const e = ease(u);
  return {p: lerp3(a.p, b.p, e), l: lerp3(a.l, b.l, e), fov: lerp(a.fov ?? 50, b.fov ?? 50, e), roll: lerp(a.roll ?? 0, b.roll ?? 0, e)};
};
/**
 * Push-in along the camera's OWN axis (CAMERA RULES v2: the only camera move besides locked-off).
 *  - pushIn(a, amount?, ease?): old form, camera moves `amount` (0.25 = 25%) of the way toward the look point.
 *  - pushIn(from, to, {duration, ease, delay}): v2 form. `to` must lie on the axis of `from` (lateral error > 0.05 m throws) and be closer.
 *    It moves for `duration` seconds (default 4) after `delay` seconds, then holds. Default ease `easeTrapezoid`: eases in and out,
 *    constant speed in the middle, no bounce or overshoot. Direction, look point and lens never change.
 */
export function pushIn(a: Pose, amount?: number, ease?: Ease): CamFn;
export function pushIn(from: Pose, to: Pose, o?: {duration?: number; ease?: Ease; delay?: number}): CamFn;
export function pushIn(a: Pose, b: number | Pose = 0.25, c?: Ease | {duration?: number; ease?: Ease; delay?: number}): CamFn {
  if (typeof b === 'number') return eased(a, {...a, p: lerp3(a.p, a.l, b)}, (typeof c === 'function' ? c : undefined) ?? easeInOut);
  const o = (typeof c === 'object' ? c : {}) as {duration?: number; ease?: Ease; delay?: number};
  const d: V3 = [a.l[0] - a.p[0], a.l[1] - a.p[1], a.l[2] - a.p[2]], n = Math.hypot(...d);
  const dir: V3 = [d[0] / n, d[1] / n, d[2] / n], diff: V3 = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]];
  const s = diff[0] * dir[0] + diff[1] * dir[1] + diff[2] * dir[2];
  const lat = Math.hypot(diff[0] - dir[0] * s, diff[1] - dir[1] * s, diff[2] - dir[2] * s);
  if (s <= 0) throw new Error('[pushIn] `to` must be closer to the look point than `from` along the camera axis');
  if (lat > 0.05) throw new Error(`[pushIn] not a straight push: the end position is ${lat.toFixed(2)} m off the camera axis (CAMERA RULES v2: push straight in only)`);
  if (s >= n - 0.1) throw new Error('[pushIn] push goes through the look point');
  const dur = o.duration ?? 4, delay = o.delay ?? 0, ease = o.ease ?? easeTrapezoid;
  const end: V3 = [a.p[0] + dir[0] * s, a.p[1] + dir[1] * s, a.p[2] + dir[2] * s];
  return (_u, t) => {
    const e = ease(clamp01(((t ?? 0) - delay) / dur));
    return {p: lerp3(a.p, end, e), l: a.l, fov: a.fov ?? 50, roll: a.roll ?? 0};
  };
}
/** Fraction of the frame height covered by a figure from foot point to head-top point (use it to check WIDE_BODY_FRAC). */
export function bodyHeightFrac(pose: Pose, foot: V3, headTop: V3): number {
  return Math.abs(toScreen(pose, foot).y - toScreen(pose, headTop).y) / 1920;
}
/**
 * A straight push-in keeps the look point fixed and moves the camera along its own axis, so anything off that axis drifts toward the frame edge as the
 * camera gets closer. Samples the push (u = 0..1) and returns one warning per problem: the focal point leaves CENTER_BOX, or a head touches or leaves it.
 */
export function pushWarnings(label: string, from: Pose, to: Pose, focal: Focal | V3, heads: Head[] = []): string[] {
  const d: V3 = [from.l[0] - from.p[0], from.l[1] - from.p[1], from.l[2] - from.p[2]], n = Math.hypot(...d) || 1;
  const dir: V3 = [d[0] / n, d[1] / n, d[2] / n];
  const s = (to.p[0] - from.p[0]) * dir[0] + (to.p[1] - from.p[1]) * dir[1] + (to.p[2] - from.p[2]) * dir[2];
  const end: V3 = [from.p[0] + dir[0] * s, from.p[1] + dir[1] * s, from.p[2] + dir[2] * s];
  const out: string[] = [];
  const fix = 'fix: place the subject on the camera axis (aim the look point at it, e.g. frameFocal on the focal point) or shorten the push';
  for (let i = 0; i <= 10; i++) {
    const u = i / 10, pose: Pose = {p: lerp3(from.p, end, u), l: from.l, fov: from.fov ?? 50, roll: from.roll};
    if (!focalInBox(pose, focal)) { out.push(`[plan] push "${label}": the focal point leaves the center box at u=${u.toFixed(1)}; ${fix}`); break; }
  }
  for (const h of heads) for (let i = 0; i <= 10; i++) {
    const u = i / 10, pose: Pose = {p: lerp3(from.p, end, u), l: from.l, fov: from.fov ?? 50, roll: from.roll};
    if (!headInBox(pose, h)) { out.push(`[plan] push "${label}": head "${h.name ?? ''}" touches or leaves the center box at u=${u.toFixed(1)}; ${fix}`); break; }
  }
  return out;
}
/** Trapezoid ease: quadratic ramps in and out (`ramp` = fraction of the move each, default 0.25), constant speed between. C1 smooth, no overshoot. */
export const easeTrapezoid = (x: number, ramp = 0.25): number => {
  const t = clamp01(x), v = 1 / (1 - ramp);
  if (t < ramp) return (v * t * t) / (2 * ramp);
  if (t > 1 - ramp) return 1 - (v * (1 - t) * (1 - t)) / (2 * ramp);
  return v * (t - ramp / 2);
};
/** Pull-out (reveal): the reverse of pushIn, ends wider. Use when the viewer must see the whole object and its environment. */
export const pullOut = (a: Pose, amount = 0.35, ease: Ease = easeInOut): CamFn => {
  const dir: V3 = [a.p[0] - a.l[0], a.p[1] - a.l[1], a.p[2] - a.l[2]];
  const b: Pose = {...a, p: [a.p[0] + dir[0] * amount, a.p[1] + dir[1] * amount, a.p[2] + dir[2] * amount]};
  return eased(a, b, ease);
};
/** USE ONLY WHEN THE USER EXPLICITLY ASKS (CAMERA RULES v2: calm camera). Lateral dolly / truck: camera and look point slide sideways together (parallax comes from layered set depth). */
export const truck = (a: Pose, dx: number, dz = 0, ease: Ease = easeInOut): CamFn => {
  const b: Pose = {...a, p: [a.p[0] + dx, a.p[1], a.p[2] + dz], l: [a.l[0] + dx, a.l[1], a.l[2] + dz]};
  return eased(a, b, ease);
};
/** USE ONLY WHEN THE USER EXPLICITLY ASKS (CAMERA RULES v2). Parallax: a truck with a slight counter-rotation of the look point, so near layers slide faster than far ones. */
export const parallax = (a: Pose, dx: number, ease: Ease = easeInOut): CamFn => {
  const b: Pose = {...a, p: [a.p[0] + dx, a.p[1], a.p[2]], l: [a.l[0] + dx * 0.25, a.l[1], a.l[2]]};
  return eased(a, b, ease);
};
/** USE ONLY WHEN THE USER EXPLICITLY ASKS (CAMERA RULES v2). Diagonal: push-in while trucking and rising (or dropping) so the target ends framed. */
export const diagonal = (a: Pose, dx: number, dy: number, push = 0.2, ease: Ease = easeInOut): CamFn => {
  const base = lerp3(a.p, a.l, push);
  const b: Pose = {...a, p: [base[0] + dx, base[1] + dy, base[2]]};
  return eased(a, b, ease);
};
/** USE ONLY WHEN THE USER EXPLICITLY ASKS (CAMERA RULES v2: at most once per video, and only on request). Slow orbit around a centre. Angles in degrees, 0 = camera on +z. Keep it under about 40 degrees per shot. */
export const orbit = (center: V3, radius: number, a0: number, a1: number, height: number, lookY = center[1], fov = 50, ease: Ease = easeInOut): CamFn => (u) => {
  const a = rad(lerp(a0, a1, ease(u)));
  return {p: [center[0] + Math.sin(a) * radius, height, center[2] + Math.cos(a) * radius], l: [center[0], lookY, center[2]], fov};
};
/** Hold with a tiny eased drift so a static shot is not dead (use only when the narration needs a calm beat). */
export const holdDrift = (a: Pose, drift = 0.12): CamFn => truck(a, drift);


// ---------------------------------------------------------------------------------------------------------
// v7 helpers: continuous 3D travel to a close-up, follow camera. Built on frameTargets. All are CamFn (u 0..1, t seconds).
const wrapPi = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** Fraction of the FRAME height the targets' projected box covers at this pose. Informational only (no rule limits it). Box corners, so a sphere reads slightly high. */
export function objectFill(pose: Pose, targets: Target[]): number {
  let y0 = Infinity, y1 = -Infinity;
  for (const t of targets) {
    const h = half(t);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const s = toScreen(pose, [t.p[0] + sx * h[0], t.p[1] + sy * h[1], t.p[2] + sz * h[2]]);
      y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y);
    }
  }
  return (y1 - y0) / 1920;
}

/**
 * USE ONLY WHEN THE USER EXPLICITLY ASKS (CAMERA RULES v2: no arcs, no travel to objects; use `insertCloseUp` + a cut).
 * ONE continuous path from the pose `fromShot` to the pose `toPose`: camera position is interpolated in cylindrical coordinates
 * around `center` (radius, height, azimuth), so the angle really changes and parallax shows depth (a 3D orbit/arc, not a 2D zoom).
 * arc  = extra azimuth swing in degrees that peaks mid-path (sign picks the side; the path still ends exactly on toPose).
 * rise = extra camera height in metres that peaks mid-path (low-to-high or over-the-top feel).
 * Look point and fov are eased between the two poses. Never a cut.
 */
export function travelTo(fromShot: Pose, toPose: Pose, o: {center: V3; arc?: number; rise?: number; ease?: Ease}): CamFn {
  const ease = o.ease ?? easeInOut, c = o.center, arc = rad(o.arc ?? 0), rise = o.rise ?? 0;
  const s0: V3 = [fromShot.p[0] - c[0], fromShot.p[1] - c[1], fromShot.p[2] - c[2]];
  const s1: V3 = [toPose.p[0] - c[0], toPose.p[1] - c[1], toPose.p[2] - c[2]];
  const r0 = Math.hypot(s0[0], s0[2]), r1 = Math.hypot(s1[0], s1[2]);
  const a0 = Math.atan2(s0[0], s0[2]), da = wrapPi(Math.atan2(s1[0], s1[2]) - a0); // shortest way round
  return (u) => {
    const e = ease(u), bulge = Math.sin(Math.PI * e);
    const r = lerp(r0, r1, e), a = a0 + da * e + arc * bulge, y = lerp(s0[1], s1[1], e) + rise * bulge;
    return {
      p: [c[0] + Math.sin(a) * r, c[1] + y, c[2] + Math.cos(a) * r],
      l: lerp3(fromShot.l, toPose.l, e),
      fov: lerp(fromShot.fov ?? 50, toPose.fov ?? 50, e),
      roll: lerp(fromShot.roll ?? 0, toPose.roll ?? 0, e),
    };
  };
}

export interface CloseUpOpts {
  from: Pose; // the shot we are in (the travel starts exactly here, no cut)
  fill?: number; // used only when no focal is given: fraction of the group fit the target box covers (free, no limits; default 0.58)
  focal?: Focal; // focal point + radius to frame instead of the whole target (the rest of the object may be cropped)
  span?: number; // with focal: fraction of the CENTER_BOX height covered by the focal radius circle (default 0.55)
  duration?: number; // travel frames (default 36 = 1.2 s at 30 fps)
  hold?: number; // frames held on the close-up (default 45 = 1.5 s)
  back?: number; // frames of the travel/pull back to `backTo` (default 0 = stay on the close-up)
  backTo?: Pose; // pose to return to (default `from`)
  ease?: Ease;
  arc?: number; // degrees of extra swing mid-travel (default 28)
  rise?: number; // extra metres of height mid-travel (default 0.25)
  yaw?: number; // end angle in degrees (frameTargets convention); default = start azimuth + 35 so the angle changes
  pitch?: number; // end pitch in degrees (default 12)
  fov?: number; // end lens (default the start fov)
  center?: V3; // pivot of the arc (default the target centre)
}
export interface CloseUpShot {cam: CamFn; frames: number; endPose: Pose; fill: number; inSafe: boolean}

/**
 * USE ONLY WHEN THE USER EXPLICITLY ASKS (CAMERA RULES v2: use `insertCloseUp` + `pushIn` + `cutTo` instead; it arcs and rises, which v2 forbids).
 * Continuous camera travel from the current shot to a tight close-up of `target`, hold, optional travel back. Total length = duration + hold + back frames
 * (use `frames` as the shot length, or the sum of the beats it spans). With a `focal` the end pose frames that focal point on the centre of CENTER_BOX and
 * the rest of the object may be cropped (fill is free). Without one it centres the group (frameTargets, margin = 1 - fill). Returns the measured fill
 * (informational) and `inSafe` = the focal point (or group centre) is inside CENTER_BOX at the end pose.
 * Only use it on props built per the PROPS rule (depth, texture, painted finish).
 */
export function closeUp(target: Target | Target[], o: CloseUpOpts): CloseUpShot {
  const targets = Array.isArray(target) ? target : [target];
  const fill = o.fill ?? 0.58;
  if (fill <= 0 || fill >= 1) throw new Error(`[closeUp] fill ${fill} must be between 0 and 1`);
  const dur = o.duration ?? 36, hold = o.hold ?? 45, back = o.back ?? 0;
  if (dur < 18) throw new Error('[closeUp] travel under 18 frames reads as a snap, not a camera move');
  const c: V3 = o.center ?? o.focal?.p ?? targets[0].p;
  const fromAz = (Math.atan2(o.from.p[0] - c[0], o.from.p[2] - c[2]) * 180) / Math.PI;
  const endPose = o.focal
    ? frameFocal(o.focal, {fov: o.fov ?? o.from.fov ?? 50, yaw: o.yaw ?? fromAz + 35, pitch: o.pitch ?? 12, span: o.span ?? 0.55})
    : frameTargets(targets, {fov: o.fov ?? o.from.fov ?? 50, yaw: o.yaw ?? fromAz + 35, pitch: o.pitch ?? 12, margin: 1 - fill});
  const inn = travelTo(o.from, endPose, {center: c, arc: o.arc ?? 28, rise: o.rise ?? 0.25, ease: o.ease});
  const out = back > 0 ? travelTo(endPose, o.backTo ?? o.from, {center: c, arc: -(o.arc ?? 28) * 0.6, rise: (o.rise ?? 0.25) * 0.6, ease: o.ease}) : null;
  const total = dur + hold + back;
  const cam: CamFn = (u, t) => {
    const f = clamp01(u) * total;
    if (f <= dur) return inn(f / dur, t);
    if (!out || f <= dur + hold) return inn(1, t);
    return out((f - dur - hold) / back, t);
  };
  return {cam, frames: total, endPose, fill: objectFill(endPose, targets), inSafe: focalInBox(endPose, o.focal ?? c)};
}

export interface FollowOpts {
  path: (t: number) => V3; // character ground position at t seconds in the shot (the SAME function that moves the card)
  duration: number; // shot length in seconds (maps u to t for the angle change)
  r?: number; // character radius for framing (default 0.9)
  chestY?: number; // height of the look point (default 0.9)
  dist?: number; // horizontal camera distance (default 4.6, wide enough that lead room still keeps the character near the centre)
  height?: number; // camera height (default 1.5)
  lead?: number; // metres of lead room ahead of the character along the travel direction (default 0.45)
  angle?: number; // start angle relative to travel: 0 behind, 90 side, 180 in front (default 100)
  angleShift?: number; // degrees the angle changes during the shot (default 40, sign picks the side)
  fov?: number;
  ease?: Ease;
}
/**
 * USE ONLY WHEN THE USER EXPLICITLY ASKS (CAMERA RULES v2 rule 7: no follow camera; cut to a camera already waiting at the next position).
 * Tracking camera for a character that walks, is pushed, or enters a room/car. Keeps the character framed with lead room, and the angle
 * swings by `angleShift` during the move so parallax and a new view appear. Heading is smoothed from the path (0.25 s window), so the
 * camera does not jitter on walk bob. Verify with assertFramed (lead room can push the focal point/head out of CENTER_BOX).
 * Rule 3: scenery must continue on every side this camera can reach (it can go behind, to the side and ahead of the character).
 */
export function followTarget(o: FollowOpts): CamFn {
  const ease = o.ease ?? easeInOut, dist = o.dist ?? 4.6, h = o.height ?? 1.5, lead = o.lead ?? 0.45, cy = o.chestY ?? 0.9;
  const a0 = o.angle ?? 100, shift = o.angleShift ?? 40, fov = o.fov ?? 50;
  let lastDir: V3 = [0, 0, -1];
  const heading = (t: number): V3 => {
    const a = o.path(Math.max(0, t - 0.125)), b = o.path(t + 0.125);
    const dx = b[0] - a[0], dz = b[2] - a[2], n = Math.hypot(dx, dz);
    if (n > 1e-4) lastDir = [dx / n, 0, dz / n];
    return lastDir;
  };
  return (u, t) => {
    const pos = o.path(t), d = heading(t);
    const az = Math.atan2(d[0], d[2]) + Math.PI + rad(a0 + shift * ease(u)); // 0 = directly behind the walker
    const look: V3 = [pos[0] + d[0] * lead, cy, pos[2] + d[2] * lead];
    return {p: [pos[0] + Math.sin(az) * dist, h, pos[2] + Math.cos(az) * dist], l: look, fov};
  };
}

/**
 * Dev check at u = 0, 0.5, 1: every FOCAL point is inside CENTER_BOX, and every head is completely inside it (a focal with `head: true`, unless
 * `crop: true`, plus the optional `headsAt` list). The rest of the object is NOT checked: it may be cropped. Throws with the failing u. Call at shot setup.
 */
export function assertFramed(label: string, cam: CamFn, focalAt: (u: number, t: number) => Focal | Focal[], duration: number, headsAt?: (u: number, t: number) => Head[]): void {
  for (const u of [0, 0.5, 1]) {
    const t = u * duration, pose = cam(u, t), f = focalAt(u, t), list = Array.isArray(f) ? f : [f];
    for (const fo of list) {
      if (!focalInBox(pose, fo)) throw new Error(`[camera] ${label}: focal point leaves the center box at u=${u}`);
      if (fo.head && !fo.crop && !headInBox(pose, {p: fo.p, r: fo.r ?? 0.4})) throw new Error(`[camera] ${label}: head touches or leaves the center box at u=${u}`);
    }
    for (const h of headsAt?.(u, t) ?? []) if (!headInBox(pose, h)) throw new Error(`[camera] ${label}: head "${h.name ?? ''}" touches or leaves the center box at u=${u}`);
  }
}


// =========================================================================================================
// CAMERA RULES v2 + SPEED AND COST OVERRIDES (STYLE_NOTES "CAMERA RULES v2"). Calm camera: locked-off or a straight push-in, cuts between
// a few named angles per set. CENTER FRAME still wins. Everything here is setup-time math (no GPU resources, no per-frame allocation).
export const V2_LIMITS = {
  maxFramingWords: 12, // a framing never lasts longer than this many narration words
  minFramingWords: 3, // never change faster than this
  maxAnglesPerSet: 3,
  maxSets: 3,
  maxCloseUpProps: 4,
  minMediumShare: 0.3, // warn when fewer than this share of the framings are medium shots (a more dynamic video)
  wordsPerFraming: [6, 10] as [number, number], // target average (about 20-25 framings for a ~195 word script)
  dissolveSec: [0.3, 0.5] as [number, number],
};

// ---- per-set registry of named angles (rule 5) --------------------------------------------------------
const SETS: Record<string, Record<string, Pose>> = {};
let ACTIVE_SET = '';
/** Define a location's named angles (max 3, V2_LIMITS). Call at shot-setup time, e.g. defineSet('lab', {frontWide, cctv, lowAngle}). */
export function defineSet(set: string, angles: Record<string, Pose>): void {
  const n = Object.keys(angles).length;
  if (n === 0) throw new Error(`[camera] set "${set}" has no angles`);
  if (n > V2_LIMITS.maxAnglesPerSet) throw new Error(`[camera] set "${set}" defines ${n} angles, max ${V2_LIMITS.maxAnglesPerSet} (reuse angles, do not invent new ones)`);
  SETS[set] = {...angles};
  ACTIVE_SET = set;
}
export function setActiveSet(set: string): void {
  if (!SETS[set]) throw new Error(`[camera] unknown set "${set}"`);
  ACTIVE_SET = set;
}
export function angleOf(angle: string, set = ACTIVE_SET): Pose {
  const p = SETS[set]?.[angle];
  if (!p) throw new Error(`[camera] set "${set}" has no angle "${angle}" (defined: ${Object.keys(SETS[set] ?? {}).join(', ') || 'none'})`);
  return p;
}

// ---- helpers ------------------------------------------------------------------------------------------
/** Locked-off shot with a tiny slow drift (default 0.05 m sideways over the whole shot, eased) so it never feels frozen. No rotation. */
export function lockedShot(position: V3, target: V3, o: {drift?: number; fov?: number; roll?: number} = {}): CamFn {
  const drift = o.drift ?? 0.05, fov = o.fov ?? 62;
  const f: V3 = [target[0] - position[0], 0, target[2] - position[2]], n = Math.hypot(f[0], f[2]) || 1;
  const right: V3 = [-f[2] / n, 0, f[0] / n]; // horizontal, perpendicular to the view direction
  return (u) => {
    const e = easeInOut(u) * drift;
    return {p: [position[0] + right[0] * e, position[1], position[2] + right[2] * e], l: [target[0] + right[0] * e, target[1], target[2] + right[2] * e], fov, roll: o.roll ?? 0};
  };
}

export interface ForegroundSpec {
  kind: 'shoulder' | 'guard-back' | 'door-frame' | 'hand';
  side: 'left' | 'right';
  depth?: number; // metres in front of the camera (default 0.7)
  color?: string; // cheap fake blur: a dark, desaturated, slightly tinted shape (default indigo `#1E1448`)
}
export interface ForegroundPlacement {kind: ForegroundSpec['kind']; position: V3; lookAt: V3; width: number; height: number; color: string; opacity: number}
export interface InsertShot {
  pose: Pose; // straight-on pose that puts the focal point on the centre of CENTER_BOX (use pushIn(from, pose) to reach it)
  focal: Focal;
  dof: {focal: V3; r: number}; // feed FocusDof (src/kit/Dof.tsx): real depth of field exists in the kit, so no fake blur is needed
  foreground?: ForegroundPlacement; // dark shape cropped by the frame edge (rule 9); render one cheap shared plane at this placement
  hold: [number, number]; // seconds to hold before cutting back (rule 8: 1-2 s)
}
/**
 * Tight straight-on close-up of a small narrated object (rule 8). `fill` = fraction of the CENTER_BOX height covered by the focal circle (default 0.7).
 * Straight axis (no arc, no rise): yaw/pitch default to `from` direction so a pushIn from the wider angle is a straight line. Hold 1-2 s, then cutTo a wider angle.
 * The focal point lands in the central box; the rest of the object may be cropped. Foreground: a dark, cropped plane near the camera at the frame edge.
 */
export function insertCloseUp(target: Focal, o: {from?: Pose; fill?: number; foreground?: ForegroundSpec; fov?: number; yaw?: number; pitch?: number} = {}): InsertShot {
  let yaw = o.yaw ?? 0, pitch = o.pitch ?? 8;
  if (o.from) { // look direction of the wide angle, so the push stays on the same line
    const d: V3 = [target.p[0] - o.from.p[0], target.p[1] - o.from.p[1], target.p[2] - o.from.p[2]];
    yaw = o.yaw ?? (Math.atan2(-d[0], -d[2]) * 180) / Math.PI;
    pitch = o.pitch ?? (Math.atan2(-d[1], Math.hypot(d[0], d[2])) * 180) / Math.PI;
  }
  const fov = o.fov ?? o.from?.fov ?? 50, fill = o.fill ?? 0.7;
  if (fill <= 0 || fill > 1.2) throw new Error(`[insertCloseUp] fill ${fill} out of range`);
  const pose = frameFocal(target, {fov, yaw, pitch, span: fill});
  let foreground: ForegroundPlacement | undefined;
  if (o.foreground) {
    const fg = o.foreground, depth = fg.depth ?? 0.7;
    const f: V3 = [pose.l[0] - pose.p[0], pose.l[1] - pose.p[1], pose.l[2] - pose.p[2]], n = Math.hypot(...f);
    const fd: V3 = [f[0] / n, f[1] / n, f[2] / n];
    const right: V3 = [-fd[2], 0, fd[0]], rl = Math.hypot(right[0], right[2]) || 1;
    const tv = Math.tan(rad(fov) / 2), th = tv * (1080 / 1920), sgn = fg.side === 'right' ? 1 : -1;
    const wHalf = depth * th, hHalf = depth * tv;
    const w = wHalf * 0.7, h = hHalf * 1.1; // covers about the outer 35% of the half width, so only an edge strip is filled
    const cx = sgn * (wHalf - w / 2 + wHalf * 0.05), cy = -hHalf * 0.25;
    const pos: V3 = [pose.p[0] + fd[0] * depth + (right[0] / rl) * cx, pose.p[1] + fd[1] * depth + cy, pose.p[2] + fd[2] * depth + (right[2] / rl) * cx];
    foreground = {kind: fg.kind, position: pos, lookAt: pose.p, width: w, height: h, color: fg.color ?? '#1E1448', opacity: 0.92};
  }
  return {pose, focal: target, dof: {focal: target.p, r: target.r ?? 0.4}, foreground, hold: [1, 2]};
}

export interface CutShot {kind: 'cut'; set: string; angle: string; cam: CamFn}
export interface DissolveShot {kind: 'dissolve'; set: string; angle: string; cam: CamFn; frames: number; dip: {frames: number}}
/** Hard cut to a named angle of the active set (or `set`). Locked, no drift (add drift with lockedShot if wanted). */
export function cutTo(angleName: string, set = ACTIVE_SET): CutShot {
  const pose = angleOf(angleName, set);
  return {kind: 'cut', set, angle: angleName, cam: () => pose};
}
/**
 * Short dissolve (0.3-0.5 s) to a named angle, only for a location change or a time jump (rule 11). The single-canvas kit draws one scene at a time, so
 * the visual is the kit's `dip` over `frames` (a dip to a colour), not a true crossfade. `duration` in seconds, default 0.4, at `fps` (default 30).
 */
export function dissolveTo(angleName: string, o: {duration?: number; set?: string; fps?: number} = {}): DissolveShot {
  const sec = o.duration ?? 0.4, set = o.set ?? ACTIVE_SET, fps = o.fps ?? 30;
  if (sec < V2_LIMITS.dissolveSec[0] || sec > V2_LIMITS.dissolveSec[1]) throw new Error(`[dissolveTo] duration ${sec}s must be ${V2_LIMITS.dissolveSec[0]}-${V2_LIMITS.dissolveSec[1]} s`);
  const pose = angleOf(angleName, set), frames = Math.round(sec * fps);
  return {kind: 'dissolve', set, angle: angleName, cam: () => pose, frames, dip: {frames}};
}

// ---- narration -> target plan v2 ----------------------------------------------------------------------
export type MoveV2 = 'locked' | 'push' | 'cut' | 'dissolve';
export interface PlanRowV2 {
  line: string; // narration text of this beat
  from: number; to: number; // frames
  words: number; // narration words in this beat (count them on the script)
  set: string; // location
  angle: string; // named angle of the set (defineSet)
  shot: ShotType; // wide / medium / close / insert
  move: MoveV2; // how this beat starts: locked (continues the same framing), push (a straight push-in starts), cut, dissolve
  target: string;
  targets: Target[];
  focal: Focal; // CENTER FRAME: must sit in the central box
  heads?: Head[];
  why: string;
  prop?: string; // name of the close-up prop (counted, max 4 per video)
  orbit?: boolean; // an orbit is used in this beat (fails unless orbitRequested)
  push?: {from: Pose; to: Pose}; // for move 'push': the poses given to pushIn(from, to); checkPlanV2 warns when the push drives the focal point or a head out of CENTER_BOX
  tracksMover?: boolean; // the camera follows a moving character instead of cutting to a waiting camera (always fails)
}
/**
 * Plan check v2 (the old `checkPlan` stays for old videos). Throws if: an orbit is used without the user's request (or more than once), a framing
 * lasts more than 12 words or less than 3, more than 3 angles in a set, more than 3 locations, more than 4 close-up props, a moving character is
 * tracked instead of cut to, or the CENTER FRAME data / reason is missing. A framing = consecutive beats with the same set, angle and shot where the
 * later beats are `locked` (the narration continues on the same framing). Warns on the average rhythm (target 6-10 words) and on a missing ladder step.
 */
export function checkPlanV2(rows: PlanRowV2[], opts: {orbitRequested?: boolean} = {}): PlanRowV2[] {
  const L = V2_LIMITS, sets = new Set<string>(), angles: Record<string, Set<string>> = {}, props = new Set<string>();
  let orbits = 0;
  const framings: {words: number; first: string}[] = [];
  rows.forEach((r, i) => {
    const q = `"${r.line}"`;
    if (!r.target.trim() || r.targets.length === 0) throw new Error(`[plan] sentence has no target: ${q}`);
    if (!r.focal || !r.focal.p || r.focal.p.length !== 3 || r.focal.p.some((x) => !Number.isFinite(x))) throw new Error(`[plan] row has no focal point: ${q}`);
    if (r.focal.r !== undefined && !(r.focal.r > 0)) throw new Error(`[plan] focal radius must be positive: ${q}`);
    for (const h of r.heads ?? []) if (!(h.r > 0) || h.p.length !== 3) throw new Error(`[plan] invalid head (needs p and r > 0): ${q}`);
    if (!r.why.trim()) throw new Error(`[plan] move has no reason: ${q}`);
    if (!r.set.trim() || !r.angle.trim()) throw new Error(`[plan] row needs a set and a named angle: ${q}`);
    if (!(r.words > 0)) throw new Error(`[plan] row needs a word count: ${q}`);
    if (!['wide', 'medium', 'close', 'insert'].includes(r.shot)) throw new Error(`[plan] invalid shot type: ${q}`);
    if (!['locked', 'push', 'cut', 'dissolve'].includes(r.move)) throw new Error(`[plan] invalid move (locked|push|cut|dissolve): ${q}`);
    if (r.tracksMover) throw new Error(`[plan] a moving character is tracked instead of cut to (rule 7: cut to a camera already waiting): ${q}`);
    if (r.orbit) {
      orbits++;
      if (!opts.orbitRequested) throw new Error(`[plan] orbit used without the user asking for it: ${q}`);
      if (orbits > 1) throw new Error(`[plan] more than one orbit in the video: ${q}`);
    }
    sets.add(r.set);
    (angles[r.set] ??= new Set()).add(r.angle);
    if (r.prop && (r.shot === 'insert' || r.shot === 'close')) props.add(r.prop);
    if (r.shot === 'insert' && !r.prop) throw new Error(`[plan] insert shot needs a prop name (counted against the ${L.maxCloseUpProps} close-up props): ${q}`);
    const prev = rows[i - 1];
    const same = prev && prev.set === r.set && prev.angle === r.angle && prev.shot === r.shot && r.move === 'locked';
    if (same) framings[framings.length - 1].words += r.words;
    else framings.push({words: r.words, first: r.line});
  });
  for (const f of framings) {
    if (f.words > L.maxFramingWords) throw new Error(`[plan] a framing lasts ${f.words} words (max ${L.maxFramingWords}), starting at "${f.first}"`);
    if (f.words < L.minFramingWords) throw new Error(`[plan] a framing lasts ${f.words} words (min ${L.minFramingWords}, never change faster), starting at "${f.first}"`);
  }
  if (sets.size > L.maxSets) throw new Error(`[plan] ${sets.size} locations used (max ${L.maxSets}): ${[...sets].join(', ')}`);
  for (const [s, a] of Object.entries(angles)) if (a.size > L.maxAnglesPerSet) throw new Error(`[plan] set "${s}" uses ${a.size} angles (max ${L.maxAnglesPerSet}): ${[...a].join(', ')}`);
  if (props.size > L.maxCloseUpProps) throw new Error(`[plan] ${props.size} close-up props (max ${L.maxCloseUpProps}): ${[...props].join(', ')}`);
  const total = framings.reduce((s, f) => s + f.words, 0), avg = total / Math.max(1, framings.length);
  if (avg < L.wordsPerFraming[0] || avg > L.wordsPerFraming[1])
    console.warn(`[plan] ${framings.length} framings for ${total} words (average ${avg.toFixed(1)} words per framing, target ${L.wordsPerFraming[0]}-${L.wordsPerFraming[1]})`);
  // Ladder (rule 4): a close/insert should follow a medium or another close on the same set, not jump straight from a wide.
  // Only when the location has no medium shot at all (a wide -> insert push is fine if a medium exists elsewhere in that location).
  const hasMedium = new Set(rows.filter((r) => r.shot === 'medium').map((r) => r.set));
  rows.forEach((r, i) => {
    const p = rows[i - 1];
    if (p && p.set === r.set && p.shot === 'wide' && (r.shot === 'close' || r.shot === 'insert') && !hasMedium.has(r.set)) console.warn(`[plan] wide -> ${r.shot} skips the medium step and "${r.set}" has no medium shot (shot ladder): "${r.line}"`);
    if (r.move === 'push' && r.push) for (const w of pushWarnings(r.line, r.push.from, r.push.to, r.focal, r.heads)) console.warn(w);
  });
  const mediums = framings.length ? rows.filter((r, i) => r.shot === 'medium' && !(rows[i - 1] && rows[i - 1].set === r.set && rows[i - 1].angle === r.angle && rows[i - 1].shot === 'medium' && r.move === 'locked')).length : 0;
  if (framings.length >= 4 && mediums / framings.length < L.minMediumShare) console.warn(`[plan] only ${mediums} of ${framings.length} framings are medium shots (target at least ${Math.round(L.minMediumShare * 100)}%): add medium shots so the video feels more dynamic`);
  return rows;
}


// ---------------------------------------------------------------- EVERY SHOT HAS A CAMERA MOVE (kit default 2026-11-16; static only when the user says so)
// One simple move per shot, smooth ease, calm: dolly push / pull along the camera's own axis, truck (sideways drift), pedestal / crane (up-down), slight tilt.
// No orbit, no rotation around the subject, no follow cam. Each channel is [from, to] over the shot (frame f of n). push = fraction of the camera-to-look distance (negative = pull back),
// dx / dy = metres of truck / crane (both camera and look point move: parallax), tilt = metres the look point rises.
export interface MoveOpts {push?: [number, number]; dx?: [number, number]; dy?: [number, number]; tilt?: [number, number]; ease?: (x: number) => number; endAt?: number}
export const moveShot = (a: Pose, o: MoveOpts) => (f: number, n: number): Pose => {
  const ease = o.ease ?? easeInOut, u = ease(Math.min(1, Math.max(0, f / Math.max(1, (n - 1) * (o.endAt ?? 1))))), ch = (c?: [number, number]) => (c ? c[0] + (c[1] - c[0]) * u : 0);
  const k = ch(o.push), dx = ch(o.dx), dy = ch(o.dy), tl = ch(o.tilt);
  return {p: [a.p[0] + (a.l[0] - a.p[0]) * k + dx, a.p[1] + (a.l[1] - a.p[1]) * k + dy, a.p[2] + (a.l[2] - a.p[2]) * k], l: [a.l[0] + dx, a.l[1] + dy + tl, a.l[2]], fov: a.fov, roll: a.roll};
};


// ================================================================= CAMERA RULES v3 (2026-11-16, MANDATORY for all future videos; REPLACES the calm-camera rules of v2)
// Every shot has ONE smooth 3D camera move (never frozen, never two stacked move types), eased with an S-curve (easeS), real parallax through a real 3D set.
// Vocabulary: pushInV3, arcIn (push + orbit 15-35 deg, max 40), craneTiltDown (rises AND pitches down 30-80 deg), craneUp / craneDown, truckV3 (sideways + slight yaw), pullBack,
// `dutchDeg` (5-8 deg roll on about 1 shot in 4), a short `shake` only at an impact. No whip pans, no 360 spins. (v2 names pushIn / truck / pullOut keep their old meaning.)
/** smootherstep: slow start, faster middle, slow end. No bounce, no overshoot. */
export const easeS = (t: number): number => { const x = Math.min(1, Math.max(0, t)); return x * x * x * (x * (x * 6 - 15) + 10); };
export interface MoveV3 {
  push?: [number, number]; // fraction of the camera-to-look distance (negative = pull back)
  yawDeg?: [number, number]; // orbit around the look point (max 40 deg of travel)
  pitchDeg?: [number, number]; // elevation change around the look point, + = camera rises and pitches down
  dx?: [number, number]; dy?: [number, number]; // truck / pedestal: camera AND look point move (metres)
  tilt?: [number, number]; // metres the look point rises
  dutchDeg?: number; // roll, eased in and out (S-curve)
  shake?: {at: number; amp: number; frames: number}; // short shake at an impact (frame of the shot, metres)
  endAt?: number; // move finishes at this fraction of the shot, then holds
}
/** Generic v3 move from a base pose; every channel is [from, to] over the shot. Returns a (frame, shotFrames) camera. */
export const moveV3 = (a: Pose, o: MoveV3) => (f: number, n: number): Pose => {
  const u = easeS(f / Math.max(1, (n - 1) * (o.endAt ?? 1))), ch = (c?: [number, number]) => (c ? c[0] + (c[1] - c[0]) * u : 0);
  const dx = ch(o.dx), dy = ch(o.dy), tl = ch(o.tilt), k = ch(o.push), yaw = (ch(o.yawDeg) * Math.PI) / 180, pit = (ch(o.pitchDeg) * Math.PI) / 180;
  // v3.1: truck / crane move the CAMERA only; the look point stays on the focus (the camera pans to keep the subject centred), so the background slides = parallax
  const l: V3 = [a.l[0], a.l[1] + tl, a.l[2]];
  const vx = a.p[0] - a.l[0], vy = a.p[1] - a.l[1], vz = a.p[2] - a.l[2], r0 = Math.hypot(vx, vy, vz), az = Math.atan2(vx, vz) + yaw, el = Math.asin(vy / r0) + pit, r = r0 * (1 - k);
  const base: V3 = [a.l[0] + dx + r * Math.cos(el) * Math.sin(az), a.l[1] + dy + r * Math.sin(el), a.l[2] + r * Math.cos(el) * Math.cos(az)];
  let sx = 0, sy = 0;
  if (o.shake && f >= o.shake.at && f < o.shake.at + o.shake.frames) { const q = (f - o.shake.at) / o.shake.frames, amp = o.shake.amp * (1 - q); sx = amp * Math.sin(f * 2.3); sy = amp * Math.cos(f * 3.1); }
  return {p: [base[0] + sx, base[1] + sy, base[2]], l, fov: a.fov, roll: o.dutchDeg ? o.dutchDeg * u : a.roll};
};
type Extra = Omit<MoveV3, 'push' | 'yawDeg' | 'pitchDeg' | 'dx' | 'dy'>;
export const pushInV3 = (a: Pose, k = 0.12, o: Extra = {}) => moveV3(a, {...o, push: [0, k]});
export const arcIn = (a: Pose, o: {yawDeg: number; push?: number} & Extra) => { if (Math.abs(o.yawDeg) > 40) throw new Error('arcIn: max 40 degrees per shot'); const {yawDeg, push, ...r} = o; return moveV3(a, {...r, yawDeg: [0, yawDeg], push: [0, push ?? 0.1]}); };
export const craneTiltDown = (a: Pose, o: {pitchDeg: number; push?: number} & Extra) => { const {pitchDeg, push, ...r} = o; return moveV3(a, {...r, pitchDeg: [0, pitchDeg], push: [0, push ?? 0]}); };
export const craneUp = (a: Pose, o: {dy: number; tiltDeg?: number} & Extra) => { const {dy, tiltDeg, ...r} = o; return moveV3(a, {...r, dy: [0, dy], pitchDeg: tiltDeg ? [0, tiltDeg] : undefined}); };
export const craneDown = (a: Pose, o: {dy: number; tiltDeg?: number} & Extra) => { const {dy, tiltDeg, ...r} = o; return moveV3(a, {...r, dy: [dy, 0], pitchDeg: tiltDeg ? [tiltDeg, 0] : undefined}); };
export const truckV3 = (a: Pose, o: {dx: number; yawDeg?: number} & Extra) => { const {dx, yawDeg, ...r} = o; return moveV3(a, {...r, dx: [-dx / 2, dx / 2], yawDeg: yawDeg ? [-yawDeg / 2, yawDeg / 2] : undefined}); };
export const pullBack = (a: Pose, k = 0.12, o: Extra = {}) => moveV3(a, {...o, push: [0, -k]});
export const dutch = (deg: number): number => Math.max(5, Math.min(8, Math.abs(deg))) * Math.sign(deg || 1);

export type MoveKindV3 = 'pushIn' | 'arcIn' | 'craneTiltDown' | 'craneUp' | 'craneDown' | 'truck' | 'pullBack';
export interface PlanRowV3 {id: string; set: string; angle: string; move?: MoveKindV3; ease?: 'S' | 'linear'; yawDeg?: number; stacked?: string[]; words?: number; tracksMover?: boolean; heroFlat?: string[]}
/** v3 plan check. Errors (throw when strict): no move, linear ease, yaw > 40, stacked move types, framing > 6 words, > 4 angles per set, a moving character tracked, a flat hero object. */
export function checkPlanV3(rows: PlanRowV3[], strict = true): {errors: string[]} {
  const errors: string[] = [], angles: Record<string, Set<string>> = {};
  for (const r of rows) {
    (angles[r.set] ??= new Set()).add(r.angle);
    if (!r.move) errors.push(`${r.id}: no camera move`);
    if (r.ease && r.ease !== 'S') errors.push(`${r.id}: move is not an S-curve`);
    if (Math.abs(r.yawDeg ?? 0) > 40) errors.push(`${r.id}: yaw ${r.yawDeg} deg > 40`);
    if ((r.stacked?.length ?? 0) > 1) errors.push(`${r.id}: stacked moves ${r.stacked!.join('+')}`);
    if ((r.words ?? 0) > 6) errors.push(`${r.id}: framing lasts ${r.words} words (> 6)`);
    if (r.tracksMover) errors.push(`${r.id}: tracks a moving character (cut to a waiting camera instead)`);
    if (r.heroFlat?.length) errors.push(`${r.id}: flat hero object(s): ${r.heroFlat.join(', ')}`);
  }
  for (const [set, a] of Object.entries(angles)) if (a.size > 4) errors.push(`${set}: ${a.size} named angles (> 4)`);
  if (strict && errors.length) throw new Error('checkPlanV3: ' + errors.join('; '));
  return {errors};
}


// ================================================================= CAMERA RULES v3.1 (2026-11-16): FOLLOW THE SUBJECT, FIT THE BOX
// REVERSES the old "no follow camera" rule: the camera follows the narration's subject (`focus`) with a smooth damped follow (it dollies / trucks WITH it, the background slides).
// Every move (arcIn, pushIn, craneTiltDown ...) is applied RELATIVE to the focus, and the focus stays inside CENTER_BOX at all times.
/** Camera distance that fits a framing box [w, h, d] (metres, around the focus) into the 9:16 frame with `margin` (fraction per side, default 5 %) seen from azimuth / elevation (deg). */
export function fitDistance(box: [number, number, number], azDeg: number, elDeg: number, fov = 62, margin = 0.05, aspect = 9 / 16): number {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180, [w, h, d] = box;
  const pw = w * Math.abs(Math.cos(az)) + d * Math.abs(Math.sin(az)), dep = d * Math.abs(Math.cos(az)) + w * Math.abs(Math.sin(az)), ph = h * Math.cos(el) + dep * Math.abs(Math.sin(el));
  const t = Math.tan((fov * Math.PI) / 360), k = 1 - 2 * margin;
  return Math.max(ph / (k * 2 * t), pw / (k * 2 * t * aspect)) + dep / 2; // + half the box depth: the near face is closer to the lens, so perspective makes it larger
}
/** Camera position at azimuth (0 = in front, toward +z; + toward +x) / elevation (deg) / radius around a focus point. */
export const orbitPos = (focus: V3, azDeg: number, elDeg: number, r: number): V3 => { const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180; return [focus[0] + r * Math.cos(el) * Math.sin(az), focus[1] + r * Math.sin(el), focus[2] + r * Math.cos(el) * Math.cos(az)]; };
/** Damped follow: returns a (frame, shotFrames) camera that equals `base` (built around focus(0)) translated by the smoothed focus movement, so the subject stays centred. lead = frames of look-ahead. */
export function followFocus(base: (f: number, n: number) => Pose, focus: (f: number) => V3, o: {damping?: number; lead?: number} = {}): (f: number, n: number) => Pose {
  const tau = o.damping ?? 5, alpha = 1 - Math.exp(-1 / tau), lead = o.lead ?? 0, f0 = focus(0), sm: V3[] = [f0];
  const smooth = (f: number): V3 => { while (sm.length <= f) { const i = sm.length, a = focus(i), b = focus(i - 1), t: V3 = [a[0] + (a[0] - b[0]) * lead, a[1] + (a[1] - b[1]) * lead, a[2] + (a[2] - b[2]) * lead], s = sm[i - 1]; sm.push([s[0] + (t[0] - s[0]) * alpha, s[1] + (t[1] - s[1]) * alpha, s[2] + (t[2] - s[2]) * alpha]); } return sm[f]; };
  return (f, n) => { const b = base(f, n), s = smooth(Math.max(0, Math.round(f))), d: V3 = [s[0] - f0[0], s[1] - f0[1], s[2] - f0[2]]; return {...b, p: [b.p[0] + d[0], b.p[1] + d[1], b.p[2] + d[2]], l: [b.l[0] + d[0], b.l[1] + d[1], b.l[2] + d[2]]}; };
}


// ================================================================= CAMERA RULES v4: SIZE BANDS (REPLACES the 5 %-margin fit of v3.1)
// The focus stays centred; only the camera moves. No padding to guarantee margins, no zooming out to fit everything. Shot size = focus height as a fraction of the frame height:
// close 0.70-1.00 (face / object fills the frame), medium 0.40-0.60 (DEFAULT), wide 0.20-0.30 (at most 1 shot in 4: establish a place or show many things).
export const bandOf = (fr: number): 'close' | 'medium' | 'wide' => (fr >= 0.7 ? 'close' : fr >= 0.4 ? 'medium' : 'wide');
/** Camera distance so that a focus of height h (m; `axis` 'z' = a footprint seen top-down) fills `fr` of the frame height at elevation elDeg. */
/** SAFE-AREA ZOOM OUT (kit default for every new video, 2026-11-17): TikTok / Shorts overlays cover the top, the bottom and the right edge, so every shot is framed about 9 % wider than its size band asks.
 *  ONE constant, tune it here: pass SAFE_ZOOM as the `safe` argument of bandDistance in the video's buildCam (the older videos keep safe = 1 and stay unchanged). */
export const SAFE_ZOOM = 1.09;
/** SAFE ZONE (frame fractions, y from the top): about 10 % margin on top, 20 % at the bottom, 12 % left and right. The main character, the narrated object and the key action stay inside it. */
export const SAFE_BOX = {x0: 0.12, x1: 0.88, y0: 0.1, y1: 0.8};
export function bandDistance(h: number, fr: number, elDeg: number, axis: 'y' | 'z' = 'y', fov = 62, safe = 1): number {
  const el = (elDeg * Math.PI) / 180, he = axis === 'y' ? h * Math.cos(el) + 0.25 * Math.abs(Math.sin(el)) : h * Math.abs(Math.sin(el)) + 0.25 * Math.cos(el);
  return (he * safe) / (fr * 2 * Math.tan((fov * Math.PI) / 360));
}


// ================================================================= FOCUS = WHAT THE NARRATION IS ABOUT (2026-11-16, kit rule)
// When a character interacts with an object the narration is about (ripping a sign, holding a coin, opening a door, stirring a pot) the focus is the ACTION: the focus box = the character AND
// the object together, fully visible and centred, never cropped out by a close push-in. `focusGroup` returns the centre of the bounding box of several moving points (use it as the entry's
// `focus`); size the framing height `h` to cover all of them. Hold the framing steady while the action happens (end the push before it). The QA gate (`keys` of an entry, check
// "narrated object fully visible at its key moment") fails when the object leaves the frame.
export const focusGroup = (parts: ((f: number) => V3)[]) => (f: number): V3 => {
  const pts = parts.map((q) => q(f)), lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
};
