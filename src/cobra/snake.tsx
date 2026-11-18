// COBRA snake rig v4 (2026-11-16): ONE continuous mesh per snake. The head is the first rings of the SAME tube (elliptical cross-sections: snout -> wide wedge -> neck -> body -> tapered tail);
// eyes, pupils, tongue (or X eyes when dead) are extra vertices of the same BufferGeometry, anchored to the head rings. Positions are rewritten in place every frame, no allocation.
// LOCOMOTION = path buffer: the head follows its path (straight travel + lateral wiggle) and every body ring is placed where the head WAS (s_i / v seconds earlier): follow-the-leader, the body
// never slides sideways, the tail comes last, never tail-first. Idle = rest curve with slow sway and the head slightly raised. Strike = S-coil, head raised and aimed, then a lunge (body follows,
// weighted toward the head). Dead = limp, straight, X eyes. The inverted-hull ink outline is a second mesh on the same geometry (offset along the normals in the vertex shader).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RAMP, V3} from '../kit/kit';

export type SnakeShape = 'S' | 'tight' | 'coil' | 'limp' | 'up';
export interface SnakeSpec {x: number; z: number; y?: number; yaw?: number; shape?: SnakeShape; dead?: boolean; s?: number; flip?: boolean}
export interface LiveSnake extends SnakeSpec {t0?: number; die?: number; off?: number; vx?: number; vz?: number; wig?: number; ph?: number; target?: [number, number]; strike?: number}
export const MAX_SNAKES = 80, MAX_HI = 60;
export const HEAD_FWD = 0, HEAD_HALF = 0; // the head is part of the tube: no separate head object, no offset
export const snakeYaw = (s: {x: number; z: number; yaw?: number; vx?: number; vz?: number; target?: [number, number]}): number => { const sp = Math.hypot(s.vx ?? 0, s.vz ?? 0); if (sp > 0) return Math.atan2(-(s.vz ?? 0), s.vx ?? 0); if (s.target) return Math.atan2(-(s.target[1] - s.z), s.target[0] - s.x); return s.yaw ?? 0; };

const LEN = 1.1, RB = 0.055;
const curveFor = (shape: SnakeShape): THREE.CatmullRomCurve3 => {
  const pts: THREE.Vector3[] = [], N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    if (shape === 'S') pts.push(new THREE.Vector3((t - 0.5) * LEN, RB, Math.sin(t * Math.PI * 3) * 0.14));
    else if (shape === 'tight') pts.push(new THREE.Vector3((t - 0.5) * LEN * 0.85, RB, Math.sin(t * Math.PI * 4.5) * 0.2));
    else if (shape === 'limp') pts.push(new THREE.Vector3((t - 0.5) * LEN, RB * 0.8, Math.sin(t * Math.PI * 1.1) * 0.08));
    else if (shape === 'coil') { const a = t * Math.PI * 5, r = 0.2 - t * 0.12; pts.push(new THREE.Vector3(Math.cos(a) * r, RB + t * 0.13, Math.sin(a) * r)); }
    else { const u = Math.max(0, (t - 0.4) / 0.6); pts.push(new THREE.Vector3((t - 0.5) * LEN * 0.6 + Math.sin(u * 2.2) * 0.06, RB + Math.pow(u, 1.4) * 0.55, Math.sin(t * Math.PI * 2) * 0.08)); }
  }
  return new THREE.CatmullRomCurve3(pts.reverse()); // index 0 = HEAD end
};
const REST = new Map<string, Float32Array>();
const restPts = (shape: SnakeShape, N: number): Float32Array => { const key = `${shape}|${N}`; let a = REST.get(key); if (!a) { const cv = curveFor(shape), v = new THREE.Vector3(); a = new Float32Array((N + 1) * 3); for (let i = 0; i <= N; i++) { cv.getPointAt(i / N, v); a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; } REST.set(key, a); } return a; };

const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const backOut = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
/** half-width / half-height of the cross-section at distance s (m, unscaled) from the snout: snout, wedge head, neck, body, tapered tail. */
const widthAt = (s: number): number => (s < 0.075 ? 0.012 + 0.038 * sstep(0, 0.075, s) : s < 0.15 ? 0.05 - 0.022 * sstep(0.075, 0.15, s) : s < 0.32 ? 0.028 + (RB - 0.028) * sstep(0.15, 0.32, s) : RB * (1 - 0.93 * Math.pow(clamp01((s - 0.32) / (LEN - 0.32)), 2.2)));
const heightAt = (s: number): number => widthAt(s) * (s < 0.15 ? 0.66 : 0.95);

export interface RingState {vis: boolean; sk: number; moving: boolean; v: number; dirX: number; dirZ: number; headPath: (tPast: number) => V3}
/** Ring centres (world, N+1 rings, ring 0 = snout/head) of a snake at frame fr. Pure function: used by the renderer and by the QA gate. `dead` selects the limp dead twin. */
export function snakeRings(s: LiveSnake, fr: number, N: number, dead: boolean, out: Float32Array): RingState {
  const k = s.s ?? 1, t0 = s.t0 ?? -1, die = s.die, ph = s.ph ?? s.x * 7.3 + s.z * 3.1, w = dead ? 0 : s.wig ?? 0, vx = s.vx ?? 0, vz = s.vz ?? 0, v = Math.hypot(vx, vz), L = LEN * k;
  let vis = fr >= t0, sk = k;
  if (dead) vis = die !== undefined ? fr >= die : fr >= t0; /* a dead twin appears at `die`; a snake that is dead from the start (dead: true) appears at t0 */ else if ((die !== undefined && fr >= die) || (s.off !== undefined && fr >= s.off)) vis = false; else if (fr < t0 + 6) { vis = fr >= t0; sk = k * (fr < t0 ? 0 : Math.max(0.001, backOut((fr - t0) / 6))); }
  const fe = dead ? die ?? 0 : die !== undefined ? Math.min(fr, die) : fr, tref = Math.max(t0, 0), y0 = s.y ?? 0;
  const moving = !dead && v > 0, dirX = moving ? vx / v : 0, dirZ = moving ? vz / v : 0, yaw = snakeYaw(s), cy = Math.cos(yaw), sy = Math.sin(yaw);
  let headPath: (t: number) => V3 = () => [s.x, y0, s.z];
  if (moving) {
    const amp = 0.07 * k * Math.max(0.4, w), lam = 0.55 * k, om = (Math.PI * 2 * v) / lam, cx = s.x - tref * vx, cz = s.z - tref * vz, nx = -dirZ, nz = dirX; // center(t) = (x, z) + v (t - tref)
    headPath = (t) => { const hx = cx + vx * t + dirX * 0.5 * L, hz = cz + vz * t + dirZ * 0.5 * L, lat = amp * Math.sin(om * (t - tref) + ph); return [hx + nx * lat, y0 + RB * k, hz + nz * lat]; }; // the path the head traces (past times extend straight behind the start)
    for (let i = 0; i <= N; i++) { const sI = (i / N) * L, p = headPath(fe - sI / v); out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2]; } // ring i = where the head was s_i / v frames ago (path buffer): exact follow-the-leader
  } else {
    const rest = restPts(dead ? 'limp' : s.shape ?? 'S', N), tg = s.target, aim = !!tg && !dead, lift = aim ? 0.2 : dead ? 0 : 0.05, sway = dead ? 0 : (aim ? 0.02 : 0.03) * Math.max(0.5, w);
    const dx = tg ? tg[0] - s.x : 0, dz = tg ? tg[1] - s.z : 0, dl = Math.hypot(dx, dz) || 1, lu = aim && s.strike !== undefined ? clamp01((fr - s.strike) / 5) * (1 - clamp01((fr - s.strike - 8) / 14)) : 0, lunge = dl * 0.55 * lu;
    for (let i = 0; i <= N; i++) {
      const u = i / N, lx = rest[i * 3] * k, ly = rest[i * 3 + 1] * k, lz = rest[i * 3 + 2] * k + sway * k * Math.sin(fe * 0.07 + ph - i * 0.35) * Math.min(1, u * 3), wt = Math.pow(1 - u, 1.5) * lunge; // sway grows from the head back, head stays steady
      out[i * 3] = s.x + cy * lx + sy * lz + (dx / dl) * wt; out[i * 3 + 1] = y0 + ly + lift * Math.pow(Math.max(0, 1 - u * 3.5), 2); out[i * 3 + 2] = s.z - sy * lx + cy * lz + (dz / dl) * wt;
    }
    headPath = () => [out[0], out[1], out[2]];
  }
  return {vis, sk, moving, v, dirX, dirZ, headPath};
}

// ---------------------------------------------------------------- one rig (one mesh) per snake
const C_BACK = new THREE.Color('#7CE23B'), C_BELLY = new THREE.Color('#D4F59A'), C_DIAM = new THREE.Color('#3E9A1C'), C_HEAD = new THREE.Color('#8CEB45'), C_W = new THREE.Color('#FFFFFF'), C_INK = new THREE.Color('#231A28'), C_RED = new THREE.Color('#E5384F');
const SPH_LAT = 6, SPH_LON = 8;
interface Rig {mesh: THREE.Mesh; hull: THREE.Mesh | null; geo: THREE.BufferGeometry; pos: Float32Array; nor: Float32Array; rings: Float32Array; N: number; R: number; dead: boolean; hi: boolean; sp: LiveSnake; nBody: number; nSph: number; nX: number}
function buildRig(sp: LiveSnake, dead: boolean, hi: boolean, bodyMat: THREE.Material, hullMat: THREE.Material): Rig {
  const N = hi ? 48 : 20, R = hi ? 10 : 6, nBody = (N + 1) * R, sphV = (SPH_LAT + 1) * (SPH_LON + 1), nSph = hi && !dead ? 4 * sphV : 0, nX = hi && dead ? 4 * 8 : 0, nT = hi && !dead ? 8 : 0, total = nBody + nSph + nX + nT;
  const col = new Float32Array(total * 3), idx: number[] = [], c = new THREE.Color();
  for (let i = 0; i <= N; i++) { const t = i / N, s = t * LEN, diam = Math.pow(0.5 + 0.5 * Math.cos(t * 17 * Math.PI * 2), 2.5) > 0.45 && t > 0.2 && t < 0.85 ? 1 : 0;
    for (let k = 0; k < R; k++) { const sn = Math.sin((k / R) * Math.PI * 2), back = sstep(0.3, 0.75, sn), belly = sstep(-0.15, -0.55, sn); c.copy(s < 0.15 ? C_HEAD : C_BACK).lerp(C_BELLY, belly).lerp(C_DIAM, back * diam * 0.9); const o = (i * R + k) * 3; col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; } }
  for (let i = 0; i < N; i++) for (let k = 0; k < R; k++) { const a = i * R + k, b = i * R + ((k + 1) % R), c2 = a + R, d2 = b + R; idx.push(a, b, c2, b, d2, c2); }
  let base = nBody;
  const paint = (from: number, n: number, cl: THREE.Color) => { for (let v = 0; v < n; v++) { const o = (from + v) * 3; col[o] = cl.r; col[o + 1] = cl.g; col[o + 2] = cl.b; } };
  if (nSph) for (let e = 0; e < 4; e++) { for (let la = 0; la < SPH_LAT; la++) for (let lo = 0; lo < SPH_LON; lo++) { const a = base + la * (SPH_LON + 1) + lo, b = a + 1, c2 = a + SPH_LON + 1, d2 = c2 + 1; idx.push(a, c2, b, b, c2, d2); } paint(base, sphV, e < 2 ? C_INK : C_W); base += sphV; }
  if (nX) for (let b = 0; b < 4; b++) { for (const q of [[0, 1, 3, 0, 3, 2], [4, 6, 7, 4, 7, 5], [0, 4, 5, 0, 5, 1], [2, 3, 7, 2, 7, 6], [0, 2, 6, 0, 6, 4], [1, 5, 7, 1, 7, 3]]) for (const v of q) idx.push(base + v); paint(base, 8, C_INK); base += 8; }
  if (nT) { for (const q of [[0, 1, 3, 0, 3, 2], [4, 6, 7, 4, 7, 5], [0, 4, 5, 0, 5, 1], [2, 3, 7, 2, 7, 6], [0, 2, 6, 0, 6, 4], [1, 5, 7, 1, 7, 3]]) for (const v of q) idx.push(base + v); paint(base, 8, C_RED); }
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, bodyMat); mesh.userData.noClutter = true; mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
  const hull = hi ? new THREE.Mesh(geo, hullMat) : null; if (hull) { hull.frustumCulled = false; hull.userData.noClutter = true; }
  return {mesh, hull, geo, pos, nor, rings: new Float32Array((N + 1) * 3), N, R, dead, hi, sp, nBody, nSph, nX};
}
const _F = new THREE.Vector3(), _N = new THREE.Vector3(), _B = new THREE.Vector3(), _Up = new THREE.Vector3(0, 1, 0), _t = new THREE.Vector3();
const SPH_U: [number, number, number][] = (() => { const a: [number, number, number][] = []; for (let la = 0; la <= SPH_LAT; la++) for (let lo = 0; lo <= SPH_LON; lo++) { const th = (la / SPH_LAT) * Math.PI, ph = (lo / SPH_LON) * Math.PI * 2; a.push([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]); } return a; })();
function updateRig(r: Rig, fr: number): void {
  const sp = r.sp, st = snakeRings(sp, fr, r.N, r.dead, r.rings), N = r.N, R = r.R, ring = r.rings, pos = r.pos, nor = r.nor, sk = st.sk;
  r.mesh.visible = st.vis; if (r.hull) r.hull.visible = st.vis; if (!st.vis) return;
  const k = sp.s ?? 1;
  if (sk !== k) { for (let i = 1; i <= N; i++) for (let a = 0; a < 3; a++) ring[i * 3 + a] = ring[a] + (ring[i * 3 + a] - ring[a]) * (sk / k); } // pop-in: grow from the head
  const Fv: V3[] = []; void Fv;
  let nx = 0, ny = 1, nz = 0, ih = 0, eyeFx = 0, eyeFy = 0, eyeFz = 0, eyeNx = 0, eyeNy = 0, eyeNz = 0, eyeBx = 0, eyeBy = 0, eyeBz = 0, eyeC: [number, number, number] = [0, 0, 0];
  const ihT = Math.round((0.06 / LEN) * N);
  for (let i = 0; i <= N; i++) {
    const a = Math.max(0, i - 1), b = Math.min(N, i + 1);
    _F.set(ring[a * 3] - ring[b * 3], ring[a * 3 + 1] - ring[b * 3 + 1], ring[a * 3 + 2] - ring[b * 3 + 2]); if (_F.lengthSq() < 1e-10) _F.set(1, 0, 0); _F.normalize(); // forward = toward the head
    if (i === 0) { _N.copy(_Up).addScaledVector(_F, -_Up.dot(_F)); if (_N.lengthSq() < 1e-4) _N.set(0, 0, 1); _N.normalize(); } else { _N.set(nx, ny, nz); _N.addScaledVector(_F, -_N.dot(_F)).normalize(); }
    nx = _N.x; ny = _N.y; nz = _N.z; _B.crossVectors(_F, _N).normalize();
    const s = (i / N) * LEN, wx = widthAt(s) * sk, hy = heightAt(s) * sk, cx = ring[i * 3], cy = ring[i * 3 + 1], cz = ring[i * 3 + 2];
    for (let q = 0; q < R; q++) { const ph = (q / R) * Math.PI * 2, c = Math.cos(ph), sn = Math.sin(ph), o = (i * R + q) * 3; pos[o] = cx + _B.x * wx * c + _N.x * hy * sn; pos[o + 1] = cy + _B.y * wx * c + _N.y * hy * sn; pos[o + 2] = cz + _B.z * wx * c + _N.z * hy * sn; _t.set(_B.x * c / Math.max(wx, 1e-4) + _N.x * sn / Math.max(hy, 1e-4), _B.y * c / Math.max(wx, 1e-4) + _N.y * sn / Math.max(hy, 1e-4), _B.z * c / Math.max(wx, 1e-4) + _N.z * sn / Math.max(hy, 1e-4)).normalize(); nor[o] = _t.x; nor[o + 1] = _t.y; nor[o + 2] = _t.z; }
    if (i === ihT) { ih = i; eyeFx = _F.x; eyeFy = _F.y; eyeFz = _F.z; eyeNx = _N.x; eyeNy = _N.y; eyeNz = _N.z; eyeBx = _B.x; eyeBy = _B.y; eyeBz = _B.z; eyeC = [cx, cy, cz]; }
    if (i === 0 && r.hi) { // tongue and snout frame
      if (!r.dead) { const o0 = r.nBody + r.nSph, fl = ((fr * 0.9 + (sp.ph ?? sp.x * 7.3 + sp.z * 3.1) * 20) % 60) < 9 ? 0.07 * sk : 0.0001, w2 = 0.004 * sk, h2 = 0.0016 * sk; let v = 0; for (const e of [0, fl]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const o = (o0 + v) * 3; pos[o] = cx + _F.x * (0.005 * sk + e) + _B.x * w2 * sx + _N.x * h2 * sy; pos[o + 1] = cy + _F.y * (0.005 * sk + e) + _B.y * w2 * sx + _N.y * h2 * sy; pos[o + 2] = cz + _F.z * (0.005 * sk + e) + _B.z * w2 * sx + _N.z * h2 * sy; nor[o] = _B.x * sx + _N.x * sy; nor[o + 1] = _B.y * sx + _N.y * sy; nor[o + 2] = _B.z * sx + _N.z * sy; v++; } }
    }
  }
  void ih;
  if (r.hi) { // eyes (white + pupil) or X eyes, anchored to the head frame at s = 0.06
    const wH = widthAt(0.06) * sk, hH = heightAt(0.06) * sk;
    for (let sg = -1; sg <= 1; sg += 2) {
      const ex = eyeC[0] + eyeBx * wH * 0.88 * sg + eyeNx * hH * 0.72 + eyeFx * 0.008 * sk, ey = eyeC[1] + eyeBy * wH * 0.88 * sg + eyeNy * hH * 0.72 + eyeFy * 0.008 * sk, ez = eyeC[2] + eyeBz * wH * 0.88 * sg + eyeNz * hH * 0.72 + eyeFz * 0.008 * sk;
      if (!r.dead) {
        const eI = sg < 0 ? 0 : 1, sphV = (SPH_LAT + 1) * (SPH_LON + 1);
        for (let part = 0; part < 2; part++) { /* 40 % of the old size: a small glossy dark eye (part 0) with a tiny white highlight (part 1) on its upper front */ const rad = (part === 0 ? 0.0115 : 0.0038) * sk, hl = part === 0 ? 0 : 1, cxp = ex + hl * (eyeFx * 0.0075 + eyeNx * 0.0065 + eyeBx * sg * 0.002) * sk, cyp = ey + hl * (eyeFy * 0.0075 + eyeNy * 0.0065 + eyeBy * sg * 0.002) * sk, czp = ez + hl * (eyeFz * 0.0075 + eyeNz * 0.0065 + eyeBz * sg * 0.002) * sk, o0 = r.nBody + (part * 2 + eI) * sphV;
          for (let v = 0; v < sphV; v++) { const u = SPH_U[v], o = (o0 + v) * 3; pos[o] = cxp + u[0] * rad; pos[o + 1] = cyp + u[1] * rad; pos[o + 2] = czp + u[2] * rad; nor[o] = u[0]; nor[o + 1] = u[1]; nor[o + 2] = u[2]; } }
      } else {
        const eI = sg < 0 ? 0 : 1;
        for (let b = 0; b < 2; b++) { const o0 = r.nBody + (eI * 2 + b) * 8, ang = b ? -Math.PI / 4 : Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang), L2 = 0.0105 * sk, T2 = 0.0025 * sk;
          let v = 0; for (const a1 of [-1, 1]) for (const a2 of [-1, 1]) for (const a3 of [-1, 1]) { const ux = (eyeBx * ca + eyeNx * sa) * a1 * L2 + (-eyeBx * sa + eyeNx * ca) * a2 * T2 + eyeFx * a3 * T2, uy = (eyeBy * ca + eyeNy * sa) * a1 * L2 + (-eyeBy * sa + eyeNy * ca) * a2 * T2 + eyeFy * a3 * T2, uz = (eyeBz * ca + eyeNz * sa) * a1 * L2 + (-eyeBz * sa + eyeNz * ca) * a2 * T2 + eyeFz * a3 * T2, o = (o0 + v) * 3; pos[o] = ex + ux; pos[o + 1] = ey + uy; pos[o + 2] = ez + uz; const l = Math.hypot(ux, uy, uz) || 1; nor[o] = ux / l; nor[o + 1] = uy / l; nor[o + 2] = uz / l; v++; } }
      }
    }
  }
  (r.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; (r.geo.getAttribute('normal') as THREE.BufferAttribute).needsUpdate = true;
}
const hullShader = (sh: THREE.WebGLProgramParametersWithUniforms) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.007;'); };

/** `cam` = camera position (LOD by distance). Max 80 snakes per field (dead twins are hidden until `die`). Geometry is built once per mount and rewritten in place; update(f) allocates nothing. */
export const SnakeField: React.FC<{snakes: LiveSnake[]; cam: V3; f?: number}> = ({snakes, cam, f = 0}) => {
  if (snakes.length > MAX_SNAKES) throw new Error(`SnakeField: ${snakes.length} snakes, max ${MAX_SNAKES}`);
  const built = useMemo(() => {
    const g = new THREE.Group(), bodyMat = new THREE.MeshToonMaterial({gradientMap: RAMP, vertexColors: true}), hullMat = new THREE.MeshBasicMaterial({color: '#231A28', side: THREE.BackSide, toneMapped: false});
    bodyMat.defines = {PAINTED_SHADOWS: ''}; hullMat.onBeforeCompile = hullShader; hullMat.customProgramCacheKey = () => 'cb-hull4';
    const order = snakes.map((s, i) => ({i, d: Math.hypot(s.x - cam[0], (s.y ?? 0) - cam[1], s.z - cam[2])})).sort((a, b) => a.d - b.d), hi = new Set(order.slice(0, MAX_HI).filter((o) => o.d < 14).map((o) => o.i)), rigs: Rig[] = [];
    snakes.forEach((s, i) => { for (const dead of s.die !== undefined ? [false, true] : [!!s.dead]) { const r = buildRig(s, dead, hi.has(i), bodyMat, hullMat); rigs.push(r); g.add(r.mesh); if (r.hull) g.add(r.hull); } });
    return {g, rigs};
  }, [snakes, cam[0], cam[1], cam[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  for (const r of built.rigs) updateRig(r, f);
  return <primitive object={built.g} />;
};
