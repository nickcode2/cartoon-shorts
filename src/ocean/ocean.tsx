// OVERBOARD_SURVIVOR world pieces (channel GlintGaze). Palettes: NIGHT = the GlintGaze hue family shifted to deep teal / navy with warm lamp accents (readable, no near-black);
// DAWN = orange / pink sky over teal water; DAY = the normal warm GlintGaze palette; UNDER = teal gradient. IMAGINE = same as night with a deeper teal tint (shots 15-18).
// The water is ONE real 3D surface: a radial grid (dense near the origin, 640 m wide) displaced in the vertex shader by 4 travelling sine waves. `waveH` is the SAME function in JS, so swimmers,
// foam, the shark fin and boats can sit exactly on the surface. Ripples (rings around a swimmer, a splash) are uniforms of the same shader (foam ring + a small bump).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, hash, makeTex, shared} from '../kit/kit';
import {Glow} from '../kit/finish';

export type WorldMode = 'night' | 'imagine' | 'dawn' | 'day' | 'under';
export interface WorldPal {skyTop: string; skyMid: string; skyHor: string; deep: string; mid: string; hi: string; foam: string; sun: string; under: [string, string]; fogNear: number; fogFar: number; glint: number; stars: boolean; amb: [string, string, number]; key: [string, number, V3]}
export const WORLD: Record<WorldMode, WorldPal> = {
  night: {skyTop: '#0A2547', skyMid: '#10456A', skyHor: '#2C8791', deep: '#093C52', mid: '#0F5F78', hi: '#2E93A6', foam: '#CFEDEE', sun: '#FFF0C4', under: ['#2AA9A8', '#0F5F78'], fogNear: 30, fogFar: 170, glint: 1, stars: true, amb: ['#9FD2E8', '#2C6F86', 1.9], key: ['#CFE6FF', 1.5, [-30, 40, -45]]},
  imagine: {skyTop: '#08233F', skyMid: '#0C4560', skyHor: '#237A88', deep: '#073548', mid: '#0B566B', hi: '#25869A', foam: '#BFE4E4', sun: '#E8F0C8', under: ['#1E9AA0', '#0C4F66'], fogNear: 25, fogFar: 150, glint: 0.7, stars: true, amb: ['#8CC8DC', '#245F76', 1.8], key: ['#BDDCF2', 1.3, [-30, 40, -45]]},
  dawn: {skyTop: '#5A86C8', skyMid: '#F0A070', skyHor: '#FFD28F', deep: '#1F7C94', mid: '#2FA3A8', hi: '#FFC27E', foam: '#FFF1DA', sun: '#FFD08A', under: ['#3CBDB4', '#14708A'], fogNear: 40, fogFar: 180, glint: 1.2, stars: false, amb: ['#FFE0C0', '#4A8FA0', 2.0], key: ['#FFC088', 2.0, [40, 12, -45]]},
  day: {skyTop: '#4FB4E0', skyMid: '#9ADBEE', skyHor: '#CDEFF5', deep: '#1F8FA8', mid: '#2FA7A0', hi: '#86DAD2', foam: '#FFF8E6', sun: '#FFF2C8', under: ['#3CBDB4', '#14708A'], fogNear: 60, fogFar: 190, glint: 0.8, stars: false, amb: ['#FFF3D6', '#5A8FA0', 2.2], key: ['#FFE2B0', 1.8, [-20, 40, -30]]},
  under: {skyTop: '#39BDB6', skyMid: '#1D8EA0', skyHor: '#0F5C78', deep: '#0F5C78', mid: '#1D8EA0', hi: '#39BDB6', foam: '#CDEFF5', sun: '#CDEFF5', under: ['#39BDB6', '#0F5C78'], fogNear: 8, fogFar: 60, glint: 0, stars: false, amb: ['#9FE0E0', '#1D7E94', 2.0], key: ['#CDEFF5', 1.0, [0, 30, 0]]},
};
export const LAMP = '#FFC878', LAMP_HDR = new THREE.Color(3.2, 2.6, 1.6);

// ------------------------------------------------------------------ waves (same maths in JS and GLSL)
const DIRS_: [number, number][] = [[0.958, 0.287], [-0.371, 0.928], [0.707, -0.707], [0.196, 0.981]].map(([x, z]) => { const l = Math.hypot(x, z); return [x / l, z / l] as [number, number]; });
const WK = [0.45, 0.8, 1.6, 0.2], WW = [1.1, 1.5, 2.2, 0.6], WA = [0.1, 0.06, 0.03, 0.18], WP = [0, 1.3, 2.1, 0.7];
/** Height of the water surface (m) at world (x, z) and time t (s). amp scales the sea state. */
export function waveH(x: number, z: number, t: number, amp = 1): number {
  let h = 0; const fade = 1 / (1 + Math.hypot(x, z) / 80);
  for (let i = 0; i < 4; i++) h += WA[i] * Math.sin(WK[i] * (DIRS_[i][0] * x + DIRS_[i][1] * z) + WW[i] * t + WP[i]);
  return h * amp * fade;
}
const VERT = `
uniform float uT; uniform float uAmp; uniform vec4 uRip[4];
varying vec3 vW; varying float vH; varying vec3 vN; varying float vDist;
const vec2 DIR0 = vec2(${DIRS_[0][0].toFixed(5)}, ${DIRS_[0][1].toFixed(5)}); const vec2 DIR1 = vec2(${DIRS_[1][0].toFixed(5)}, ${DIRS_[1][1].toFixed(5)});
const vec2 DIR2 = vec2(${DIRS_[2][0].toFixed(5)}, ${DIRS_[2][1].toFixed(5)}); const vec2 DIR3 = vec2(${DIRS_[3][0].toFixed(5)}, ${DIRS_[3][1].toFixed(5)});
void wave(vec2 p, float k, float w, float a, float ph, vec2 d, inout float h, inout vec2 g) { float s = sin(k * dot(d, p) + w * uT + ph), c = cos(k * dot(d, p) + w * uT + ph); h += a * s; g += a * k * c * d; }
void main() {
  vec2 p = position.xz; float fade = uAmp / (1.0 + length(p) / 80.0); float h = 0.0; vec2 g = vec2(0.0);
  wave(p, ${WK[0].toFixed(3)}, ${WW[0].toFixed(3)}, ${WA[0].toFixed(3)}, ${WP[0].toFixed(3)}, DIR0, h, g); wave(p, ${WK[1].toFixed(3)}, ${WW[1].toFixed(3)}, ${WA[1].toFixed(3)}, ${WP[1].toFixed(3)}, DIR1, h, g); wave(p, ${WK[2].toFixed(3)}, ${WW[2].toFixed(3)}, ${WA[2].toFixed(3)}, ${WP[2].toFixed(3)}, DIR2, h, g); wave(p, ${WK[3].toFixed(3)}, ${WW[3].toFixed(3)}, ${WA[3].toFixed(3)}, ${WP[3].toFixed(3)}, DIR3, h, g);
  h *= fade; g *= fade;
  for (int i = 0; i < 4; i++) { vec4 r = uRip[i]; float age = uT - r.z; if (r.w > 0.0 && age > 0.0) { float d = length(p - r.xy), rr = age * 1.0 + 0.2, env = exp(-age * 0.5) * r.w; h += 0.05 * env * sin((d - rr) * 7.0) * exp(-abs(d - rr) * 2.2); } }
  vec3 wp = vec3(position.x, h, position.z); vW = wp; vH = h; vN = normalize(vec3(-g.x, 1.0, -g.y)); vDist = distance(cameraPosition, wp);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const FRAG = `
uniform float uT; uniform float uAmp; uniform vec4 uRip[4]; uniform vec3 uDeep, uMid, uHi, uFoam, uHor, uSun, uUA, uUB, uMoon; uniform float uFogNear, uFogFar, uGlint, uAlpha;
varying vec3 vW; varying float vH; varying vec3 vN; varying float vDist;
void main() {
  vec3 col; float fog = smoothstep(uFogNear, uFogFar, vDist);
  if (!gl_FrontFacing) {
    float c = 0.5 + 0.5 * sin(vW.x * 1.3 + uT * 0.8) * sin(vW.z * 1.1 - uT * 0.6); col = mix(uUA * 0.85, uUA * 1.25, floor(c * 4.0) / 4.0); col = mix(col, uUB, fog * 0.8); gl_FragColor = vec4(col, 1.0);
  } else {
    vec3 V = normalize(cameraPosition - vW), L = normalize(uMoon); float far = clamp(length(vW.xz - cameraPosition.xz) / 70.0, 0.0, 0.92); vec3 N = normalize(mix(normalize(vN), vec3(0.0, 1.0, 0.0), far));
    float ndl = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0), band = floor(ndl * 3.0 + 0.5) / 3.0, hh = mix(clamp(vH / max(uAmp, 0.2) * 3.4 + 0.5, 0.0, 1.0), 0.5, far);
    col = mix(uDeep, uMid, 0.12 + band * 0.5 + hh * 0.22); col = mix(col, uHi, smoothstep(0.78, 1.0, hh) * 0.4);
    vec3 R = reflect(-V, N); float g = dot(R, L); float spark = smoothstep(0.55, 0.8, hh) * (1.0 - far * 0.8); col += uSun * (smoothstep(0.985, 0.998, g) * uGlint * (0.35 + 0.65 * spark) * 0.8 + smoothstep(0.93, 0.995, g) * spark * 0.35 * uGlint);
    float nz = sin(vW.x * 2.3 + vW.z * 1.7 + uT) * sin(vW.x * 1.1 - vW.z * 2.9 - uT * 1.3); col = mix(col, uFoam, smoothstep(0.8, 0.96, hh + 0.1 * nz) * 0.7 * (1.0 - far));
    float ring = 0.0; for (int i = 0; i < 4; i++) { vec4 r = uRip[i]; float age = uT - r.z; if (r.w > 0.0 && age > 0.0) { float d = length(vW.xz - r.xy), rr = age * 1.0 + 0.2; ring = max(ring, smoothstep(0.17, 0.02, abs(d - rr)) * exp(-age * 0.55) * min(1.0, r.w)); } }
    col = mix(col, uFoam, ring);
    col = mix(col, uFoam, smoothstep(0.75, 1.0, sin(dot(vW.xz, vec2(0.37, 0.21)) + uT * 0.4 + sin(vW.z * 0.13) * 3.0) * sin(dot(vW.xz, vec2(-0.19, 0.33)) - uT * 0.3 + sin(vW.x * 0.11) * 3.0)) * 0.22);
    col = mix(col, uHor, pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0) * 0.3); col = mix(col, uHor, fog); gl_FragColor = vec4(col, uAlpha);
  }
  #include <colorspace_fragment>
}`;
const radialGeo = () => shared('ocean-radial', () => {
  const rings = 70, seg = 120, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < rings; i++) { const r = i === 0 ? 0 : 0.35 * Math.pow(1.115, i - 1); for (let j = 0; j < seg; j++) { const a = (j / seg) * Math.PI * 2; pos.push(r * Math.cos(a), 0, r * Math.sin(a)); } }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = (i + 1) * seg + j, d = (i + 1) * seg + ((j + 1) % seg); idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 700); return g;
});
export interface Ripple {x: number; z: number; t0: number; k: number}
/** Repeating rings around a source that moves: ring i is emitted every `period` s from where the source was. */
export function ringsFor(t: number, src: (t: number) => [number, number], period = 0.9, k = 1): Ripple[] {
  const base = Math.floor(t / period), out: Ripple[] = [];
  for (let i = 0; i < 4; i++) { const t0 = (base - i) * period, [x, z] = src(t0); out.push({x, z, t0, k}); }
  return out;
}
/** THE OCEAN. t = absolute seconds; ripples <= 4. Camera may be above or under the surface (the underside is a bright teal ceiling with light bands). */
export const Ocean: React.FC<{mode: WorldMode; t: number; amp?: number; ripples?: Ripple[]; fogNear?: number; fogFar?: number; clear?: number}> = ({mode, t, amp = 1, ripples = [], fogNear, fogFar, clear = 1}) => {
  const P = WORLD[mode];
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: clear < 1, depthWrite: clear >= 1,
    uniforms: {uT: {value: 0}, uAmp: {value: 1}, uRip: {value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0))}, uDeep: {value: new THREE.Color(P.deep)}, uMid: {value: new THREE.Color(P.mid)}, uHi: {value: new THREE.Color(P.hi)}, uFoam: {value: new THREE.Color(P.foam)}, uHor: {value: new THREE.Color(P.skyHor)}, uSun: {value: new THREE.Color(P.sun)}, uUA: {value: new THREE.Color(P.under[0])}, uUB: {value: new THREE.Color(P.under[1])}, uMoon: {value: new THREE.Vector3(...P.key[2])}, uFogNear: {value: P.fogNear}, uFogFar: {value: P.fogFar}, uGlint: {value: P.glint}, uAlpha: {value: clear}},
  }), [mode, clear]); // eslint-disable-line react-hooks/exhaustive-deps
  const u = mat.uniforms; u.uT.value = t; u.uAmp.value = amp; u.uFogNear.value = fogNear ?? P.fogNear; u.uFogFar.value = fogFar ?? P.fogFar; u.uAlpha.value = clear;
  (u.uRip.value as THREE.Vector4[]).forEach((v, i) => { const r = ripples[i]; if (r) v.set(r.x, r.z, r.t0, r.k); else v.set(0, 0, 0, 0); });
  return <mesh geometry={radialGeo()} material={mat} frustumCulled={false} renderOrder={0} />;
};

// ------------------------------------------------------------------ sky, stars, moon / sun, light rig
export const skyTex = (mode: WorldMode) => { const P = WORLD[mode]; return makeTex(8, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, P.skyTop); g.addColorStop(0.3, P.skyMid); g.addColorStop(0.5, P.skyHor); g.addColorStop(0.58, P.skyHor); g.addColorStop(1, P.deep); c.fillStyle = g; c.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const y = h * (0.12 + 0.34 * hash(i, 11)), x = w * hash(i, 12); c.fillStyle = `rgba(255,255,255,${0.1 + 0.1 * hash(i, 13)})`; c.beginPath(); c.ellipse(x, y, w * (0.5 + 0.9 * hash(i, 14)), 3 + 6 * hash(i, 15) * (y / h + 0.5), 0, 0, 7); c.fill(); } }); };
const starsTex = () => makeTex(2048, 1024, (c, w, h) => { for (let i = 0; i < 520; i++) { c.fillStyle = `rgba(255,255,240,${0.4 + hash(i, 3) * 0.5})`; c.beginPath(); c.arc(hash(i, 1) * w, hash(i, 2) * h * 0.46, 0.5 + hash(i, 4) * (i % 23 === 0 ? 1.5 : 0.8), 0, 7); c.fill(); } });
/** Gradient dome with the horizon colour = the ocean's fog colour (so the world has no visible edge). */
export const SkyDome: React.FC<{mode: WorldMode; moon?: boolean; r?: number}> = ({mode, moon = true, r = 175}) => {
  const P = WORLD[mode], sky = useMemo(() => skyTex(mode), [mode]), st = useMemo(() => (P.stars ? starsTex() : null), [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = P.key[2], dl = Math.hypot(...d), mp: V3 = [(d[0] / dl) * 150, Math.max(18, (d[1] / dl) * 150), (d[2] / dl) * 150];
  return (
    <group>
      <mesh><sphereGeometry args={[r, 28, 18]} /><meshBasicMaterial map={sky} side={THREE.BackSide} toneMapped={false} depthWrite={false} fog={false} /></mesh>
      {st && <mesh><sphereGeometry args={[r - 1, 24, 14]} /><meshBasicMaterial map={st} side={THREE.BackSide} toneMapped={false} transparent depthWrite={false} fog={false} /></mesh>}
      {moon && (<>
        <mesh position={mp}><sphereGeometry args={[mode === 'dawn' ? 9 : 7, 24, 16]} /><meshBasicMaterial color={mode === 'dawn' ? '#FFE3A8' : '#FFF4D2'} toneMapped={false} fog={false} /></mesh>
        <Glow p={mp} size={mode === 'dawn' ? 120 : 80} color={mode === 'dawn' ? '#FFB36B' : '#F6E8C8'} intensity={mode === 'dawn' ? 1.0 : 0.8} />
      </>)}
    </group>
  );
};
export const WorldLights: React.FC<{mode: WorldMode; ss?: number; focus?: V3}> = ({mode, ss = 1024, focus = [0, 0, 0]}) => {
  const P = WORLD[mode];
  return (<>
    <hemisphereLight args={[P.amb[0], P.amb[1], P.amb[2]]} />
    <directionalLight color={P.key[0]} intensity={P.key[1]} position={[focus[0] + P.key[2][0] * 0.4, focus[1] + P.key[2][1] * 0.4, focus[2] + P.key[2][2] * 0.4]} target-position={focus} castShadow shadow-mapSize={[ss, ss]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-camera-near={1} shadow-camera-far={120} shadow-bias={-0.0004} />
  </>);
};

// ------------------------------------------------------------------ underwater: teal gradient, light rays from the surface, particles
const rayTex = () => makeTex(32, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(205,239,245,0)'); g.addColorStop(0.5, 'rgba(205,239,245,1)'); g.addColorStop(1, 'rgba(205,239,245,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); const v = c.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = v; c.fillRect(0, 0, w, h); });
const dotTex = () => makeTex(32, 32, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(220,255,250,1)'); g.addColorStop(1, 'rgba(220,255,250,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
const MOTES = 140;
export const UnderWorld: React.FC<{mode?: WorldMode; f: number; center?: V3; rays?: boolean; surfaceY?: number; top?: string; bot?: string}> = ({mode = 'under', f, center = [0, -8, 0], rays = true, surfaceY = 0, top = '#39BDB6', bot = '#0F5C78'}) => {
  const {sky, ray, dot, rayMat, pts, base} = useMemo(() => {
    const sky = makeTex(256, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(0.5, bot); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(210,250,245,${0.03 + 0.05 * hash(i, 21)})`; c.beginPath(); c.ellipse(w * hash(i, 22), h * (0.05 + 0.6 * hash(i, 23)), 8 + 30 * hash(i, 24), 2 + 5 * hash(i, 25), 0.4 * (hash(i, 26) - 0.5), 0, 7); c.fill(); } }), ray = rayTex(), dot = dotTex();
    const rayMat = new THREE.MeshBasicMaterial({map: ray, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, color: '#CDEFF5'});
    const base = new Float32Array(MOTES * 3), pos = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) { base[i * 3] = (hash(i, 1) - 0.5) * 22; base[i * 3 + 1] = -hash(i, 2) * 16; base[i * 3 + 2] = (hash(i, 3) - 0.5) * 22; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({map: dot, size: 0.24, sizeAttenuation: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false})); pts.frustumCulled = false; pts.renderOrder = 21;
    return {sky, ray, dot, rayMat, pts, base};
  }, [top, bot]); // eslint-disable-line react-hooks/exhaustive-deps
  void sky; void ray; void dot; void mode;
  const arr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < MOTES; i++) { arr.array[i * 3] = center[0] + base[i * 3] + 0.3 * Math.sin(f * 0.02 + i); arr.array[i * 3 + 1] = center[1] + 8 + base[i * 3 + 1] + 0.25 * Math.sin(f * 0.017 + i * 1.7) + ((f * 0.006 + i * 0.37) % 1) * 0.6; arr.array[i * 3 + 2] = center[2] + base[i * 3 + 2] + 0.3 * Math.cos(f * 0.016 + i * 1.3); }
  arr.needsUpdate = true;
  rayMat.opacity = 0.2 * (0.85 + 0.15 * Math.sin(f * 0.05));
  return (
    <group>
      <mesh><sphereGeometry args={[110, 24, 16]} /><meshBasicMaterial map={sky} side={THREE.BackSide} toneMapped={false} depthWrite={false} fog={false} /></mesh>
      {rays && [-9, -5.5, -2, 1.5, 5, 8.5, 12].map((x, i) => (
        <mesh key={i} position={[center[0] + x + 1.3 * Math.sin(f * 0.012 + i), surfaceY - 9, center[2] - 4 - (i % 3) * 3]} rotation={[0, 0.4 * (i % 2 ? 1 : -1), 0.35 + 0.05 * Math.sin(f * 0.01 + i)]} scale={[1.6 + (i % 3) * 0.8, 20, 1]} material={rayMat} renderOrder={19}><planeGeometry args={[1, 1]} /></mesh>
      ))}
      <primitive object={pts} />
    </group>
  );
};

// ------------------------------------------------------------------ jellyfish: translucent glowing bell + flowing tentacles (shader sway)
const TVERT = `uniform float uT; uniform float uPh; uniform float uReach; varying float vY;
void main() { vec3 p = position; float k = clamp(-p.y, 0.0, 1.0); vY = k; float s = sin(p.y * 5.0 - uT * 3.0 + uPh + position.x * 40.0) * 0.1 * k + sin(p.y * 3.0 - uT * 1.7 + uPh * 2.0) * 0.06 * k; p.x += s * (1.0 + uReach); p.z += cos(p.y * 4.0 - uT * 2.3 + uPh) * 0.07 * k; p.y *= (1.0 + uReach * 0.9);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const TFRAG = `uniform vec3 uCol; uniform float uOp; varying float vY; void main() { gl_FragColor = vec4(uCol * (1.0 + 1.2 * (1.0 - vY)), uOp * (1.0 - 0.7 * vY));
#include <colorspace_fragment>
}`;
const tentGeo = () => shared('jelly-tent', () => {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r = 0.34 + 0.06 * (i % 2); const g = new THREE.CylinderGeometry(0.014, 0.004, 1, 5, 14, true); g.translate(0, -0.5, 0); g.translate(Math.cos(a) * r, 0, Math.sin(a) * r); parts.push(g); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4, g = new THREE.CylinderGeometry(0.04, 0.01, 0.8, 6, 12, true); g.translate(0, -0.4, 0); g.translate(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1); parts.push(g); }
  const pos: number[] = [], idx: number[] = []; let off = 0;
  for (const g of parts) { const p = g.getAttribute('position'); for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i)); const ix = g.getIndex()!; for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off); off += p.count; g.dispose(); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setIndex(idx); return m;
});
/** `p` = bell centre, `s` = bell radius (m, tentacles are about 3 x s long), `rot` = tilt (rad about z), `reach` 0..1 stretches the tentacles. userData.qaJelly lets the QA measure the distance to a swimmer. */
export const Jelly: React.FC<{p: V3; s?: number; t: number; ph?: number; rot?: V3; reach?: number; glow?: number}> = ({p, s = 0.6, t, ph = 0, rot = [0, 0, 0], reach = 0, glow = 1}) => {
  const pulse = 1 + 0.12 * Math.sin(t * 2.6 + ph), tent = useMemo(() => new THREE.ShaderMaterial({vertexShader: TVERT, fragmentShader: TFRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: {uT: {value: 0}, uPh: {value: ph}, uReach: {value: 0}, uCol: {value: new THREE.Color(0.3, 0.7, 0.65)}, uOp: {value: 0.8}}}), [ph]);
  tent.uniforms.uT.value = t; tent.uniforms.uReach.value = reach;
  const bell = useMemo(() => shared('jelly-bell', () => new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55)), []);
  const inner = useMemo(() => shared(`jelly-in${glow.toFixed(1)}`, () => new THREE.MeshBasicMaterial({color: new THREE.Color(0.16 + 0.1 * glow, 0.5 + 0.1 * glow, 0.46 + 0.08 * glow), transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, toneMapped: false})), [glow]);
  const shell = useMemo(() => shared('jelly-shell', () => new THREE.MeshBasicMaterial({color: '#9FE8DC', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, toneMapped: false})), []);
  return (
    <group position={p} rotation={rot} userData={{qaJelly: {r: s * 1.15}}}>
      <group scale={[s * pulse, s * (2 - pulse), s * pulse]}>
        <mesh geometry={bell} material={inner} scale={0.9} /><mesh geometry={bell} material={shell} />
        <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.96, 0.05, 6, 28]} /><meshBasicMaterial color={new THREE.Color(0.5, 0.85, 0.8)} toneMapped={false} /></mesh>
      </group>
      <mesh geometry={tentGeo()} material={tent} scale={[s * 1.0, s * 3.2, s * 1.0]} position={[0, -0.05 * s, 0]} />
      <Glow p={[0, 0, 0]} size={s * 3.0} color="#7FFFE0" intensity={0.1 * glow} />
    </group>
  );
};

// ------------------------------------------------------------------ shark fin (cartoon, no gore) + a dark torpedo body for the underwater views
const finGeo = () => shared('shark-fin', () => {
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(0.12, 0.25, 0.3, 0.55, 0.55, 0.86); sh.bezierCurveTo(0.5, 0.5, 0.6, 0.25, 0.78, 0); sh.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(sh, {depth: 0.16, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 14}); g.translate(-0.39, 0, -0.08); return g;
});
/** `p` = fin base at the water surface (the base is submerged 0.12 x size), yaw = heading. userData.qaShark gives the radius of the fin for the swimmer clearance check. */
export const SharkFin: React.FC<{p: V3; yaw: number; size?: number; body?: boolean}> = ({p, yaw, size = 1, body = false}) => (
  <group position={[p[0], p[1] - 0.12 * size, p[2]]} rotation={[0, yaw, 0]} scale={size} userData={{qaShark: {r: 0.5 * size}}}>
    <mesh geometry={finGeo()} castShadow><meshToonMaterial color="#5A7A8E" side={THREE.DoubleSide} /></mesh>
    <mesh position={[-0.02, 0.43, 0]} rotation={[0, 0, -0.36]} scale={[1, 1, 0.5]} castShadow><coneGeometry args={[0.26, 1.0, 12]} /><meshToonMaterial color="#5A7A8E" /></mesh>
    <mesh position={[0.1, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.35, 0.5, 24]} /><meshBasicMaterial color="#DDF5F1" transparent opacity={0.7} depthWrite={false} toneMapped={false} /></mesh>
    {body && (<>
      <mesh position={[0, -0.5, 0]} scale={[2.2, 0.38, 0.5]}><sphereGeometry args={[1, 18, 12]} /><meshBasicMaterial color="#4F6C80" toneMapped={false} /></mesh>
      <mesh position={[-2.1, -0.45, 0]} rotation={[0, 0, 0.5]} scale={[0.9, 0.5, 0.08]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#4F6C80" toneMapped={false} /></mesh>
    </>)}
  </group>
);

// ------------------------------------------------------------------ the huge dark shape (unclear on purpose: a long rounded mass with a tail, no face)
const beastGeo = () => shared('beast', () => {
  const pts: THREE.Vector2[] = []; const prof = [[0, 0], [2, 3.2], [8, 5.2], [18, 6.0], [30, 5.4], [42, 3.8], [52, 2.0], [58, 0.9], [60, 0]];
  prof.forEach(([x, r]) => pts.push(new THREE.Vector2(r, x)));
  const g = new THREE.LatheGeometry(pts, 28); g.rotateZ(-Math.PI / 2); g.translate(-30, 0, 0); g.scale(1, 0.62, 1); return g;
});
const flukeGeo = () => shared('beast-fluke', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(2, 4, 6, 7, 9, 8); s.bezierCurveTo(8, 4, 8, 2, 9, 0); s.bezierCurveTo(8, -2, 8, -4, 9, -8); s.bezierCurveTo(6, -7, 2, -4, 0, 0); const g = new THREE.ExtrudeGeometry(s, {depth: 0.6, bevelEnabled: false}); g.translate(0, 0, -0.3); g.rotateX(Math.PI / 2); return g; });
export const Beast: React.FC<{p: V3; yaw?: number; scale?: number; color?: string; sway?: number}> = ({p, yaw = 0, scale = 1, color = '#0A3042', sway = 0}) => (
  <group position={p} rotation={[0, yaw, 0]} scale={scale} userData={{qaBeast: true}}>
    <mesh geometry={beastGeo()}><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    <group position={[28, 0, 0]} rotation={[0, sway, 0]}><mesh geometry={flukeGeo()}><meshBasicMaterial color={color} toneMapped={false} side={THREE.DoubleSide} /></mesh></group>
    <mesh position={[-14, -2.2, 6]} rotation={[0.5, 0.4, -0.3]} scale={[6, 0.4, 2]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    <mesh position={[-14, -2.2, -6]} rotation={[-0.5, -0.4, -0.3]} scale={[6, 0.4, 2]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
  </group>
);
