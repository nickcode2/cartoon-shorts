// Sets for AIRPLANE_WINDOWS: 1950s Comet cabin, modern cabin (breather hole), hangar with the pressure-test water tank, diagram stages.
// GLOBAL STYLE v3 palette; standard materials; painted textures; lights per scene (shots use ownLights).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {LiveTex, Sky, V3, makeTex, clamp01, lerp} from '../kit/kit';
import {Glow, PAL, paintedTexture} from '../kit/finish';
import {B, Ball, Clouds, COMET_WIN, CometWindow, Cy, HDR_GOLD, HDR_SKY, HDR_WARM, MODERN_WIN, Mat, ModernWindow, RB, wallGeometry} from './parts';
import {Fuselage} from './aircraft';
import {Seat} from './seat';

// ================================================================= CABINS
export interface CabinSpec {wallX: number; rows: number[]; winDz: number; winY: number; seatX: number[]; pitchLabel: string}
export const MODERN: CabinSpec = {wallX: -1.95, rows: [0, -1.8, -3.6, -5.4, -7.2], winDz: 0.8, winY: 1.32, seatX: [-1.3, -0.62, 0.06, 0.95, 1.6], pitchLabel: 'modern'};
export const COMET: CabinSpec = {wallX: -2.45, rows: [0, -2.4, -4.8, -7.2, -9.6], winDz: 1.1, winY: 1.34, seatX: [-1.7, -0.98, 0.7, 1.4, 2.1], pitchLabel: 'comet'};
export const winZ = (spec: CabinSpec, row: number) => spec.rows[row] + spec.winDz;

export const Cabin: React.FC<{era: 'modern' | 'comet'; holeGlow?: number; children?: React.ReactNode}> = ({era, holeGlow = 0, children}) => {
  const modern = era === 'modern';
  const S = modern ? MODERN : COMET;
  const W = Math.abs(S.wallX);
  const win = modern ? MODERN_WIN : COMET_WIN;
  const len = 24;
  const wallTex = useMemo(() => paintedTexture('cabwall' + era, modern ? PAL.lavender.base : '#f1dcea', modern ? '#9d9fd8' : PAL.rose.base, '#ffffff', [0.3, 0.45], 3), [era, modern]);
  const floorTex = useMemo(() => makeTex(256, 256, (c, w, h) => {
    c.fillStyle = PAL.indigo.base; c.fillRect(0, 0, w, h);
    c.fillStyle = modern ? PAL.blueViolet.base : PAL.rose.base;
    if (modern) { for (let i = 0; i < 16; i++) { c.fillRect(0, i * 16, w, 6); } } else { c.fillRect(w * 0.38, 0, w * 0.24, h); c.strokeStyle = PAL.lavender.base; c.lineWidth = 5; c.strokeRect(w * 0.38, 6, w * 0.24, h - 12); }
    c.strokeStyle = 'rgba(30,20,72,0.4)'; c.lineWidth = 3; c.strokeRect(0, 0, w, h);
  }, [W * 0.9, 12]), [modern, W]);
  const holesL = useMemo(() => S.rows.map((z) => [-(z + S.winDz), S.winY] as [number, number]), [S]);
  const holesR = useMemo(() => S.rows.map((z) => [z + S.winDz, S.winY] as [number, number]), [S]);
  const wallL = useMemo(() => wallGeometry(len, 2.2, holesL, win.w, win.h, win.r), [len, holesL, win]);
  const wallR = useMemo(() => wallGeometry(len, 2.2, holesR, win.w, win.h, win.r), [len, holesR, win]);
  const seatC = modern ? PAL.lilac.base : PAL.rose.base, seatA = modern ? PAL.rose.base : PAL.lilac.vivid;
  return (
    <group>
      <hemisphereLight args={[modern ? '#C7CBFF' : '#E9A6B3', '#6A6CC0', 1.5]} />
      <directionalLight color="#ffd9a0" intensity={3.0} position={[-9, 5.5, 2]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-near={0.5} shadow-camera-far={24} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={3} />
      <pointLight position={[0, 2.3, 0.4]} color={PAL.glowWarm} intensity={9} distance={9} decay={2} />
      <pointLight position={[0, 2.3, -3]} color={PAL.glowWarm} intensity={7} distance={8} decay={2} />
      <ambientLight color="#ffffff" intensity={0.12} />

      {/* sky outside the windows */}
      <Sky top="#5A4FDB" bottom="#F5C2A0" r={160} />
      <Clouds items={[[-7, 0.6, -2, 1.3], [-9, 1.4, 4, 1.7], [-8, 0.3, 8, 1.4], [-10, 1.8, -7, 2]]} />
      <Clouds items={[[7, 0.6, 1, 1.3], [9, 1.4, -5, 1.7], [8, 0.2, 6, 1.4]]} />

      {/* shell: floor, walls with real window openings, curved ceiling, bulkheads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow><planeGeometry args={[W * 2, len]} /><Mat map={floorTex} r={0.8} /></mesh>
      <mesh geometry={wallL} position={[S.wallX, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow><Mat map={wallTex} r={0.8} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={wallR} position={[-S.wallX, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow><Mat map={wallTex} r={0.8} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 2.2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]} receiveShadow>
        <cylinderGeometry args={[W, W, len, 48, 1, true, Math.PI / 2, Math.PI]} />
        <Mat c={modern ? PAL.lavender.base : '#f4dfe9'} r={0.85} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((sg) => (
        <mesh key={'bk' + sg} position={[0, 1.4, sg * (len / 2)]} receiveShadow><planeGeometry args={[W * 2, 3.4]} /><Mat c={PAL.blueViolet.base} r={0.9} side={THREE.DoubleSide} /></mesh>
      ))}
      {/* wainscot rail, overhead bins, ceiling light strips (HDR) */}
      {[-1, 1].map((sg) => (
        <group key={'tr' + sg}>
          <RB s={[0.07, 0.07, len - 1]} p={[sg * (W - 0.04), 0.62, 0]} rad={0.03} c={PAL.indigo.base} r={0.5} cast={false} />
          <RB s={[0.55, 0.34, len - 1]} p={[sg * (W - 0.34), 2.28, 0]} rad={0.12} c={modern ? PAL.lavender.vivid : PAL.rose.base} r={0.7} cast={false} />
        </group>
      ))}
      {S.rows.map((z) => (
        <mesh key={'ls' + z} position={[0, 2.78, z]}><boxGeometry args={[0.14, 0.02, 0.6]} /><meshBasicMaterial color={HDR_WARM} toneMapped={false} /></mesh>
      ))}
      <Glow p={[0, 2.6, 0.2]} size={2.4} color={PAL.glowWarm} intensity={0.25} />

      {/* windows, both sides */}
      {S.rows.map((z) => (
        <group key={'wl' + z}>
          <group position={[S.wallX, S.winY, z + S.winDz]} rotation={[0, Math.PI / 2, 0]}>{modern ? <ModernWindow holeGlow={holeGlow} /> : <CometWindow />}</group>
          <group position={[-S.wallX, S.winY, z + S.winDz]} rotation={[0, -Math.PI / 2, 0]}>{modern ? <ModernWindow /> : <CometWindow />}</group>
        </group>
      ))}

      {/* seats: left block of three (A B C) and right block of two */}
      {S.rows.map((z) => S.seatX.map((x, i) => (
        <Seat key={z + '_' + i} p={[x, 0, z]} c={seatC} accent={seatA} retro={!modern} lod={Math.abs(z) > S.rows[1] * 1.1 || (i > 2 && Math.abs(z) > 0.1)} />
      )))}
      {children}
    </group>
  );
};

// ================================================================= HANGAR + TANK
export const TANK = {cx: 0, cz: -3, w: 9.2, d: 3.6, wall: 2.4, water: 2.0};
export const FUSE_C: V3 = [0, 0, TANK.cz];

const Cable: React.FC<{x: number; y0: number; y1: number; z: number}> = ({x, y0, y1, z}) => (
  <mesh position={[x, (y0 + y1) / 2, z]} scale={[1, Math.max(0.01, y1 - y0), 1]} castShadow>
    <cylinderGeometry args={[0.025, 0.025, 1, 8]} />
    <Mat c="#1E1448" r={0.4} m={0.6} />
  </mesh>
);

export const Hangar: React.FC<{fuseY: number; swell: number; crack: number; t: number; blueprint: number; children?: React.ReactNode}> = ({fuseY, swell, crack, t, blueprint, children}) => {
  const floor = useMemo(() => paintedTexture('hfloor', PAL.lavender.base, '#9d9fd8', '#ffffff', [6, 6], 5), []);
  const wall = useMemo(() => paintedTexture('hwall', PAL.blueViolet.base, PAL.indigo.base, '#8f90e0', [5, 2], 9), []);
  const tankTex = useMemo(() => paintedTexture('tank', PAL.indigo.base, PAL.indigo.vivid, '#6A6CC0', [3, 1], 2), []);
  const ripple = useMemo(() => makeTex(256, 256, (c, w, h) => {
    c.fillStyle = '#7f86ee'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { c.strokeStyle = i % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(30,20,72,0.2)'; c.lineWidth = 3 + (i % 4); const x = (i * 97) % w, y = (i * 53) % h; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 20, y - 8, x + 40, y + 8, x + 60, y); c.stroke(); }
  }, [3, 1.2]), []);
  ripple.offset.x = t * 0.02; ripple.offset.y = Math.sin(t * 0.6) * 0.01;
  const { cz, w, d, wall: wh, water } = TANK;
  const cables = fuseY > water + 0.6 || fuseY < water;
  return (
    <group>
      <hemisphereLight args={['#C7CBFF', '#6A6CC0', 1.7]} />
      <pointLight position={[0, 4, 5]} color="#ffe9d0" intensity={60} distance={18} decay={2} />
      <pointLight position={[0, 1.6, -2]} color="#A583F2" intensity={14} distance={7} decay={2} />
      {/* rim lights so the submerged hull reads: orange from behind and lilac from both ends */}
      <pointLight position={[0, 2.6, -6.6]} color={PAL.rim} intensity={70} distance={10} decay={2} />
      <pointLight position={[-6.4, 1.6, -3]} color="#C7CBFF" intensity={30} distance={8} decay={2} />
      <pointLight position={[6.4, 1.6, -3]} color="#F37A92" intensity={30} distance={8} decay={2} />
      <directionalLight color="#ffd9a0" intensity={2.6} position={[-5, 11, 7]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-11} shadow-camera-right={11} shadow-camera-top={11} shadow-camera-bottom={-11} shadow-camera-near={1} shadow-camera-far={40} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={3} />
      <pointLight position={[0, 8.5, -3]} color={PAL.key} intensity={30} distance={22} decay={2} />
      <pointLight position={[-9, 4, 2]} color={PAL.glowWarm} intensity={14} distance={12} decay={2} />
      <ambientLight color="#ffffff" intensity={0.1} />

      {/* shell */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow><planeGeometry args={[44, 44]} /><Mat map={floor} r={0.6} /></mesh>
      <mesh position={[0, 6, -13]} receiveShadow><planeGeometry args={[44, 14]} /><Mat map={wall} r={0.9} /></mesh>
      <mesh position={[-20, 6, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow><planeGeometry args={[44, 14]} /><Mat map={wall} r={0.9} /></mesh>
      <mesh position={[20, 6, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow><planeGeometry args={[44, 14]} /><Mat map={wall} r={0.9} /></mesh>
      <mesh position={[0, 6, 22]} rotation={[0, Math.PI, 0]}><planeGeometry args={[44, 14]} /><Mat map={wall} r={0.9} /></mesh>
      <mesh position={[0, 13, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[44, 44]} /><Mat c={PAL.indigo.base} r={1} /></mesh>
      {[-15, -9, -3, 3, 9, 15].map((x) => <B key={'bm' + x} s={[0.5, 0.5, 40]} p={[x, 11.4, 0]} c={PAL.indigo.vivid} r={0.6} cast={false} />)}
      {/* tall back windows: HDR golden light */}
      {[-12, -6, 6, 12].map((x) => (
        <group key={'bw' + x} position={[x, 6, -12.9]}>
          <B s={[2.6, 6, 0.1]} p={[0, 0, 0]} c={PAL.indigo.vivid} cast={false} />
          <mesh position={[0, 0, 0.07]}><planeGeometry args={[2.2, 5.6]} /><meshBasicMaterial color={HDR_GOLD} toneMapped={false} /></mesh>
          <Glow p={[0, 0, 0.6]} size={5} color={PAL.glowWarm} intensity={0.22} />
        </group>
      ))}
      {/* hanging lamps */}
      {[-6, 0, 6].map((x) => (
        <group key={'lp' + x} position={[x, 9.6, -3]}>
          <Cy r0={0.015} h={1.6} p={[0, 0.9, 0]} c="#1E1448" />
          <Cy r0={0.55} r1={0.12} h={0.4} p={[0, 0, 0]} c={PAL.rose.vivid} rough={0.4} m={0.3} open />
          <mesh position={[0, -0.12, 0]}><sphereGeometry args={[0.16, 16, 12]} /><meshBasicMaterial color={HDR_GOLD} toneMapped={false} /></mesh>
          <Glow p={[0, -0.2, 0]} size={2.4} color={PAL.glowWarm} intensity={0.55} />
        </group>
      ))}

      {/* tank: concrete floor and back wall, glass sides and front in steel frames, water volume */}
      <group position={[0, 0, cz]}>
        <B s={[w + 0.8, 0.4, d + 0.8]} p={[0, 0.2, 0]} map={tankTex} r={0.7} />
        <B s={[w + 0.8, wh, 0.4]} p={[0, wh / 2, -d / 2 - 0.2]} map={tankTex} r={0.7} />
        {[-1, 1].map((sg) => <B key={'tw' + sg} s={[0.3, wh, d + 0.4]} p={[sg * (w / 2 + 0.15), wh / 2, 0]} map={tankTex} r={0.7} />)}
        <mesh position={[0, wh / 2, d / 2 + 0.05]}><boxGeometry args={[w, wh, 0.08]} /><meshStandardMaterial color="#cfdcff" transparent opacity={0.16} roughness={0.05} depthWrite={false} /></mesh>
        {[-w / 2, -w / 4, 0, w / 4, w / 2].map((x) => <B key={'pst' + x} s={[0.14, wh + 0.1, 0.14]} p={[x, wh / 2, d / 2 + 0.05]} c={PAL.indigo.vivid} m={0.5} r={0.4} cast={false} />)}
        <B s={[w + 0.3, 0.14, 0.18]} p={[0, wh + 0.05, d / 2 + 0.05]} c={PAL.indigo.vivid} m={0.5} r={0.4} cast={false} />
        <mesh position={[0, water / 2 + 0.2, 0]}><boxGeometry args={[w - 0.05, water - 0.2, d - 0.05]} /><meshStandardMaterial color="#6A6CC0" transparent opacity={0.06} roughness={0.15} depthWrite={false} /></mesh>
        <mesh position={[0, water, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[w - 0.05, d - 0.05]} /><meshStandardMaterial map={ripple} transparent opacity={0.14} roughness={0.1} depthWrite={false} emissive="#3b38ee" emissiveIntensity={0.1} /></mesh>
      </group>

      {/* gantry crane: posts, beam, trolley, slings */}
      {[-6.2, 6.2].map((x) => <B key={'gp' + x} s={[0.4, 9.2, 0.4]} p={[x, 4.6, cz - 0.4]} c={PAL.indigo.vivid} m={0.4} r={0.5} />)}
      <B s={[13, 0.5, 0.5]} p={[0, 9.0, cz - 0.4]} c={PAL.indigo.vivid} m={0.4} r={0.5} />
      <B s={[1.4, 0.4, 0.8]} p={[0, 8.6, cz - 0.4]} c={PAL.rose.vivid} m={0.3} r={0.5} />
      {cables && [-1.2, 1.2].map((x) => <Cable key={'cb' + x} x={x} y0={fuseY + 0.8} y1={8.4} z={cz} />)}
      {!cables && null}

      {/* the pressure-test fuselage, hoisted/sunk by fuseY */}
      <group position={[FUSE_C[0], fuseY, FUSE_C[2]]}>
        <Fuselage swell={swell} crack={crack} dim={Math.min(1, Math.max(0, (2.7 - fuseY) / 0.9))} />
      </group>

      {/* pump station + gauge on the right */}
      <group position={[6.8, 0, -1.2]}>
        <RB s={[1.1, 1.3, 0.8]} p={[0, 0.65, 0]} rad={0.08} c={PAL.blueViolet.vivid} r={0.5} m={0.2} />
        <Cy r0={0.26} h={0.08} p={[0, 1.0, 0.44]} rot={[Math.PI / 2, 0, 0]} c="#fbfaf7" />
        <mesh position={[0, 1.0, 0.485]} rotation={[0, 0, -1.2 * swell + 0.9]}><boxGeometry args={[0.03, 0.2, 0.01]} /><meshBasicMaterial color="#F37A92" toneMapped={false} /></mesh>
      </group>

      {/* engineers' corner: drafting board with the live blueprint, stool, lamp */}
      <group position={[-8.5, 0, 1.4]}>
        <B s={[2.2, 0.08, 1.3]} p={[0, 0.82, 0]} rot={[0.5, 0, 0]} c={PAL.lilac.base} r={0.6} />
        {[-0.9, 0.9].map((x) => <B key={'dl' + x} s={[0.08, 0.85, 0.08]} p={[x, 0.42, 0.1]} c={PAL.indigo.base} m={0.3} />)}
        <group position={[0, 0.82, 0]} rotation={[0.5, 0, 0]}>
          <LiveTex w={512} h={300} size={[2.0, 1.15]} p={[0, 0.05, 0]} rot={[-Math.PI / 2, 0, 0]} draw={(c) => drawBlueprint(c, blueprint)} basic />
        </group>
        <group position={[0.9, 1.1, -0.15]}>
          <Cy r0={0.015} h={0.5} p={[0, 0.25, 0]} c="#1E1448" />
          <Cy r0={0.14} r1={0.04} h={0.16} p={[-0.12, 0.55, 0.1]} rot={[0, 0, 0.6]} c={PAL.rose.vivid} open />
          <mesh position={[-0.15, 0.5, 0.1]}><sphereGeometry args={[0.04, 12, 10]} /><meshBasicMaterial color={HDR_GOLD} toneMapped={false} /></mesh>
          <Glow p={[-0.15, 0.45, 0.12]} size={0.9} color={PAL.glowWarm} intensity={0.6} />
        </group>
        <pointLight position={[0.75, 1.7, 0.4]} color={PAL.key} intensity={5} distance={5} decay={2} />
        <Cy r0={0.25} h={0.06} p={[1.9, 0.7, 1.1]} c={PAL.rose.base} />
        <Cy r0={0.03} h={0.7} p={[1.9, 0.35, 1.1]} c={PAL.indigo.base} m={0.4} />
      </group>
      {children}
    </group>
  );
};

/** Blueprint canvas (blue-violet paper, white lines): a fuselage side view with window shapes. k 0 = big square windows, 1 = smaller rounded windows. */
function drawBlueprint(c: CanvasRenderingContext2D, k: number) {
  const W = 512, H = 300;
  c.fillStyle = '#5A4FDB'; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(199,203,255,0.25)'; c.lineWidth = 1;
  for (let x = 0; x < W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y < H; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.strokeStyle = '#f4f2ff'; c.lineWidth = 3;
  c.beginPath(); c.roundRect(24, 100, 464, 110, 55); c.stroke();
  c.beginPath(); c.moveTo(24, 155); c.lineTo(488, 155); c.setLineDash([10, 8]); c.stroke(); c.setLineDash([]);
  const w = lerp(46, 26, k), h = lerp(44, 34, k), r = lerp(2, 15, k);
  for (let i = 0; i < 7; i++) {
    const cx = 78 + i * 62, cy = 132;
    c.beginPath(); c.roundRect(cx - w / 2, cy - h / 2, w, h, r); c.stroke();
    c.fillStyle = 'rgba(255,233,168,' + (0.2 + 0.2 * k) + ')'; c.fill();
  }
  c.strokeStyle = '#F37A92'; c.lineWidth = 4;
  c.beginPath(); c.arc(78 + 2 * 62 - (lerp(46, 26, k) / 2) * 0.7, 132 - lerp(44, 34, k) / 2 * 0.8, 18, 0, Math.PI * 2); c.stroke(); // circled corner
}

// ================================================================= DIAGRAM STAGES
export const Stage: React.FC<{children?: React.ReactNode; dark?: boolean}> = ({children}) => {
  const floor = useMemo(() => paintedTexture('stagefloor', PAL.blueViolet.base, PAL.indigo.base, PAL.lilac.base, [4, 4], 4), []);
  return (
    <group>
      <hemisphereLight args={['#C7CBFF', '#6A6CC0', 1.5]} />
      <pointLight position={[0, 3, 6]} color="#ffe9d0" intensity={40} distance={16} decay={2} />
      <directionalLight color="#ffd9a0" intensity={2.4} position={[-3.5, 6, 5]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-camera-near={0.5} shadow-camera-far={20} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={3} />
      <pointLight position={[3, 2.5, -3]} color={PAL.rim} intensity={9} distance={10} decay={2} />
      <pointLight position={[-3, 1.5, 3]} color={PAL.glowWarm} intensity={4} distance={8} decay={2} />
      <Sky top="#1E1448" bottom="#6A6CC0" r={120} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow><circleGeometry args={[40, 48]} /><Mat map={floor} r={0.5} m={0.1} /></mesh>
      {children}
    </group>
  );
};

/** Window cut-out plate for the stress diagram. kind 'square' (sharp corners) or 'round'. heat 0..1 grows the stress glow. */
export const StressPlate: React.FC<{kind: 'square' | 'round'; heat: number}> = ({kind, heat}) => {
  const sq = kind === 'square';
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.9, -0.9); s.lineTo(0.9, -0.9); s.lineTo(0.9, 0.9); s.lineTo(-0.9, 0.9); s.closePath();
    const h = new THREE.Path();
    const hw = sq ? 0.42 : 0.34, hh = sq ? 0.42 : 0.46, r = sq ? 0.0 : 0.3;
    if (r === 0) { h.moveTo(-hw, -hh); h.lineTo(-hw, hh); h.lineTo(hw, hh); h.lineTo(hw, -hh); h.closePath(); }
    else { const k = Math.min(r, hw, hh); h.moveTo(-hw + k, -hh); h.lineTo(hw - k, -hh); h.absarc(hw - k, -hh + k, k, -Math.PI / 2, 0, false); h.lineTo(hw, hh - k); h.absarc(hw - k, hh - k, k, 0, Math.PI / 2, false); h.lineTo(-hw + k, hh); h.absarc(-hw + k, hh - k, k, Math.PI / 2, Math.PI, false); h.lineTo(-hw, -hh + k); h.absarc(-hw + k, -hh + k, k, Math.PI, Math.PI * 1.5, false); }
    s.holes.push(h);
    return new THREE.ExtrudeGeometry(s, {depth: 0.14, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 16});
  }, [sq]);
  const tex = useMemo(() => paintedTexture('plate' + kind, PAL.lavender.base, '#9d9fd8', '#ffffff', [0.7, 0.7], 6), [kind]);
  return (
    <group position={[0, 1.1, 0]}>
      <mesh geometry={geo} castShadow receiveShadow><Mat map={tex} r={0.4} m={0.15} /></mesh>
      {/* rivets around the border */}
      {Array.from({length: 24}, (_, i) => { const a = (i / 24) * Math.PI * 2, rr = 0.8; return <Ball key={i} r={0.018} p={[Math.cos(a) * rr * (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 1 : 0.9), Math.sin(a) * rr, 0.16]} c="#8f90e0" m={0.5} />; })}
      {/* stress heat: bright piles at the sharp corners / a thin even band on the round one */}
      <LiveTex w={512} h={512} size={[1.8, 1.8]} p={[0, 0, 0.175]} draw={(c) => drawHeat(c, sq, heat)} />
    </group>
  );
};
function drawHeat(c: CanvasRenderingContext2D, sq: boolean, heat: number) {
  const px = 512 / 1.8; // px per metre
  const spots: [number, number, number, number][] = sq
    ? [[-0.42, -0.42, 0.34, 1], [0.42, -0.42, 0.34, 1], [0.42, 0.42, 0.34, 1], [-0.42, 0.42, 0.34, 1]]
    : Array.from({length: 12}, (_, i) => { const a = (i / 12) * Math.PI * 2; return [Math.cos(a) * 0.34 * 1.05, Math.sin(a) * 0.46 * 1.02, 0.22, 0.28] as [number, number, number, number]; });
  c.globalCompositeOperation = 'lighter';
  for (const [x, y, r, a] of spots) {
    const cx = 256 + x * px, cy = 256 - y * px, R = r * px * (0.4 + 0.6 * heat);
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, `rgba(255,201,60,${0.95 * a * heat})`);
    g.addColorStop(0.35, `rgba(243,122,146,${0.7 * a * heat})`);
    g.addColorStop(1, 'rgba(165,131,242,0)');
    c.fillStyle = g; c.fillRect(0, 0, 512, 512);
  }
  c.globalCompositeOperation = 'source-over';
}

/** Cross-section of the three-pane window seen edge-on: cabin on the left, outside on the right. `flow` 0..1 animates air through the breather hole,
 *  `load` 0..1 loads the outer pane (it glows), arrows show the cabin pressure. */
export const PaneStack: React.FC<{flow: number; load: number; t: number}> = ({flow, load, t}) => {
  const slabs: {x: number; c: string; hole?: boolean; name: string}[] = [
    {x: -0.75, c: '#d9e4ff', name: 'inner'},
    {x: 0.0, c: '#c4d4ff', hole: true, name: 'middle'},
    {x: 0.75, c: '#b8c8ff', name: 'outer'},
  ];
  const H = 1.5, T = 0.16, D = 0.8;
  const emi = new THREE.Color(1.2 + 1.8 * load, 0.45 + 0.55 * load, 0.4 + 0.3 * load);
  return (
    <group position={[0, 1.15, 0]}>
      {/* frame blocks top and bottom */}
      <RB s={[2.1, 0.16, D + 0.2]} p={[0, H / 2 + 0.08, 0]} rad={0.04} c={PAL.indigo.base} m={0.3} r={0.5} />
      <RB s={[2.1, 0.16, D + 0.2]} p={[0, -H / 2 - 0.08, 0]} rad={0.04} c={PAL.indigo.base} m={0.3} r={0.5} />
      {slabs.map((s) => (
        <group key={s.name} position={[s.x, 0, 0]}>
          {s.hole ? (
            <>
              <RB s={[T, H - 0.46, D]} p={[0, 0.115, 0]} rad={0.02} c={s.c} r={0.1} o={0.5} cast={false} />
              <RB s={[T, 0.22, D]} p={[0, -H / 2 + 0.11, 0]} rad={0.02} c={s.c} r={0.1} o={0.5} cast={false} />
              {/* hole between them */}
              <mesh position={[0, -H / 2 + 0.31, 0]}><boxGeometry args={[T + 0.01, 0.07, D * 0.999]} /><meshBasicMaterial color={HDR_GOLD} transparent opacity={0.35 + 0.4 * flow} toneMapped={false} depthWrite={false} /></mesh>
            </>
          ) : (
            <RB s={[T, H, D]} p={[0, 0, 0]} rad={0.02} c={s.name === 'outer' ? '#e6c4ff' : s.c} r={0.1} o={s.name === 'outer' ? 0.75 : 0.5} e={s.name === 'outer' ? emi : undefined} cast={false} />
          )}
        </group>
      ))}
      {/* cabin pressure arrows (point right, toward the outer pane) */}
      {[-0.5, -0.1, 0.3, 0.6].map((y, i) => (
        <group key={i} position={[-1.35 + 0.1 * Math.sin(t * 3 + i), y, 0]}>
          <Cy r0={0.03} h={0.32} p={[0, 0, 0]} rot={[0, 0, Math.PI / 2]} c={PAL.rose.vivid} />
          <mesh position={[0.2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.07, 0.14, 12]} /><Mat c={PAL.rose.vivid} /></mesh>
        </group>
      ))}
      {/* air dots flowing through the breather hole into the gap between middle and outer pane */}
      {[0, 1, 2].map((i) => {
        const u = (flow * 1.4 + i / 3) % 1;
        return <Ball key={i} r={0.03} p={[-0.4 + u * 0.9, -H / 2 + 0.31, 0.05 * i - 0.05]} c={HDR_GOLD.getStyle()} e={HDR_GOLD} o={flow > 0.02 ? 0.9 : 0} />;
      })}
      <Glow p={[0.75, 0, 0.5]} size={1.8} color={PAL.rim} intensity={0.55 * load} />
    </group>
  );
};

export const Cutaway: React.FC<{swell: number}> = ({swell}) => (
  <group position={[0, 1.4, 0]}>
    <Fuselage swell={swell} cut />
    {/* outward pressure arrows */}
    {Array.from({length: 10}, (_, i) => { const a = (i / 10) * Math.PI * 2, rr = 1.2 + 0.4 * swell; return (
      <mesh key={i} position={[((i % 5) - 2) * 0.9, Math.sin(a) * rr, Math.cos(a) * rr]} rotation={[a * -1 + Math.PI / 2 * 0, 0, 0]}>
        <coneGeometry args={[0.07, 0.2, 10]} /><meshBasicMaterial color={clamp01(swell) > 0.05 ? PAL.rose.vivid : '#000'} transparent opacity={0.9 * clamp01(swell * 2)} />
      </mesh>
    ); })}
    <Glow p={[0, 0, 0]} size={4.5} color={PAL.glowWarm} intensity={0.25 + 0.3 * swell} />
  </group>
);
void HDR_SKY;
