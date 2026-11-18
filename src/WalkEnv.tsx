// WalkEnv: the WalkTest set as REAL 3D geometry shaded as clean toon / cel (3-tone ramp), with thin slightly irregular ink outlines (inverted hull) and the baked gradient / ink overlays.
// Look: reference/rick_C4_closeup.png, w_065, w_072, sheet_06, sheet_07. Painted / brushy look ONLY in shadows (PAINTED_SHADOWS) and occasional black ink lines; lit surfaces stay clean.
// Performance: blocks, tiles and bolts are InstancedMeshes (one draw call each), static props are merged into ONE vertex-coloured geometry (+ one hull draw), gradients are baked once into small
// textures, nothing is allocated per frame (the door leaf is a group whose rotation is set per frame). Everything is created inside the shot (useMemo), so the kit disposes it with the shot.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {V3, hash, makeTex, shared, useTex} from './kit/kit';
import {CEIL, CELL_Z0, CELL_Z1, DOOR_H, DOOR_W, DOOR_X, LINE_Z, SW_H, SW_Z0, SW_Z1, WALL_Z, WL, X_W, jx0, jx1} from './walkLayout';

// ---------------------------------------------------------------- light budget and colour
// three 0.187 physical lights: a surface shows albedo x (hemisphere 2.8 / pi + sun 1.5 / pi x ramp step). Ramp steps 0 / 0.25 / 0.55 -> walls (middle step) about 0.98, floor (top step) about 1.12, faces turned
// away from the sun (the cop's wall) about 0.86 = the cool shade side. `ex` divides a TARGET colour by that factor so the screen colour lands near the target.
export const K_WALL = 0.98, K_FLOOR = 0.98;
export const ex = (hex: string, k: number) => { const v = [1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) / k))); return `#${v.map((x) => x.toString(16).padStart(2, '0')).join('')}`; };
const PAL = {
  cinder: '#7FA3B8', mortar: '#46687F', tile: '#6DC2E3', tileMortar: '#3F8FB0', ledge: '#9DDDF2', ledgeShade: '#2A5578', floor: '#D5E3E8', grout: '#8FA6B2', steel: '#24516f', door: '#2F5F7F', doorPanel: '#264F6B',
  band: '#1F4768', ceiling: '#3F5B73', beam: '#1F3F6E', flange: '#2A5290', plate: '#2C4F85', bolt: '#9FB4C8', pink: '#EE4F9B', pinkMortar: '#A8326F', pinkCeil: '#C32F7C', cellFloor: '#9BB3C0', ink: '#12202E', metal: '#9FB4C0', stone: '#C4CED0',
};
export type TexFn = (w: number, h: number, paint: (c: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]) => THREE.Texture;

// ---------------------------------------------------------------- texture painters (small canvases, painted once)
const paintSign = (c: CanvasRenderingContext2D, w: number, h: number) => { // sign plate "B-7" (our own text; not the reference's)
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f1f4ec'); g.addColorStop(1, '#d6dccf'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a3a44'; c.lineWidth = 5; c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = '#1b2a33'; c.font = 'bold 74px Arial, Helvetica, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('B-7', w / 2, h / 2 + 4);
};
const paintMesh = (c: CanvasRenderingContext2D, w: number, h: number) => { c.fillStyle = '#9fb7c2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#5d7886'; c.lineWidth = 2; for (let i = -h; i < w; i += 10) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); } };
const paintSpeckle = (c: CanvasRenderingContext2D, w: number, h: number) => { // fine speckle on the dark ceiling panel
  c.fillStyle = ex(PAL.ceiling, K_WALL); c.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { const x = hash(i, 1) * w, y = hash(i, 2) * h, v = hash(i, 3); c.fillStyle = v > 0.5 ? 'rgba(190,215,235,0.35)' : 'rgba(8,20,36,0.35)'; c.fillRect(x, y, v > 0.9 ? 2 : 1, v > 0.9 ? 2 : 1); }
};
const paintDiffuser = (c: CanvasRenderingContext2D, w: number, h: number) => { // glowing fluorescent panel: bright centre, ribs
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfe6f6'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(120,150,175,0.7)'; c.lineWidth = 3; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo((i * w) / 4, 0); c.lineTo((i * w) / 4, h); c.stroke(); } c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
  c.strokeStyle = 'rgba(40,70,100,0.85)'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
};
export const paintRamp = (c: CanvasRenderingContext2D) => { c.fillStyle = 'rgb(0,0,0)'; c.fillRect(0, 0, 1, 1); c.fillStyle = 'rgb(136,136,136)'; c.fillRect(1, 0, 1, 1); c.fillStyle = 'rgb(194,194,194)'; c.fillRect(2, 0, 1, 1); }; // linear 0 / 0.25 / 0.55
const paintShaft = (c: CanvasRenderingContext2D, w: number, h: number) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,248,215,0.42)'); g.addColorStop(1, 'rgba(255,248,215,0.06)'); c.fillStyle = g; c.fillRect(0, 0, w, h); const s = c.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,0.5)'); s.addColorStop(0.2, 'rgba(0,0,0,0)'); s.addColorStop(0.8, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,0.5)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = s; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; };
export const ENV_PAINTERS: [string, (c: CanvasRenderingContext2D, w: number, h: number) => void, number, number][] = [['sign B-7', paintSign, 256, 128], ['mesh vent', paintMesh, 128, 96], ['ceiling speckle', paintSpeckle, 256, 256], ['diffuser', paintDiffuser, 256, 160], ['toon ramp', paintRamp, 3, 1], ['light shaft', paintShaft, 64, 128]];

// ---------------------------------------------------------------- geometry helpers
export const col = (hex: string) => new THREE.Color(hex);
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
export class Acc { // collects geometry, bakes a vertex colour per part and merges to ONE geometry
  geos: THREE.BufferGeometry[] = [];
  put(g0: THREE.BufferGeometry, hex: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void {
    const g = g0.index ? g0.toNonIndexed() : g0; if (g !== g0) g0.dispose(); // all parts non-indexed so they merge
    g.applyMatrix4(M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S1));
    const n = g.getAttribute('position').count, c = col(hex), a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); this.geos.push(g);
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, hex: string, r = 0.01, ry = 0, rz = 0): void { this.put(new RoundedBoxGeometry(w, h, d, 1, Math.max(0.002, Math.min(r, Math.min(w, h, d) * 0.45))), hex, x, y, z, 0, ry, rz); }
  cyl(r: number, h: number, x: number, y: number, z: number, hex: string, axis: 'x' | 'y' | 'z' = 'y', seg = 8): void { this.put(new THREE.CylinderGeometry(r, r, h, seg), hex, x, y, z, axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0); }
  ball(r: number, x: number, y: number, z: number, hex: string, sz = 1): void { const g = new THREE.SphereGeometry(r, 8, 6); g.scale(1, 1, sz); this.put(g, hex, x, y, z); }
  dome(r: number, x: number, y: number, z: number, hex: string): void { this.put(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hex, x, y, z, Math.PI / 2, 0, 0); } // half sphere bulging toward +z
  merged(): THREE.BufferGeometry { const g = mergeGeometries(this.geos, false); this.geos.forEach((q) => q.dispose()); return g; }
}
export const toon = (ramp: THREE.Texture, o: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial => { const m = new THREE.MeshToonMaterial({gradientMap: ramp, ...o}); m.defines = {PAINTED_SHADOWS: ''}; return m; }; // shadows are cut into 3 brushy tones (kit)
/** Thin dark ink outline: inverted hull pushed along the normals by about 6 mm with a smooth low-frequency wobble (slightly irregular thickness). */
export const hullMaterial = (thick = 0.006, color: string = PAL.ink): THREE.MeshBasicMaterial => {
  const m = new THREE.MeshBasicMaterial({color, side: THREE.BackSide, toneMapped: false});
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float inkN = 0.5 + 0.25 * sin(position.x * 31.0 + position.y * 17.0) + 0.25 * sin(position.y * 23.0 + position.z * 29.0);\n transformed += normalize(normal) * ' + thick.toFixed(4) + ' * (0.55 + 0.9 * inkN);'); };
  m.customProgramCacheKey = () => 'wk-ink-hull-' + thick;
  return m;
};
export interface Env { group: THREE.Group; door: THREE.Group }
/** Triangles and draw calls of an object tree (instances counted). */
export function envStats(root: THREE.Object3D): {triangles: number; drawCalls: number; instances: number} {
  let triangles = 0, drawCalls = 0, instances = 0;
  root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh || !m.visible) return; const g = m.geometry, n = (g.index ? g.index.count : g.getAttribute('position').count) / 3, k = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1; triangles += n * k; drawCalls++; instances += k; });
  return {triangles: Math.round(triangles), drawCalls, instances};
}

const PLANE = shared('wk-plane', () => new THREE.PlaneGeometry(1, 1));

// ---------------------------------------------------------------- the set
export function buildEnv(tex: TexFn): Env {
  const group = new THREE.Group(), w = (h: string) => ex(h, K_WALL), fl = (h: string) => ex(h, K_FLOOR);
  const ramp = tex(3, 1, paintRamp); ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false;
  const S = new Acc(), bolts: V3[] = [];
  const cx = DOOR_X, cw = 2 * (DOOR_W / 2 + 0.5), cd = CELL_Z0 - CELL_Z1, cz = (CELL_Z0 + CELL_Z1) / 2, wx = 0.15, wy = 2.05; // cell centre, width, depth; barred window
  const bolt = (x: number, y: number, z: number) => bolts.push([x, y, z]);

  // 1 / 2 / 3 BACK WALL: dark mortar bed (the gaps between blocks), door reveal and jambs with real thickness, the dark band, the tile ledge
  const MZ = WALL_Z - 0.04, mortar = w(PAL.mortar);
  S.box(jx0 + WL, 3.0, 0.3, (-WL + jx0) / 2, 1.5, MZ - 0.15, mortar); S.box(WL - jx1, 3.0, 0.3, (jx1 + WL) / 2, 1.5, MZ - 0.15, mortar); S.box(DOOR_W, 3.0 - DOOR_H, 0.3, DOOR_X, (DOOR_H + 3.0) / 2, MZ - 0.15, mortar);
  const lin = w('#3c7899');
  S.box(0.02, DOOR_H, 0.34, jx0 + 0.01, DOOR_H / 2, WALL_Z - 0.17, lin, 0.004); S.box(0.02, DOOR_H, 0.34, jx1 - 0.01, DOOR_H / 2, WALL_Z - 0.17, lin, 0.004); S.box(DOOR_W, 0.02, 0.34, DOOR_X, DOOR_H - 0.01, WALL_Z - 0.17, lin, 0.004); // inner reveal (steel lining)
  const jamb = w(PAL.steel);
  S.box(0.1, DOOR_H + 0.1, 0.34, jx0 - 0.05, (DOOR_H + 0.1) / 2, WALL_Z + 0.02, jamb, 0.012); S.box(0.1, DOOR_H + 0.1, 0.34, jx1 + 0.05, (DOOR_H + 0.1) / 2, WALL_Z + 0.02, jamb, 0.012); S.box(DOOR_W + 0.2, 0.1, 0.34, DOOR_X, DOOR_H + 0.05, WALL_Z + 0.02, jamb, 0.012);
  for (const y of [0.35, 1.0, 1.65]) { S.cyl(0.02, 0.16, jx1 - 0.03, y, WALL_Z - 0.2, w('#8fa6b4')); S.ball(0.024, jx1 - 0.03, y + 0.085, WALL_Z - 0.2, w('#8fa6b4')); S.box(0.05, 0.14, 0.012, jx1 - 0.02, y, WALL_Z - 0.2 + 0.03, w('#8fa6b4'), 0.004); } // hinge barrels with pins
  S.box(2 * WL, 3.0 - 2.57, 0.08, 0, (2.57 + 3.0) / 2, WALL_Z + 0.03, w(PAL.band));
  for (const [a, b] of [[-WL, jx0 - 0.1], [jx1 + 0.1, WL]]) { const len = b - a, mx = (a + b) / 2; S.box(len, 0.07, 0.09, mx, 1.185, WALL_Z + 0.025, w(PAL.ledge), 0.014); S.box(len, 0.03, 0.04, mx, 1.135, WALL_Z + 0.0, w(PAL.ledgeShade), 0.006); } // thick top ledge + its dark underside
  // neighbouring steel door with a wire-mesh vent, handle and lock plate
  S.box(0.84, 2.0, 0.08, -1.42, 1.0, WALL_Z + 0.04, w('#3F8FB0'), 0.012); S.box(0.62, 0.4, 0.02, -1.42, 1.55, WALL_Z + 0.09, w('#2f7389'), 0.006); S.box(0.5, 0.22, 0.02, -1.42, 0.85, WALL_Z + 0.09, w('#2f7389'), 0.006); S.box(0.1, 0.03, 0.03, -1.12, 1.0, WALL_Z + 0.1, w(PAL.metal), 0.006);
  // side walls (out of frame, closed so the set has no edges), floor base (grout colour), yellow floor line
  S.box(0.1, 3.0, 14, -WL - 0.05, 1.5, -1.2, w(PAL.cinder)); S.box(0.1, 3.0, 14, WL + 0.05, 1.5, -1.2, w(PAL.cinder));
  S.box(2 * WL, 0.1, 14, 0, -0.05, -1.2, fl(PAL.grout), 0.01); S.box(2 * WL, 0.012, 0.13, 0, 0.018, LINE_Z, fl('#f2c418'), 0.004);

  // 7 SIGN "B-7" (bevelled frame, 4 screws, slight shadow), 6 DOME SECURITY LIGHT with bracket, 5 CONDUIT + JUNCTION BOX
  const sx = DOOR_X, sy = 2.3;
  S.box(0.34, 0.17, 0.03, sx, sy, WALL_Z + 0.015, w('#1b2a33'), 0.01); for (const [dx, dy] of [[-0.15, -0.065], [0.15, -0.065], [-0.15, 0.065], [0.15, 0.065]]) bolt(sx + dx, sy + dy, WALL_Z + 0.034);
  S.box(0.1, 0.1, 0.014, sx, 2.47, WALL_Z + 0.007, w('#46606f'), 0.005); S.box(0.03, 0.03, 0.07, sx, 2.47, WALL_Z + 0.045, w('#46606f'), 0.004); S.cyl(0.056, 0.03, sx, 2.47, WALL_Z + 0.09, w('#2e3f4f'), 'z', 12); S.dome(0.07, sx, 2.47, WALL_Z + 0.105, w('#7d95a6')); S.cyl(0.062, 0.012, sx, 2.47, WALL_Z + 0.105, w(PAL.ink), 'z', 12);
  const jx = 0.5;
  S.cyl(0.013, 0.8, jx, 2.6, WALL_Z + 0.085, w(PAL.ink)); S.box(0.04, 0.03, 0.03, jx, 2.7, WALL_Z + 0.075, w(PAL.metal), 0.004); S.box(0.04, 0.03, 0.03, jx, 2.4, WALL_Z + 0.075, w(PAL.metal), 0.004);
  S.box(0.17, 0.17, 0.075, jx, 2.12, WALL_Z + 0.0375, w(PAL.metal), 0.01); S.cyl(0.02, 0.06, jx, 2.23, WALL_Z + 0.075, w(PAL.metal), 'y', 8); for (const [dx, dy] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) bolt(jx + dx, 2.12 + dy, WALL_Z + 0.078);

  // 3 CEILING beams (web + flanges, bevelled), square bracket plates with 4 bolts where the beams meet the wall; 4 fluorescent fixtures with hanging brackets
  const BZ0 = WALL_Z + 0.075, BZ1 = 5.8, bzc = (BZ0 + BZ1) / 2, bl = BZ1 - BZ0;
  for (const bx of [-1.6, -0.5, 0.55, 1.65]) {
    S.box(0.045, 0.24, bl, bx, CEIL - 0.14, bzc, w(PAL.beam), 0.008); S.box(0.16, 0.04, bl, bx, CEIL - 0.26, bzc, w(PAL.flange), 0.01); S.box(0.16, 0.04, bl, bx, CEIL - 0.02, bzc, w(PAL.flange), 0.01);
    S.box(0.34, 0.36, 0.025, bx, CEIL - 0.14, BZ0 + 0.0125, w(PAL.plate), 0.01); for (const [dx, dy] of [[-0.12, -0.13], [0.12, -0.13], [-0.12, 0.13], [0.12, 0.13]]) bolt(bx + dx, CEIL - 0.14 + dy, BZ0 + 0.03);
  }
  for (const sd of [-1, 1]) {
    const fx = sd * 1.1, fz = -5.6;
    S.box(0.56, 0.11, 0.44, fx, CEIL - 0.095, fz, w(PAL.beam), 0.012); S.box(0.6, 0.03, 0.04, fx, CEIL - 0.16, fz - 0.21, w(PAL.flange), 0.006); S.box(0.6, 0.03, 0.04, fx, CEIL - 0.16, fz + 0.21, w(PAL.flange), 0.006);
    for (const dz of [-0.15, 0.15]) { S.box(0.07, 0.012, 0.05, fx, CEIL - 0.006, fz + dz, w(PAL.metal), 0.004); S.cyl(0.008, 0.04, fx, CEIL - 0.026, fz + dz, w(PAL.metal)); S.box(0.07, 0.012, 0.05, fx, CEIL - 0.04, fz + dz, w(PAL.metal), 0.004); } // hanging bracket: top plate, rod, clamp
  }

  // 8 / 9 / 11 PARTITION (the cop's side wall): mortar bed, tile ledge, post, cap, conduit run with clamps
  const pl = Math.abs(SW_Z0 - SW_Z1), pzc = (SW_Z0 + SW_Z1) / 2;
  S.box(0.09, SW_H, pl, X_W + 0.055, SW_H / 2, pzc, mortar); S.box(0.044, 0.07, pl, X_W + 0.008, 1.185, pzc, w(PAL.ledge), 0.012); S.box(0.03, 0.03, pl, X_W + 0.02, 1.135, pzc, w(PAL.ledgeShade), 0.006);
  S.box(0.14, SW_H, 0.1, X_W + 0.03, SW_H / 2, SW_Z1, w(PAL.steel), 0.012); S.box(0.2, 0.05, pl + 0.1, X_W + 0.05, SW_H + 0.025, pzc, w(PAL.steel), 0.01);
  S.cyl(0.035, pl - 0.2, X_W - 0.05, 2.46, pzc, w(PAL.metal), 'z', 10); for (const t of [-0.8, 0, 0.8]) S.box(0.05, 0.1, 0.04, X_W - 0.03, 2.46, pzc + t, w('#6f8798'), 0.006);

  // 9 CELL: pink mortar bed, ceiling, floor base, barred window with stone sill, bench with legs and lip, floor drain grate
  const pm = w(PAL.pinkMortar);
  S.box(cw + 0.3, 3.0, 0.1, cx, 1.5, CELL_Z1 - 0.09, pm); S.box(0.1, 3.0, cd, cx - cw / 2 - 0.09, 1.5, cz, pm); S.box(0.1, 3.0, cd, cx + cw / 2 + 0.09, 1.5, cz, pm);
  S.box(cw + 0.3, 0.08, cd + 0.2, cx, 3.04, cz, w(PAL.pinkCeil)); S.box(cw + 0.3, 0.1, cd, cx, -0.05, cz, fl('#7f97a4'));
  S.box(0.8, 0.62, 0.08, wx, wy, CELL_Z1 - 0.01, w('#3a4852'), 0.012); S.box(0.96, 0.07, 0.2, wx, wy - 0.35, CELL_Z1 + 0.03, w(PAL.stone), 0.015); // window frame + stone sill
  for (let i = 0; i < 5; i++) S.cyl(0.007, 0.46, wx - 0.24 + i * 0.12, wy, CELL_Z1 + 0.036, w(PAL.ink), 'y', 6); S.cyl(0.007, 0.62, wx, wy, CELL_Z1 + 0.036, w(PAL.ink), 'x', 6);
  S.box(0.55, 0.06, 1.6, 0.4, 0.42, -7.9, w('#a8bcc8'), 0.015); S.box(0.04, 0.045, 1.6, 0.145, 0.4725, -7.9, w('#bfd0da'), 0.012); S.box(0.05, 0.39, 0.05, 0.2, 0.195, -8.5, w('#8197a4'), 0.008); S.box(0.05, 0.39, 0.05, 0.2, 0.195, -7.3, w('#8197a4'), 0.008); S.box(0.07, 0.22, 1.5, 0.66, 0.31, -7.9, w('#8197a4'), 0.01);
  S.cyl(0.12, 0.012, -0.5, 0.018, -7.4, fl('#5f7480'), 'y', 14); for (let i = -2; i <= 2; i++) S.box(0.17, 0.006, 0.012, -0.5, 0.026, -7.4 + i * 0.035, fl(PAL.ink), 0.002);
  const stat = new THREE.Mesh(S.merged(), toon(ramp, {vertexColors: true})); stat.castShadow = true; stat.receiveShadow = true; group.add(stat);
  const hull = hullMaterial(), statHull = new THREE.Mesh(stat.geometry, hull); group.add(statHull);

  // 1 / 2 / 10 INSTANCED BLOCKS and TILES: bevelled, own colour per block, dark mortar gaps; one InstancedMesh for every wall block / tile of the set
  const BW = 0.43, BH = 0.21, BD = 0.05;
  interface Inst { x: number; y: number; z: number; ry: number; sx: number; sy: number; hex: string; i: number }
  const list: Inst[] = [];
  const grid = (u0: number, u1: number, y0: number, y1: number, pu: number, rows: number, hex: string, at: (u: number, y: number) => [number, number, number, number], skip?: (u: number, y: number) => boolean) => {
    const pv = (y1 - y0) / rows;
    for (let r = 0; r < rows; r++) for (let k = -1; k <= Math.ceil((u1 - u0) / pu); k++) {
      const u = u0 + k * pu + pu / 2 + (r % 2 ? pu / 2 : 0), y = y0 + (r + 0.5) * pv; if (u < u0 + pu * 0.3 || u > u1 - pu * 0.3 || (skip && skip(u, y))) continue;
      const [x, yy, z, ry] = at(u, y), i = list.length, c = col(hex); c.offsetHSL((hash(i, 11) - 0.5) * 0.02, (hash(i, 12) - 0.5) * 0.06, (hash(i, 13) - 0.5) * 0.06);
      list.push({x: x + (hash(i, 14) - 0.5) * 0.004, y: yy + (hash(i, 15) - 0.5) * 0.004, z, ry, sx: (pu * 0.96) / BW, sy: (pv * 0.92) / BH, hex: `#${c.getHexString()}`, i});
    }
  };
  const doorSkip = (x: number, y: number) => (x > jx0 - 0.2 && x < jx1 + 0.2 && y < DOOR_H + 0.2) || (x > -1.92 && x < -0.92 && y < 2.1);
  const onBack = (u: number, y: number): [number, number, number, number] => [u, y, WALL_Z - BD / 2, 0];
  grid(-WL, WL, 1.22, 2.57, 0.45, 6, w(PAL.cinder), onBack, doorSkip); // 1 cinder blocks, back wall
  grid(-WL, WL, 0, 1.15, 0.45, 5, w(PAL.tile), onBack, doorSkip); // 2 cyan tile band
  const onPart = (u: number, y: number): [number, number, number, number] => [X_W + BD / 2, y, u, Math.PI / 2];
  grid(SW_Z0, SW_Z1, 1.22, SW_H, 0.45, 6, w(PAL.cinder), onPart); grid(SW_Z0, SW_Z1, 0, 1.15, 0.45, 5, w(PAL.tile), onPart); // 11 the cop's wall
  const pinkB = w(PAL.pink), winSkip = (x: number, y: number) => x > wx - 0.5 && x < wx + 0.5 && y > 1.62 && y < 2.5;
  grid(cx - cw / 2, cx + cw / 2, 0, 3.0, 0.45, 13, pinkB, (u, y) => [u, y, CELL_Z1 - BD / 2, 0], winSkip); // 9 pink cell, back and sides
  grid(CELL_Z1, CELL_Z0, 0, 3.0, 0.45, 13, pinkB, (u, y) => [cx - cw / 2 - BD / 2, y, u, Math.PI / 2]); grid(CELL_Z1, CELL_Z0, 0, 3.0, 0.45, 13, pinkB, (u, y) => [cx + cw / 2 + BD / 2, y, u, Math.PI / 2]);
  const blocks = new THREE.InstancedMesh(new RoundedBoxGeometry(BW, BH, BD, 1, 0.011), toon(ramp), list.length);
  list.forEach((b, i) => { M4.compose(V.set(b.x, b.y, b.z), Q.setFromEuler(E.set(0, b.ry, (hash(i, 16) - 0.5) * 0.02)), new THREE.Vector3(b.sx, b.sy, 1)); blocks.setMatrixAt(i, M4); blocks.setColorAt(i, col(b.hex)); });
  blocks.instanceMatrix.needsUpdate = true; if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true; blocks.receiveShadow = true; group.add(blocks);
  // 10 FLOOR TILES: big, slightly different tones, thin grout (the grout-coloured base shows between them)
  const ft: Inst[] = [];
  for (let r = 0; r < 14; r++) for (let k = 0; k < 6; k++) { const i = ft.length, c = col(fl(PAL.floor)); c.offsetHSL((hash(i, 21) - 0.5) * 0.015, (hash(i, 22) - 0.5) * 0.04, (hash(i, 23) - 0.5) * 0.05); ft.push({x: -1.75 + k * 0.7, y: 0.006, z: -5.85 + r * 0.7, ry: 0, sx: 1, sy: 1, hex: `#${c.getHexString()}`, i}); }
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) { const i = ft.length, c = col(fl(PAL.cellFloor)); c.offsetHSL(0, 0, (hash(i, 24) - 0.5) * 0.05); ft.push({x: cx - cw / 2 + 0.33 + k * 0.67, y: 0.006, z: CELL_Z0 - 0.37 - r * 0.73, ry: 0, sx: 1, sy: 1, hex: `#${c.getHexString()}`, i}); }
  const tiles = new THREE.InstancedMesh(new RoundedBoxGeometry(0.68, 0.012, 0.68, 1, 0.004), toon(ramp), ft.length);
  ft.forEach((b, i) => { M4.compose(V.set(b.x, b.y, b.z), Q.setFromEuler(E.set(0, 0, 0)), S1); tiles.setMatrixAt(i, M4); tiles.setColorAt(i, col(b.hex)); });
  tiles.instanceMatrix.needsUpdate = true; if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true; tiles.receiveShadow = true; group.add(tiles);
  // BOLTS / SCREWS: one InstancedMesh (beam plates 16, sign 4, junction box 4)
  const boltGeo = new THREE.SphereGeometry(0.014, 6, 4); boltGeo.scale(1, 1, 0.55);
  const bm = new THREE.InstancedMesh(boltGeo, toon(ramp, {color: w(PAL.bolt)}), bolts.length); bolts.forEach((b, i) => { M4.compose(V.set(b[0], b[1], b[2]), Q.identity(), S1); bm.setMatrixAt(i, M4); }); bm.instanceMatrix.needsUpdate = true; group.add(bm);

  // textured / unlit parts: ceiling panel with speckle, sign plate + its shadow, wire-mesh vent, glowing fluorescent diffusers, cell window glass, light shaft + sun patch
  const plane = (wd: number, ht: number, x: number, y: number, z: number, rx = 0, ry = 0): THREE.BufferGeometry => { const g = new THREE.PlaneGeometry(wd, ht); g.applyMatrix4(M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, 0)), S1)); return g; };
  const ceilMap = tex(256, 256, paintSpeckle, [WL * 2 / 0.6, 14 / 0.6]); group.add(new THREE.Mesh(plane(2 * WL, 14, 0, CEIL, -1.2, Math.PI / 2), toon(ramp, {map: ceilMap})));
  const signMap = tex(256, 128, paintSign); group.add(new THREE.Mesh(plane(0.3, 0.13, sx, sy, WALL_Z + 0.0305), new THREE.MeshBasicMaterial({map: signMap, toneMapped: false})));
  const sh = new THREE.Mesh(plane(0.4, 0.23, sx + 0.014, sy - 0.018, WALL_Z + 0.004), new THREE.MeshBasicMaterial({color: '#0e2236', transparent: true, opacity: 0.24, depthWrite: false, toneMapped: false})); sh.renderOrder = 1; group.add(sh);
  const meshMap = tex(128, 96, paintMesh); group.add(new THREE.Mesh(plane(0.52, 0.34, -1.42, 1.55, WALL_Z + 0.101), new THREE.MeshBasicMaterial({map: meshMap, toneMapped: false})));
  const difMap = tex(256, 160, paintDiffuser); group.add(new THREE.Mesh(mergeGeometries([plane(0.46, 0.34, -1.1, CEIL - 0.158, -5.6, Math.PI / 2), plane(0.46, 0.34, 1.1, CEIL - 0.158, -5.6, Math.PI / 2)], false), new THREE.MeshBasicMaterial({map: difMap, toneMapped: false})));
  group.add(new THREE.Mesh(plane(0.6, 0.44, wx, wy, CELL_Z1 + 0.0765), new THREE.MeshBasicMaterial({color: '#f4fcff', toneMapped: false})));
  const shaftMap = tex(64, 128, paintShaft), shaft = new THREE.BufferGeometry();
  { const A = [wx - 0.3, wy + 0.22, CELL_Z1 + 0.08], B = [wx + 0.3, wy + 0.22, CELL_Z1 + 0.08], C = [wx + 0.3 - 0.9, 0.02, CELL_Z1 + 1.7], D = [wx - 0.3 - 0.9, 0.02, CELL_Z1 + 1.7]; // light shaft quad window -> floor, and the sun patch on the cell floor
    const P = [A, B, C, A, C, D, [wx - 1.2, 0.022, CELL_Z1 + 1.55], [wx - 0.45, 0.022, CELL_Z1 + 1.55], [wx - 0.45, 0.022, CELL_Z1 + 2.2], [wx - 1.2, 0.022, CELL_Z1 + 1.55], [wx - 0.45, 0.022, CELL_Z1 + 2.2], [wx - 1.2, 0.022, CELL_Z1 + 2.2]];
    const UV = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1], [0, 0.15], [1, 0.15], [1, 0.5], [0, 0.15], [1, 0.5], [0, 0.5]];
    shaft.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.flat()), 3)); shaft.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(UV.flat()), 2)); }
  const sm = new THREE.Mesh(shaft, new THREE.MeshBasicMaterial({map: shaftMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false})); sm.renderOrder = 3; group.add(sm);

  // 8 DOOR LEAF (animated group, hinged at the right jamb, swings INTO the cell): slab, panels, barred window, wire-mesh vent, handle, lock plate, hinge plates; casts a shadow on the floor
  const door = new THREE.Group(); door.position.set(jx1 - 0.03, 0, WALL_Z - 0.2); group.add(door);
  const Lf = new Acc(), dh = (h: string) => w(h);
  Lf.box(DOOR_W - 0.04, DOOR_H - 0.04, 0.1, -DOOR_W / 2, DOOR_H / 2 - 0.02, 0, dh(PAL.door), 0.014); Lf.box(0.84, 0.4, 0.02, -0.5, 0.82, 0.055, dh(PAL.doorPanel), 0.008); Lf.box(0.84, 0.04, 0.025, -0.5, 1.1, 0.055, dh('#1c3a4a'), 0.006);
  Lf.box(0.3, 0.34, 0.03, -0.5, 1.52, 0.06, dh('#1c3a4a'), 0.008); for (const dx of [-0.07, 0, 0.07]) Lf.cyl(0.008, 0.3, -0.5 + dx, 1.52, 0.088, dh(PAL.ink), 'y', 6);
  Lf.box(0.56, 0.2, 0.025, -0.5, 0.25, 0.06, dh('#1c3a4a'), 0.006); Lf.box(0.13, 0.028, 0.032, -0.84, 0.98, 0.085, dh(PAL.metal), 0.006); Lf.cyl(0.03, 0.02, -0.9, 0.98, 0.07, dh(PAL.metal), 'z', 10);
  Lf.box(0.075, 0.2, 0.016, -0.9, 1.1, 0.06, dh('#8fa6b4'), 0.004); Lf.cyl(0.012, 0.02, -0.9, 1.14, 0.07, dh(PAL.ink), 'z', 6); for (const y of [0.35, 1.0, 1.65]) Lf.box(0.05, 0.14, 0.03, -0.035, y, 0.0, dh('#8fa6b4'), 0.004);
  const leaf = new THREE.Mesh(Lf.merged(), toon(ramp, {vertexColors: true})); leaf.castShadow = true; leaf.receiveShadow = true; door.add(leaf); door.add(new THREE.Mesh(leaf.geometry, hull));
  const lg = new THREE.Mesh(plane(0.26, 0.3, -0.5, 1.52, 0.0765), new THREE.MeshBasicMaterial({color: '#e8f6ff', toneMapped: false})); door.add(lg);
  door.add(new THREE.Mesh(plane(0.52, 0.16, -0.5, 0.25, 0.0765), new THREE.MeshBasicMaterial({map: meshMap, toneMapped: false})));
  return {group, door};
}

/** Environment component: builds the set once per shot; the per-frame work is one rotation. */
export const EnvScene: React.FC<{doorAngle: number}> = ({doorAngle}) => {
  const env = useMemo(() => buildEnv((w, h, p, r) => makeTex(w, h, p, r)), []);
  env.door.rotation.y = doorAngle;
  return <primitive object={env.group} />;
};

// ---------------------------------------------------------------- baked gradients and ink accents (one canvas texture each, built once, no per-frame work)
// The gradients (light falloff, cool far end, warm sun patch, soft ceiling and cell gradients) used to come from the lights; the brightening pass (hemisphere 2.8, sun 0.9) made the ambient
// almost uniform, so they are painted here instead, as soft alpha overlays on the lit surfaces. Painted / ink strokes appear ONLY in shadows and as occasional black accent lines.
const INKC = 'rgba(14,26,38,0.62)';
const inkStroke = (c: CanvasRenderingContext2D, xa: number, ya: number, xb: number, yb: number, sd: number, lw: number, alpha = 1) => { // a hand-drawn black line: wobble, round caps, dry-brush breaks
  const n = Math.max(4, Math.round(Math.hypot(xb - xa, yb - ya) / 22)), nx = -(yb - ya), ny = xb - xa, nl = Math.hypot(nx, ny) || 1;
  c.strokeStyle = INKC.replace('0.62', String(0.62 * alpha)); c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
  let pen = false;
  for (let i = 0; i <= n; i++) {
    const q = i / n, j = (hash(sd + i * 2.3, 7) - 0.5) * lw * 0.9, x = xa + (xb - xa) * q + (nx / nl) * j, y = ya + (yb - ya) * q + (ny / nl) * j, brk = hash(sd + i * 5.7, 3) > 0.9;
    if (brk) { if (pen) c.stroke(); pen = false; continue; }
    if (!pen) { c.beginPath(); c.moveTo(x, y); pen = true; } else c.lineTo(x, y);
  }
  if (pen) c.stroke();
};
const SW = 4.2, FLOOR_L = 14, FLOOR_Z0 = -8.2; // floor overlay: x +-2.1, z from -8.2 (canvas top) to 5.8
const paintFloorGrad = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const zy = (z: number) => ((z - FLOOR_Z0) / FLOOR_L) * h;
  const g = c.createLinearGradient(0, zy(-6.3), 0, zy(-2.4)); g.addColorStop(0, 'rgba(58,100,140,0.3)'); g.addColorStop(0.55, 'rgba(120,160,190,0.04)'); g.addColorStop(1, 'rgba(255,240,210,0.2)'); c.fillStyle = g; c.fillRect(0, 0, w, h); // cooler and darker at the far end, light near the camera
  const hx = c.createLinearGradient(0, 0, w, 0); hx.addColorStop(0, 'rgba(60,100,140,0.16)'); hx.addColorStop(0.25, 'rgba(60,100,140,0)'); hx.addColorStop(0.75, 'rgba(60,100,140,0)'); hx.addColorStop(1, 'rgba(60,100,140,0.16)'); c.fillStyle = hx; c.fillRect(0, 0, w, h); // falloff toward the side walls
  { // bright sun patch coming from the cell through the open door: a soft parallelogram that leans toward -x as it comes forward, warm, fading with distance
    const px = (x: number) => ((x + 2.1) / SW) * w, P: [number, number][] = [[px(-0.8), zy(-6.2)], [px(0.2), zy(-6.2)], [px(-0.45), zy(-4.7)], [px(-1.6), zy(-4.7)]];
    const pg = c.createLinearGradient(0, zy(-6.2), 0, zy(-4.7)); pg.addColorStop(0, 'rgba(255,238,195,0.62)'); pg.addColorStop(1, 'rgba(255,236,190,0)'); c.fillStyle = pg; c.beginPath(); P.forEach((q, k) => (k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fill();
    const pw = c.createLinearGradient(0, zy(-6.2), 0, zy(-4.2)); pw.addColorStop(0, 'rgba(255,240,205,0.16)'); pw.addColorStop(1, 'rgba(255,240,205,0)'); c.fillStyle = pw; c.beginPath(); [[px(-1.0), zy(-6.2)], [px(0.4), zy(-6.2)], [px(-0.3), zy(-4.2)], [px(-1.9), zy(-4.2)]].forEach((q, k) => (k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fill();
  }
};
const paintBackWallGrad = (c: CanvasRenderingContext2D, w: number, h: number) => { // 4.2 x 3.0 m
  const px = (x: number) => ((x + 2.1) / SW) * w, py = (y: number) => (1 - y / 3) * h;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(35,65,95,0.38)'); g.addColorStop(0.35, 'rgba(35,65,95,0)'); g.addColorStop(0.8, 'rgba(255,244,222,0.07)'); g.addColorStop(1, 'rgba(60,110,150,0.14)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  const r = c.createRadialGradient(px(-0.3), py(1.4), 0, px(-0.3), py(1.4), w * 0.5); r.addColorStop(0, 'rgba(255,250,235,0.16)'); r.addColorStop(1, 'rgba(255,250,235,0)'); c.fillStyle = r; c.fillRect(0, 0, w, h); // lighter near the door
  const d = c.createLinearGradient(0, 0, w, h); d.addColorStop(0, 'rgba(70,110,160,0.14)'); d.addColorStop(0.5, 'rgba(70,110,160,0)'); d.addColorStop(1, 'rgba(255,235,200,0.12)'); c.fillStyle = d; c.fillRect(0, 0, w, h); // diagonal cool -> warm
  c.clearRect(px(DOOR_X - DOOR_W / 2 - 0.13), py(DOOR_H + 0.13), px(DOOR_X + DOOR_W / 2 + 0.13) - px(DOOR_X - DOOR_W / 2 - 0.13), py(0) - py(DOOR_H + 0.13)); // keep the door opening clear
  // occasional black ink accents: door jambs and lintel, the dark band edges
  inkStroke(c, px(DOOR_X - DOOR_W / 2 - 0.12), py(0), px(DOOR_X - DOOR_W / 2 - 0.12), py(DOOR_H + 0.13), 1, 3.2); inkStroke(c, px(DOOR_X + DOOR_W / 2 + 0.12), py(0), px(DOOR_X + DOOR_W / 2 + 0.12), py(DOOR_H + 0.13), 2, 3.2);
  inkStroke(c, px(DOOR_X - DOOR_W / 2 - 0.12), py(DOOR_H + 0.13), px(DOOR_X + DOOR_W / 2 + 0.12), py(DOOR_H + 0.13), 3, 3.2);
  inkStroke(c, 0, py(2.57), w, py(2.57), 4, 2.4, 0.8); inkStroke(c, 0, py(2.87), w, py(2.87), 5, 2.4, 0.8);
};
const paintSideGrad = (c: CanvasRenderingContext2D, w: number, h: number) => { // the cop's side wall, canvas left = far end
  const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(50,90,130,0.4)'); g.addColorStop(0.6, 'rgba(120,160,190,0.05)'); g.addColorStop(1, 'rgba(255,240,210,0.2)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  const v = c.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(35,65,95,0.28)'); v.addColorStop(0.4, 'rgba(35,65,95,0)'); c.fillStyle = v; c.fillRect(0, 0, w, h);
  inkStroke(c, 6, h * 0.04, 6, h * 0.98, 6, 3.4); inkStroke(c, w - 8, h * 0.05, w - 8, h * 0.98, 7, 3, 0.8);
};
const paintCeilingGrad = (c: CanvasRenderingContext2D, w: number, h: number) => { // ceiling plane faces down, canvas top = near the camera, bottom = far end
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(150,185,215,0.16)'); g.addColorStop(0.55, 'rgba(60,95,130,0)'); g.addColorStop(1, 'rgba(10,25,50,0.5)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  const hx = c.createLinearGradient(0, 0, w, 0); hx.addColorStop(0, 'rgba(10,25,50,0.22)'); hx.addColorStop(0.3, 'rgba(10,25,50,0)'); hx.addColorStop(0.7, 'rgba(10,25,50,0)'); hx.addColorStop(1, 'rgba(10,25,50,0.22)'); c.fillStyle = hx; c.fillRect(0, 0, w, h);
};
const paintBeamInk = (c: CanvasRenderingContext2D, w: number, h: number) => { // black ink along the bottom edges of the 4 ceiling beams (x = -1.6, -0.5, 0.55, 1.65, 0.16 wide)
  [-1.6, -0.5, 0.55, 1.65].forEach((bx, i) => [-0.08, 0.08].forEach((o, j) => { const x = ((bx + o + 2.1) / SW) * w; inkStroke(c, x, h * 0.02, x, h * 0.98, i * 4 + j + 11, 3.2, 0.85); }));
};
const paintCellGrad = (c: CanvasRenderingContext2D, w: number, h: number) => { // pink cell: lighter at the window side / top, deeper magenta low, warm-cool diagonal
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,205,230,0.32)'); g.addColorStop(0.55, 'rgba(255,205,230,0)'); g.addColorStop(1, 'rgba(140,15,85,0.34)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  const d = c.createLinearGradient(0, 0, w, h); d.addColorStop(0, 'rgba(255,235,200,0.14)'); d.addColorStop(1, 'rgba(110,40,170,0.16)'); c.fillStyle = d; c.fillRect(0, 0, w, h);
};
/** The cast "door wall" shadow on the floor, painted: hard wobbly edges, two cel tones, a few black hatch strokes (ink only in shadow). Footprint x -2.6..1.0, z -5.0..-6.2. */
const paintShadowPatch = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const P: [number, number][] = [[0, 0], [0.806 * w, 0], [w, h], [0, h]], edge = (a: [number, number], b: [number, number], sd: number): [number, number][] => { const o: [number, number][] = [], n = 14, nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny) || 1; for (let i = 0; i < n; i++) { const q = i / n, j = (hash(sd + i * 1.9, 5) - 0.5) * 7; o.push([a[0] + (b[0] - a[0]) * q + (nx / nl) * j, a[1] + (b[1] - a[1]) * q + (ny / nl) * j]); } return o; };
  const poly = P.flatMap((p, i) => edge(p, P[(i + 1) % 4], i * 13)), path = () => { c.beginPath(); poly.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); };
  path(); c.fillStyle = 'rgba(76,127,160,0.4)'; c.fill();
  c.save(); path(); c.clip(); c.fillStyle = 'rgba(46,92,130,0.26)'; c.beginPath(); c.moveTo(w * 0.05, h * 0.45); c.lineTo(w * 0.78, h * 0.45); c.lineTo(w * 0.92, h); c.lineTo(w * 0.05, h); c.closePath(); c.fill(); // darker core
  for (let i = -6; i < 24; i++) { const x = i * 26 + (hash(i, 8) - 0.5) * 8; inkStroke(c, x, h * 0.55, x + h * 0.7, h * 1.05, 40 + i, 2.4, 0.7); } // hatch strokes, shadow only
  c.restore();
  { const ux = (x: number) => ((x + 2.6) / 3.6) * w, e = c.createLinearGradient(0, 0, 0, h); e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(1, 'rgba(0,0,0,0.55)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = e; c.beginPath(); c.moveTo(ux(-0.8), 0); c.lineTo(ux(0.2), 0); c.lineTo(ux(-0.32), h); c.lineTo(ux(-1.44), h); c.closePath(); c.fill(); c.globalCompositeOperation = 'source-over'; } // the sun patch coming through the door stays bright, no shadow on it
  for (let i = 0; i < poly.length; i += 3) { const a = poly[i], b = poly[(i + 3) % poly.length]; if (hash(i, 17) > 0.35) inkStroke(c, a[0], a[1], b[0], b[1], 90 + i, 2.6, 0.6); } // dry-brush ink edge, broken
};
const GradPlane: React.FC<{k: string; w: number; h: number; paint: (c: CanvasRenderingContext2D, w: number, h: number) => void; p: V3; rot?: V3; s: [number, number]; order?: number}> = ({k, w, h, paint, p, rot, s, order = 2}) => {
  const tex = useTex(k, w, h, paint), mat = useMemo(() => new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}), [tex]);
  return <mesh geometry={PLANE} material={mat} position={p} rotation={rot ?? [0, 0, 0]} scale={[s[0], s[1], 1]} renderOrder={order} />;
};
/** All gradient / ink overlays: 9 thin planes sharing 7 small canvas textures, built once. */
export const Overlays: React.FC = () => {
  const cw = 2 * (DOOR_W / 2 + 0.5), cz = (CELL_Z0 + CELL_Z1) / 2, cd = CELL_Z0 - CELL_Z1, e = 0.004;
  return (
    <group>
      <GradPlane k="wk-g-floor" w={128} h={512} paint={paintFloorGrad} p={[0, 0.014, -1.2]} rot={[-Math.PI / 2, 0, 0]} s={[SW, FLOOR_L]} />
      <GradPlane k="wk-g-back" w={512} h={384} paint={paintBackWallGrad} p={[0, 1.5, WALL_Z + e]} s={[SW, 3.0]} />
      <GradPlane k="wk-g-side" w={256} h={256} paint={paintSideGrad} p={[X_W - e, SW_H / 2, (SW_Z0 + SW_Z1) / 2]} rot={[0, -Math.PI / 2, 0]} s={[Math.abs(SW_Z0 - SW_Z1), SW_H]} />
      <GradPlane k="wk-g-ceil" w={128} h={512} paint={paintCeilingGrad} p={[0, CEIL - e, -1.2]} rot={[Math.PI / 2, 0, 0]} s={[SW, FLOOR_L]} />
      <GradPlane k="wk-g-beam" w={128} h={512} paint={paintBeamInk} p={[0, CEIL - 0.28 - e, -1.2]} rot={[Math.PI / 2, 0, 0]} s={[SW, FLOOR_L]} order={3} />
      <GradPlane k="wk-g-cell" w={128} h={256} paint={paintCellGrad} p={[DOOR_X, 1.6, CELL_Z1 + e]} s={[cw, 3.2]} />
      <GradPlane k="wk-g-cell" w={128} h={256} paint={paintCellGrad} p={[DOOR_X - cw / 2 + e, 1.6, cz]} rot={[0, Math.PI / 2, 0]} s={[cd, 3.2]} />
      <GradPlane k="wk-g-cell" w={128} h={256} paint={paintCellGrad} p={[DOOR_X + cw / 2 - e, 1.6, cz]} rot={[0, -Math.PI / 2, 0]} s={[cd, 3.2]} />
      <GradPlane k="wk-g-shadow" w={512} h={171} paint={paintShadowPatch} p={[-0.8, 0.016, -5.6]} rot={[-Math.PI / 2, 0, 0]} s={[3.6, 1.2]} order={4} />
    </group>
  );
};

export const OVERLAY_PAINTERS: [string, (c: CanvasRenderingContext2D, w: number, h: number) => void, number, number][] = [['floor', paintFloorGrad, 128, 512], ['back wall', paintBackWallGrad, 512, 384], ['side wall', paintSideGrad, 256, 256], ['ceiling', paintCeilingGrad, 128, 512], ['beam ink', paintBeamInk, 128, 512], ['cell', paintCellGrad, 128, 256], ['shadow patch', paintShadowPatch, 512, 171]];

