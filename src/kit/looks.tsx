// ENVIRONMENT LOOKS for Rick-style shots (reference ref_night_*, ref_outside): NIGHT and OUTDOOR DAY. Both keep the characters as 2D cards with 3D limbs (kit/rickRig.tsx) and use the same
// toon / ink-hull set kit as the WalkTest corridor (src/WalkEnv.tsx: Acc, toon, hullMaterial).
//  NIGHT: deep navy (#000022, #192A60), ONE warm accent (orange desk and lamp), thin dark ink outlines on every 3D object, soft light pools (additive gradient planes), no sun.
//  OUTDOOR DAY: bright sky gradient, saturated asphalt / grass / building colours, soft sun shadows (painted 3-tone shadows), thin ink outlines.
// `aerialDescent` = the establishing move: a descending aerial move over the outdoor set that ends at the entrance, then a cut or dip to the interior.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Pose, V3, hash, makeTex} from './kit';
import {Acc, TexFn, col, hullMaterial, paintRamp, toon} from '../WalkEnv';

export type LookName = 'night' | 'outdoorDay';
export interface Look { name: LookName; sky: [string, string]; hemi: [string, string, number]; sun: {color: string; intensity: number; pos: V3} | null; ink: number; accent: string }
export const LOOKS: Record<LookName, Look> = {
  night: {name: 'night', sky: ['#000022', '#192A60'], hemi: ['#6a86e8', '#1c2a6e', 2.3], sun: {color: '#8fa8ff', intensity: 0.35, pos: [-4, 6, 3]}, ink: 0.008, accent: '#FF8A2A'},
  outdoorDay: {name: 'outdoorDay', sky: ['#2f8fe6', '#cfeaff'], hemi: ['#d6ecff', '#8fb070', 2.3], sun: {color: '#fff1d0', intensity: 2.4, pos: [14, 22, 10]}, ink: 0.03, accent: '#F2C418'},
};
/** Lights of a look (the shot sets ownLights). Shadows from the sun: soft, painted 3-tone cut in the toon materials. */
export const LookLights: React.FC<{look: LookName; extent?: number}> = ({look, extent = 30}) => {
  const L = LOOKS[look];
  return (
    <>
      <hemisphereLight args={[L.hemi[0], L.hemi[1], L.hemi[2]]} />
      {L.sun && <directionalLight color={L.sun.color} intensity={L.sun.intensity} position={L.sun.pos} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-extent} shadow-camera-right={extent} shadow-camera-top={extent} shadow-camera-bottom={-extent} shadow-camera-near={1} shadow-camera-far={120} shadow-bias={-0.0004} shadow-normalBias={0.03} />}
    </>
  );
};
/** Sky dome: a big inverted sphere with a vertical gradient baked into vertex colours (one draw call). */
export const Sky: React.FC<{look: LookName; radius?: number}> = ({look, radius = 200}) => {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(radius, 24, 16), c0 = col(LOOKS[look].sky[0]), c1 = col(LOOKS[look].sky[1]), a = new Float32Array(g.getAttribute('position').count * 3), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, p.getY(i) / radius)), k = Math.pow(t, 0.6), c = c1.clone().lerp(c0, k); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  }, [look, radius]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.BackSide, toneMapped: false, depthWrite: false}), []);
  return <mesh geometry={geo} material={mat} renderOrder={-10} frustumCulled={false} />;
};
export const gradientBg = (look: LookName) => `linear-gradient(${LOOKS[look].sky[0]}, ${LOOKS[look].sky[1]})`;

/** Descending aerial move: from high above, looking down at the target, to a low establishing view of the entrance. u = 0..1, ease in-out, a slight sideways arc. */
export function aerialDescent(from: V3, to: V3, lookFrom: V3, lookTo: V3, fovFrom = 50, fovTo = 62): (u: number) => Pose {
  const e = (u: number) => { const x = Math.min(1, Math.max(0, u)); return x * x * x * (x * (6 * x - 15) + 10); };
  return (u) => { const k = e(u), lerp = (a: V3, b: V3): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; const p = lerp(from, to); p[0] += Math.sin(Math.PI * k) * 3; return {p, l: lerp(lookFrom, lookTo), fov: fovFrom + (fovTo - fovFrom) * k, roll: 0}; };
}

// ---------------------------------------------------------------- the two sets (merged, vertex-coloured toon + ink hull, instanced repeats)
const glow = (tex: TexFn, hex: string, a: number) => tex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
const planeAt = (g: THREE.Group, map: THREE.Texture, w: number, h: number, x: number, y: number, z: number, rx: number, order = 3) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false})); m.position.set(x, y, z); m.rotation.x = rx; m.renderOrder = order; g.add(m); };
function finish(group: THREE.Group, S: Acc, ramp: THREE.Texture, ink: number): void {
  const mesh = new THREE.Mesh(S.merged(), toon(ramp, {vertexColors: true})); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); group.add(new THREE.Mesh(mesh.geometry, hullMaterial(ink)));
}
const rampTex = (tex: TexFn) => { const r = tex(3, 1, paintRamp); r.minFilter = r.magFilter = THREE.NearestFilter; r.generateMipmaps = false; return r; };

/** OUTDOOR DAY: grass, asphalt road with dashes, sidewalk, 5 saturated buildings with instanced windows, trees, the entrance door of the main building at x = 0, z = -8. */
export function buildOutdoor(tex: TexFn): THREE.Group {
  const group = new THREE.Group(), S = new Acc(), ramp = rampTex(tex);
  S.box(240, 0.2, 240, 0, -0.1, -40, '#2FA84F', 0.02); // grass
  S.box(240, 0.06, 8, 0, 0.03, 0, '#59606E', 0.01); // asphalt road along x
  S.box(240, 0.14, 2.4, 0, 0.07, -5.2, '#E6DFCC', 0.02); S.box(240, 0.14, 2.4, 0, 0.07, 5.2, '#E6DFCC', 0.02); // sidewalks
  const blds: [number, number, number, number, number, string][] = [[-10, -12, 9, 11, 9, '#F2733A'], [0, -12, 8, 7.5, 8, '#3F8EE0'], [10, -12, 8.5, 11, 9, '#F2C418'], [-6, -26, 14, 15, 10, '#A56BD6'], [9, -26, 12, 8.5, 10, '#E0485A']]; // x, z, width, height, depth, colour
  blds.forEach(([x, z, w, h, d, c]) => { S.box(w, h, d, x, h / 2, z, c, 0.06); S.box(w + 0.5, 0.5, d + 0.5, x, h + 0.25, z, '#34406B', 0.05); });
  S.box(1.6, 2.6, 0.3, 0, 1.3, -7.95, '#1F4F8F', 0.04); S.box(2.2, 0.3, 0.7, 0, 2.9, -7.8, '#34406B', 0.04); S.box(2.6, 0.2, 1.6, 0, 0.18, -7.3, '#E6DFCC', 0.03); // entrance: door, canopy, step
  for (let i = 0; i < 14; i++) S.box(1.6, 0.02, 0.35, -26 + i * 4, 0.075, 0, '#F2C418', 0.005); // road dashes
  for (const [x, z] of [[-18, -8], [-16, 7], [-4, 9], [6, 8.5], [14, 8], [19, -7], [-22, -14], [22, -18]] as [number, number][]) { S.cyl(0.18, 2.2, x, 1.1, z, '#8A5A3A'); S.ball(1.5, x, 3.3, z, '#25A044'); S.ball(1.1, x + 0.6, 4.4, z, '#35BD55'); } // trees
  finish(group, S, ramp, LOOKS.outdoorDay.ink);
  const win = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1.1, 0.1), toon(ramp), 110), M = new THREE.Matrix4(); let n = 0;
  blds.forEach(([x, z, w, h, d], bi) => { for (let r = 0; r < Math.floor((h - 2.5) / 2.2); r++) for (let k = 0; k < Math.floor(w / 2.1) - 1; k++) { if (n >= 110) return; M.makeTranslation(x - w / 2 + 1.5 + k * 2.1, 2.6 + r * 2.2, z + d / 2 + 0.05); win.setMatrixAt(n, M); win.setColorAt(n, col(hash(n + bi, 4) > 0.3 ? '#BFE6FF' : '#FFE08A')); n++; } });
  win.count = n; win.instanceMatrix.needsUpdate = true; if (win.instanceColor) win.instanceColor.needsUpdate = true; group.add(win);
  return group;
}
/** NIGHT: deep navy room, ONE warm accent (the orange desk and its lamp), soft orange light pools, a bluish window, a bench; thin dark ink outlines on everything. */
export function buildNight(tex: TexFn): THREE.Group {
  const group = new THREE.Group(), S = new Acc(), ramp = rampTex(tex), A = LOOKS.night.accent;
  S.box(8, 0.2, 9, 0, -0.1, -2, '#0B1340', 0.02); S.box(8, 3.4, 0.2, 0, 1.7, -6.5, '#14215A', 0.02); S.box(0.2, 3.4, 9, -4, 1.7, -2, '#101B4E', 0.02); S.box(0.2, 3.4, 9, 4, 1.7, -2, '#101B4E', 0.02); S.box(8, 0.2, 9, 0, 3.4, -2, '#070C2A', 0.02); // room shell
  S.box(1.7, 0.07, 0.85, 0.9, 0.75, -2.7, A, 0.015); for (const [dx, dz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) S.box(0.07, 0.72, 0.07, 0.9 + dx, 0.36, -2.7 + dz, '#C9651A', 0.01); S.box(1.7, 0.2, 0.05, 0.9, 0.62, -3.1, '#C9651A', 0.01); // the orange desk
  S.cyl(0.12, 0.04, 1.5, 0.8, -2.55, '#2A3260'); S.cyl(0.015, 0.45, 1.5, 1.02, -2.55, '#2A3260'); S.cyl(0.14, 0.12, 1.5, 1.3, -2.55, '#FFB060', 'y', 10); // lamp base, stem, shade
  S.box(1.6, 0.06, 0.4, 0.9, 0.45, -4.0, '#26346F', 0.01); S.box(0.06, 0.45, 0.4, 0.2, 0.22, -4.0, '#26346F', 0.01); S.box(0.06, 0.45, 0.4, 1.6, 0.22, -4.0, '#26346F', 0.01); // seat (a bench behind the desk)
  S.box(1.1, 0.9, 0.12, -2.0, 1.9, -6.35, '#23327F', 0.02); // window frame
  finish(group, S, ramp, LOOKS.night.ink);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshBasicMaterial({color: '#7F9BFF', toneMapped: false})); win.position.set(-2.0, 1.9, -6.28); group.add(win);
  planeAt(group, glow(tex, A, 0.55), 3.2, 3.2, 1.4, 0.02, -2.6, -Math.PI / 2); planeAt(group, glow(tex, '#FFC890', 0.5), 1.4, 1.0, 0.95, 0.79, -2.7, -Math.PI / 2, 4); planeAt(group, glow(tex, '#9fb4ff', 0.3), 2.4, 2.4, -2.0, 0.02, -5.0, -Math.PI / 2); // soft light pools: lamp on the floor, lamp on the desk, moon from the window
  return group;
}
export const LookSet: React.FC<{look: LookName}> = ({look}) => { const g = useMemo(() => (look === 'night' ? buildNight(makeTex) : buildOutdoor(makeTex)), [look]); return <primitive object={g} />; };
