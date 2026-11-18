// SunUniverseTest: Sun (main character) walks to the island and picks up a mug; Universe (secondary) listens. 9:16, 90 frames at 30 fps = 3.0 s, hard hold, no fade.
// Night kitchen, wide shot, one slow push-in. GlowCharacter + RIG_GLOW. Standard materials, GLOBAL STYLE v3 palette. No text in the scene, so no Fredoka label.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Bloom, DepthOfField, EffectComposer, ToneMapping, Vignette} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import {Pose, ShotSpec, SingleCanvasVideo, V3, makeTex} from './kit/kit';
import {GlowCharacter, useGlowTextures} from './kit/glowChar';
import {Glow, PAL, paintedTexture} from './kit/finish';
import {CAM, COUNTER_Y, CUP_Z, CZ, FPS, FRAMES, HOLD_T, S, SUN_X, UNI_X, sunMotion, universePose} from './SunUniverseMotion';

const HDR_GOLD = new THREE.Color(3.4, 3.0, 1.9);
const HDR_MOON = new THREE.Color(1.5, 1.6, 2.4);

const Mat: React.FC<{c?: string; map?: THREE.Texture; r?: number; m?: number}> = ({c = '#ffffff', map, r = 0.7, m = 0}) => (
  <meshStandardMaterial color={c} map={map} roughness={r} metalness={m} />
);
const B: React.FC<{s: V3; p: V3; c?: string; map?: THREE.Texture; r?: number; m?: number; cast?: boolean}> = ({s, p, cast = true, ...mp}) => (
  <mesh position={p} castShadow={cast} receiveShadow>
    <boxGeometry args={s} />
    <Mat {...mp} />
  </mesh>
);
const Cy: React.FC<{r0: number; r1?: number; h: number; p: V3; rot?: V3; c: string; rough?: number; m?: number; open?: boolean}> = ({r0, r1, h, p, rot, c, rough = 0.6, m = 0, open}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} castShadow receiveShadow>
    <cylinderGeometry args={[r1 ?? r0, r0, h, 32, 1, open]} />
    <meshStandardMaterial color={c} roughness={rough} metalness={m} side={open ? THREE.DoubleSide : THREE.FrontSide} />
  </mesh>
);

const Pendant: React.FC<{x: number}> = ({x}) => (
  <group position={[x, 0, -0.4]}>
    <Cy r0={0.004} h={0.9} p={[0, 2.45, 0]} c="#1E1448" />
    <Cy r0={0.2} r1={0.05} h={0.2} p={[0, 1.9, 0]} c={PAL.rose.vivid} rough={0.4} m={0.2} open />
    <mesh position={[0, 1.8, 0]}>
      <sphereGeometry args={[0.055, 16, 12]} />
      <meshBasicMaterial color={HDR_GOLD} toneMapped={false} />
    </mesh>
    <Glow p={[0, 1.78, 0.02]} size={0.9} color={PAL.glowWarm} intensity={0.6} />
  </group>
);

const Mug: React.FC<{p: V3}> = ({p}) => (
  <group position={p}>
    <Cy r0={0.04} r1={0.043} h={0.09} p={[0, 0, 0]} c={PAL.rose.base} rough={0.35} open />
    <Cy r0={0.04} h={0.086} p={[0, -0.002, 0]} c={PAL.rose.vivid} rough={0.35} />
    <mesh position={[0, 0.036, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.039, 24]} />
      <meshStandardMaterial color="#2a1a2e" roughness={0.2} />
    </mesh>
    <mesh position={[0.041, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
      <torusGeometry args={[0.026, 0.007, 10, 24, Math.PI]} />
      <Mat c={PAL.rose.vivid} r={0.35} />
    </mesh>
  </group>
);

const Kitchen: React.FC = () => {
  const floor = useMemo(() => makeTex(512, 512, (c, w, h) => {
    const n = 4, ts = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = (i + j) % 2 ? '#a591d6' : '#BBA8E3'; c.fillRect(i * ts, j * ts, ts, ts); }
    c.strokeStyle = '#352A57'; c.lineWidth = 6;
    for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * ts, 0); c.lineTo(i * ts, h); c.stroke(); c.beginPath(); c.moveTo(0, i * ts); c.lineTo(w, i * ts); c.stroke(); }
  }, [10, 10]), []);
  const wall = useMemo(() => paintedTexture('wallSU', PAL.blueViolet.base, PAL.indigo.base, '#8f90e0', [6, 2], 3), []);
  const tiles = useMemo(() => makeTex(256, 128, (c, w, h) => {
    c.fillStyle = PAL.lavender.base; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#9d9fd8'; c.lineWidth = 3;
    for (let r = 0; r < 4; r++) { const y = r * (h / 4); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = (r % 2) * 32; x < w; x += 64) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + h / 4); c.stroke(); } }
  }, [14, 3]), []);
  const top = useMemo(() => paintedTexture('topSU', PAL.lavender.base, '#a9abdc', '#ffffff', [3, 1], 7), []);
  const cab = useMemo(() => paintedTexture('cabSU', PAL.lilac.base, PAL.indigo.base, '#d9cdf5', [2, 1], 5), []);
  const doors = (x0: number, n: number, w: number) => Array.from({length: n}, (_, i) => x0 + i * w);
  return (
    <group>
      <hemisphereLight args={['#8f90e0', '#352A57', 1.0]} />
      <directionalLight color="#9fb0ff" intensity={1.5} position={[-3.5, 3.6, 3.8]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-camera-near={0.5} shadow-camera-far={16} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={4} />
      <pointLight position={[0.05, 1.75, -0.35]} color={PAL.key} intensity={7} distance={6} decay={2} />
      <pointLight position={[0.6, 1.4, -2.0]} color="#a9b8ff" intensity={5} distance={5} decay={2} />
      <ambientLight color="#ffffff" intensity={0.1} />

      {/* shell: floor, ceiling, back and side walls extend past every view edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} receiveShadow><planeGeometry args={[16, 16]} /><Mat map={floor} r={0.35} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 2.9, 2]}><planeGeometry args={[16, 16]} /><Mat c={PAL.indigo.base} r={0.9} /></mesh>
      <mesh position={[0, 1.45, -2.4]} receiveShadow><planeGeometry args={[16, 2.9]} /><Mat map={wall} r={0.85} /></mesh>
      <mesh position={[-6, 1.45, 2]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[16, 2.9]} /><Mat map={wall} r={0.85} /></mesh>
      <mesh position={[6, 1.45, 2]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[16, 2.9]} /><Mat map={wall} r={0.85} /></mesh>

      {/* back run: base cabinets, worktop, tiled backsplash, upper cabinets, window with moonlight, fridge */}
      <B s={[8, 0.1, 0.64]} p={[0, 0.05, -2.05]} c={PAL.indigo.base} />
      <B s={[8, 0.74, 0.62]} p={[0, 0.47, -2.06]} map={cab} />
      {doors(-3.5, 8, 1).map((x) => <B key={x} s={[0.94, 0.66, 0.02]} p={[x, 0.47, -1.74]} c={PAL.lilac.vivid} r={0.5} cast={false} />)}
      {doors(-3.5, 8, 1).map((x) => <Cy key={'h' + x} r0={0.01} h={0.14} p={[x + 0.36, 0.72, -1.71]} c="#DCDDF3" m={0.6} rough={0.3} />)}
      <B s={[8, 0.04, 0.7]} p={[0, 0.84, -2.04]} map={top} r={0.4} />
      <mesh position={[0, 1.2, -2.38]} receiveShadow><planeGeometry args={[8, 0.66]} /><Mat map={tiles} r={0.35} /></mesh>
      {[[-2.2, 2.2], [1.45, 2.4]].map(([x, w]) => (
        <group key={x}>
          <B s={[w, 0.8, 0.34]} p={[x, 1.95, -2.22]} map={cab} />
          <B s={[w, 0.03, 0.02]} p={[x, 1.55, -2.04]} c={HDR_GOLD.getStyle()} cast={false} />
        </group>
      ))}
      <B s={[1.1, 0.06, 0.1]} p={[-0.2, 1.1, -2.34]} c={PAL.indigo.vivid} />
      <group position={[-0.2, 1.75, -2.36]}>
        <B s={[1.1, 1.1, 0.06]} p={[0, 0, 0]} c={PAL.indigo.vivid} />
        <mesh position={[0, 0, 0.035]}><planeGeometry args={[0.98, 0.98]} /><meshBasicMaterial color={HDR_MOON} toneMapped={false} /></mesh>
        <B s={[0.03, 0.98, 0.03]} p={[0, 0, 0.05]} c={PAL.indigo.vivid} cast={false} />
        <B s={[0.98, 0.03, 0.03]} p={[0, 0, 0.05]} c={PAL.indigo.vivid} cast={false} />
        <Glow p={[0, 0, 0.3]} size={1.6} color="#a9b8ff" intensity={0.35} />
      </group>
      <B s={[0.9, 1.9, 0.75]} p={[-2.6, 0.95, -1.9]} c={PAL.lavender.base} r={0.35} m={0.2} />
      <B s={[0.03, 0.5, 0.04]} p={[-2.15, 1.2, -1.5]} c={PAL.indigo.base} m={0.6} />

      {/* island: carcass, three inset doors, handles, toe kick, overhanging top with edge, bowl and fruit */}
      <B s={[3.8, 0.1, 0.72]} p={[0, 0.05, -0.4]} c={PAL.indigo.base} />
      <B s={[3.8, 0.64, 0.8]} p={[0, 0.42, -0.4]} map={cab} />
      {[-1.2, 0, 1.2].map((x) => (
        <group key={x}>
          <B s={[1.12, 0.52, 0.02]} p={[x, 0.42, 0.005]} c={PAL.lilac.vivid} r={0.5} cast={false} />
          <B s={[1.04, 0.44, 0.012]} p={[x, 0.42, 0.016]} c={PAL.lilac.base} r={0.55} cast={false} />
          <Cy r0={0.012} h={0.2} p={[x + 0.4, 0.58, 0.05]} c="#DCDDF3" m={0.6} rough={0.3} />
        </group>
      ))}
      <B s={[3.9, 0.04, 0.92]} p={[0, COUNTER_Y - 0.02, -0.4]} map={top} r={0.35} />
      <B s={[3.9, 0.012, 0.012]} p={[0, COUNTER_Y - 0.052, 0.05]} c={PAL.lavender.vivid} cast={false} />
      <group position={[-0.95, COUNTER_Y, -0.38]}>
        <Cy r0={0.12} r1={0.19} h={0.09} p={[0, 0.045, 0]} c={PAL.indigo.vivid} rough={0.4} open />
        <Cy r0={0.1} h={0.01} p={[0, 0.01, 0]} c={PAL.indigo.vivid} />
        {[[-0.05, 0.1, 0.0, PAL.rose.vivid], [0.06, 0.1, 0.03, '#F5C2A0'], [0.0, 0.11, -0.06, PAL.lilac.vivid], [0.07, 0.1, -0.05, PAL.rose.base]].map(([x, y, z, col], i) => (
          <mesh key={i} position={[x as number, y as number, z as number]} castShadow><sphereGeometry args={[0.055, 18, 14]} /><Mat c={col as string} r={0.5} /></mesh>
        ))}
      </group>
      <Pendant x={-0.5} />
      <Pendant x={0.55} />
    </group>
  );
};

const Scene: React.FC<{t: number; ready: boolean}> = ({t, ready}) => {
  const sun = sunMotion(t);
  return (
    <>
      <Kitchen />
      <Mug p={sun.cup} />
      <GlowCharacter kind="universe" pose={universePose(t)} p={[UNI_X, 0, CZ]} s={S} yawK={0} ready={ready} />
      <GlowCharacter kind="sun" pose={sun.pose} p={[sun.x, 0, CZ]} s={S} yawK={0} ready={ready} />
    </>
  );
};

const FOCUS = new THREE.Vector3((UNI_X + SUN_X) / 2, 0.8, CZ);
const Post: React.FC<{pose: Pose}> = ({pose}) => (
  <EffectComposer multisampling={4}>
    <Bloom intensity={0.9} luminanceThreshold={1.0} luminanceSmoothing={0.2} mipmapBlur radius={0.8} />
    <DepthOfField worldFocusDistance={new THREE.Vector3(...pose.p).distanceTo(FOCUS)} worldFocusRange={3.0} bokehScale={2.0} />
    <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    <Vignette offset={0.32} darkness={0.4} />
  </EffectComposer>
);

const SunUniverse: React.FC = () => {
  const ready = useGlowTextures();
  const shots: ShotSpec[] = useMemo(() => [{
    from: 0,
    to: FRAMES,
    light: 'dark',
    ownLights: true,
    cam: CAM,
    post: (_f, pose) => <Post pose={pose} />,
    render: (t) => <Scene t={t} ready={ready} />,
  }], [ready]);
  return <SingleCanvasVideo shots={shots} fps={FPS} />;
};

export const SunUniverseTest: React.FC = () => <SunUniverse />;
export {FRAMES as SU_FRAMES, FPS as SU_FPS, HOLD_T as SU_HOLD_T, CUP_Z as SU_CUP_Z};
