// Keep-out zones and path checks: characters must never pass through solid objects (cars, doors, counters, shelves, carts).
// Ground plane only (x, z). Every walking path is checked against the zones before rendering (assertPathClear), and
// `slideOut` pushes a point out of a zone for paths that only brush one. Rules in STYLE_NOTES.md "ANIMATION v5".
import {V3} from './kit';
import {easeInOut, MIN_SEC} from './motion';
import {METERS_PER_PX, SOLE_Y} from '../guard';
import {ManPose} from './hoodieMan';

export type Zone =
  | {kind: 'box'; name: string; c: [number, number]; half: [number, number]; yaw?: number} // c = centre (x, z), half extents, yaw about y (rad)
  | {kind: 'circle'; name: string; c: [number, number]; r: number};

export const insideZone = (z: Zone, x: number, zz: number, pad = 0): boolean => inside(z, x, zz, pad);
const inside = (z: Zone, x: number, zz: number, pad: number): boolean => {
  if (z.kind === 'circle') return Math.hypot(x - z.c[0], zz - z.c[1]) < z.r + pad;
  const yaw = z.yaw ?? 0, cs = Math.cos(yaw), sn = Math.sin(yaw);
  const dx = x - z.c[0], dz = zz - z.c[1];
  const lx = dx * cs + dz * sn, lz = -dx * sn + dz * cs; // into the box frame
  return Math.abs(lx) < z.half[0] + pad && Math.abs(lz) < z.half[1] + pad;
};
/** Zone for a vehicle body, footprint length (along its yaw) x width in metres. */
export const carZone = (name: string, c: [number, number], yaw = 0, length = 4.6, width = 1.9): Zone => ({kind: 'box', name, c, half: [length / 2, width / 2], yaw});

export interface Violation {t: number; zone: string; at: [number, number]}
export interface Allow {zone: string; from: number; to: number} // time window (s) in which the walker may be inside this zone (e.g. getting into the car)
/**
 * Sample a path (t seconds -> world position) and report every moment the walker's body circle (radius `r`, default 0.28 m) is inside a zone.
 * Pass `allow` windows for deliberate contact (entering the car, sitting at a counter).
 */
export function checkPath(path: (t: number) => V3, t0: number, t1: number, zones: Zone[], r = 0.28, allow: Allow[] = [], fps = 30): Violation[] {
  const out: Violation[] = [];
  for (let f = Math.floor(t0 * fps); f <= Math.ceil(t1 * fps); f++) {
    const t = f / fps, p = path(t);
    for (const z of zones) {
      if (allow.some((a) => a.zone === z.name && t >= a.from && t <= a.to)) continue;
      if (inside(z, p[0], p[2], r)) out.push({t, zone: z.name, at: [p[0], p[2]]});
    }
  }
  return out;
}
/** Throws with the first violations (time, zone, position). Call it in the shot setup (dev) for every character path. */
export function assertPathClear(label: string, path: (t: number) => V3, t0: number, t1: number, zones: Zone[], r = 0.28, allow: Allow[] = []): void {
  const v = checkPath(path, t0, t1, zones, r, allow);
  if (v.length) throw new Error(`[collide] ${label} passes through ${[...new Set(v.map((x) => x.zone))].join(', ')} first at t=${v[0].t.toFixed(2)}s (${v[0].at.map((n) => n.toFixed(2)).join(', ')}), ${v.length} frames`);
}
/** Push a point out of every zone along the shortest direction (use for paths that only brush a zone). */
export function slideOut(p: V3, zones: Zone[], r = 0.28): V3 {
  let x = p[0], z = p[2];
  for (const zn of zones) {
    if (!inside(zn, x, z, r)) continue;
    if (zn.kind === 'circle') {
      const dx = x - zn.c[0], dz = z - zn.c[1], d = Math.hypot(dx, dz) || 1e-4, k = (zn.r + r) / d;
      x = zn.c[0] + dx * k; z = zn.c[1] + dz * k;
    } else {
      const yaw = zn.yaw ?? 0, cs = Math.cos(yaw), sn = Math.sin(yaw);
      const dx = x - zn.c[0], dz = z - zn.c[1];
      let lx = dx * cs + dz * sn, lz = -dx * sn + dz * cs;
      const px = zn.half[0] + r - Math.abs(lx), pz = zn.half[1] + r - Math.abs(lz);
      if (px < pz) lx = Math.sign(lx || 1) * (zn.half[0] + r); else lz = Math.sign(lz || 1) * (zn.half[1] + r);
      x = zn.c[0] + lx * cs - lz * sn; z = zn.c[1] + lx * sn + lz * cs;
    }
  }
  return [x, p[1], z];
}

// ---------------------------------------------------------------------------------------------------------------
// Entering a car (beats from the vehicle-animation reference: door open by the handle, duck to clear the frame, pivot + lower into
// the seat and settle, reach back for the inner handle and pull the door shut). The reference gives NO durations: ours are estimates.
// Returns the timeline plus the `allow` window for the car's keep-out zone (only while the door is open and the character is entering).
export interface CarEntry {
  start: number; // seconds when the walk arrives at the door stand point
  door: V3; // stand point outside the door (ON the zone's edge, character faces the car)
  seat: V3; // seat position inside the car (character card sits inside the solid car, the body occludes the lower half)
  zone: string; // name of the car zone
  doorMax?: number; // door angle at full open (rad, default 1.15)
}
export interface CarEntryState {
  pos: V3;
  doorOpen: number; // pass to <Vehicle doorOpen>
  turn: number; // -1..1 head/body turn toward the seat
  crouch: number; // 0..1: add body.dy = crouch * 150 and lean, bend the knees (feet stay planted until the character leaves the ground)
  seated: boolean;
  reach: 'outer' | 'inner' | null; // hand goes to the outer door handle while the door opens, back to the inner handle while it closes
  duck: number; // 0..1 head and torso dip to clear the door frame while lowering (add to nod / body.lean)
  phase: 'arrive' | 'open' | 'turn' | 'lower' | 'in' | 'close' | 'done';
}
export function carEntry(e: CarEntry): {at: (t: number) => CarEntryState; allow: Allow; end: number} {
  const D = {open: 0.7, turn: 0.45, lower: 0.6, inn: 0.7, close: 0.6};
  if (D.open < MIN_SEC.doorOpen || D.lower < MIN_SEC.lower || D.turn < MIN_SEC.turn) throw new Error('[motion] car entry durations below minimums');
  const tOpen = e.start, tTurn = tOpen + D.open, tLower = tTurn + D.turn, tIn = tLower + D.lower, tClose = tIn + D.inn, end = tClose + D.close;
  const dm = e.doorMax ?? 1.15;
  const at = (t: number): CarEntryState => {
    const doorOpen = t < tOpen ? 0 : t < tTurn ? dm * easeInOut((t - tOpen) / D.open) : t < tClose ? dm : dm * (1 - easeInOut((t - tClose) / D.close));
    const turn = t < tTurn ? 0 : Math.min(1, easeInOut((t - tTurn) / D.turn));
    const crouch = t < tLower ? 0 : t < tIn ? easeInOut((t - tLower) / D.lower) : 1;
    const k = t < tIn ? 0 : easeInOut((t - tIn) / D.inn);
    const pos: V3 = [e.door[0] + (e.seat[0] - e.door[0]) * k, e.door[1] + (e.seat[1] - e.door[1]) * k, e.door[2] + (e.seat[2] - e.door[2]) * k];
    const phase: CarEntryState['phase'] = t < tOpen ? 'arrive' : t < tTurn ? 'open' : t < tLower ? 'turn' : t < tIn ? 'lower' : t < tClose ? 'in' : t < end ? 'close' : 'done';
    const duck = t < tTurn ? 0 : t < tIn ? easeInOut((t - tTurn) / (D.turn + D.lower)) : t < tClose ? 1 - 0.7 * easeInOut((t - tIn) / D.inn) : 0.3 * (1 - easeInOut((t - tClose) / D.close));
    const reach: CarEntryState['reach'] = t >= tOpen && t < tOpen + D.open * 0.8 ? 'outer' : t >= tClose && t < end ? 'inner' : null;
    return {pos, doorOpen, turn, crouch, seated: t >= tClose, reach, duck, phase};
  };
  return {at, allow: {zone: e.zone, from: tIn, to: end + 10}, end};
}

/** Legs vs seat (v8): the world positions of every knee and foot of a seated card (card plane at p, scale s, rotated up to +-yawMax toward the camera)
 *  must stay outside the seat zone (a box footprint with a cushion top height). Throws with the first offender. */
export function assertLegsClear(label: string, pose: Pick<ManPose, 'feet' | 'knees'>, p: V3, s: number, seat: Zone, top: number, yawMax = 0.8): void {
  const k = METERS_PER_PX * s;
  const pts: [string, [number, number]][] = [];
  pose.feet?.forEach((f, i) => pts.push([`foot${i}`, [f[0], f[1]]]));
  pose.knees?.forEach((n, i) => n && pts.push([`knee${i}`, [n[0], n[1]]]));
  for (const yaw of [-yawMax, 0, yawMax]) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (const [name, [cx, cy]] of pts) {
      const lx = (cx - 300) * k, h = (SOLE_Y - cy) * k;
      const wx = p[0] + lx * cs, wz = p[2] - lx * sn;
      if (h < top && inside(seat, wx, wz, 0.0)) throw new Error(`[collide] ${label}: ${name} is inside the seat at card yaw ${yaw.toFixed(2)} (x ${wx.toFixed(2)}, z ${wz.toFixed(2)}, height ${h.toFixed(2)} m)`);
    }
  }
}
