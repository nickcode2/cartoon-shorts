// QA GATE (kit default 2026-11-16): checks every shot automatically (math, no GPU) at 5 sample times plus a dense scan every 3 frames for occlusion / geometry.
// Use: runQA(entries) -> {lines, fails}. In Studio open any composition with ?qa=1 and read the console ("[qa] PASS|FAIL ..."); ?qa=sheet draws the contact sheets.
import {CENTER_BOX, SAFE_BOX, toScreen} from './camera';
import * as THREE from 'three';
import {Pose, V3} from './kit';
import {SHOP_LAMPS, shopInside} from '../shop/solids';
import {cameraActivity} from './camActivity';
import type {Channel} from './channel';
export {cameraActivity, planTakes, pickAngles, takeActivity, STILL_MAX_S, TAKE_MAX_S} from './camActivity';

export interface QASnake {x: number; z: number; vx?: number; vz?: number; yaw?: number; target?: [number, number]; die?: number; t0?: number; head0?: number}
export interface QAEntry {
  id: string; set: string; ang: string; kind: 'wide' | 'medium' | 'close' | 'insert'; n: number;
  cam: (f: number, n: number) => Pose; base?: (f: number, n: number) => Pose; endAt?: number; sCurve?: boolean;
  focus: (f: number) => V3; box: [number, number, number]; h: number; fr: number; axis?: 'y' | 'z';
  snakes?: QAEntry['snakeSpec'][]; snakeSpec?: QASnake; yawOf?: (s: QASnake) => number; headGap?: number;
  heroFlat?: string[]; hideable?: Aabb[]; doorZ?: number; sampleSnakes?: QASnake[]; snakeIssues?: string[]; keys?: {name: string; at: (f: number) => V3; r: number; f: number[]}[];
}
export interface Aabb {min: V3; max: V3; name: string}
const box = (name: string, c: V3, h: V3): Aabb => ({name, min: [c[0] - h[0], c[1] - h[1], c[2] - h[2]], max: [c[0] + h[0], c[1] + h[1], c[2] + h[2]]});
/** Fixed scene occluders per set (thin things the camera could end up behind). */
export const OCCLUDERS: Record<string, Aabb[]> = {
  street: [10, 2, -6, -14, -22].flatMap((z) => [box('lamp pole', [-2.35, 1.7, z], [0.07, 1.7, 0.07]), box('lamp pole', [2.35, 1.7, z - 4], [0.07, 1.7, 0.07])]),
  office: [box('ceiling fan', [0, 2.9, -0.6], [0.65, 0.08, 0.65]), box('fan rod', [0, 3.15, -0.6], [0.04, 0.25, 0.04])],
  garage: [box('bulb', [0.6, 2.45, -1.2], [0.12, 0.14, 0.12]), box('bulb cord', [0.6, 2.9, -1.2], [0.02, 0.4, 0.02]), box('ceiling light', [-1.8, 3.1, -2.2], [0.1, 0.06, 1.2]), box('ceiling light', [1.8, 3.1, -2.2], [0.1, 0.06, 1.2])],
};
for (const z of ['aisle', 'register', 'entrance']) OCCLUDERS[z] = SHOP_LAMPS.map((l) => box(l.name, l.c, l.h)); // SHOPPING_CART hall zones
export const HIDEABLE = new Set(['ceiling fan', 'fan rod']); // the runtime hides these when they block the focus (Office `fan` prop)
const segHitsAabb = (a: V3, b: V3, bx: Aabb): boolean => { let t0 = 0, t1 = 1; for (let i = 0; i < 3; i++) { const d = b[i] - a[i]; if (Math.abs(d) < 1e-9) { if (a[i] < bx.min[i] || a[i] > bx.max[i]) return false; } else { let u0 = (bx.min[i] - a[i]) / d, u1 = (bx.max[i] - a[i]) / d; if (u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) return false; } } return true; };
export const blockedBy = (cam: V3, focus: V3, set: string): Aabb[] => (OCCLUDERS[set] ?? []).filter((o) => segHitsAabb(cam, focus, o));
/** Per-set geometry checks registered by a video (zone name -> reason or ''). Used by ZUMBIS_PARTE_10; the older sets keep their built-in rules. */
export const EXTRA_INSIDE: Record<string, (p: V3, id: string) => string> = {};
/** Is the camera inside (or beyond a wall of) the set geometry? Returns a reason or ''. */
export function insideGeometry(set: string, p: V3, id: string): string {
  if (EXTRA_INSIDE[set]) return EXTRA_INSIDE[set](p, id);
  if (set === 'aisle' || set === 'register' || set === 'entrance') return shopInside(p);
  const [x, y, z] = p;
  if (y < 0.04) return 'below the floor';
  if (set === 'street') { const cross = z < -6.4 && z > -9.9; if (!cross && Math.abs(x) > 2.8 && y < 7.2) return 'inside a building'; if (z < -34) return 'inside the end building'; }
  if (set === 'office') { if (y > 3.35) return 'above the ceiling'; if (Math.abs(x) > 3.95 || z < -3.1) return 'in a wall'; }
  if (set === 'garage') {
    const outside = z > 2.05; // outside the door wall (exterior shots)
    if (!outside) { if (y > 3.2) return 'above the garage ceiling'; if (Math.abs(x) > 3.95 || z < -6) return 'in a wall'; if (z > 1.65 && (Math.abs(x) > 1.9 || y > 2.8)) return 'in the door wall'; }
    else if (Math.abs(x) > 4.0 && z < 4.05 && y < 4.4) return 'inside a neighbour building';
  }
  void id; return '';
}
export function runQA(entries: QAEntry[], seq: {id: string; set: string; ang: string}[] = entries): {lines: string[]; fails: string[]; camTable: string[]} {
  const lines: string[] = [], fails: string[] = [];
  const out = (ok: boolean, name: string, msg = '') => { const l = `${ok ? 'PASS' : 'FAIL'} ${name}${msg ? ' ' + msg : ''}`; lines.push(l); if (!ok) fails.push(l); };
  const keyBad: string[] = [], safeBad: string[] = [], sizes: string[] = [], centerOK: string[] = [], boxBad: string[] = [], occBad: string[] = [], insideBad: string[] = [], moveBad: string[] = [], easeBad: string[] = [], snakeBad: string[] = [], flat: string[] = [];
  for (const e of entries) {
    const n = e.n, samples = [0, 0.25, 0.5, 0.75, 1].map((q) => Math.round(q * (n - 1)));
    for (const f of samples) {
      const c = e.cam(f, n), fc = e.focus(f), s = toScreen(c, fc), nx = s.x / 1080, ny = s.y / 1920;
      if (s.depth > 0 && !(nx >= SAFE_BOX.x0 && nx <= SAFE_BOX.x1 && ny >= SAFE_BOX.y0 && ny <= SAFE_BOX.y1)) safeBad.push(`${e.id}@${f} focus centre (${nx.toFixed(2)},${ny.toFixed(2)})`);
      if (!(nx >= CENTER_BOX.x0 && nx <= CENTER_BOX.x1 && ny >= CENTER_BOX.y0 && ny <= CENTER_BOX.y1 && s.depth > 0)) centerOK.push(`${e.id}@${f} (${nx.toFixed(2)},${ny.toFixed(2)})`);
      { // SIZE BAND (v4): focus height as a fraction of the frame height; head inside the frame in medium / wide
        const up: V3 = e.axis === 'z' ? [0, 0, e.h / 2] : [0, e.h / 2, 0], a1 = toScreen(c, [fc[0] - up[0], fc[1] - up[1], fc[2] - up[2]]), a2 = toScreen(c, [fc[0] + up[0], fc[1] + up[1], fc[2] + up[2]]), frac = Math.abs(a1.y - a2.y) / 1920;
        sizes.push(`${e.id}@${f} ${(frac * 100).toFixed(0)}%`);
        const lo = e.kind === 'close' ? 0.55 : e.kind === 'medium' ? 0.35 : 0, hi = e.kind === 'wide' ? 0.4 : 1.2;
        if (frac < lo || frac > hi) boxBad.push(`${e.id}@${f} ${e.kind} ${(frac * 100).toFixed(0)}%`);
        const top = a1.y < a2.y ? a1 : a2; if (e.kind !== 'close' && e.axis !== 'z' && (top.y < 0.02 * 1920 || top.y > 0.98 * 1920 || top.x < 0 || top.x > 1080)) boxBad.push(`${e.id}@${f} head outside the frame`);
      }
    }
    for (const k of e.keys ?? []) for (const f of k.f) { // the narrated object must be FULLY inside the frame at its key moment (sphere of radius r, 3 % margin)
      const c = e.cam(Math.min(f, n - 1), n), p = k.at(f), q = toScreen(c, p), qx = toScreen(c, [p[0] + k.r, p[1], p[2]]), px = Math.hypot(qx.x - q.x, qx.y - q.y) || 0, rr = Math.max(px, Math.abs(toScreen(c, [p[0], p[1] + k.r, p[2]]).y - q.y));
      if (q.depth > 0 && (q.x - rr < SAFE_BOX.x0 * 1080 || q.x + rr > SAFE_BOX.x1 * 1080 || q.y - rr < SAFE_BOX.y0 * 1920 || q.y + rr > SAFE_BOX.y1 * 1920)) safeBad.push(`${e.id}@${f} ${k.name} outside the platform safe zone (centre ${(q.x / 10.8).toFixed(0)} %, ${(q.y / 19.2).toFixed(0)} %, r ${(rr / 10.8).toFixed(0)} %)`);
      if (!(q.depth > 0) || q.x - rr < 0.03 * 1080 || q.x + rr > 0.97 * 1080 || q.y - rr < 0.03 * 1920 || q.y + rr > 0.97 * 1920) keyBad.push(`${e.id}@${f} ${k.name} cut by the frame (centre ${(q.x / 10.8).toFixed(0)} %, ${(q.y / 19.2).toFixed(0)} %, r ${(rr / 10.8).toFixed(0)} %)`);
    }
    let blockedFrames = 0, run = 0, worst = 0, insideReason = '';
    for (let f = 0; f < n; f += 3) {
      const c = e.cam(f, n), fc = e.focus(f), hit = blockedBy(c.p, fc, e.set).filter((o) => !HIDEABLE.has(o.name) || e.set !== 'office');
      if (hit.length) { blockedFrames += 3; run += 3; worst = Math.max(worst, run); } else run = 0;
      const why = insideGeometry(e.set, c.p, e.id); if (why && !insideReason) insideReason = `${why}@${f}`;
    }
    if (worst > 9) occBad.push(`${e.id}: blocked ${(worst / 30).toFixed(2)} s`);
    if (insideReason) insideBad.push(`${e.id}: ${insideReason}`);
    const a = e.cam(0, n), b = e.cam(n - 1, n), moved = Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]) + Math.hypot(a.l[0] - b.l[0], a.l[1] - b.l[1], a.l[2] - b.l[2]);
    if (moved < 0.08 && !(e.base && Math.abs((e.base(n - 1, n).roll ?? 0) - (e.base(0, n).roll ?? 0)) > 1)) moveBad.push(`${e.id}: moved ${moved.toFixed(3)} m`);
    if (e.base && e.sCurve !== false) { // S-curve: after 25 % of the move less than 20 % of the travel, after 75 % more than 80 %
      const m = (q: number) => e.base!(Math.round(q * (n - 1) * (e.endAt ?? 1)), n), p0 = m(0), p1 = m(1), tot = Math.hypot(p1.p[0] - p0.p[0], p1.p[1] - p0.p[1], p1.p[2] - p0.p[2]) + Math.abs((p1.roll ?? 0) - (p0.roll ?? 0)) * 0.05;
      if (tot > 0.05) { const r = (q: number) => { const pq = m(q); return (Math.hypot(pq.p[0] - p0.p[0], pq.p[1] - p0.p[1], pq.p[2] - p0.p[2]) + Math.abs((pq.roll ?? 0) - (p0.roll ?? 0)) * 0.05) / tot; }; const r25 = r(0.25), r75 = r(0.75); if (!(r25 < 0.2 && r75 > 0.8)) easeBad.push(`${e.id}: ${r25.toFixed(2)} / ${r75.toFixed(2)}`); }
    }
    for (const sn of e.sampleSnakes ?? []) {
      const sp = Math.hypot(sn.vx ?? 0, sn.vz ?? 0), yaw = e.yawOf ? e.yawOf(sn) : sn.yaw ?? 0;
      if (sp > 0) { const dot = ((sn.vx ?? 0) * Math.cos(yaw) + (sn.vz ?? 0) * -Math.sin(yaw)) / sp; if (dot <= 0.7) snakeBad.push(`${e.id}: head.velocity ${dot.toFixed(2)}`); }
      if (e.doorZ !== undefined && sn.head0 !== undefined && sn.head0 >= e.doorZ) snakeBad.push(`${e.id}: starts outside the door (head z ${sn.head0.toFixed(2)})`);
    }
    for (const m of e.snakeIssues ?? []) snakeBad.push(`${e.id}: ${m}`);
    if (e.headGap !== undefined && e.headGap > 0.01) snakeBad.push(`${e.id}: head gap ${e.headGap}`);
    for (const h of e.heroFlat ?? []) flat.push(`${e.id}: ${h}`);
  }
  const uses: Record<string, Record<string, number>> = {}, prev: Record<string, string> = {}, angBad: string[] = [];
  for (const q of seq) { const u = (uses[q.set] ??= {}); u[q.ang] = (u[q.ang] ?? 0) + 1; if (prev[q.set] === q.ang) angBad.push(`${q.set}: ${q.id} repeats ${q.ang}`); prev[q.set] = q.ang; }
  for (const [set, u] of Object.entries(uses)) { for (const [a, k] of Object.entries(u)) if (k > 2) angBad.push(`${set}: angle ${a} used ${k} times`); if (Object.keys(u).length > 6) angBad.push(`${set}: ${Object.keys(u).length} named angles`); }
  out(centerOK.length === 0, 'focus centre inside CENTER_BOX (5 samples/shot)', centerOK.slice(0, 6).join('; '));
  const wideN = entries.filter((e) => e.kind === 'wide').length;
  out(boxBad.length === 0 && wideN <= Math.floor(entries.length / 4), `shot size bands (close >= 55 %, medium >= 35 %, wide <= 40 % of frame height; head in frame); wide shots ${wideN} of ${entries.length} (max 1 in 4)`, boxBad.slice(0, 8).join('; '));
  out(occBad.length === 0, 'focus not occluded > 0.3 s (fan auto-hidden)', occBad.join('; '));
  out(insideBad.length === 0, 'camera never inside geometry', insideBad.join('; '));
  out(angBad.length === 0, 'no repeated angle in a row, none used > 2 times, <= 6 per set', angBad.join('; '));
  out(snakeBad.length === 0, 'snakes: head = first rings of the tube, head leads (dot > 0.7), rings on the head path (< 5 % of the length), emerge from inside', snakeBad.join('; '));
  out(moveBad.length === 0, 'camera moves between first and last sample', moveBad.join('; '));
  out(easeBad.length === 0, 'move easing is an S-curve (<20 % at 25 %, >80 % at 75 %)', easeBad.join('; '));
  out(safeBad.length === 0, 'platform safe zone (10 % top, 20 % bottom, 12 % sides): focus centre and narrated objects inside', safeBad.slice(0, 8).join('; '));
  out(keyBad.length === 0, 'narrated object / action fully visible at its key moment', keyBad.slice(0, 8).join('; '));
  out(flat.length === 0, 'no hero object is a flat card', flat.join('; '));
  { // KIT RULES v9 rule 1: the camera never sits still for long (still <= 3 s, no take > 5 s, takes > 3 s keep a continuous S-curve move). Old videos (built before 2026-11-17) will report FAIL here: they are not re-rendered.
    const ca = cameraActivity(entries.map((e) => ({id: e.id, n: e.n, cam: e.cam})));
    ca.lines.forEach((l) => { lines.push(l); }); fails.push(...ca.lines.filter((l) => l.startsWith('FAIL')));
    (globalThis as unknown as {__camTable?: string[]}).__camTable = ca.table; if (typeof console !== 'undefined') console.info('[qa-camera]\n' + ca.table.join('\n'));
    return {lines, fails, camTable: ca.table};
  }
}

/** CLUTTER CHECK (kit rule): number of small LOOSE objects lying on the floor (radius < 0.2 m, centre below 0.2 m) in a scene group. Characters (limb tubes) and snakes are marked `userData.noClutter` and skipped.
 *  Fail when a shot has more than 15. Never add random clutter just to pass the flat-area check: change the framing, add a designed texture / gradient, or add a purposeful prop. */
export function looseFloorObjects(root: THREE.Object3D): number {
  let n = 0; const sph = new THREE.Sphere(), m4 = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion();
  const walk = (o: THREE.Object3D) => {
    if (o.userData.noClutter) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
      if (mat && mat.side !== THREE.BackSide) {
        if ((m as THREE.InstancedMesh).isInstancedMesh) { const im = m as THREE.InstancedMesh; im.geometry.computeBoundingSphere(); const r0 = im.geometry.boundingSphere!.radius; for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m4); m4.premultiply(im.matrixWorld); m4.decompose(p, q, sc); if (p.y < 0.2 && r0 * Math.max(sc.x, sc.y, sc.z) < 0.2 && sc.x + sc.y + sc.z > 0.001) n++; } }
        else { m.geometry.computeBoundingSphere(); sph.copy(m.geometry.boundingSphere!).applyMatrix4(m.matrixWorld); if (sph.center.y < 0.2 && sph.radius < 0.2 && sph.radius > 0.004) n++; }
      }
    }
    o.children.forEach(walk);
  };
  walk(root); return n;
}


/** RELIEF SHADOW CHECK (kit QA 2026-11-17): the relief colour must be a dark, translucent near-black (not light) and the head crescent must land on the LOWER RIGHT: draws a test head on a canvas and compares the lower-right and upper-left luminance. */
import {RELIEF_COLOR, build, drawHead} from './rickRig';
export function runReliefCheck(): string[] {
  const out: string[] = [], m = RELIEF_COLOR.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
  if (!m) return ['FAIL relief colour is not rgba()'];
  const lum = (+m[1] * 0.3 + +m[2] * 0.59 + +m[3] * 0.11), a = +m[4];
  out.push(`${lum < 60 && a >= 0.22 && a <= 0.38 ? 'PASS' : 'FAIL'} relief colour is dark and translucent (luminance ${lum.toFixed(0)}, alpha ${a})`);
  try {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400; const c = cv.getContext('2d', {willReadFrequently: true})!; c.translate(200, 200); const kind = 'c21' as const, b = build(kind); drawHead(c, kind, 'deadpan', 0, []);
    const px = (x: number, y: number) => { const d = c.getImageData(200 + x, 200 + y, 1, 1).data; return d[0] * 0.3 + d[1] * 0.59 + d[2] * 0.11; };
    const lr = px(0.62 * b.rx, 0.55 * b.ry * 0.9), ul = px(-0.5 * b.rx, -0.62 * b.ry);
    out.push(`${lr < ul - 10 ? 'PASS' : 'FAIL'} relief shadow is on the lower right (lower-right luminance ${lr.toFixed(0)} vs upper-left ${ul.toFixed(0)}; no light crescent)`);
  } catch (e) { out.push(`FAIL relief pixel test threw ${String(e)}`); }
  return out;
}

/** GENERIC COLLISION QA (kit default, round 3). Works on a built scene group. Producers tag groups with userData:
 *  qaBody {role, axis [x, z], r, top}   a character (vertical cylinder around the body axis; arms and the hand grips are not part of it),
 *  qaBox {name, c, h}                    a prop box in its own local frame (centre c, half extents h): carts, hand baskets, props,
 *  qaHead {role, hats, r, top}           a head pivot (hats = number of hat meshes on that head).
 *  Checks: (1) box vs body cylinder, (2) box vs box, (3) exactly one head and at most one hat per character, (4) head vs head of different characters (3D). Penetration deeper than TOL fails.
 *  Fix by repositioning, offsetting, trimming or the rig separation step (HeldBasket), never by hiding. */
export const COLLIDE_TOL = 0.015;
export function collisionCheck(group: THREE.Object3D): string[] {
  group.updateWorldMatrix(true, true);
  const bodies: {o: THREE.Object3D; role: string; x: number; z: number; r: number; top: number; heads: number; hats: number}[] = [], boxes: {o: THREE.Object3D; name: string; c: THREE.Vector3; h: THREE.Vector3}[] = [], heads: {o: THREE.Object3D; role: string; w: THREE.Vector3; r: number; hats: number; owner: number}[] = [];
  group.traverse((o) => { const u = o.userData; if (u.qaBody) bodies.push({o, role: u.qaBody.role, x: u.qaBody.axis[0], z: u.qaBody.axis[1], r: u.qaBody.r, top: u.qaBody.top, heads: 0, hats: 0}); if (u.qaBox) boxes.push({o, name: u.qaBox.name, c: new THREE.Vector3(...(u.qaBox.c as [number, number, number])), h: new THREE.Vector3(...(u.qaBox.h as [number, number, number]))}); });
  bodies.forEach((b, bi) => b.o.traverse((o) => { if (o.userData.qaHead) { const q = o.userData.qaHead; b.heads++; b.hats += q.hats; const w = new THREE.Vector3(); o.getWorldPosition(w); heads.push({o, role: b.role, w: w.add(new THREE.Vector3(0, q.top * 0.0, 0)), r: q.r, hats: q.hats, owner: bi}); } }));
  const out: string[] = [];
  bodies.forEach((b) => { if (b.heads !== 1 || b.hats > 1) out.push(`${b.role}: ${b.heads} heads, ${b.hats} hats (must be exactly one head, at most one hat)`); });
  const rect = (bx: typeof boxes[number]) => { const m = bx.o.matrixWorld, e = m.elements; return {cx: bx.c.clone().applyMatrix4(m), ax: new THREE.Vector2(e[0], e[2]).normalize(), az: new THREE.Vector2(e[8], e[10]).normalize(), hx: bx.h.x * Math.hypot(e[0], e[2]), hz: bx.h.z * Math.hypot(e[8], e[10]), y0: bx.c.clone().applyMatrix4(m).y - bx.h.y, y1: bx.c.clone().applyMatrix4(m).y + bx.h.y}; };
  const rects = boxes.map(rect);
  boxes.forEach((bx, i) => { const R = rects[i]; bodies.forEach((b) => { if (R.y1 < 0.05 || R.y0 > b.top) return; const dx = b.x - R.cx.x, dz = b.z - R.cx.z, lx = dx * R.ax.x + dz * R.ax.y, lz = dx * R.az.x + dz * R.az.y, ex = Math.max(0, Math.abs(lx) - R.hx), ez = Math.max(0, Math.abs(lz) - R.hz), d = Math.hypot(ex, ez), inside = Math.abs(lx) < R.hx && Math.abs(lz) < R.hz, pen = inside ? b.r + Math.min(R.hx - Math.abs(lx), R.hz - Math.abs(lz)) : b.r - d; if (pen > COLLIDE_TOL) out.push(`${bx.name} / ${b.role} body: ${(pen * 100).toFixed(1)} cm deep (box centre ${R.cx.x.toFixed(2)}, ${R.cx.z.toFixed(2)}; body axis ${b.x.toFixed(2)}, ${b.z.toFixed(2)}; local ${lx.toFixed(2)}, ${lz.toFixed(2)} of half ${R.hx.toFixed(2)}, ${R.hz.toFixed(2)})`); }); });
  const sat = (A: ReturnType<typeof rect>, B: ReturnType<typeof rect>) => { let minPen = 1e9; for (const ax of [A.ax, A.az, B.ax, B.az]) { const dx = B.cx.x - A.cx.x, dz = B.cx.z - A.cx.z, d = Math.abs(dx * ax.x + dz * ax.y), ra = A.hx * Math.abs(A.ax.dot(ax)) + A.hz * Math.abs(A.az.dot(ax)), rb = B.hx * Math.abs(B.ax.dot(ax)) + B.hz * Math.abs(B.az.dot(ax)); minPen = Math.min(minPen, ra + rb - d); if (ra + rb - d <= 0) return 0; } return minPen; };
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const A = rects[i], B = rects[j]; if (A.y1 < B.y0 || B.y1 < A.y0) continue; const pen = sat(A, B); if (pen > COLLIDE_TOL) out.push(`${boxes[i].name} / ${boxes[j].name}: ${(pen * 100).toFixed(1)} cm deep`); }
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) { const A = bodies[i], B = bodies[j], pen = A.r + B.r - Math.hypot(A.x - B.x, A.z - B.z); if (pen > COLLIDE_TOL) out.push(`${A.role} body / ${B.role} body: ${(pen * 100).toFixed(1)} cm deep`); }
  for (let i = 0; i < heads.length; i++) for (let j = i + 1; j < heads.length; j++) { if (heads[i].owner === heads[j].owner) continue; const d = heads[i].w.distanceTo(heads[j].w), pen = (heads[i].r + heads[j].r) * 0.5 - d; if (pen > COLLIDE_TOL) out.push(`head ${heads[i].role} / head ${heads[j].role}: ${(pen * 100).toFixed(1)} cm deep`); }
  return out;
}
/** SCREEN OVERLAP OF HEADWEAR (kit QA): in the frame of `cam` a hat-wearing head that is farther away than another head must not overlap that nearer head disc (a background hat peeking out of a foreground head reads as a second hat on it). */
export function headOverlapCheck(group: THREE.Object3D, cam: THREE.PerspectiveCamera): string[] {
  group.updateWorldMatrix(true, true); cam.updateMatrixWorld(); const hs: {role: string; ndc: THREE.Vector2; rs: number; z: number; hats: number}[] = [], out: string[] = [];
  group.traverse((o) => { const q = o.userData.qaHead; if (!q) return; const w = new THREE.Vector3(); o.getWorldPosition(w); w.y += q.top * 0.15; const dist = w.distanceTo(cam.position), pr = w.clone().project(cam), f = 1 / Math.tan((cam.fov * Math.PI) / 360); hs.push({role: ((): string => { let q2: THREE.Object3D | null = o; while (q2 && !q2.userData.qaBody) q2 = q2.parent; return (q2?.userData.qaBody?.role ?? '?') as string; })(), ndc: new THREE.Vector2(pr.x * cam.aspect, pr.y), rs: (q.r * 0.8 / dist) * f, z: dist, hats: q.hats}); });
  for (let i = 0; i < hs.length; i++) for (let j = 0; j < hs.length; j++) { if (i === j) continue; const A = hs[i], B = hs[j]; if (B.z <= A.z + 0.1 || !B.hats || A.rs < 0.045) continue; /* heads under 4.5 % of the frame height (far figures of a wide shot) read as dots and are exempt */ if (A.ndc.distanceTo(B.ndc) < A.rs + B.rs * 0.6 && Math.abs(A.z - B.z) < 6) out.push(`hat of ${B.role} (${B.z.toFixed(1)} m) overlaps the head of ${A.role} (${A.z.toFixed(1)} m) on screen`); }
  return out;
}

/** HELD-PROP FRAMING (kit QA, round 3): a cart that somebody pushes (a body within 1.1 m of its handle bar) must have BOTH grip anchors (the hands) inside 3..97 % of the frame and at least 75 % of its basket / handle corners inside (the wheels and lower rack may leave the frame); with several pushers only the nearest cart must be framed completely, the others need both hands in frame, so a pushing shot never shows empty hands or a cart cut off by the frame.
 *  A hand basket carried by a body must have its centre inside the frame when its carrier's head is inside the frame. */
export function heldFramingCheck(group: THREE.Object3D, cam: THREE.PerspectiveCamera): string[] {
  group.updateWorldMatrix(true, true); cam.updateMatrixWorld(); const out: string[] = [], bodies: {x: number; z: number; role: string; o: THREE.Object3D}[] = [], carts: THREE.Object3D[] = [], baskets: THREE.Object3D[] = [];
  group.traverse((o) => { if (o.userData.qaBody) bodies.push({x: o.userData.qaBody.axis[0], z: o.userData.qaBody.axis[1], role: o.userData.qaBody.role, o}); if (o.userData.qaBox?.name === 'cart') carts.push(o); if (o.userData.qaBox?.name === 'basket') baskets.push(o); });
  const inF = (w: THREE.Vector3, m = 0.03) => { const p = w.clone().project(cam); return p.z < 1 && Math.abs(p.x) <= 1 - 2 * m && Math.abs(p.y) <= 1 - 2 * m; };
  for (const c of carts) {
    const bar = new THREE.Vector3(0, 0.99, 0.6).applyMatrix4(c.matrixWorld); if (!bodies.some((b) => Math.hypot(b.x - bar.x, b.z - bar.z) < 1.1)) continue;
    const grips = [-0.2, 0.2].map((x) => new THREE.Vector3(x, 0.99, 0.6).applyMatrix4(c.matrixWorld)), corners: THREE.Vector3[] = []; for (const sx of [-1, 1]) for (const sy of [0.45, 0.99]) for (const sz of [-0.46, 0.6]) corners.push(new THREE.Vector3(sx * 0.3, sy, sz).applyMatrix4(c.matrixWorld));
    const gi = grips.filter((g) => inF(g)).length, ci = corners.filter((q) => inF(q, 0)).length;
    const nearest = carts.filter((k) => bodies.some((b) => Math.hypot(b.x - bar.x, b.z - bar.z) < 1.1)).reduce((m, k) => (k.getWorldPosition(new THREE.Vector3()).distanceTo(cam.position) < m.d ? {k, d: k.getWorldPosition(new THREE.Vector3()).distanceTo(cam.position)} : m), {k: c, d: 1e9}).k; /* with several pushers only the nearest cart must be fully framed, the others need their hands (grips) in frame */
    if (gi < 2 || (c === nearest && ci < 6)) out.push(`pushed cart: ${gi}/2 hands (grips) and ${ci}/8 cart corners inside the frame`);
  }
  for (const k of baskets) { const w = new THREE.Vector3(0, 0.11, 0).applyMatrix4(k.matrixWorld); const near = bodies.find((b) => Math.hypot(b.x - w.x, b.z - w.z) < 0.6); if (!near) continue; const head = new THREE.Vector3(near.x, 1.5, near.z); if (inF(head, 0) && !inF(w, 0)) out.push(`carried basket of ${near.role} is outside the frame while the carrier is in it`); }
  return out;
}


/** BRIGHTNESS CHECK (kit QA, KIT RULES v9 rule 2, channels with a `brightness` block, FocoProibido): mean luminance of every shot at least `minFactor` x the old baseline, and no large near-black areas.
 *  Input = RGBA pixels of one drawn frame / cell. `blocks` = an 8 x 8 grid; a block is "near-black" when more than 60 % of its pixels have luminance below `nearBlack`. */
export interface BrightStat {lum: number; nearBlackShare: number; worstBlock: number; blocksBlack: number}
export function brightnessStat(d: Uint8ClampedArray, w: number, h: number, nearBlack = 0.07): BrightStat {
  const G = 8, cnt = new Array(G * G).fill(0), blk = new Array(G * G).fill(0); let lum = 0, n = 0, nb = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const q = (y * w + x) * 4, l = (0.2126 * d[q] + 0.7152 * d[q + 1] + 0.0722 * d[q + 2]) / 255, gi = Math.min(G - 1, Math.floor((y / h) * G)) * G + Math.min(G - 1, Math.floor((x / w) * G)); lum += l; n++; cnt[gi]++; if (l < nearBlack) { nb++; blk[gi]++; } }
  let worst = 0, bb = 0; for (let i = 0; i < G * G; i++) { const f = cnt[i] ? blk[i] / cnt[i] : 0; worst = Math.max(worst, f); if (f > 0.6) bb++; }
  return {lum: lum / (n || 1), nearBlackShare: nb / (n || 1), worstBlock: worst, blocksBlack: bb};
}
export function brightnessLines(stats: {id: string; stat: BrightStat}[], ch: Channel): {lines: string[]; fails: string[]; table: string[]} {
  const b = ch.brightness; if (!b) return {lines: [], fails: [], table: []};
  const need = b.baselineLum * b.minFactor, low = stats.filter((s) => s.stat.lum < need), black = stats.filter((s) => s.stat.blocksBlack > 0 || s.stat.nearBlackShare > b.nearBlackMax), mean = stats.reduce((a, s) => a + s.stat.lum, 0) / (stats.length || 1);
  const lines = [
    `${low.length === 0 ? 'PASS' : 'FAIL'} brightness: every shot mean luminance >= ${b.minFactor} x old baseline ${b.baselineLum} = ${need.toFixed(3)} (mean of all ${mean.toFixed(3)})${low.length ? ' ' + low.slice(0, 6).map((s) => `${s.id} ${s.stat.lum.toFixed(3)}`).join('; ') : ''}`,
    `${black.length === 0 ? 'PASS' : 'FAIL'} brightness: no large near-black areas (near-black share <= ${(b.nearBlackMax * 100).toFixed(0)} %, no 1/8 x 1/8 block more than 60 % near-black)${black.length ? ' ' + black.slice(0, 6).map((s) => `${s.id} ${(s.stat.nearBlackShare * 100).toFixed(1)} % / ${s.stat.blocksBlack} blocks`).join('; ') : ''}`,
  ];
  return {lines, fails: lines.filter((l) => l.startsWith('FAIL')), table: ['shot | mean luminance | near-black share | black blocks', ...stats.map((s) => `${s.id} | ${s.stat.lum.toFixed(3)} | ${(s.stat.nearBlackShare * 100).toFixed(1)} % | ${s.stat.blocksBlack}`)]};
}
export {headMotionAudit, headSampleOf, motionReport, HEAD_SAMPLE_STEP} from './headgear';
export type {HeadSample} from './headgear';

/** CONNECTIVITY CHECK (kit rule, every hero object: vehicles, ships, helicopters, carts, buildings, furniture): each part's box must touch or overlap the box of the part it is attached to
 *  (gap <= tol). `parts` = {name, c (centre), h (half size)} in one frame, `edges` = [parent, child]. Returns one line per object; FAIL names every gapped edge and part. */
export function connectivityReport(object: string, parts: {name: string; c: V3; h: V3}[], edges: [string, string][], tol = 0.03): {line: string; ok: boolean} {
  const by = new Map(parts.map((p) => [p.name, p])), bad: string[] = [], linked = new Set<string>();
  for (const [a, b] of edges) { const A = by.get(a), B = by.get(b); if (!A || !B) { bad.push(`${a}-${b} missing`); continue; } linked.add(a); linked.add(b); const gap = Math.max(...[0, 1, 2].map((i) => Math.abs(A.c[i] - B.c[i]) - (A.h[i] + B.h[i]))); if (gap > tol) bad.push(`${a}-${b} gap ${gap.toFixed(2)} m`); }
  for (const p of parts) if (!linked.has(p.name)) bad.push(`${p.name} floating (no parent)`);
  return {ok: bad.length === 0, line: `${bad.length ? 'FAIL' : 'PASS'} connectivity ${object}: ${parts.length} parts, ${edges.length} joints${bad.length ? ' ' + bad.join('; ') : ''}`};
}
/** CONTACT CHECK (kit rule): every character has a contact point at every sampled frame: feet on a surface, hands on an anchor within tol, or a hanging attachment within tol. `d` = worst distance (m) of that contact. */
export function contactLine(name: string, kind: 'feet' | 'hands' | 'hanging', d: number, tol = 0.052): {line: string; ok: boolean} { const ok = d <= tol; return {ok, line: `${ok ? 'PASS' : 'FAIL'} contact ${name} (${kind}): worst ${(d * 100).toFixed(1)} cm`}; }
