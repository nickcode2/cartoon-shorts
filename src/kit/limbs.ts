// Smooth limbs for the new characters (sun / universe, see glowChar.tsx). Every arm and leg is ONE smooth bezier through
// shoulder -> elbow -> hand (hip -> knee -> foot): a parabola arc whose midpoint is the joint, so a bend is a gentle arc and never a V.
// A minimum bend radius is enforced two ways: (1) the IK keeps the interior angle at the joint above THETA_MIN, (2) the curve's real
// minimum radius is measured and the middle joint is flattened toward the chord until it is at least R_MIN. The motion kit (walk, pickPlace,
// holdPhone, carEntry) only produces targets; every character that draws limbs through this module gets the rounded bends for all of them.
export type V2 = [number, number];

/** Per-character anchor geometry, in card px (600x1000). The motion kit reads it so its targets fit the character's body. */
export interface Rig {
  hipX: [number, number]; // leg start x (left, right)
  hipY: number; // leg start y
  stanceX: [number, number]; // ankle x when standing
  ground: number; // ankle y on the ground
  leg: [number, number]; // thigh, shin lengths
  shoulders: [V2, V2]; // arm start (left = front arm, right = back arm)
  handRest: [V2, V2]; // hand when the arm hangs
  arm: [number, number]; // upper arm, forearm lengths
}
/** The hoodie man's numbers (hoodieMan.tsx, unchanged). */
export const RIG_HOODIE: Rig = {hipX: [274, 326], hipY: 644, stanceX: [262, 338], ground: 942, leg: [155, 145], shoulders: [[232, 388], [368, 388]], handRest: [[216, 656], [384, 656]], arm: [150, 140]};
/** Sun / universe (layout from characters/reference-full.png scaled 0.64 to card px; legs are shorter than the hoodie man's). */
export const RIG_GLOW: Rig = {hipX: [265, 341], hipY: 691, stanceX: [253, 353], ground: 939, leg: [128, 122], shoulders: [[249, 425], [383, 427]], handRest: [[205, 643], [452, 633]], arm: [125, 125]};

export const THETA_MIN = (50 * Math.PI) / 180; // smallest interior angle at an elbow / knee
export const R_MIN_ARM = 48; // minimum bend radius, px
export const R_MIN_LEG = 60;

/** Two-bone IK with a minimum interior angle. Returns the middle joint and the (possibly clamped) end point. `pick(p)` scores the two candidates, higher wins. */
export function ik2(a: V2, target: V2, L1: number, L2: number, pick: (p: V2) => number, thetaMin = THETA_MIN): {m: V2; end: V2} {
  let dx = target[0] - a[0], dy = target[1] - a[1];
  let D = Math.hypot(dx, dy) || 1e-4;
  const dMax = (L1 + L2) * 0.995;
  const dMin = Math.sqrt(L1 * L1 + L2 * L2 - 2 * L1 * L2 * Math.cos(thetaMin));
  const Dc = Math.min(dMax, Math.max(dMin, D));
  dx *= Dc / D; dy *= Dc / D; D = Dc;
  const q = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
  const h = Math.sqrt(Math.max(0, L1 * L1 - q * q));
  const mx = a[0] + (dx * q) / D, my = a[1] + (dy * q) / D, px = -dy / D, py = dx / D;
  const c1: V2 = [mx + px * h, my + py * h], c2: V2 = [mx - px * h, my - py * h];
  return {m: pick(c1) >= pick(c2) ? c1 : c2, end: [a[0] + dx, a[1] + dy]};
}

export interface LimbCurve {
  seg: [V2, V2, V2, V2][]; // one cubic (a parabola arc through a, m, b)
  m: V2; // the joint actually used (flattened if needed)
  minR: number; // measured minimum bend radius (px), Infinity for a straight limb
}
export const bezPoint = (s: [V2, V2, V2, V2], t: number): V2 => bez(s, t);
const bez = (s: [V2, V2, V2, V2], t: number): V2 => {
  const u = 1 - t;
  return [u * u * u * s[0][0] + 3 * u * u * t * s[1][0] + 3 * u * t * t * s[2][0] + t * t * t * s[3][0], u * u * u * s[0][1] + 3 * u * u * t * s[1][1] + 3 * u * t * t * s[2][1] + t * t * t * s[3][1]];
};
const d1 = (s: [V2, V2, V2, V2], t: number): V2 => {
  const u = 1 - t;
  return [3 * u * u * (s[1][0] - s[0][0]) + 6 * u * t * (s[2][0] - s[1][0]) + 3 * t * t * (s[3][0] - s[2][0]), 3 * u * u * (s[1][1] - s[0][1]) + 6 * u * t * (s[2][1] - s[1][1]) + 3 * t * t * (s[3][1] - s[2][1])];
};
const d2 = (s: [V2, V2, V2, V2], t: number): V2 => {
  const u = 1 - t;
  return [6 * u * (s[2][0] - 2 * s[1][0] + s[0][0]) + 6 * t * (s[3][0] - 2 * s[2][0] + s[1][0]), 6 * u * (s[2][1] - 2 * s[1][1] + s[0][1]) + 6 * t * (s[3][1] - 2 * s[2][1] + s[1][1])];
};
const build = (a: V2, m: V2, b: V2): [V2, V2, V2, V2][] => {
  // The quadratic bezier whose midpoint is the joint m: q = 2m - (a+b)/2. One parabola arc through shoulder, elbow, hand: curvature has one
  // sign (no S-shapes) and no corner. Elevated to a cubic for the canvas.
  const q: V2 = [2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2];
  return [[a, [a[0] + ((q[0] - a[0]) * 2) / 3, a[1] + ((q[1] - a[1]) * 2) / 3], [b[0] + ((q[0] - b[0]) * 2) / 3, b[1] + ((q[1] - b[1]) * 2) / 3], b]];
};
const radiusOf = (seg: [V2, V2, V2, V2][]): number => {
  let kMax = 0;
  for (const s of seg) for (let i = 0; i <= 16; i++) {
    const t = i / 16, v = d1(s, t), w = d2(s, t);
    const sp = Math.pow(v[0] * v[0] + v[1] * v[1], 1.5);
    if (sp > 1e-6) kMax = Math.max(kMax, Math.abs(v[0] * w[1] - v[1] * w[0]) / sp);
  }
  return kMax > 1e-9 ? 1 / kMax : Infinity;
};
/** One smooth bezier through a, m, b. If the tightest bend is below rMin the joint m is eased toward the chord until it is not. */
export function limbCurve(a: V2, m: V2, b: V2, rMin: number): LimbCurve {
  let mm: V2 = [m[0], m[1]];
  const cx = b[0] - a[0], cy = b[1] - a[1], cl = Math.hypot(cx, cy) || 1e-4;
  const t = ((mm[0] - a[0]) * cx + (mm[1] - a[1]) * cy) / (cl * cl);
  const foot: V2 = [a[0] + cx * t, a[1] + cy * t]; // m projected on the chord
  let seg = build(a, mm, b), r = radiusOf(seg);
  for (let i = 0; i < 40 && r < rMin; i++) {
    mm = [foot[0] + (mm[0] - foot[0]) * 0.85, foot[1] + (mm[1] - foot[1]) * 0.85];
    seg = build(a, mm, b);
    r = radiusOf(seg);
  }
  return {seg, m: mm, minR: r};
}
/** Stroke a limb as one smooth curve (round caps). Returns the measured minimum radius. */
export function strokeLimb(c: CanvasRenderingContext2D, curve: LimbCurve, width: number, color: string): number {
  c.beginPath();
  c.moveTo(curve.seg[0][0][0], curve.seg[0][0][1]);
  for (const s of curve.seg) c.bezierCurveTo(s[1][0], s[1][1], s[2][0], s[2][1], s[3][0], s[3][1]);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
  return curve.minR;
}
/** Test helper: sweep reach distances and bend directions and return the smallest radius any limb curve gets. Must stay >= the rMin. */
export function limbSweep(L1: number, L2: number, rMin: number): number {
  let worst = Infinity;
  for (let D = 1; D <= (L1 + L2) * 1.1; D += 3) for (let ang = 0; ang < 360; ang += 30) {
    const a: V2 = [0, 0], tg: V2 = [Math.cos((ang * Math.PI) / 180) * D, Math.sin((ang * Math.PI) / 180) * D];
    for (const sg of [-1, 1]) {
      const {m, end} = ik2(a, tg, L1, L2, (p) => p[0] * sg);
      worst = Math.min(worst, limbCurve(a, m, end, rMin).minR);
    }
  }
  return worst;
}
