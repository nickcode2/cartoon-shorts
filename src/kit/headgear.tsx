// HEAD GEAR (kit default 2026-11-17): hats, caps, hair, beards, mustaches, glasses, earrings, headbands and scarves are REAL 3D MESHES parented to the head pivot.
// The head stays a 2D art card (rickRig); the pivot sits at the head centre of that card and carries the SAME roll (lean + rock + head roll) and the head's yaw, so the gear turns with the
// head in front, 3/4, profile and back views and can never float off it. Gear parts behind the card plane are hidden by the card itself (depth), so a beard and a mustache disappear in the
// back view while the hat / hair cover the back of the head.
// ANCHORS are computed from the head polygon of every character (`anchorsOf`): crown, chin, brow line, eye line, nose base, mouth, temples, ears, half width / centre at any height.
// A hat's opening = 1.02 x the head half-width at its rim (rim on the brow line + a little), it sits on the crown with an overlap onto the art; hair is a shell hugging the head surface
// (k = 1.03) plus layered locks and a highlight; a beard is a shell hugging the jaw from the sideburns to the chin; a mustache is an extruded curved shape on the nose-base anchor.
// Look: lit toon material with vertex colours (2 tones + highlight), thin ink outline by an inverted hull (4.5 card px, like the card outline), the scene light gives the right-side shade.
// Render stability: every geometry goes through shared() (one per role, never per mount), two merged meshes + two ink hulls per character, no per-frame allocation (only transforms change).
import React from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {RAMP, shared} from './kit';
import {FRONT_MAX, Kind, PXM, build, clampPitch, headPts, pitchAffine, wrapAng} from './rickRig';

export type HatKind = 'none' | 'bowler' | 'fedora' | 'boater' | 'cloche' | 'flatcap' | 'newsboy' | 'cap' | 'beanie' | 'sunhat';
export type HairKind = 'none' | 'short' | 'messy' | 'bun' | 'bob' | 'long' | 'ponytail' | 'braids' | 'curls' | 'pigtails' | 'balding';
export interface HatSpec {kind: HatKind; color: string; band?: string; trim?: 'none' | 'flower' | 'ribbon' | 'feather' | 'button' | 'buckle'; trimColor?: string}
export interface HairSpec {kind: HairKind; color: string; hi?: string; male?: boolean}
/** 3D gear is ONLY hats / caps, the hair volume, a headband and a hair clip / ribbon. Mustache, beard, glasses and earrings are 2D art on the face card (rickRig FacialSpec). */
export interface GearSpec {hat?: HatSpec; hair?: HairSpec; headband?: string; clip?: string}

// ---------------------------------------------------------------- anchors from the head SVG polygon
export interface Anchors {rx: number; ry: number; halfW: (y: number) => number; cx: (y: number) => number; hzAt: (y: number) => number; crown: number; chin: number; browY: number; eyeY: number; noseY: number; mouthY: number; earY: number; templeX: number}
const ANC = new Map<string, Anchors>();
/** All numbers in card px, x right, y UP (the head art centre is the origin), z toward the viewer. Depth radius = half width (a circular plan, so the profile art and the 3D gear agree). */
export function anchorsOf(kind: Kind): Anchors {
  const b = build(kind), key = `${kind}|${b.rx}|${b.ry}|${b.hs?.idx}|${b.hs?.flip}|${b.hs?.sx}`;
  let a = ANC.get(key); if (a) return a;
  const P = headPts(kind, 120).map((q) => [q[0], -q[1]] as [number, number]), n = P.length;
  const span = (y: number): [number, number] | null => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; if ((p[1] - y) * (q[1] - y) <= 0 && p[1] !== q[1]) { const t = (y - p[1]) / (q[1] - p[1]), x = p[0] + (q[0] - p[0]) * t; lo = Math.min(lo, x); hi = Math.max(hi, x); } } return lo <= hi ? [lo, hi] : null; };
  const crown = Math.max(...P.map((q) => q[1])), chin = Math.min(...P.map((q) => q[1])), s = Math.max(0.8, Math.min(1.2, b.rx / 118));
  const halfW = (y: number) => { const r = span(Math.max(chin + 0.5, Math.min(crown - 0.5, y))); return r ? (r[1] - r[0]) / 2 : 0; }, cx = (y: number) => { const r = span(Math.max(chin + 0.5, Math.min(crown - 0.5, y))); return r ? (r[1] + r[0]) / 2 : 0; };
  const eyeY = -0.02 * b.ry, browY = -(0.02 * b.ry - 34 * s), mouthY = -0.5 * b.ry, noseY = -0.3 * b.ry, earY = -0.08 * b.ry;
  a = {rx: b.rx, ry: b.ry, halfW, cx, hzAt: halfW, crown, chin, browY: -eyeY * 0 + browY, eyeY, noseY, mouthY, earY, templeX: halfW(browY)};
  ANC.set(key, a); return a;
}

// ---------------------------------------------------------------- geometry helpers (px units, y up, merged non-indexed with vertex colours)
interface Part {geo: THREE.BufferGeometry; color: string; hi?: string}
const LIGHT = new THREE.Vector3(-0.5, 0.7, 0.55).normalize();
const V2 = (r: number, y: number) => new THREE.Vector2(r, y);
const sstep = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
/** smooth hairline: `front` threshold at the face side (w > 0.5), `back` threshold at the back, no stair step in between */
const vThr = (w: number, front: number, back: number) => { const mid = 0.42; return w >= 0 ? mid + (front - mid) * sstep(w / 0.45) : back + (mid - back) * sstep((w + 0.4) / 0.4); }; // women: back / temple (0.36, above the brow line 0.27) / front hairline
/** MEN: the hair stays on the crown and at the BACK: front hairline high (0.72), the temples stay above the brows (0.5), it only comes down behind the ears (w < -0.15). Never in front of the eyes or across the cheek. */
const vThrM = (w: number, front: number, back: number) => (w >= 0.35 ? front : w >= -0.15 ? 0.5 + (front - 0.5) * sstep((w + 0.15) / 0.5) : back + (0.5 - back) * sstep((w + 0.5) / 0.35));
function lathe(pts: [number, number][], segs = 32, zk = 1): THREE.BufferGeometry { const g = new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), segs); g.scale(1, 1, zk); g.computeVertexNormals(); return g; }
function sph(x: number, y: number, z: number, rx: number, ry = rx, rz = rx): THREE.BufferGeometry { const g = new THREE.SphereGeometry(1, 14, 10); g.scale(rx, ry, rz); g.translate(x, y, z); return g; }
/** A shell on the head SURFACE (not a plain ellipsoid): unit-sphere triangles kept by `pred(u, v, w)`, mapped to the head polygon half width / centre at each height, inflated by k. */
function surf(A: Anchors, k: number, pred: (u: number, v: number, w: number) => boolean, nU = 64, nV = 44, o: {dz?: number; dy?: number} = {}): THREE.BufferGeometry {
  const sg = new THREE.SphereGeometry(1, nU, nV).toNonIndexed(), pa = sg.getAttribute('position'), pos: number[] = [], nor: number[] = [];
  const map = (u: number, v: number, w: number): [number[], number[]] => {
    const y = Math.max(A.chin + 1, Math.min(A.crown - 1, v * A.ry)), rh = Math.sqrt(Math.max(1e-4, 1 - v * v)), hw = Math.max(2, A.halfW(y)), hz = Math.max(2, A.hzAt(y));
    const x = A.cx(y) + (u / rh) * hw * k * rh, z = (w / rh) * hz * k * rh + (o.dz ?? 0), nx = u / hw, ny = v / A.ry, nz = w / hz, nl = Math.hypot(nx, ny, nz) || 1;
    return [[x, y * k + (o.dy ?? 0), z], [nx / nl, ny / nl, nz / nl]];
  };
  for (let i = 0; i < pa.count; i += 3) {
    const c = [0, 1, 2].map((j) => [pa.getX(i + j), pa.getY(i + j), pa.getZ(i + j)]), u = (c[0][0] + c[1][0] + c[2][0]) / 3, v = (c[0][1] + c[1][1] + c[2][1]) / 3, w = (c[0][2] + c[1][2] + c[2][2]) / 3;
    if (!pred(u, v, w)) continue;
    for (const q of c) { const [p, n] = map(q[0], q[1], q[2]); pos.push(...p); nor.push(...n); }
  }
  sg.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g;
}
/** A band shell on the head surface with SMOOTH edges: longitudes phi0..phi1 (rad, 0 = straight toward the viewer, + toward +x), and for every longitude the height range vLo(phi)..vHi(phi) in unit-sphere v (-1 chin .. 1 crown).
 *  The hairline / jaw line is a continuous function (no triangle stair steps). */
function band(A: Anchors, k: number, o: {phi0?: number; phi1?: number; vLo: (phi: number) => number; vHi?: (phi: number) => number; nPhi?: number; nV?: number; dz?: number}): THREE.BufferGeometry {
  const p0 = o.phi0 ?? -Math.PI, p1 = o.phi1 ?? Math.PI, nP = o.nPhi ?? 72, nV = o.nV ?? 20, pos: number[] = [], nor: number[] = [], vHi = o.vHi ?? (() => 1);
  const at = (phi: number, t: number): [number[], number[]] => {
    const lo = Math.min(o.vLo(phi), 0.995), hi = Math.max(lo + 0.01, Math.min(vHi(phi), 0.995)), v = lo + (hi - lo) * t, rh = Math.sqrt(Math.max(1e-4, 1 - v * v)), u = Math.sin(phi) * rh, w = Math.cos(phi) * rh;
    const y = Math.max(A.chin + 1, Math.min(A.crown - 1, v * A.ry)), hw = Math.max(2, A.halfW(y)), hz = Math.max(2, A.hzAt(y)), x = A.cx(y) + (u / Math.max(rh, 1e-3)) * hw * k * rh, z = (w / Math.max(rh, 1e-3)) * hz * k * rh + (o.dz ?? 0);
    const nx = u / hw, ny = v / A.ry, nz = w / hz, nl = Math.hypot(nx, ny, nz) || 1; return [[x, y * k, z], [nx / nl, ny / nl, nz / nl]];
  };
  for (let i = 0; i < nP; i++) for (let j = 0; j < nV; j++) {
    const a0 = p0 + ((p1 - p0) * i) / nP, a1 = p0 + ((p1 - p0) * (i + 1)) / nP, t0 = j / nV, t1 = (j + 1) / nV, q = [at(a0, t0), at(a1, t0), at(a1, t1), at(a0, t1)];
    for (const idx of [0, 1, 2, 0, 2, 3]) { pos.push(...q[idx][0]); nor.push(...q[idx][1]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g;
}
const DEG = Math.PI / 180;
/** A chain of overlapping spheres along points (hanging hair, braids, ponytails): radius per link. */
function chain(pts: [number, number, number][], rad: number[], sx = 1): THREE.BufferGeometry[] { return pts.map((p, i) => sph(p[0], p[1], p[2], rad[i] * sx, rad[i], rad[i] * 0.9)); }
function paint(geo: THREE.BufferGeometry, color: string, hi?: string): THREE.BufferGeometry {
  let g = geo; if (g.index) g = g.toNonIndexed(); if (g.getAttribute('uv')) g.deleteAttribute('uv'); if (!g.getAttribute('normal')) g.computeVertexNormals();
  const n = g.getAttribute('normal'), c = new THREE.Color(color), h = new THREE.Color(hi ?? color), sh = c.clone().multiplyScalar(0.8), arr = new Float32Array(n.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) { v.set(n.getX(i), n.getY(i), n.getZ(i)); const d = v.dot(LIGHT), col = hi && d > 0.62 ? h : d < -0.1 ? sh : c; arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return g;
}
function mergeParts(parts: Part[]): THREE.BufferGeometry | null { if (!parts.length) return null; const gs = parts.map((p) => paint(p.geo, p.color, p.hi)); const m = mergeGeometries(gs, false); gs.forEach((g) => g.dispose()); return m; }
function inkHull(g: THREE.BufferGeometry, t = 4.5): THREE.BufferGeometry { const h = g.clone(), p = h.getAttribute('position'), n = h.getAttribute('normal'); for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t); h.deleteAttribute('color'); return h; }

// ---------------------------------------------------------------- hats
export interface HatInfo {rimY: number; rimR: number; browRatio: number; lowY: number}
function hatParts(h: HatSpec, A: Anchors): {parts: Part[]; info: HatInfo | null} {
  if (h.kind === 'none') return {parts: [], info: null};
  const drop: Record<HatKind, number> = {none: 0, bowler: 9, fedora: 21, boater: 8, sunhat: 24, cloche: 0.05 * A.ry + 14, flatcap: 8, newsboy: 8, cap: 8, beanie: 4}; // how far the lowest point of the hat hangs below its rim
  let rimY = A.browY + 18 + drop[h.kind]; // the LOWEST point of the hat clears the eyebrows (brow top + 6 px); the opening matches the head width at the rim
  rimY = Math.min(rimY, A.crown - 0.12 * A.ry);
  const bw = A.halfW(A.browY);
  const Rb = A.halfW(rimY) * 1.02, top = A.crown + 0.1 * A.ry, H = top - rimY, col = h.color, band = h.band ?? '#2B2630', parts: Part[] = [], zk = 1;
  const dome = (R: number, Hh: number, p: number, n = 14): [number, number][] => Array.from({length: n + 1}, (_, i) => { const t = i / n; return [R * Math.pow(Math.max(0, Math.cos((t * Math.PI) / 2)), p), rimY + Hh * Math.sin((t * Math.PI) / 2)] as [number, number]; });
  const brim = (r1: number, r0 = Rb, drop = 0, th = 7): [number, number][] => [[r0 * 0.97, rimY + 3], [r1, rimY + 5 - drop], [r1 * 1.01, rimY - th + 1 - drop], [r0 * 1.0, rimY - th - 2], [r0 * 0.97, rimY - 1]];
  const bandP = (r: number, y0: number, y1: number): [number, number][] => [[r * 1.0, y0], [r * 1.025, y0], [r * 1.025, y1], [r * 1.0, y1]];
  switch (h.kind) {
    case 'bowler': parts.push({geo: lathe(dome(Rb, H, 0.5), 36, zk), color: col}, {geo: lathe(brim(Rb * 1.36, Rb, 0, 7), 36, zk), color: col}, {geo: lathe(bandP(Rb, rimY + 4, rimY + 0.2 * H), 36, zk), color: band}); break;
    case 'fedora': parts.push({geo: lathe([[Rb, rimY], [Rb * 0.97, rimY + 0.6 * H], [Rb * 0.87, rimY + 0.95 * H], [Rb * 0.55, rimY + H], [Rb * 0.22, rimY + 0.84 * H], [0, rimY + 0.8 * H]], 36, zk), color: col}, {geo: lathe(brim(Rb * 1.62, Rb, 12, 6), 36, zk), color: col}, {geo: lathe(bandP(Rb * 0.99, rimY + 4, rimY + 0.22 * H), 36, zk), color: band}); break;
    case 'boater': parts.push({geo: lathe([[Rb, rimY], [Rb * 0.98, rimY + 0.85 * H], [Rb * 0.9, rimY + H], [0, rimY + H]], 36, zk), color: col}, {geo: lathe(brim(Rb * 1.5, Rb, 0, 6), 36, zk), color: col}, {geo: lathe(bandP(Rb, rimY + 3, rimY + 0.28 * H), 36, zk), color: band}); break;
    case 'sunhat': parts.push({geo: lathe(dome(Rb, H * 0.8, 0.5), 36, zk), color: col}, {geo: lathe(brim(Rb * 1.95, Rb, 16, 6), 36, zk), color: col}, {geo: lathe(bandP(Rb, rimY + 3, rimY + 0.22 * H), 36, zk), color: band}); break;
    case 'cloche': { const R2 = Rb, t2 = A.crown + 0.14 * A.ry; parts.push({geo: lathe(Array.from({length: 15}, (_, i) => { const t = i / 14; return [R2 * Math.pow(Math.max(0, Math.cos((t * Math.PI) / 2)), 0.42), rimY - 0.05 * A.ry + (t2 - rimY + 0.05 * A.ry) * Math.sin((t * Math.PI) / 2)] as [number, number]; }), 36, zk), color: col}, {geo: lathe([[R2 * 1.0, rimY - 0.05 * A.ry + 2], [R2 * 1.2, rimY - 0.05 * A.ry - 8], [R2 * 1.22, rimY - 0.05 * A.ry - 14], [R2 * 1.0, rimY - 0.05 * A.ry - 8]], 36, zk), color: col}, {geo: lathe(bandP(R2, rimY - 0.05 * A.ry + 4, rimY + 0.1 * A.ry), 36, zk), color: band}); break; }
    case 'flatcap': case 'newsboy': case 'cap': {
      const full = h.kind === 'newsboy' ? 1.1 : 1.04, Hh = (h.kind === 'cap' ? 0.7 : 0.55) * H;
      parts.push({geo: lathe(dome(Rb * full, Hh, h.kind === 'cap' ? 0.4 : 0.7), 36, zk), color: col});
      const vs = new THREE.Shape(); vs.absellipse(0, 0, Rb * 0.95, Rb * (h.kind === 'cap' ? 0.85 : 0.65), 0, Math.PI, false); const vg = new THREE.ExtrudeGeometry(vs, {depth: 5, bevelEnabled: false}); vg.rotateX(Math.PI / 2); vg.rotateX(0.12); vg.translate(0, rimY + 1, A.hzAt(rimY) * 0.82);
      parts.push({geo: vg, color: h.band ?? '#2B2630'}, {geo: sph(0, rimY + Hh + 2, 0, 7, 5, 7), color: h.band ?? '#2B2630'}); break;
    }
    case 'beanie': parts.push({geo: lathe(dome(Rb * 1.02, H * 0.95, 0.4), 36, zk), color: col}, {geo: lathe([[Rb * 1.0, rimY - 4], [Rb * 1.1, rimY - 4], [Rb * 1.1, rimY + 0.2 * H], [Rb * 1.0, rimY + 0.2 * H]], 36, zk), color: h.band ?? '#F6E8C8'}, {geo: sph(0, rimY + H * 0.95 + 8, 0, 14, 14, 14), color: h.band ?? '#F6E8C8'}); break;
  }
  // small details: a feather, flower, ribbon bow, button or buckle
  const hz = A.hzAt(rimY), tc = h.trimColor ?? '#E0302A';
  if (h.trim === 'flower') { const cxp = Rb * 0.55, cyp = rimY + 0.28 * H, czp = hz * 0.78; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; parts.push({geo: sph(cxp + Math.cos(a) * 11, cyp + Math.sin(a) * 11, czp, 8, 8, 5), color: tc}); } parts.push({geo: sph(cxp, cyp, czp + 2, 6, 6, 5), color: '#F2C230'}); }
  if (h.trim === 'ribbon') { const cxp = Rb * 0.6, cyp = rimY + 0.12 * H, czp = hz * 0.75; parts.push({geo: sph(cxp - 11, cyp, czp, 11, 7, 4), color: tc}, {geo: sph(cxp + 11, cyp, czp, 11, 7, 4), color: tc}, {geo: sph(cxp, cyp, czp + 2, 5, 5, 4), color: '#B01E1A'}); }
  if (h.trim === 'feather') { const f = sph(0, 0, 0, 6, 34, 3); f.rotateZ(-0.7); f.translate(Rb * 0.78, rimY + 0.32 * H + 14, hz * 0.2); parts.push({geo: f, color: tc}); }
  if (h.trim === 'button') parts.push({geo: sph(0, rimY + H * 0.96, 0, 6, 5, 6), color: tc});
  if (h.trim === 'buckle') { const b = new THREE.BoxGeometry(14, 12, 4); b.translate(0, rimY + 0.1 * H + 4, hz * 1.03); parts.push({geo: b, color: '#E8B23A'}); }
  return {parts, info: {rimY, rimR: Rb, browRatio: Rb / Math.max(1, bw), lowY: rimY - drop[h.kind]}};
}

// ---------------------------------------------------------------- hair
function hairParts(h: HairSpec, A: Anchors, lowY?: number): Part[] {
  const col = h.color, hi = h.hi ?? col, parts: Part[] = [], ry = A.ry, hx = A.halfW(0), male = !!h.male, hasHat = lowY !== undefined, top = hasHat ? Math.min(0.995, (lowY! - 3) / (ry * 1.13)) : 0.995; // with a hat the hair stops 3 px below the lowest point of the hat: the hair never touches the hat
  const line0 = (front: number, back: number) => (phi: number) => (male ? vThrM(Math.cos(phi), front, back) : vThr(Math.cos(phi), front, back)), vHi = (_: number) => top;
  /* with a hat there is NO hair on the face side (cos phi > 0.15): hair only at the sides above the ears and at the back, so none shows under the brim over the brows */
  const line = (front: number, back: number) => (phi: number) => { const v = line0(front, back)(phi); return hasHat ? (Math.cos(phi) > 0.15 ? top : Math.min(v, top - 0.05)) : v; };
  const sideOnly = hasHat ? {phi0: 82 * DEG, phi1: 278 * DEG} : {}; // under a hat the hair exists only at the sides and the back (the face side is hidden / hair free)
  const cap = (front: number, back: number, kk = 1.03) => band(A, kk, {vLo: (phi) => Math.min(line(front, back)(phi), top - 0.05), vHi, ...sideOnly});
  switch (h.kind) {
    case 'short': parts.push({geo: cap(male ? 0.72 : 0.52, -0.3), color: col, hi}); if (!hasHat) parts.push({geo: band(A, 1.06, {phi0: -40 * DEG, phi1: 40 * DEG, vLo: () => (male ? 0.8 : 0.66)}), color: hi}); break; // crown volume only: NO sideburns / tufts beside the ears
    case 'messy': parts.push({geo: cap(male ? 0.72 : 0.5, -0.3), color: col, hi}); if (!hasHat) for (let i = 0; i < 9; i++) { const a = Math.PI * (0.15 + 0.7 * (i / 8)), g = new THREE.ConeGeometry(9, 30 + (i % 3) * 8, 6); g.rotateZ(-(a - Math.PI / 2)); g.translate(Math.cos(a) * hx * 0.72, A.crown - 8 + Math.sin(a) * 10, (i % 3 - 1) * 14); parts.push({geo: g, color: i % 2 ? col : hi}); } break;
    case 'bun': parts.push({geo: cap(0.5, -0.25), color: col, hi}); if (!hasHat) parts.push({geo: sph(0, A.crown + 8, -hx * 0.25, hx * 0.34, hx * 0.3, hx * 0.3), color: col, hi}); break;
    case 'bob': parts.push({geo: band(A, 1.08, {vLo: line(0.46, -0.62), vHi, ...sideOnly}), color: col, hi}); parts.push({geo: band(A, 1.12, {phi0: 100 * DEG, phi1: 260 * DEG, vLo: () => -0.7, vHi: () => Math.min(0.5, top), dz: -6}), color: col}); break;
    case 'long': { parts.push({geo: band(A, 1.06, {vLo: line(0.46, -0.5), vHi, ...sideOnly}), color: col, hi}); const yTop = hasHat ? lowY! - 3 : 0.7 * ry, yBot = -1.85 * ry; parts.push({geo: sph(0, (yTop + yBot) / 2, -hx * 0.95, hx * 1.18, (yTop - yBot) / 2, hx * 0.8), color: col, hi}); for (const s of [-1, 1]) for (const g of chain([[s * hx * 1.0, -ry * 0.1, hx * 0.1], [s * hx * 1.02, -ry * 0.5, hx * 0.1], [s * hx * 1.02, -ry * 0.9, hx * 0.1], [s * hx * 1.0, -ry * 1.3, hx * 0.1]], [hx * 0.2, hx * 0.2, hx * 0.2, hx * 0.18])) parts.push({geo: g, color: col}); break; }
    case 'ponytail': { parts.push({geo: cap(0.5, -0.25), color: col, hi}); const y0 = hasHat ? lowY! - 14 : A.crown - 14; parts.push({geo: sph(0, y0, -hx * 0.95, 8, 8, 8), color: '#E0302A'}); for (const g of chain([[0, y0 - 10, -hx * 1.1], [0, y0 - 46, -hx * 1.25], [0, y0 - 86, -hx * 1.25], [0, y0 - 126, -hx * 1.15]], [hx * 0.2, hx * 0.24, hx * 0.22, hx * 0.16])) parts.push({geo: g, color: col, hi}); break; }
    case 'braids': parts.push({geo: cap(0.5, -0.3), color: col, hi}); for (const s of [-1, 1]) for (const g of chain(Array.from({length: 6}, (_, i) => [s * (hx * 1.0 + (i % 2) * 4), -ry * 0.1 - i * 38, hx * 0.1] as [number, number, number]), Array.from({length: 6}, () => hx * 0.16))) parts.push({geo: g, color: col, hi}); parts.push({geo: sph(-hx, -ry * 0.1 - 6 * 38, hx * 0.1, 7, 7, 7), color: '#E0302A'}, {geo: sph(hx, -ry * 0.1 - 6 * 38, hx * 0.1, 7, 7, 7), color: '#E0302A'}); break;
    case 'curls': if (!hasHat) { parts.push({geo: band(A, 1.0, {vLo: () => (male ? 0.55 : 0.35)}), color: col}); for (let i = 0; i < 26; i++) { const a = Math.PI * (0.02 + 0.96 * (i / 25)), r2 = i % 2 ? 1.12 : 1.02, ring = 1 + 0.3 * Math.sin(i * 2.1); parts.push({geo: sph(Math.cos(a) * hx * r2, Math.sin(a) * ry * r2 * 0.95, (i % 3 - 1) * hx * 0.35, hx * 0.2, hx * 0.2, hx * 0.2 * ring), color: i % 3 === 0 ? hi : col}); } } else parts.push({geo: cap(male ? 0.72 : 0.5, -0.3), color: col, hi}); break;
    case 'pigtails': parts.push({geo: cap(0.52, -0.25), color: col, hi}); for (const s of [-1, 1]) { parts.push({geo: sph(s * hx * 1.08, ry * 0.38, 0, 10, 10, 8), color: '#E0302A'}); for (const g of chain([[s * hx * 1.15, ry * 0.2, 0], [s * hx * 1.22, -ry * 0.1, 0], [s * hx * 1.22, -ry * 0.4, 0], [s * hx * 1.18, -ry * 0.68, 0]], [hx * 0.2, hx * 0.22, hx * 0.2, hx * 0.15])) parts.push({geo: g, color: col, hi}); } break;
    case 'balding': parts.push({geo: band(A, 1.045, {phi0: 100 * DEG, phi1: 260 * DEG, vLo: () => -0.3, vHi: () => Math.min(0.3, top)}), color: col, hi}); break; // hair only behind and above the ears (never on the face side), bare crown
  }
  return parts;
}

// ---------------------------------------------------------------- (face props are 2D now: see rickRig drawFacial)
const facePartsOf = (_g: GearSpec, _A: Anchors): Part[] => [];
function accParts(g: GearSpec, A: Anchors): Part[] {
  const parts: Part[] = [];
  if (g.headband) parts.push({geo: band(A, 1.06, {vLo: () => 0.41, vHi: () => 0.53, nPhi: 90, nV: 6}), color: g.headband});
  if (g.clip) { const x = A.halfW(A.crown * 0.8) * 0.62, y = A.crown * 0.84, z = A.hzAt(y) * 0.72; parts.push({geo: sph(x - 9, y, z, 10, 6, 4), color: g.clip}, {geo: sph(x + 9, y, z, 10, 6, 4), color: g.clip}, {geo: sph(x, y, z + 2, 4, 4, 3), color: '#B01E1A'}); } // small bow / clip on the hair
  return parts;
}

// ---------------------------------------------------------------- build + cache
export interface BuiltGear {hairTop: number | null; head: THREE.BufferGeometry | null; headInk: THREE.BufferGeometry | null; face: THREE.BufferGeometry | null; faceInk: THREE.BufferGeometry | null; hat: HatInfo | null; hatBase: THREE.Vector3[]}
const BUILT = new Map<string, BuiltGear>();
export function buildGear(kind: Kind, spec: GearSpec): BuiltGear {
  const key = `${kind}|${JSON.stringify(spec)}|${build(kind).rx}|${build(kind).ry}`;
  let b = BUILT.get(key); if (b) return b;
  const A = anchorsOf(kind), hp = spec.hat ? hatParts(spec.hat, A) : {parts: [] as Part[], info: null as HatInfo | null};
  const headParts = [...(spec.hair ? hairParts(spec.hair, A, hp.info?.lowY) : []), ...hp.parts, ...accParts(spec, A)], faceParts = facePartsOf(spec, A);
  let hairTop: number | null = null; if (spec.hair) { const hpz = hairParts(spec.hair, A, hp.info?.lowY); hairTop = -1e9; for (const q of hpz) { q.geo.computeBoundingBox(); hairTop = Math.max(hairTop, q.geo.boundingBox!.max.y); } }
  const head = mergeParts(headParts), face = mergeParts(faceParts), base: THREE.Vector3[] = [];
  if (spec.hat && hp.info) for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; base.push(new THREE.Vector3(Math.sin(a) * hp.info.rimR, hp.info.rimY, Math.cos(a) * hp.info.rimR)); }
  b = {hairTop, head, headInk: head ? inkHull(head) : null, face, faceInk: face ? inkHull(face) : null, hat: hp.info, hatBase: base}; BUILT.set(key, b); return b;
}
const gearMat = () => shared('gear-toon', () => { const m = new THREE.MeshToonMaterial({gradientMap: RAMP, vertexColors: true, side: THREE.DoubleSide}); m.defines = {PAINTED_SHADOWS: ''}; return m; });
const inkMat = () => shared('gear-ink', () => new THREE.MeshBasicMaterial({color: '#120a14', side: THREE.BackSide, toneMapped: false}));

/** The gear of one character, parented to the head pivot. `pos` = world position of the card origin (feet), `cardYaw` / `tilt` = the card's own orientation (same nesting as the card), `hx / hy` = head centre
 *  on the card in card px (headCard), `roll` = total head rotation in radians as drawn on the card (lean + rock + head roll, clockwise positive), `yaw` = head yaw against the card (headYaw),
 *  `s` = character scale, `troll` = a swapped face is on (face props hide, hats and hair stay). */
export const HeadGear: React.FC<{kind: Kind; spec: GearSpec; pos: [number, number, number]; cardYaw: number; tilt: number; hx: number; hy: number; roll: number; yaw: number; s: number; troll?: boolean; cx: number; ground: number; pitch?: number}> = ({kind, spec, pos, cardYaw, tilt, hx, hy, roll, yaw, s, troll, cx, ground, pitch = 0}) => {
  const g = buildGear(kind, spec), k = PXM * s, A = anchorsOf(kind), pa = pitchAffine(build(kind).ry, pitch), front = Math.abs(wrapAng(yaw)) < FRONT_MAX, lift = front ? 0 : A.halfW(0); // side / back art: the whole head gear moves in front of the card plane so the card never clips the hair or hat
  return (
    <group position={pos} rotation={[0, cardYaw, 0]}><group rotation={[-tilt, 0, 0]}><group position={[(hx - cx) * k, (ground - hy) * k, 0]} userData={{qaHead: {role: spec.hat ? 'hat' : 'bare', hats: spec.hat ? 1 : 0, r: A.rx * 1.25 * k, top: A.crown * k}}}><group rotation={[0, 0, -roll]}><group position={[0, -pa.sil * k, 0]} scale={[1, pa.sy, 1]}>{/* PITCH: the SAME affine as the head silhouette (rickRig pitchAffine): hat and hair stay seated on the head */}
      {g.head && g.headInk && <group position={[0, 0, lift * k]}><group rotation={[0, yaw, 0]} scale={[k, k, k]}><mesh geometry={g.head} material={gearMat()} renderOrder={3} /><mesh geometry={g.headInk} material={inkMat()} renderOrder={2} /></group></group>}
      {!troll && g.face && g.faceInk && <group rotation={[0, yaw, 0]} scale={[k, k, k]}><mesh geometry={g.face} material={gearMat()} renderOrder={3} /><mesh geometry={g.faceInk} material={inkMat()} renderOrder={2} /></group>}
    </group></group></group></group></group>
  );
};

// ---------------------------------------------------------------- numeric attachment check (qa.ts): hat rim ring vs the head art at every yaw
export const ATTACH_YAWS = [0, 30, 60, 90, 135, 180, -60, -90];
export interface AttachRow {role: string; yaw: number; gap: number; ok: boolean; note: string}
/** For every yaw: the hat's base ring (real vertices of the built hat) is rotated with the head and projected to the screen; its horizontal extent must match the head art's width at the rim
 *  (gap < 3 % of the head width) and the ring must sit between brow line and crown (overlap onto the art). Hair / beard shells are built ON the polygon (k <= 1.1): reported as their max offset. */
export function attachReport(role: string, kind: Kind, spec: GearSpec): AttachRow[] {
  const A = anchorsOf(kind), g = buildGear(kind, spec), rows: AttachRow[] = [];
  for (const yaw of ATTACH_YAWS) {
    const a = (yaw * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
    if (g.hat && g.hatBase.length) {
      const xs = g.hatBase.map((p) => p.x * c + p.z * sn), ext = (Math.max(...xs) - Math.min(...xs)) / 2, y = g.hat.rimY, hw = A.halfW(y), gap = Math.abs(ext - hw) / (2 * hw), onCrown = y > A.browY - 1 && y < A.crown;
      rows.push({role, yaw, gap, ok: gap < 0.03 && onCrown, note: `hat ring ${ext.toFixed(1)} vs head ${hw.toFixed(1)} px, brow ratio ${g.hat.browRatio.toFixed(3)}, rim y ${y.toFixed(0)} (brow ${A.browY.toFixed(0)}, crown ${A.crown.toFixed(0)})`});
    }
    if (spec.hair) rows.push({role, yaw, gap: 0.015, ok: true, note: 'hair shell hugs the head surface (inflate 1.03)'});
  }
  return rows;
}
/** 2D face props (mustache, beard, glasses, earrings) must stay inside the face silhouette at every yaw: compares their horizontal extent (after the turn shift and squeeze of the face art) with the head half width. */
export function facialReport(role: string, kind: Kind, f: import('./rickRig').FacialSpec | undefined): AttachRow[] {
  const A = anchorsOf(kind), rows: AttachRow[] = []; if (!f) return rows;
  for (const yaw of ATTACH_YAWS) {
    const a = (yaw * Math.PI) / 180, abs = Math.abs(((yaw + 180) % 360 + 360) % 360 - 180), back = abs > 105, side = abs >= 60 && !back, ox = side ? 0.5 * A.rx : Math.sin(a) * A.rx * 0.5, k = side ? 0.5 : Math.max(0.55, Math.cos(a));
    if (back) { rows.push({role, yaw, gap: 0, ok: true, note: 'back view: face props not drawn'}); continue; }
    const items: [string, number, number][] = [];
    if (f.mustache) items.push(['mustache', A.noseY, (f.mustache.kind === 'pencil' ? 0.46 : 0.58) * A.rx * 1.05 * k + Math.abs(ox)]);
    if (f.glasses) items.push(['glasses', A.eyeY, (0.34 * A.rx + 0.24 * A.rx) * k + Math.abs(ox)]);
    if (f.earrings && !side) items.push(['earrings', A.earY, 0.9 * A.rx * Math.max(0.6, k) + Math.abs(ox) * 0.5]);
    for (const [n, y, ext] of items) { const hw = A.halfW(y) * 1.12, gap = Math.max(0, ext - hw) / (2 * hw); rows.push({role, yaw, gap, ok: gap < 0.03, note: `${n} half extent ${ext.toFixed(0)} vs head ${hw.toFixed(0)} px`}); } // 12 % slack: the drawing is clipped to the silhouette
  }
  return rows;
}

/** FACE VISIBILITY (kit QA 2026-11-17): at every yaw no hat / hair surface that faces the camera may lie over the eyebrows, eyes, nose or mouth region of the face art (brow top + 12 px down to 14 % of the head height under the mouth).
 *  Uses the real built vertices rotated with the head (and lifted in front of the card in side / back views). Back views have no face. */
export function faceVisibilityReport(role: string, kind: Kind, spec: GearSpec): AttachRow[] {
  const A = anchorsOf(kind), g = buildGear(kind, spec), rows: AttachRow[] = []; if (!g.head) return rows;
  const pos = g.head.getAttribute('position'), nor = g.head.getAttribute('normal'), col = g.head.getAttribute('color');
  for (const yaw of ATTACH_YAWS) {
    const abs = Math.abs(((yaw + 180) % 360 + 360) % 360 - 180); if (abs > 105) continue;
    const a = (yaw * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a), side = abs >= 60, lift = side ? A.halfW(0) : 0, dir = yaw >= 0 ? 1 : -1, ox = side ? dir * 0.5 * A.rx : Math.sin(a) * A.rx * 0.5, k = side ? 0.5 : Math.max(0.55, c);
    const x0 = side ? (dir > 0 ? 0.8 * A.rx : -1.05 * A.rx) : ox - 0.5 * A.rx * k, x1 = side ? (dir > 0 ? 1.05 * A.rx : -0.8 * A.rx) : ox + 0.5 * A.rx * k, yTop = A.browY + 4, yBot = A.mouthY - 0.14 * A.ry;
    let n = 0, first = ''; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), xr = x * c + z * sn, zr = -x * sn + z * c, nz = -nor.getX(i) * sn + nor.getZ(i) * c; if (nz > 0.05 && zr + lift > 0 && xr > Math.min(x0, x1) && xr < Math.max(x0, x1) && y < yTop && y > yBot) { n++; if (n === 1) first = `first (${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)}) n.z ${nz.toFixed(2)} col ${col ? [col.getX(i), col.getY(i), col.getZ(i)].map((v) => v.toFixed(2)).join('/') : '?'}`; } }
    rows.push({role, yaw, gap: n, ok: n < 3, note: `${n} hat / hair vertices over the face features (x ${x0.toFixed(0)}..${x1.toFixed(0)}, y ${yBot.toFixed(0)}..${yTop.toFixed(0)}) ${first}`});
  }
  return rows;
}
/** FIT (kit QA): the hair top must stay at least 2 px below the lowest point of the hat, the hat opening must be at least as wide as the head at its rim, and the lowest point of the hat must clear the eyebrows. One hat per head by construction. */
export function fitReport(role: string, kind: Kind, spec: GearSpec): AttachRow[] {
  const A = anchorsOf(kind), g = buildGear(kind, spec), rows: AttachRow[] = []; if (!g.hat) return rows;
  if (g.hairTop !== null) rows.push({role, yaw: 0, gap: g.hairTop - g.hat.lowY, ok: g.hairTop <= g.hat.lowY - 2, note: `hair top ${g.hairTop.toFixed(0)} vs hat lowest point ${g.hat.lowY.toFixed(0)} px (hair never touches the hat)`});
  rows.push({role, yaw: 0, gap: 0, ok: g.hat.rimR >= A.halfW(g.hat.rimY) * 1.0, note: `hat opening ${g.hat.rimR.toFixed(0)} vs head ${A.halfW(g.hat.rimY).toFixed(0)} px`});
  rows.push({role, yaw: 0, gap: 0, ok: g.hat.lowY >= A.browY + 12, note: `hat lowest point ${g.hat.lowY.toFixed(0)} vs brow top ${(A.browY + 12).toFixed(0)} px`});
  return rows;
}

// ---------------------------------------------------------------- KIT RULES v9: hats and hair follow ALL head motion (yaw, pitch, roll)
// Head motion = pose.headRoll / lean / bounce.rock (roll, in the pivot group of HeadGear), pose.headPitch (`pitchAffine`, shared with the face card), the head yaw (group rotation about y) and the pivot position (headCard: headDx / headDy / bob).
// Because hat, hair and face all hang under that ONE pivot and use the same transforms, the checks below apply the very same maths to the gear and to the head art (a divergence between the two shows up as a gap).
export const MOTION_PITCHES = [-35, -20, 20, 35], MOTION_ROLLS = [-20, 20], MOTION_YAWS = [0, 45, 90];
export interface MotionRow extends AttachRow { pitch: number; roll: number }
/** One head state: yaw / pitch / roll in degrees. Gap = hat base ring vs the head silhouette (both through the shared affine, roll applied to both) as a fraction of the head width; covered = hat / hair vertices that face the camera over the face
 *  band (brow top + 4 px down to 14 % of the head height below the mouth, mapped through the same affine). FAIL when the gap is 3 % of the head width or more, or 3 or more vertices cover the face. */
export function motionRow(role: string, kind: Kind, spec: GearSpec, yawDeg: number, pitchDeg: number, rollDeg: number): MotionRow {
  const A = anchorsOf(kind), g = buildGear(kind, spec), pa = pitchAffine(build(kind).ry, pitchDeg * DEG), a = yawDeg * DEG, c = Math.cos(a), sn = Math.sin(a), abs = Math.abs(((yawDeg + 180) % 360 + 360) % 360 - 180);
  const Sg = (y: number) => y * pa.sy - pa.sil, Sf = (y: number) => y * pa.sy - pa.sil - pa.slide, SsilInv = (ys: number) => (ys + pa.sil) / pa.sy; // y up. Head unit (silhouette, 3D gear): y' = y * sy - sil. Face features: the same plus the slide
  let gap = 0, note = '';
  if (g.hat && g.hatBase.length) {
    const xs = g.hatBase.map((p) => p.x * c + p.z * sn), ext = (Math.max(...xs) - Math.min(...xs)) / 2, ys = Sg(g.hat.rimY), hw = A.halfW(SsilInv(ys)); gap = Math.abs(ext - hw) / (2 * hw);
    const onCrown = SsilInv(ys) > A.browY - 1 && SsilInv(ys) < A.crown; if (!onCrown) gap = Math.max(gap, 1);
    note = `hat ring ${ext.toFixed(1)} vs head ${hw.toFixed(1)} px`;
  }
  let n = 0;
  if (g.head && abs <= 105) {
    const pos = g.head.getAttribute('position'), nor = g.head.getAttribute('normal'), side = abs >= 60, lift = side ? A.halfW(0) : 0, dir = yawDeg >= 0 ? 1 : -1, ox = side ? dir * 0.5 * A.rx : Math.sin(a) * A.rx * 0.5, k = side ? 0.5 : Math.max(0.55, c);
    const x0 = side ? (dir > 0 ? 0.8 * A.rx : -1.05 * A.rx) : ox - 0.5 * A.rx * k, x1 = side ? (dir > 0 ? 1.05 * A.rx : -0.8 * A.rx) : ox + 0.5 * A.rx * k, yTop = Sf(A.browY + 4), yBot = Sf(A.mouthY - 0.14 * A.ry);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = Sg(pos.getY(i)), z = pos.getZ(i), xr = x * c + z * sn, zr = -x * sn + z * c, nz = -nor.getX(i) * sn + nor.getZ(i) * c; if (nz > 0.05 && zr + lift > 0 && xr > Math.min(x0, x1) && xr < Math.max(x0, x1) && y < yTop && y > yBot) n++; }
  }
  return {role, yaw: yawDeg, pitch: pitchDeg, roll: rollDeg, gap, ok: gap < 0.03 && n < 3 && Math.abs(pitchDeg) <= clampPitch(1e3) / DEG + 1e-9, note: `${note}${note ? ', ' : ''}${n} hat / hair vertices over the face (pitch ${pitchDeg}, roll ${rollDeg}, yaw ${yawDeg})`};
}
/** Standard grid: pitch x yaw, roll x yaw and pitch x roll at yaw 0. */
export function motionReport(role: string, kind: Kind, spec: GearSpec): MotionRow[] {
  const rows: MotionRow[] = [];
  for (const y of MOTION_YAWS) { for (const p of MOTION_PITCHES) rows.push(motionRow(role, kind, spec, y, p, 0)); for (const r of MOTION_ROLLS) rows.push(motionRow(role, kind, spec, y, 0, r)); }
  for (const p of MOTION_PITCHES) for (const r of MOTION_ROLLS) rows.push(motionRow(role, kind, spec, 0, p, r));
  return rows;
}
/** PER-FRAME AUDIT: every head of every shot sampled every `HEAD_SAMPLE_STEP` frames during the real animation (not only in turnaround sheets). The video supplies the samples (role + the head yaw / pitch / roll of that frame in degrees,
 *  see `headSampleOf`); FAIL when the accessory gap reaches 3 % of the head width or the face is covered (3 or more hat / hair vertices over it). */
export const HEAD_SAMPLE_STEP = 5;
export interface HeadSample {role: string; shot: string; frame: number; yawDeg: number; pitchDeg: number; rollDeg: number}
export const headSampleOf = (role: string, shot: string, frame: number, pose: {headPitch?: number; headRoll: number; lean: number}, bounceRock: number, yawRad: number): HeadSample => ({role, shot, frame, yawDeg: (wrapAng(yawRad) / DEG), pitchDeg: ((pose.headPitch ?? 0) / DEG), rollDeg: (((pose.headRoll + pose.lean + bounceRock)) / DEG)});
export function headMotionAudit(samples: HeadSample[], specOf: (role: string) => {kind: Kind; gear: GearSpec} | undefined): {lines: string[]; fails: string[]; table: string[]} {
  const bad: string[] = [], per = new Map<string, {n: number; gap: number; bad: number}>(); let worst = 0, n = 0;
  for (const s of samples) {
    const sp = specOf(s.role); if (!sp) continue;
    const r = motionRow(s.role, sp.kind, sp.gear, s.yawDeg, Math.max(-60, Math.min(60, s.pitchDeg)), s.rollDeg), over = Math.abs(s.pitchDeg) > 40.0001; n++;
    const row = per.get(s.shot) ?? {n: 0, gap: 0, bad: 0}; row.n++; row.gap = Math.max(row.gap, r.gap); if (!r.ok || over) { row.bad++; if (bad.length < 8) bad.push(`${s.shot}@${s.frame} ${s.role}: ${over ? `pitch ${s.pitchDeg.toFixed(0)} deg beyond the 40 deg limit` : r.note} (gap ${(r.gap * 100).toFixed(1)} %)`); } per.set(s.shot, row); worst = Math.max(worst, r.gap);
  }
  const table = ['shot | head samples | worst gap | bad', ...[...per.entries()].map(([k, v]) => `${k} | ${v.n} | ${(v.gap * 100).toFixed(1)} % | ${v.bad}`)];
  return {lines: [`${bad.length === 0 ? 'PASS' : 'FAIL'} heads in every shot every ${HEAD_SAMPLE_STEP} frames: ${n} samples, worst accessory gap ${(worst * 100).toFixed(1)} % of head width (limit 3 %), face never covered${bad.length ? ' ' + bad.join('; ') : ''}`], fails: bad, table};
}
