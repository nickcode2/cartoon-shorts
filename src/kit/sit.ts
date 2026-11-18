// SITTING (reference ref_sit_*): the torso card sits in the middle of the seat; thighs come forward from the seat, the shins bend down in ONE smooth curve, feet point forward.
// The near-side arm rests on the table (or on the thigh) in front of the torso, the far-side arm is behind it; hands touch what they rest on, nothing floats.
// Poses: seated-at-a-table and seated-on-a-bench, facing the camera ('front') and in 3/4 ('three-quarter', 40 degrees). Limbs are explicit 3D curves in card-local px (RickPose.limbs3).
// All numbers are estimates (no source gave seated proportions for this rig): seat 0.45 m, table 0.75 m, hand 0.36 m in front of the torso. Sitting arms and legs bend far more than the walk limit (arm offset up to 35 % of the chord, the leg is an L).
import {ARM, BASE_Z, C3, GROUND, HIP_Y, HAND_R, Kind, LIMB_W, P3, PXM, REST, RickPose, build, hipX, limbCurves3, rightIsNear, shoulderX, shoulderY, solve, torsoYaw} from './rickRig';

export type SitSeat = 'table' | 'bench';
export type SitView = 'front' | 'three-quarter';
export interface SitOpts { seat: SitSeat; view: SitView; camYaw: number; mirror?: boolean; scale?: number; seatTop?: number; tableTop?: number }
export interface SitResult { pose: RickPose; yOffset: number; seatTop: number; tableTop: number; tableForward: number; scale: number; kind: Kind }
export const SEAT_TOP = 0.45, TABLE_TOP = 0.75, TABLE_FORWARD = 0.36; // metres

export function sitPose(kind: Kind, o: SitOpts): SitResult {
  const b = build(kind), s = o.scale ?? 1, k = PXM * s, seatTop = o.seatTop ?? SEAT_TOP, tableTop = o.tableTop ?? TABLE_TOP;
  const theta = o.view === 'front' ? 0 : (o.mirror ? -1 : 1) * (40 * Math.PI) / 180, a = o.camYaw + theta, fwd: [number, number] = [Math.sin(a), Math.cos(a)];
  const yOffset = seatTop - (GROUND - (b.top + b.th)) * k; // the torso bottom edge sits on the seat
  const pose0: RickPose = {...REST, fwd, torsoFwd: fwd, headFwd: fwd, legSw: [0, 0], toe: [0, 0], armSw: [0, 0]};
  const sol = solve(kind, pose0, o.camYaw), sinT = Math.sin(torsoYaw(pose0, o.camYaw)), fR = Math.sin(theta), fN = Math.cos(theta); // forward in the card frame (R, N)
  const rightR = -fN, rightN = fR; // the character's own right in the card frame (R, N): slot 0 is the own-right limb
  const floorY = GROUND + yOffset / k, px = (m: number) => m / k, wsc = Math.max(0.22, Math.abs(Math.cos(theta)));
  // legs: one L-shaped cubic: thigh forward from the root, shin down to the floor, the foot points forward
  const legs = [0, 1].map((i) => {
    const sg = i === 0 ? 1 : -1, root: P3 = [sol.hip[i][0], sol.hip[i][1], BASE_Z + sg * hipX(b) * sinT], d = px(0.42), H = floorY - root[1];
    const ankle: P3 = [root[0] + fR * d, floorY, root[2] + fN * d], p1: P3 = [root[0] + fR * d * 0.6, root[1] + 4, root[2] + fN * d * 0.6], p2: P3 = [ankle[0], ankle[1] - 0.6 * H, ankle[2]];
    return [root, p1, p2, ankle] as C3;
  }) as [C3, C3];
  const nearSlot = rightIsNear(fwd, o.camYaw) ? 0 : 1, farSlot = 1 - nearSlot;
  const armTo = (slot: number, target: P3): C3 => { // one gentle-ish cubic from the shoulder to the hand, the elbow bows outward (away from the torso)
    const sg = slot === 0 ? 1 : -1, S: P3 = [CXs(sol.sh[slot][0]), shoulderY(b), BASE_Z + sg * shoulderX(b) * sinT];
    const dv = [target[0] - S[0], target[1] - S[1], target[2] - S[2]], d = Math.hypot(dv[0], dv[1], dv[2]), u = dv.map((v) => v / d), out = [sg * rightR, 0, sg * rightN], dot = out[0] * u[0] + out[1] * u[1] + out[2] * u[2];
    let n = [out[0] - dot * u[0], out[1] - dot * u[1], out[2] - dot * u[2]]; const nl = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map((v) => v / nl);
    const h = d * Math.sqrt(Math.max(0, (3 * (ARM / Math.max(d, 1) - 1)) / 8)), q = (4 / 3) * h;
    return [S, [S[0] + dv[0] / 3 + n[0] * q, S[1] + dv[1] / 3 + n[1] * q, S[2] + dv[2] / 3 + n[2] * q], [S[0] + (2 * dv[0]) / 3 + n[0] * q, S[1] + (2 * dv[1]) / 3 + n[1] * q, S[2] + (2 * dv[2]) / 3 + n[2] * q], target] as C3;
  };
  const arms = [0, 1].map((slot) => {
    const sg = slot === 0 ? 1 : -1, handR = HAND_R, legR = LIMB_W / 2;
    if (o.seat === 'table') { // the hands lie on the table top in front of the torso, one each side; the ball touches the surface
      const lat = px(0.14) * sg, fwdD = px(TABLE_FORWARD), tabY = GROUND - (tableTop - yOffset) / k;
      return armTo(slot, [450 + fR * fwdD + rightR * lat, tabY - handR, fN * fwdD + rightN * lat]);
    }
    // bench: the hands rest on the thighs just in front of the hips (the arms are short); the ball touches the top of the thigh tube
    const t = 0.16, L = legs[slot], B = (e: number) => { const m = 1 - t; return m * m * m * L[0][e] + 3 * m * m * t * L[1][e] + 3 * m * t * t * L[2][e] + t * t * t * L[3][e]; };
    return armTo(slot, [B(0), B(1) - 2 * legR - handR, B(2)]); // (the rig lifts the whole leg by one limb radius so it rests on the floor: the hand sits one more radius up)
  }) as [C3, C3];
  const pose: RickPose = {...pose0, limbs3: {legs, arms}, face: 'deadpan'};
  void limbCurves3; void HIP_Y;
  return {pose, yOffset, seatTop, tableTop, tableForward: TABLE_FORWARD, scale: s, kind};
}
const CXs = (x: number) => x;
