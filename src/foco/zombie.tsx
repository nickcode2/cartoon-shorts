// FOCOPROIBIDO zombies: dark purple skeletal FLYERS with big real-3D bat wings. ONE instanced draw per LOD (near = full wings with ink ribbons, far = coarse), cap 80 per swarm.
// Body local frame: +z = forward (the HEAD leads), +y up, +x right. Every instance is oriented by its forward vector (head first, never backward); roll banks the body.
// WINGS: membrane panels between the finger bones (scalloped trailing edge), arm bone + finger bones + edge ribbons in ink, all one vertex-coloured mesh. The flap is a TRAVELLING WAVE in the
// vertex shader: the angle of a wing vertex grows with its span (tip lags the root by `LAG` rad), amplitude `aZ.z`, wet wings (`aZ.w` = droop 0..1) sag: lower amplitude + a downward bend that grows with span^1.4.
// Per-instance data: instanceMatrix (position, orientation, scale) + aZ (phase, freq rad/s, amplitude rad, droop). Everything is built once (useMemo, disposed with the shot) and rewritten in place per frame.
// Sources for the wing design (searched 2026-11-17): bat wing = arm bone + 4 elongated finger bones with membrane (patagium) between them, scalloped trailing edge between fingertips
// (Wikipedia: Bat flight / Bat wing anatomy); flap = wing tip lags the root, downstroke powers the flight. Numbers (amplitude 0.55 rad, lag 1.6 rad, 2 Hz) are estimates, untested.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {V3} from '../kit/kit';

export const MAX_ZOMBIES = 80;
export const ZC = {body: '#4A2B8F', rib: '#7A55C8', bone: '#2B1A6A', mem: '#4F2F9A', memTip: '#7552C0', memIn: '#3A2480', ink: '#120A14', eye: '#E0243C'} as const;
export const HALF_SPAN = 1.6, LAG = 1.6, ROOT: V3 = [0.14, 0.1, 0.3];
export interface ZState {p: V3; fwd: V3; s: number; ph: number; wet: number; roll?: number; amp?: number; freq?: number; glide?: number; vis?: number}

// ---------------------------------------------------------------- geometry
const col = (g: THREE.BufferGeometry, c: string) => { const k = new THREE.Color(c), n = g.getAttribute('position').count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const ss = (g: THREE.BufferGeometry, span?: number[], side = 0) => { const n = g.getAttribute('position').count, a = new Float32Array(n * 2); for (let i = 0; i < n; i++) { a[i * 2] = span ? span[i] : 0; a[i * 2 + 1] = side; } g.setAttribute('aSS', new THREE.BufferAttribute(a, 2)); return g; };
const place = (g: THREE.BufferGeometry, p: V3, s: V3 = [1, 1, 1], r: V3 = [0, 0, 0]) => { g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s))); return g; };
const limb = (a: V3, b: V3, r0: number, r1: number, c: string, seg = 6) => { // tapered rod from a to b (a capsule-like limb piece)
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length(), g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false); g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.applyQuaternion(q); g.translate(a[0], a[1], a[2]); return col(g, c);
};
const ball = (p: V3, s: V3, c: string, seg = 8) => col(place(new THREE.SphereGeometry(1, seg, Math.max(4, seg - 2)), p, s), c);
const claw = (p: V3, dir: V3, len: number, r: number, c: string) => { const g = new THREE.ConeGeometry(r, len, 5); g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize())); g.translate(p[0], p[1], p[2]); return col(g, c); };
/** Body parts only (skeletal, thin limbs, claws). detail 'hi' has rib rings + claws + rounded joints. Returns non-indexed geometries with colour + aSS (span 0). */
function bodyParts(detail: 'hi' | 'lo'): THREE.BufferGeometry[] {
  const hi = detail === 'hi', sg = hi ? 10 : 6, out: THREE.BufferGeometry[] = [];
  out.push(ball([0, 0.08, 0.66], [0.12, 0.13, 0.17], ZC.body, sg)); // skull
  out.push(col(place(new THREE.BoxGeometry(1, 1, 1), [0, -0.02, 0.8], [0.07, 0.05, 0.1]), ZC.bone)); // jaw / snout
  out.push(limb([0, 0.02, 0.5], [0, 0.04, 0.38], 0.04, 0.05, ZC.body, 6)); // neck
  out.push(ball([0, 0.04, 0.22], [0.15, 0.13, 0.22], ZC.body, sg)); // chest
  out.push(ball([0, 0.0, -0.1], [0.09, 0.08, 0.2], ZC.body, sg)); // abdomen
  out.push(ball([0, -0.02, -0.3], [0.08, 0.07, 0.09], ZC.body, 6)); // pelvis
  if (hi) for (let i = 0; i < 4; i++) { const t = new THREE.TorusGeometry(0.15 - i * 0.012, 0.013, 4, 10, Math.PI * 1.3); t.rotateY(Math.PI / 2); t.rotateX(Math.PI * 0.85); out.push(col(place(t, [0, 0.04, 0.34 - i * 0.11]), ZC.rib)); } // rib rings
  for (const sd of [-1, 1]) {
    out.push(limb([sd * 0.12, 0.0, 0.3], [sd * 0.19, -0.13, 0.44], 0.03, 0.025, ZC.body, 6), limb([sd * 0.19, -0.13, 0.44], [sd * 0.17, -0.2, 0.68], 0.025, 0.018, ZC.body, 6)); // arm: upper arm, forearm reaching forward
    if (hi) { out.push(ball([sd * 0.19, -0.13, 0.44], [0.04, 0.04, 0.04], ZC.body, 6)); for (const k of [-1, 0, 1]) out.push(claw([sd * 0.17 + k * 0.025, -0.2, 0.68], [k * 0.25, -0.35, 1], 0.1, 0.012, ZC.ink)); } // rounded elbow + 3 claws
    else out.push(claw([sd * 0.17, -0.2, 0.68], [0, -0.3, 1], 0.1, 0.02, ZC.ink));
    out.push(limb([sd * 0.05, -0.04, -0.32], [sd * 0.09, -0.1, -0.56], 0.028, 0.02, ZC.body, 6), limb([sd * 0.09, -0.1, -0.56], [sd * 0.08, -0.3, -0.7], 0.02, 0.014, ZC.body, 6)); // thin legs trailing behind
    if (hi) { out.push(ball([sd * 0.09, -0.1, -0.56], [0.03, 0.03, 0.03], ZC.body, 6)); for (const k of [-1, 0, 1]) out.push(claw([sd * 0.08 + k * 0.02, -0.3, -0.7], [k * 0.3, -1, -0.3], 0.09, 0.01, ZC.ink)); }
  }
  return out.map((g) => { const ng = g.index ? g.toNonIndexed() : g; for (const n of Object.keys(ng.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'color') ng.deleteAttribute(n); return ss(ng); });
}
// wing outline (right wing, wing-local = body-local coords). W = wrist; tips T1..T4 (leading finger first); H = hip anchor on the body.
const R: V3 = ROOT, W: V3 = [0.95, 0.2, 0.52], TIP: V3[] = [[HALF_SPAN, 0.06, 1.05], [HALF_SPAN + 0.1, 0.0, 0.42], [1.42, -0.04, -0.2], [1.0, -0.06, -0.62]], H: V3 = [0.12, -0.02, -0.36];
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dist3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const spanOf = (p: V3) => Math.min(1, dist3(p, R) / (HALF_SPAN + 0.1));
/** Triangle list builder for one wing; `sd` mirrors it. Returns geometry (membrane + bones + edge ribbons) with colour + aSS. */
function wingGeo(sd: 1 | -1, detail: 'hi' | 'lo'): THREE.BufferGeometry {
  const pos: number[] = [], colr: number[] = [], spn: number[] = [], k = new THREE.Color();
  const mir = (p: V3): V3 => [p[0] * sd, p[1], p[2]];
  const tri = (a: V3, b: V3, c: V3, ca: string, cb = ca, cc = ca) => { for (const [p, cl] of [[a, ca], [b, cb], [c, cc]] as [V3, string][]) { const q = mir(p); pos.push(q[0], q[1], q[2]); k.set(cl); colr.push(k.r, k.g, k.b); spn.push(spanOf(p)); } };
  const mix = (t: number) => new THREE.Color(ZC.mem).lerp(new THREE.Color(ZC.memTip), t).getStyle(); // membrane gets lighter toward the tips
  const n = detail === 'hi' ? 5 : 2, ribs: V3[] = [...TIP, H];
  const Pk = (i: number, t: number): V3 => lerp3(W, ribs[i], t);
  for (let i = 0; i < 4; i++) { // panels between rib i and rib i+1
    for (let j = 0; j < n - 1; j++) { const t0 = j / n, t1 = (j + 1) / n, a = Pk(i, t0), b = Pk(i + 1, t0), c = Pk(i, t1), d = Pk(i + 1, t1); tri(a, c, b, mix(t0), mix(t1), mix(t0)); tri(b, c, d, mix(t0), mix(t1), mix(t1)); }
    const tn = (n - 1) / n, a = Pk(i, tn), b = Pk(i + 1, tn), tp = ribs[i], tq = ribs[i + 1], m = lerp3(lerp3(tp, tq, 0.5), W, 0.2); // scalloped trailing edge: the middle of the outer edge is pulled toward the wrist
    tri(a, tp, m, mix(tn), mix(1), mix(0.9)); tri(a, m, b, mix(tn), mix(0.9), mix(tn)); tri(b, m, tq, mix(tn), mix(0.9), mix(1));
  }
  tri(R, W, H, ZC.memIn, ZC.mem, ZC.memIn); tri(W, Pk(3, 0.5), H, ZC.mem, ZC.memIn, ZC.memIn); // inboard membrane (root to wrist to hip)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); ss(g, spn, sd);
  const gs: THREE.BufferGeometry[] = [g];
  // bones and edge ribbons (hi only for the ribbons): flat strips lying on the membrane, ink outline around the scalloped edge
  const strip = (pts: V3[], w: number, c: string) => { const sp: number[] = [], ps: number[] = [], cl: number[] = [], kk = new THREE.Color(c); const nrm: V3 = [0, 1, 0]; for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, ox = (-dz / l) * w, oz = (dx / l) * w, q = [[a[0] + ox, a[1] + 0.012, a[2] + oz], [a[0] - ox, a[1] + 0.012, a[2] - oz], [b[0] + ox, b[1] + 0.012, b[2] + oz], [b[0] - ox, b[1] + 0.012, b[2] - oz]] as V3[]; for (const idx of [0, 1, 2, 2, 1, 3]) { const p = mir(q[idx]); ps.push(p[0], p[1], p[2]); cl.push(kk.r, kk.g, kk.b); sp.push(spanOf(q[idx])); } } void nrm; const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); return ss(gg, sp, sd); };
  gs.push(strip([R, W], 0.034, ZC.bone)); for (let i = 0; i < 4; i++) gs.push(strip([W, ribs[i]], detail === 'hi' ? 0.02 : 0.03, ZC.bone));
  if (detail === 'hi') { const edge: V3[] = []; for (let i = 0; i < 4; i++) { edge.push(ribs[i]); if (i < 3) edge.push(lerp3(lerp3(ribs[i], ribs[i + 1], 0.5), W, 0.2)); } edge.push(ribs[3], H); gs.push(strip(edge, 0.018, ZC.ink), strip([H, R], 0.016, ZC.ink)); }
  return mergeGeometries(gs.map((q) => { const ng = q.index ? q.toNonIndexed() : q; ng.computeVertexNormals(); return ng; }))!;
}
export function buildZombieGeo(detail: 'hi' | 'lo'): {geo: THREE.BufferGeometry; eyes: THREE.BufferGeometry; hull: THREE.BufferGeometry | null; tris: number} {
  const body = bodyParts(detail).map((g) => { g.computeVertexNormals(); return g; });
  const geo = mergeGeometries([...body, wingGeo(1, detail), wingGeo(-1, detail)].map((g) => { for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'aSS'].includes(n)) g.deleteAttribute(n); return g; }))!;
  const eyes = mergeGeometries([ball([-0.058, 0.125, 0.8], [0.03, 0.024, 0.024], '#ffffff', 6), ball([0.058, 0.125, 0.8], [0.03, 0.024, 0.024], '#ffffff', 6)].map((g) => { const ng = g.toNonIndexed(); for (const n of Object.keys(ng.attributes)) if (n !== 'position') ng.deleteAttribute(n); return ng; }))!;
  let hull: THREE.BufferGeometry | null = null;
  if (detail === 'hi') hull = mergeGeometries(body.map((g) => { const ng = g.clone(); for (const n of Object.keys(ng.attributes)) if (n !== 'position' && n !== 'normal') ng.deleteAttribute(n); return ng; }))!;
  return {geo, eyes, hull, tris: geo.getAttribute('position').count / 3};
}

// ---------------------------------------------------------------- the flap (GLSL) and its CPU twin (QA)
const GLSL = `
uniform float uT; attribute vec2 aSS; attribute vec4 aZ;
float wingAng(){ float sp = aSS.x; if (aZ.z < 0.0) return -1.3 * (0.25 + sp) + 0.05 * sin(uT * 3.0 + aZ.x + sp * 2.0); float ph = uT * aZ.y + aZ.x - sp * ${LAG.toFixed(2)}; float amp = aZ.z * (1.0 - 0.55 * aZ.w); return (amp * sin(ph) + 0.12) * (0.25 + 1.0 * sp) - aZ.w * 0.95 * pow(sp, 1.4); }
vec3 rotX(vec3 p, vec3 c, float a){ vec3 q = p - c; float cs = cos(a), sn = sin(a); return vec3(q.x, q.y * cs - q.z * sn, q.y * sn + q.z * cs) + c; }
vec3 flapPos(vec3 p){ float sd = aSS.y;
  if (sd == 0.0) { if (aZ.z < -0.001) { float sw = sin(uT * aZ.y * 0.9 + aZ.x + step(0.0, p.x) * 3.14159) * (-aZ.z); if (p.z < -0.3 && p.y < -0.03) return rotX(p, vec3(0.0, -0.02, -0.32), sw * 0.75); if (p.z > 0.36 && p.y < -0.08) return rotX(p, vec3(p.x, 0.0, 0.3), -sw * 0.6); } return p; }
  float a = wingAng(); vec3 q = p - vec3(${ROOT[0]}*sd, ${ROOT[1]}, ${ROOT[2]}); float px = q.x * sd; float c = cos(a), s = sin(a); float nx = px * c - q.y * s, ny = px * s + q.y * c; q.x = nx * sd; q.y = ny; return q + vec3(${ROOT[0]}*sd, ${ROOT[1]}, ${ROOT[2]}); }
vec3 flapNrm(vec3 n){ float sd = aSS.y; if (sd == 0.0) return n; float a = wingAng(); float c = cos(a), s = sin(a); float nx = n.x * sd * c - n.y * s, ny = n.x * sd * s + n.y * c; return vec3(nx * sd, ny, n.z); }
`;
/** CPU twin of the wing flap: world position of a wing-local point (side +1 / -1) of a zombie state at time t (s). */
export function wingWorld(z: ZState, loc: V3, sd: 1 | -1, t: number, sp: number): V3 {
  const amp = z.amp ?? 0.55, freq = z.freq ?? 12.5, droop = z.wet, ph = t * freq + z.ph - sp * LAG, a = amp < 0 ? -1.3 * (0.25 + sp) + 0.05 * Math.sin(t * 3 + z.ph + sp * 2) : (amp * (1 - 0.55 * droop) * Math.sin(ph) + 0.12) * (0.25 + sp) - droop * 0.95 * Math.pow(sp, 1.4);
  const x0 = loc[0] * sd, rx = ROOT[0] * sd, qx = (x0 - rx) * sd, qy = loc[1] - ROOT[1], c = Math.cos(a), s = Math.sin(a), lx = (qx * c - qy * s) * sd + rx, ly = qx * s + qy * c + ROOT[1], lz = loc[2]; // loc = right-wing coordinates, mirrored for the left wing (same as the shader)
  const f = new THREE.Vector3(...z.fwd).normalize(), up0 = Math.abs(f.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), right = new THREE.Vector3().crossVectors(up0, f).normalize(), up = new THREE.Vector3().crossVectors(f, right);
  const roll = z.roll ?? 0, cr = Math.cos(roll), sr = Math.sin(roll), r2 = right.clone().multiplyScalar(cr).addScaledVector(up, sr), u2 = up.clone().multiplyScalar(cr).addScaledVector(right, -sr);
  return [z.p[0] + (r2.x * lx + u2.x * ly + f.x * lz) * z.s, z.p[1] + (r2.y * lx + u2.y * ly + f.y * lz) * z.s, z.p[2] + (r2.z * lx + u2.z * ly + f.z * lz) * z.s];
}
/** World position of a body-local point (no wing flap): used for claw tips, eyes, the head. */
export function bodyWorld(z: ZState, loc: V3): V3 { const f = new THREE.Vector3(...z.fwd).normalize(), up0 = Math.abs(f.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), right = new THREE.Vector3().crossVectors(up0, f).normalize(), up = new THREE.Vector3().crossVectors(f, right), roll = z.roll ?? 0, cr = Math.cos(roll), sr = Math.sin(roll), r2 = right.clone().multiplyScalar(cr).addScaledVector(up, sr), u2 = up.clone().multiplyScalar(cr).addScaledVector(right, -sr); return [z.p[0] + (r2.x * loc[0] + u2.x * loc[1] + f.x * loc[2]) * z.s, z.p[1] + (r2.y * loc[0] + u2.y * loc[1] + f.y * loc[2]) * z.s, z.p[2] + (r2.z * loc[0] + u2.z * loc[1] + f.z * loc[2]) * z.s]; }
/** Wing skeleton points used by the QA (arm bone, 4 finger bones, hip edge): [local point, span]. */
export const WING_PTS: [V3, number][] = [[R, 0], [W, spanOf(W)], ...TIP.map((t): [V3, number] => [t, spanOf(t)]), [H, spanOf(H)], ...TIP.map((t): [V3, number] => [lerp3(W, t, 0.55), spanOf(lerp3(W, t, 0.55))])];
export const WING_SEGS: [number, number][] = [[0, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [6, 0], [7, 2], [8, 3], [9, 4], [10, 5]]; // bones (indices into WING_PTS)

// ---------------------------------------------------------------- the swarm
const hullMat = () => { const m = new THREE.MeshBasicMaterial({color: ZC.ink, side: THREE.BackSide, toneMapped: false}); m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.014;'); }; return m; };
export const ZombieSwarm: React.FC<{states: ZState[]; t: number; cam: V3; farDist?: number}> = ({states, t, cam, farDist = 34}) => {
  if (states.length > MAX_ZOMBIES) throw new Error(`ZombieSwarm: ${states.length} zombies > cap ${MAX_ZOMBIES}`);
  const R_ = useMemo(() => {
    const uT = {value: 0}, mk = (side: THREE.Side) => { const m = new THREE.MeshToonMaterial({vertexColors: true, side, gradientMap: TOON_RAMP(), emissive: new THREE.Color('#2A1670')}); m.onBeforeCompile = (sh) => { sh.uniforms.uT = uT; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL).replace('#include <beginnormal_vertex>', 'vec3 objectNormal = flapNrm(vec3(normal));\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(tangent.xyz);\n#endif').replace('#include <begin_vertex>', 'vec3 transformed = flapPos(position);'); }; m.customProgramCacheKey = () => 'zombie-flap'; return m; };
    const hi = buildZombieGeo('hi'), lo = buildZombieGeo('lo'), eyeMat = new THREE.MeshBasicMaterial({color: new THREE.Color(2.6, 0.1, 0.18), toneMapped: false, fog: false}), body = mk(THREE.DoubleSide);
    const mkMesh = (g: THREE.BufferGeometry, m: THREE.Material, n: number, attrs: boolean) => { const geo = g.clone(); if (attrs) geo.setAttribute('aZ', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)); const im = new THREE.InstancedMesh(geo, m, n); im.frustumCulled = false; im.count = 0; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return im; };
    const near = mkMesh(hi.geo, body, MAX_ZOMBIES, true), far = mkMesh(lo.geo, body, MAX_ZOMBIES, true), hull = mkMesh(hi.hull!, hullMat(), MAX_ZOMBIES, false), eyesN = mkMesh(hi.eyes, eyeMat, MAX_ZOMBIES, false), eyesF = mkMesh(lo.eyes, eyeMat, MAX_ZOMBIES, false);
    return {uT, near, far, hull, eyesN, eyesF, o: new THREE.Object3D(), tmp: new THREE.Vector3()};
  }, []);
  const {uT, near, far, hull, eyesN, eyesF, o, tmp} = R_;
  uT.value = t;
  let nn = 0, nf = 0;
  for (const z of states) {
    if (z.vis === 0) continue;
    o.position.set(...z.p); tmp.set(z.p[0] + z.fwd[0], z.p[1] + z.fwd[1], z.p[2] + z.fwd[2]); o.up.set(0, Math.abs(z.fwd[1]) > 0.95 ? 0 : 1, Math.abs(z.fwd[1]) > 0.95 ? 1 : 0); o.lookAt(tmp); o.rotateZ(z.roll ?? 0); o.scale.setScalar(z.s); o.updateMatrix();
    const d = Math.hypot(z.p[0] - cam[0], z.p[1] - cam[1], z.p[2] - cam[2]) / z.s, isNear = d < farDist, mesh = isNear ? near : far, k = isNear ? nn++ : nf++, a = (mesh.geometry.getAttribute('aZ') as THREE.InstancedBufferAttribute).array as Float32Array;
    mesh.setMatrixAt(k, o.matrix); (isNear ? eyesN : eyesF).setMatrixAt(k, o.matrix); if (isNear) hull.setMatrixAt(k, o.matrix);
    a[k * 4] = z.ph; a[k * 4 + 1] = z.freq ?? 12.5; a[k * 4 + 2] = z.amp ?? 0.55; a[k * 4 + 3] = z.wet;
  }
  near.count = hull.count = eyesN.count = nn; far.count = eyesF.count = nf;
  for (const m of [near, far, hull, eyesN, eyesF]) { m.instanceMatrix.needsUpdate = true; }
  (near.geometry.getAttribute('aZ') as THREE.InstancedBufferAttribute).needsUpdate = true; (far.geometry.getAttribute('aZ') as THREE.InstancedBufferAttribute).needsUpdate = true;
  return (<group userData={{qaZombies: {states, t}}}><primitive object={near} /><primitive object={far} /><primitive object={hull} /><primitive object={eyesN} /><primitive object={eyesF} /></group>);
};
import {RAMP} from '../kit/kit';
const TOON_RAMP = () => RAMP;

// ---------------------------------------------------------------- QA helpers (pure maths)
const segDist = (p1: V3, q1: V3, p2: V3, q2: V3): number => { // min distance between two segments
  const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]], d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]], r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const a = d1[0] ** 2 + d1[1] ** 2 + d1[2] ** 2, e = d2[0] ** 2 + d2[1] ** 2 + d2[2] ** 2, f = d2[0] * r[0] + d2[1] * r[1] + d2[2] * r[2];
  let s: number, t: number; const c = d1[0] * r[0] + d1[1] * r[1] + d1[2] * r[2], b = d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2], den = a * e - b * b, cl = (x: number) => Math.min(1, Math.max(0, x));
  s = den > 1e-9 ? cl((b * f - c * e) / den) : 0; t = (b * s + f) / (e || 1); if (t < 0) { t = 0; s = cl(-c / (a || 1)); } else if (t > 1) { t = 1; s = cl((b - c) / (a || 1)); }
  const x = [p1[0] + d1[0] * s - p2[0] - d2[0] * t, p1[1] + d1[1] * s - p2[1] - d2[1] * t, p1[2] + d1[2] * s - p2[2] - d2[2] * t]; return Math.hypot(x[0], x[1], x[2]);
};
/** Wing-vs-wing interpenetration: smallest distance between the bone segments of two different zombies (m). Pairs farther than 4 m apart are skipped. */
export function wingClearance(states: ZState[], t: number): {min: number; a: number; b: number} {
  let best = 1e9, ia = -1, ib = -1; const pts = states.map((z) => [-1, 1].flatMap((sd) => WING_PTS.map(([p, sp]) => wingWorld(z, p, sd as 1 | -1, t, sp)))); const m = WING_PTS.length;
  for (let i = 0; i < states.length; i++) for (let j = i + 1; j < states.length; j++) {
    if (states[i].vis === 0 || states[j].vis === 0) continue; if (Math.hypot(states[i].p[0] - states[j].p[0], states[i].p[1] - states[j].p[1], states[i].p[2] - states[j].p[2]) > 4.2 * Math.max(states[i].s, states[j].s)) continue;
    for (let wi = 0; wi < 2; wi++) for (let wj = 0; wj < 2; wj++) for (const [a0, a1] of WING_SEGS) for (const [b0, b1] of WING_SEGS) { const d = segDist(pts[i][wi * m + a0], pts[i][wi * m + a1], pts[j][wj * m + b0], pts[j][wj * m + b1]); if (d < best) { best = d; ia = i; ib = j; } }
  }
  return {min: best, a: ia, b: ib};
}
/** Head-leads check: forward must be unit and agree with the motion (dot >= 0.7) whenever the speed is above 0.4 m/s; `next` = the same swarm one frame later. */
export function headLeads(a: ZState[], b: ZState[], dt: number): {worst: number; idx: number} {
  let worst = 1, idx = -1;
  a.forEach((z, i) => { const w = b[i]; if (!w || w.p[1] < 0.34) return; /* landed: the touchdown stops it */ const v: V3 = [(w.p[0] - z.p[0]) / dt, (w.p[1] - z.p[1]) / dt, (w.p[2] - z.p[2]) / dt], sp = Math.hypot(...v), fl = Math.hypot(...z.fwd) || 1; if (sp < 0.4) return; const d = (v[0] * z.fwd[0] + v[1] * z.fwd[1] + v[2] * z.fwd[2]) / (sp * fl); if (d < worst) { worst = d; idx = i; } });
  return {worst, idx};
}
export const norm3 = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
