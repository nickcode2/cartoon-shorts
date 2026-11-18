// LIFE AND LIGHT (kit default 2026-11-16, Ricks Clips look): outdoor day = warm sun from the upper-left with soft god-ray shafts, sun patches on the ground and floating dust motes;
// indoors = window light shafts with a window-shaped patch on the floor, a lamp / bulb glow with a light pool, dust in the beams. All additive, unlit, no shadows, cheap:
// one texture per kind painted once (makeTex), shared geometry, dust = one Points object whose buffer is rewritten in place each frame (no allocation). Characters are unlit
// cards, so none of this grays them. Post (bloom, vignette, grade): `gradeEffects()` in ./Grade.tsx.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, hash, makeTex, shared} from './kit';

const shaftTex = (c: CanvasRenderingContext2D, w: number, h: number) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'destination-in'; const v = c.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,0.1)'); v.addColorStop(0.3, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = v; c.fillRect(0, 0, w, h); };
const radialTex = (c: CanvasRenderingContext2D, w: number, h: number) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,244,214,1)'); g.addColorStop(0.35, 'rgba(255,230,170,0.5)'); g.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); };
const windowTex = (c: CanvasRenderingContext2D, w: number, h: number) => { c.fillStyle = 'rgba(255,236,190,1)'; c.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.88); c.clearRect(w * 0.48, 0, w * 0.04, h); c.clearRect(0, h * 0.48, w, h * 0.04); c.filter = 'blur(6px)'; c.drawImage(c.canvas, 0, 0); c.filter = 'none'; }; // window panes with mullions, soft edge
const dotTex = (c: CanvasRenderingContext2D, w: number, h: number) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,248,225,1)'); g.addColorStop(1, 'rgba(255,248,225,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); };
const PLANE = () => shared('lfx-plane', () => new THREE.PlaneGeometry(1, 1));
const addMat = (map: THREE.Texture, op: number, color = '#ffe6b0') => new THREE.MeshBasicMaterial({map, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide});

export type FxMode = 'street' | 'office' | 'garage';
const Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
/** A beam from a to b (width w): a soft additive strip oriented along the vector. */
const Beam: React.FC<{a: V3; b: V3; w: number; mat: THREE.Material}> = ({a, b, w, mat}) => {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  Q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize()); // texture v runs from the source (top) to the end
  return <mesh geometry={PLANE()} material={mat} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={Q.clone()} scale={[w, len, 1]} renderOrder={20} />;
};
const DUST = 90;
export const LightFx: React.FC<{mode: FxMode; f: number; cam: V3}> = ({mode, f}) => {
  const {shaft, radial, win, dot, mats, dust, base} = useMemo(() => {
    const shaft = makeTex(64, 256, shaftTex), radial = makeTex(128, 128, radialTex), win = makeTex(256, 256, windowTex), dot = makeTex(32, 32, dotTex);
    const mats = {beam: addMat(shaft, 0.13), glow: addMat(radial, 0.55), win: addMat(win, 0.32), patch: addMat(radial, 0.2, '#ffd890'), sun: addMat(radial, 0.5)};
    const reg = mode === 'street' ? {x: [-2.4, 2.4], y: [0.3, 4], z: [-12, 2]} : mode === 'office' ? {x: [-3, 1], y: [0.3, 2.8], z: [-3, 1]} : {x: [-2.5, 2.5], y: [0.3, 2.8], z: [-5, 1]};
    const base = new Float32Array(DUST * 3), pos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) { base[i * 3] = reg.x[0] + hash(i, 1) * (reg.x[1] - reg.x[0]); base[i * 3 + 1] = reg.y[0] + hash(i, 2) * (reg.y[1] - reg.y[0]); base[i * 3 + 2] = reg.z[0] + hash(i, 3) * (reg.z[1] - reg.z[0]); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({map: dot, size: mode === 'street' ? 0.07 : 0.05, sizeAttenuation: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: '#fff2cc'}));
    pts.frustumCulled = false; pts.renderOrder = 21;
    return {shaft, radial, win, dot, mats, dust: pts, base};
  }, [mode]);
  void shaft; void radial; void win; void dot;
  const arr = dust.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < DUST; i++) { arr.array[i * 3] = base[i * 3] + 0.25 * Math.sin(f * 0.018 + i); arr.array[i * 3 + 1] = base[i * 3 + 1] + 0.18 * Math.sin(f * 0.013 + i * 1.7) + 0.0015 * f % 0.4; arr.array[i * 3 + 2] = base[i * 3 + 2] + 0.2 * Math.cos(f * 0.011 + i * 0.6); } // slow drift, in place
  arr.needsUpdate = true;
  const br = 0.85 + 0.15 * Math.sin(f * 0.04);
  mats.beam.opacity = 0.13 * br;
  return (
    <group>
      {mode === 'street' && (<>
        {[[-1.3, -1.0], [0.9, -3.5], [-0.7, -7], [1.6, -11], [-1.9, -14]].map(([x, z], i) => <Beam key={i} a={[x - 2.6, 7.5, z - 1]} b={[x + 2.2, 0, z + 0.5]} w={1.1 + 0.4 * (i % 2)} mat={mats.beam} />)}
        {[[0.6, -1.6, 2.6, 1.6], [-0.9, -4.4, 2.2, 1.4], [0.9, -7, 2.4, 1.6], [-0.5, -11, 2.6, 1.8]].map(([x, z, w, h], i) => <mesh key={i} geometry={PLANE()} material={mats.patch} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0.4]} scale={[w, h, 1]} renderOrder={19} />)}
      </>)}
      {mode === 'office' && (<>
        <Beam a={[-2.3, 2.4, -3.0]} b={[-0.1, 0, -0.9]} w={1.5} mat={mats.beam} />
        <mesh geometry={PLANE()} material={mats.win} position={[-0.25, 0.02, -1.0]} rotation={[-Math.PI / 2, 0, 0.35]} scale={[1.5, 2.1, 1]} renderOrder={19} />
        <mesh geometry={PLANE()} material={mats.glow} position={[-0.8, 1.25, -1.45]} scale={[0.9, 0.9, 1]} renderOrder={22} />
        <mesh geometry={PLANE()} material={mats.patch} position={[-0.8, 0.815, -1.2]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.2, 0.9, 1]} renderOrder={19} />
      </>)}
      {mode === 'garage' && (<>
        <Beam a={[0.6, 2.5, -1.2]} b={[0.6, 0, -1.2]} w={1.8} mat={mats.beam} />
        <mesh geometry={PLANE()} material={mats.glow} position={[0.6, 2.45, -1.1]} scale={[1.5, 1.5, 1]} renderOrder={22} />
        <mesh geometry={PLANE()} material={mats.patch} position={[0.6, 0.02, -1.2]} rotation={[-Math.PI / 2, 0, 0]} scale={[3.6, 3.6, 1]} renderOrder={19} />
      </>)}
      <primitive object={dust} />
    </group>
  );
};
void Z;
