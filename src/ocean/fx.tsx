// OVERBOARD_SURVIVOR: the SWIMMER (a white card standing IN the water: waterline at a card height, legs hang below the surface, arms treading / paddling / waving), splash, current streaks and
// small held props (luggage tag, cocktail, binoculars, rescue strop). The waterline is chosen on the card (`wl` card px), the card is placed so that exactly that height sits on the wave surface
// at its position (`waveH`), so a swimmer shows head, shoulders and arms and never floats or sinks. Hands reach targets through the kit's IK (rounded elbows), clamped to the arm reach.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, hash, shared} from '../kit/kit';
import {CX, GROUND, HIP_Y, PXM, FaceName, RickPose} from '../kit/rickRig';
import {clampHand, mix, clamp, S as SC} from '../shop/shots';
import {Person, dirTo, poseOf, handPos} from './cast';
import {waveH} from './ocean';

export const SWIM_S = SC; // 0.9, the kit's base scale
export const swimP = (g: number, xz: [number, number], wl: number, amp = 1, lift = 0): V3 => [xz[0], waveH(xz[0], xz[1], g / 30, amp) + lift - (GROUND - wl) * PXM * SWIM_S, xz[1]];
/** world height of a card pixel row for a swimmer standing at p */
export const cardY = (p: V3, py: number, role = 'survivor', s = SWIM_S): number => p[1] + (GROUND - py) * PXM * s * (role === 'survivor' ? 1 : 1);
export const HIP_DROP = (GROUND - HIP_Y) * PXM * SWIM_S; // hip height above the swimmer's feet (m)
export type ArmMode = 'tread' | 'paddle' | 'flail' | 'wave' | 'rest' | 'hold' | 'down';
const ph = (g: number, r: number) => g * r;
/** Hand targets (card px) for an arm mode; g = absolute frame; wl = waterline (card px). */
export function swimHands(role: string, mode: ArmMode, g: number, wl: number, k = 1): Pick<RickPose, 'hands' | 'handsZ'> {
  const a = ph(g, 0.22), cl = (slot: number, q: [number, number, number]) => clampHand(role, slot, q, 1, 14);
  let l: [number, number, number], r: [number, number, number];
  if (mode === 'tread') { l = [CX - 175 + 20 * Math.sin(a), wl + 8 + 16 * Math.cos(a), 30]; r = [CX + 175 - 20 * Math.sin(a + 1.1), wl + 8 + 16 * Math.cos(a + 1.7), 30]; }
  else if (mode === 'paddle') { const s0 = Math.max(0, Math.sin(a * 1.6)), s1 = Math.max(0, Math.sin(a * 1.6 + Math.PI)); l = [CX - 150 - 40 * s0, wl - 150 * s0 + 14, 60]; r = [CX + 150 + 40 * s1, wl - 150 * s1 + 14, 60]; }
  else if (mode === 'flail') { l = [CX - 190 + 40 * Math.sin(a * 2.3), 230 + 70 * Math.sin(a * 1.9), 20]; r = [CX + 190 + 40 * Math.sin(a * 2.1 + 1), 220 + 70 * Math.cos(a * 1.7), 20]; }
  else if (mode === 'wave') { l = [CX - 175, wl + 12 + 8 * Math.sin(a * 0.6), 30]; r = [CX + 200 + 24 * Math.sin(a * 0.9), 150 + 22 * Math.sin(a * 0.9 + 1.2), 20]; }
  else if (mode === 'down') { l = [CX - 120, wl + 24, 30]; r = [CX + 120, wl + 24, 30]; }
  else { l = [CX - 165 + 6 * Math.sin(a), wl + 10, 30]; r = [CX + 165 - 6 * Math.sin(a), wl + 10, 30]; }
  const L = cl(0, [mix(CX - 170, l[0], k), mix(wl + 8, l[1], k), l[2]]), R = cl(1, [mix(CX + 170, r[0], k), mix(wl + 8, r[1], k), r[2]]);
  return {hands: [[L[0], L[1]], [R[0], R[1]]], handsZ: [L[2], R[2]]};
}
export interface SwimArgs {g: number; xz: [number, number]; wl: number; cam: V3; role?: string; arms?: ArmMode; face?: FaceName; look?: [number, number]; lean?: number; pitch?: number; kick?: number; roll?: number; amp?: number; lift?: number; armK?: number; extra?: Partial<RickPose>}
export const Swimmer: React.FC<SwimArgs> = ({g, xz, wl, cam, role = 'survivor', arms = 'tread', face = 'deadpan', look, lean = 0, pitch = 0, kick = 0.5, roll = 0, amp = 1, lift = 0, armK = 1, extra}) => {
  const p = swimP(g, xz, wl, amp, lift), a = ph(g, 0.3), fwd = dirTo(p, cam);
  const pose = poseOf(p, cam, {...swimHands(role, arms, g, wl, armK), face, legSw: [kick * Math.sin(a), -kick * Math.sin(a)], bend: [0.5 + 0.5 * Math.sin(a), 0.5 - 0.5 * Math.sin(a)], toe: [0, 0], lean: lean + 0.025 * Math.sin(g * 0.11), headRoll: roll + 0.03 * Math.sin(g * 0.13), headDy: 3 * Math.sin(g * 0.17), headFwd: look ?? fwd, torsoFwd: fwd, headPitch: pitch, ...extra});
  return <Person role={role} p={p} s={SWIM_S} cam={cam} pose={pose} noCane />;
};
/** world position of a swimmer's card pixel (x offset from the centre in card px) for props / QA: in front of the card toward the camera by `dz` m */
export const cardPoint = (p: V3, cam: V3, px: number, py: number, dz = 0, s = SWIM_S): V3 => { const d = dirTo(p, cam), k = PXM * s, rx = d[1], rz = -d[0]; return [p[0] + rx * (px - CX) * k + d[0] * dz, p[1] + (GROUND - py) * k, p[2] + rz * (px - CX) * k + d[1] * dz]; };

// ------------------------------------------------------------------ splash: crown of droplets + a short water column, `age` in seconds since the impact
const dropGeo = () => shared('os-drop', () => new THREE.SphereGeometry(1, 8, 6)), whiteM = () => shared('os-white', () => new THREE.MeshBasicMaterial({color: '#F4FFFD', toneMapped: false})), colM = () => shared('os-col', () => new THREE.MeshBasicMaterial({color: '#E3FAF6', transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false}));
export const Splash: React.FC<{p: V3; age: number; size?: number}> = ({p, age, size = 1}) => {
  if (age < 0 || age > 1.5) return null;
  const col = Math.sin(Math.PI * clamp(age / 0.9)) * 1.0 * size, fade = clamp((1.5 - age) / 0.6);
  return (
    <group position={p} userData={{noClutter: true}}>
      {age < 0.9 && <mesh geometry={shared('os-cyl', () => new THREE.CylinderGeometry(0.5, 1, 1, 14, 1, true))} material={colM()} position={[0, col / 2, 0]} scale={[0.13 * size * (0.6 + age), col, 0.13 * size * (0.6 + age)]} />}
      {Array.from({length: 16}, (_, i) => { const a = (i / 16) * Math.PI * 2 + hash(i, 1), sp = (0.9 + hash(i, 2) * 1.5) * size, v0 = (3.2 + hash(i, 3) * 2.4) * size, y = v0 * age - 5 * age * age, r = sp * age; return y < -0.02 ? null : <mesh key={i} geometry={dropGeo()} material={whiteM()} position={[Math.cos(a) * r, Math.max(0, y), Math.sin(a) * r]} scale={0.035 * size * (0.5 + hash(i, 4)) * fade} />; })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={[1, 1, 1]} renderOrder={4}><ringGeometry args={[0.15 + age * 1.9, 0.3 + age * 2.0, 40]} /><meshBasicMaterial color="#F4FFFD" transparent opacity={0.8 * fade} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  );
};

// ------------------------------------------------------------------ current streaks: thin flat strokes sliding over the surface along `dir` at `speed` m/s, wrapping in a 16 x 16 m window around `c`
const STREAKS = 44;
export const CurrentStreaks: React.FC<{c: V3; g: number; dir?: [number, number]; speed?: number; color?: string}> = ({c, g, dir = [1, 0], speed = 3.2, color = '#DDF5F1'}) => {
  const mesh = useMemo(() => { const m = new THREE.InstancedMesh(shared('os-streak', () => { const q = new THREE.PlaneGeometry(1, 1); q.rotateX(-Math.PI / 2); return q; }), new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false}), STREAKS); m.frustumCulled = false; m.renderOrder = 5; return m; }, [color]);
  const t = g / 30, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  for (let i = 0; i < STREAKS; i++) {
    const len = 1.2 + hash(i, 2) * 2.6, u = (hash(i, 1) + (t * speed) / 16) % 1, v = hash(i, 3), sw = 0.5 * Math.sin(t * 0.7 + i), ang = Math.atan2(-dir[1], dir[0]) + 0.35 * Math.sin(u * 6.28 + i) + sw * 0.2;
    const x = c[0] + (u - 0.5) * 16 * dir[0] - (v - 0.5) * 16 * dir[1], z = c[2] + (u - 0.5) * 16 * dir[1] + (v - 0.5) * 16 * dir[0], y = waveH(x, z, t) + 0.07;
    E.set(0, ang, 0); Q.setFromEuler(E); M.compose(new THREE.Vector3(x, y, z), Q, new THREE.Vector3(len, 1, 0.05 + 0.04 * hash(i, 5))); mesh.setMatrixAt(i, M);
  }
  mesh.instanceMatrix.needsUpdate = true; (mesh.material as THREE.MeshBasicMaterial).opacity = 0.65;
  return <primitive object={mesh} />;
};

// ------------------------------------------------------------------ small held props, each with named grip anchors (world points) used by the QA
/** luggage tag: yellow rounded tag + hole + string loop; `p` = the hand */
export const LuggageTag: React.FC<{p: V3; ry?: number}> = ({p, ry = 0}) => (
  <group position={p} rotation={[0, ry, 0.1]}>
    <mesh position={[0, -0.09, 0.0]} castShadow><boxGeometry args={[0.1, 0.15, 0.012]} /><meshToonMaterial color="#F2C230" /></mesh>
    <mesh position={[0, -0.01, 0.0]}><cylinderGeometry args={[0.05, 0.05, 0.012, 16]} /><meshToonMaterial color="#F2C230" /></mesh>
    <mesh position={[0, -0.01, 0.008]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.014, 12]} /><meshBasicMaterial color="#2B3A44" /></mesh>
    <mesh position={[0, -0.12, 0.008]}><boxGeometry args={[0.07, 0.02, 0.004]} /><meshBasicMaterial color="#E0302A" /></mesh><mesh position={[0, -0.09, 0.008]}><boxGeometry args={[0.07, 0.012, 0.004]} /><meshBasicMaterial color="#2B3A44" /></mesh>
    <mesh position={[0, 0.05, 0]}><torusGeometry args={[0.035, 0.005, 6, 14]} /><meshBasicMaterial color="#E0302A" /></mesh>
  </group>
);
/** tall glass with a straw + a paper umbrella; `p` = the glass bottom centre */
export const Cocktail: React.FC<{p: V3}> = ({p}) => (
  <group position={p}>
    <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.045, 0.034, 0.14, 14]} /><meshToonMaterial color="#FF8A5C" transparent opacity={0.92} /></mesh>
    <mesh position={[0.015, 0.14, 0]} rotation={[0, 0, -0.2]}><cylinderGeometry args={[0.005, 0.005, 0.16, 6]} /><meshToonMaterial color="#E0302A" /></mesh>
    <mesh position={[-0.02, 0.19, 0]} rotation={[0, 0, 0.3]}><coneGeometry args={[0.05, 0.035, 10]} /><meshToonMaterial color="#3FA7C9" /></mesh>
  </group>
);
/** binoculars: two black barrels + bridge + lenses; `p` = centre between the eyes, `d` = unit direction the lenses face; anchors = the two barrel centres */
export const BINO_SEP = 0.065;
export const binoAnchors = (p: V3, d: [number, number]): V3[] => [[p[0] + d[1] * BINO_SEP * 1.4, p[1] - 0.02, p[2] - d[0] * BINO_SEP * 1.4], [p[0] - d[1] * BINO_SEP * 1.4, p[1] - 0.02, p[2] + d[0] * BINO_SEP * 1.4]];
export const Binoculars: React.FC<{p: V3; d: [number, number]}> = ({p, d}) => {
  const yaw = Math.atan2(d[0], d[1]);
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      {[-1, 1].map((s) => (<group key={s} position={[s * BINO_SEP, 0, 0]}><mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.04, 0.05, 0.16, 14]} /><meshToonMaterial color="#2B3A44" /></mesh><mesh position={[0, 0, 0.082]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.04, 14]} /><meshBasicMaterial color="#7FD6D0" toneMapped={false} /></mesh><mesh position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.06, 12]} /><meshToonMaterial color="#12202A" /></mesh></group>))}
      <mesh position={[0, 0, 0.01]}><boxGeometry args={[0.07, 0.035, 0.08]} /><meshToonMaterial color="#3A4A55" /></mesh>
    </group>
  );
};
/** rescue strop / harness: an orange loop around the chest (passes through the card plane: the back half is hidden by the card, the front half shows), two shoulder straps and a D-ring + hook above */
export const Strop: React.FC<{p: V3; yaw: number; r?: number; hook?: boolean}> = ({p, yaw, r = 0.22, hook = true}) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.62, 1]}><torusGeometry args={[r, 0.032, 8, 24]} /><meshToonMaterial color="#F2A31A" /></mesh>
    {[-1, 1].map((s) => <mesh key={s} position={[s * r * 0.55, 0.2, 0.05]} rotation={[0, 0, s * -0.18]}><boxGeometry args={[0.05, 0.42, 0.02]} /><meshToonMaterial color="#F2A31A" /></mesh>)}
    <mesh position={[0, 1.0, -0.07]}><torusGeometry args={[0.05, 0.012, 6, 14]} /><meshBasicMaterial color="#CFCFC6" toneMapped={false} /></mesh>
    {hook && <mesh position={[0, 1.08, -0.07]}><boxGeometry args={[0.03, 0.1, 0.03]} /><meshToonMaterial color="#E8B23A" /></mesh>}
  </group>
);
export { handPos };

/** A thin rod / rope between two world points (shared geometry, one mesh). */
export const Rod: React.FC<{a: V3; b: V3; r?: number; c?: string}> = ({a, b, r = 0.02, c = '#2B2630'}) => {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length() || 1e-3, q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={q} scale={[r, len, r]} geometry={shared('os-rod', () => new THREE.CylinderGeometry(1, 1, 1, 6))}><meshToonMaterial color={c} /></mesh>;
};
const CHEST = (975 - 440) * 0.0021 * SWIM_S, SHOULDER = (975 - 346) * 0.0021 * SWIM_S, HIP = (975 - 572) * 0.0021 * SWIM_S;
export const SLING = {chest: CHEST, shoulder: SHOULDER, hip: HIP, ring: 2.0};
/** RESCUE SLING: the body stands INSIDE it. A chest loop and a seat loop pass through the card (front halves in front of the body, back halves hidden behind it), two straps go over the shoulders (front part on the
 *  chest, then up behind the head), meet at a ring ABOVE the head (behind the face card) where the hook and the rope are. `p` = the person's feet, `yaw` = card yaw. */
export const Sling: React.FC<{p: V3; yaw: number}> = ({p, yaw}) => {
  const ring: V3 = [0, SLING.ring, -0.07], col = '#F2A31A';
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <mesh position={[0, CHEST, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.62, 1]}><torusGeometry args={[0.2, 0.032, 8, 24]} /><meshToonMaterial color={col} /></mesh>
      <mesh position={[0, HIP + 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.62, 1]}><torusGeometry args={[0.17, 0.034, 8, 24]} /><meshToonMaterial color={col} /></mesh>
      {[-1, 1].map((s) => (<group key={s}><Rod a={[s * 0.12, CHEST + 0.04, 0.115]} b={[s * 0.19, SHOULDER + 0.05, 0.05]} r={0.024} c={col} /><Rod a={[s * 0.19, SHOULDER + 0.05, 0.05]} b={[s * 0.19, SHOULDER + 0.07, -0.04]} r={0.024} c={col} /><Rod a={[s * 0.19, SHOULDER + 0.07, -0.04]} b={ring} r={0.024} c={col} /></group>))}
      <mesh position={ring}><torusGeometry args={[0.05, 0.013, 6, 14]} /><meshBasicMaterial color="#CFCFC6" toneMapped={false} /></mesh>
      <mesh position={[ring[0], ring[1] + 0.09, ring[2]]}><boxGeometry args={[0.035, 0.12, 0.035]} /><meshToonMaterial color="#E8B23A" /></mesh>
    </group>
  );
};
