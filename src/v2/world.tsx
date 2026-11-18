// Map room and the Swedish mailbox street for CrisisShortV2.
import React from 'react';
import * as THREE from 'three';
import {Sky, V3, clamp01, hash, lerp, smooth} from '../kit/kit';
import {Ctx, Halo, SBall, SBox, SCyl, SPlane, blot, fitCover, lgr, paintHalo} from './gfx';
import {ctex, Bush, Fence, House, paintConcrete, paintGrass, paintLeaves, Tree} from './street';
import {paintPlanks, paintWall} from './rooms';
import {CANADA, CITIES, EXTRA, ICELAND, IRELAND, JAPAN, LL, MAINLAND, MAP_H, MAP_W, PPX, PPY, SARDINIA, SICILY, UK, mapXZ, toPx} from './mapdata';

// ================================================================================================== MAP ROOM
const SEA = '#5fb8de';
const drawLand = (c: Ctx, pts: LL[], f: (p: LL) => [number, number]) => {
  const path = () => { c.beginPath(); pts.forEach((p, i) => { const [x, y] = f(p); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }); c.closePath(); };
  c.lineJoin = 'round';
  path(); c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 46; c.stroke(); // shallow water halo
  path(); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 24; c.stroke();
  path(); c.fillStyle = '#e8d49a'; c.fill();
  c.save(); path(); c.clip();
  blot(c, 11, 90, 3000, 3000, 20, 90, '120,160,80', 0.4); // lowlands
  blot(c, 12, 70, 3000, 3000, 20, 80, '200,150,90', 0.36); // hills
  blot(c, 13, 40, 3000, 3000, 14, 50, '255,255,255', 0.5); // mountain snow
  c.restore();
  path(); c.strokeStyle = '#5b4630'; c.lineWidth = 5; c.stroke();
};
const europeTex = (c: Ctx, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, 0, h, [[0, '#4fa9d6'], [1, '#6cc9e8']]); c.fillRect(0, 0, w, h);
  blot(c, 21, 60, w, h, 80, 260, '30,100,160', 0.12);
  c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2;
  for (let lon = -20; lon < 36; lon += 10) { const [x] = toPx([lon, 0]); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let lat = 40; lat < 72; lat += 10) { const [, y] = toPx([0, lat]); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  for (const poly of [MAINLAND, UK, IRELAND, ICELAND, SICILY, SARDINIA]) drawLand(c, poly, toPx);
  // compass rose in the sea (bottom-left corner)
  c.save(); c.translate(150, h - 150); c.fillStyle = 'rgba(255,255,255,0.85)'; c.strokeStyle = '#5b4630'; c.lineWidth = 4;
  for (let i = 0; i < 4; i++) { c.save(); c.rotate((i * Math.PI) / 2); c.beginPath(); c.moveTo(0, -100); c.lineTo(18, -18); c.lineTo(0, 0); c.lineTo(-18, -18); c.closePath(); c.fill(); c.stroke(); c.restore(); }
  c.beginPath(); c.arc(0, 0, 118, 0, 7); c.stroke(); c.restore();
  c.strokeStyle = '#5b4630'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
};
const tileTex = (poly: LL[][], f: (p: LL) => [number, number]) => (c: Ctx, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, 0, h, [[0, '#4fa9d6'], [1, '#6cc9e8']]); c.fillRect(0, 0, w, h);
  blot(c, 22, 30, w, h, 60, 200, '30,100,160', 0.12);
  poly.forEach((p) => drawLand(c, p, f));
  c.strokeStyle = '#5b4630'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
};

const Pulse: React.FC<{p: V3; t0: number; t: number; r: number}> = ({p, t0, t, r}) => {
  const age = t - t0;
  if (age < 0) return null;
  const pop = Math.min(1, age / 0.18);
  const sc = pop < 1 ? 1 + 0.5 * Math.sin(pop * Math.PI) : 1;
  const ph = (age * 0.9) % 1;
  return (
    <group position={p}>
      <mesh position={[0, 0.03, 0]} scale={sc * pop} castShadow>
        <cylinderGeometry args={[r, r, 0.06, 24]} />
        <meshStandardMaterial color="#ff2f3a" emissive="#ff2f3a" emissiveIntensity={1.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.07, 0]} scale={sc * pop}>
        <cylinderGeometry args={[r * 0.5, r * 0.5, 0.05, 16]} />
        <meshStandardMaterial color={new THREE.Color(3, 1.6, 1.6)} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={r * (1 + ph * 5)}>
        <ringGeometry args={[0.85, 1, 40]} />
        <meshBasicMaterial color="#ff2f3a" transparent opacity={0.7 * (1 - ph)} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
};

export const MapRoom: React.FC<{t: number; absT: number; dotR?: number}> = ({absT, dotR = 0.075}) => {
  const halo = ctex('halo', 256, 256, paintHalo);
  const eu = ctex('europe2', MAP_W, MAP_H, europeTex);
  const caTex = ctex('canada2', 1200, 700, tileTex([CANADA], (p) => [((p[0] + 142) / 92) * 1200, ((72 - p[1]) / 31) * 700]));
  const jpTex = ctex('japan2', 700, 900, tileTex(JAPAN, (p) => [((p[0] - 127) / 21) * 700, ((47 - p[1]) / 18) * 900]));
  const wood = ctex('tablewood2', 1024, 1024, paintPlanks('#9a6a40', 128, true), [14, 8]);
  const floor = ctex('mfloor', 512, 512, paintPlanks('#4a3626', 64), [20, 20]);
  const wall = ctex('mwall', 512, 512, paintWall('#2f4a52', '#294148'), [10, 1]);
  const paper = ctex('paper', 256, 256, (c, w, h) => { c.fillStyle = '#f5f0e0'; c.fillRect(0, 0, w, h); blot(c, 3, 30, w, h, 20, 90, '140,120,80', 0.1); });
  const toWorld = (ll: LL, tile: string): V3 => {
    if (tile === 'ca') return [-9.5 + ((ll[0] + 142) / 92 - 0.5) * 6, 0.025, ((72 - ll[1]) / 31 - 0.5) * 3.5];
    if (tile === 'jp') return [9 + ((ll[0] - 127) / 21 - 0.5) * 3.5, 0.025, ((47 - ll[1]) / 18 - 0.5) * 4.5];
    const [x, z] = mapXZ(ll[0], ll[1]);
    return [x, 0.025, z];
  };
  const T = absT - 15.3;
  const pins = [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]];
  return (
    <group>
      <hemisphereLight args={['#bcd6ff', '#5a4030', 0.85]} />
      <directionalLight color="#ffe0b0" intensity={1.7} position={[-3, 9, 5]} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-camera-near={0.5} shadow-camera-far={30} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={4} />
      <directionalLight color="#a8c8ff" intensity={0.5} position={[5, 4, -4]} />
      <ambientLight intensity={0.1} />
      {[[0, 3.4, 0], [-9.5, 3.4, 0], [9, 3.4, 0], [0, 3.4, -9], [0, 3.4, 9]].map((q, i) => <pointLight key={i} position={q as V3} color="#fff0d2" intensity={22} distance={14} decay={2} />)}
      {/* war-room shell far beyond the table: floor, walls, ceiling with lamps */}
      <SPlane w={120} h={80} p={[0, -0.9, 0]} rot={[-Math.PI / 2, 0, 0]} map={floor} r={0.6} />
      <SPlane w={120} h={14} p={[0, 6.1, -40]} map={wall} r={0.9} />
      <SPlane w={120} h={14} p={[0, 6.1, 40]} rot={[0, Math.PI, 0]} map={wall} r={0.9} />
      <SPlane w={80} h={14} p={[-60, 6.1, 0]} rot={[0, Math.PI / 2, 0]} map={wall} r={0.9} />
      <SPlane w={80} h={14} p={[60, 6.1, 0]} rot={[0, -Math.PI / 2, 0]} map={wall} r={0.9} />
      <SPlane w={120} h={80} p={[0, 13, 0]} rot={[Math.PI / 2, 0, 0]} c="#cfc8b8" r={0.95} recv={false} />
      {[-3, -2, -1, 0, 1, 2, 3].map((k) => (
        <group key={k}>
          <SPlane w={5} h={3.2} p={[k * 8.4 - 0.5, 4.2, -39.9]} map={eu} r={0.6} />
          <SBox s={[5.2, 3.4, 0.06]} p={[k * 8.4 - 0.5, 4.2, -39.95]} c="#5b3b24" r={0.7} />
        </group>
      ))}
      {[-18, -9, 0, 9, 18].map((x) => [-9, 9].map((z) => (
        <group key={x + '_' + z}>
          <SCyl r0={0.01} h={5} p={[x, 10.5, z]} c="#2d313b" r={0.5} seg={6} cast={false} />
          <mesh position={[x, 7.9, z]}><sphereGeometry args={[0.22, 14, 10]} /><meshStandardMaterial color={new THREE.Color(3.4, 3.1, 2.4)} emissive="#ffd9a0" toneMapped={false} /></mesh>
          <Halo tex={halo} p={[x, 7.9, z]} w={2} color="#ffe0b0" op={0.4} />
        </group>
      )))}
      {/* one huge table so every angle (incl. the overview) is full of wood */}
      <SBox s={[60, 0.3, 26]} p={[0, -0.18, 0]} c="#9a6a40" map={wood} r={0.5} />
      <SBox s={[60, 0.5, 0.4]} p={[0, -0.5, 13.0]} c="#6f4528" r={0.6} />
      <SBox s={[60, 0.5, 0.4]} p={[0, -0.5, -13.0]} c="#6f4528" r={0.6} />
      {/* map sheets */}
      <SBox s={[7.6, 0.03, 7.6]} p={[0, 0.0, 0]} c="#f5f0e0" r={0.8} recv map={paper} />
      <SPlane w={7.32} h={7.296} p={[0, 0.021, 0]} rot={[-Math.PI / 2, 0, 0]} map={eu} r={0.55} />
      <SBox s={[6.3, 0.03, 3.8]} p={[-9.5, 0.0, 0]} c="#f5f0e0" r={0.8} map={paper} />
      <SPlane w={6} h={3.5} p={[-9.5, 0.021, 0]} rot={[-Math.PI / 2, 0, 0]} map={caTex} r={0.55} />
      <SBox s={[3.8, 0.03, 4.8]} p={[9, 0.0, 0]} c="#f5f0e0" r={0.8} map={paper} />
      <SPlane w={3.5} h={4.5} p={[9, 0.021, 0]} rot={[-Math.PI / 2, 0, 0]} map={jpTex} r={0.55} />
      {CITIES.map((c) => <Pulse key={c.n} p={toWorld(c.ll, 'eu')} t0={c.at} t={T} r={dotR} />)}
      {EXTRA.map((c) => <Pulse key={c.n} p={toWorld(c.ll, c.tile)} t0={c.at} t={T} r={dotR * (c.tile === 'eu' ? 1.4 : 1.8)} />)}
      {pins.map(([x, z], i) => <group key={i}><SBall r0={0.09} p={[x, 0.1, z]} c="#e5484d" r={0.35} /><SCyl r0={0.012} h={0.1} p={[x, 0.04, z]} c="#c9ccd2" r={0.3} m={0.9} seg={6} /></group>)}
      {/* table clutter: lamp, mug, ruler, pencils, magnifier, compass, notebooks, sticky notes, tape */}
      <group position={[-4.7, 0, 3.0]}>
        <SCyl r0={0.25} h={0.06} p={[0, 0.06, 0]} c="#2d313b" r={0.5} m={0.6} seg={24} />
        <SBox s={[0.04, 1.1, 0.04]} p={[0, 0.6, 0]} c="#2d313b" r={0.5} m={0.6} />
        <mesh position={[0.15, 1.2, 0]} rotation={[0, 0, 1.0]}><coneGeometry args={[0.22, 0.3, 20, 1, true]} /><meshStandardMaterial color="#2f7a5a" side={THREE.DoubleSide} emissive="#ffd9a0" emissiveIntensity={0.3} roughness={0.4} metalness={0.3} /></mesh>
        <Halo tex={halo} p={[0.4, 1.1, 0.25]} w={1.6} color="#ffe2b0" op={0.4} />
      </group>
      <group position={[4.8, 0, -2.6]}>
        <SCyl r0={0.14} h={0.26} p={[0, 0.13, 0]} c="#f4f1ea" r={0.3} seg={22} />
        <SCyl r0={0.12} h={0.01} p={[0, 0.25, 0]} c="#3a2418" r={0.2} seg={20} />
      </group>
      <SBox s={[1.4, 0.015, 0.16]} p={[-3.8, 0.04, 4.1]} c="#e8c24a" r={0.5} rot={[0, 0.25, 0]} />
      <group position={[3.0, 0.04, 4.1]}>
        {[0, 1, 2].map((i) => <SCyl key={i} r0={0.012} h={0.5} p={[0, i * 0.026, 0]} rot={[0, 0, Math.PI / 2]} c={['#f2c53d', '#d93a40', '#2f7fd0'][i]} r={0.5} seg={6} />)}
      </group>
      <group position={[-4.9, 0.04, -1.0]} rotation={[0, 0.5, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><torusGeometry args={[0.3, 0.025, 10, 32]} /><meshStandardMaterial color="#c9a14a" metalness={0.8} roughness={0.25} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}><circleGeometry args={[0.29, 32]} /><meshStandardMaterial color="#bfe6f7" transparent opacity={0.4} roughness={0.05} /></mesh>
        <SBox s={[0.5, 0.03, 0.06]} p={[0.55, 0.02, 0.0]} c="#7a5230" r={0.6} />
      </group>
      <group position={[4.9, 0.04, 2.4]}>
        {[0, 1, 2].map((i) => <SBox key={i} s={[0.7, 0.07, 0.5]} p={[0, i * 0.075, 0]} c={['#2f4a78', '#6a3a2a', '#3a6a52'][i]} r={0.7} rot={[0, 0.3 * i - 0.2, 0]} />)}
      </group>
      <SBox s={[0.3, 0.012, 0.3]} p={[-4.2, 0.04, -3.9]} c="#f6e36a" r={0.8} rot={[0, 0.3, 0]} />
      <SBox s={[0.3, 0.012, 0.3]} p={[-3.9, 0.052, -3.8]} c="#f08fa0" r={0.8} rot={[0, -0.2, 0]} />
      <mesh position={[4.2, 0.07, -4.1]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.09, 0.05, 10, 20]} /><meshStandardMaterial color="#d9393f" roughness={0.6} /></mesh>
    </group>
  );
};

// ================================================================================================== SWEDEN: mailbox street
const flagTex = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#006aa7'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#fecc02'; c.fillRect(w * 0.3125, 0, w * 0.125, h); c.fillRect(0, h * 0.4, w, h * 0.2);
};
const paintGravel = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#9b9486'; c.fillRect(0, 0, w, h);
  blot(c, 3, 30, w, h, 20, 90, '70,66,58', 0.22);
  for (let i = 0; i < 5000; i++) { c.fillStyle = `rgba(${hash(i, 1) > 0.5 ? '255,255,255' : '40,36,30'},${hash(i, 2) * 0.3})`; c.fillRect(hash(i, 3) * w, hash(i, 4) * h, 2 + hash(i, 5) * 3, 2 + hash(i, 6) * 2); }
};
const paintWood = (c: Ctx, w: number, h: number) => { c.fillStyle = '#a63d2f'; c.fillRect(0, 0, w, h); c.fillStyle = '#8c3225'; for (let i = 0; i < 128; i += 16) c.fillRect(i * (w / 128), 0, 4, h); blot(c, 4, 20, w, h, 10, 40, '0,0,0', 0.1); };

const Spruce: React.FC<{p: V3; s?: number}> = ({p, s = 1}) => {
  const map = ctex('leaf#2c6a40', 256, 256, paintLeaves('#2c6a40'));
  return (
    <group position={p} scale={s}>
      <SCyl r0={0.12} h={1.0} p={[0, 0.5, 0]} c="#5a3a26" r={0.9} seg={8} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 1.1 + i * 0.75, 0]} castShadow receiveShadow>
          <coneGeometry args={[1.25 - i * 0.28, 1.3, 14]} />
          <meshStandardMaterial map={map} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
};
const Birch: React.FC<{p: V3; s?: number}> = ({p, s = 1}) => {
  const map = ctex('leaf#7ab648', 256, 256, paintLeaves('#7ab648'));
  return (
    <group position={p} scale={s}>
      <SCyl r0={0.1} h={3.2} p={[0, 1.6, 0]} c="#ece8e0" r={0.9} seg={8} />
      {[0.8, 1.3, 1.9, 2.4].map((y, i) => <SBox key={i} s={[0.2, 0.05, 0.1]} p={[0.0, y, 0.09]} c="#2d2a26" r={0.9} cast={false} />)}
      {[[0, 3.4, 0, 0.9], [0.45, 3.0, 0.15, 0.6], [-0.45, 3.1, -0.1, 0.65]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow receiveShadow><sphereGeometry args={[r, 16, 12]} /><meshStandardMaterial map={map} roughness={0.95} /></mesh>
      ))}
    </group>
  );
};

export const SwedenStreet: React.FC<{t: number}> = ({t}) => {
  const halo = ctex('halo', 256, 256, paintHalo);
  const flag = ctex('swflag', 160, 100, flagTex);
  const cover = ctex('mailcover', 320, 470, (c, w, h) => fitCover(c, w, h));
  const grass = ctex('grass', 512, 512, paintGrass, [100, 100]);
  const gravel = ctex('gravel', 512, 512, paintGravel, [160, 4]);
  const conc = ctex('conc', 256, 256, paintConcrete, [330, 1]);
  const tl = ctex('treeline', 2048, 256, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#244e38'; for (let i = 0; i < 200; i++) { const x = hash(i, 1) * w, ph = 40 + hash(i, 2) * 90; c.beginPath(); c.moveTo(x - 24, h); c.lineTo(x, h - ph); c.lineTo(x + 24, h); c.fill(); } c.fillRect(0, h - 30, w, 40); });
  const N = 7;
  const xs = Array.from({length: N}, (_, i) => -5.4 + i * 1.8);
  return (
    <group>
      <hemisphereLight args={['#a8c8ff', '#b8c49a', 1.05]} />
      <directionalLight color="#ffe3b8" intensity={2.4} position={[-5, 8, 8]} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={10} shadow-camera-bottom={-6} shadow-camera-near={0.5} shadow-camera-far={40} shadow-bias={-0.0003} shadow-normalBias={0.02} shadow-radius={4} />
      <directionalLight color="#a8c8ff" intensity={0.5} position={[6, 3, -6]} />
      <ambientLight intensity={0.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow><planeGeometry args={[500, 500]} /><meshStandardMaterial map={grass} roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 5.6]} receiveShadow><planeGeometry args={[500, 5.2]} /><meshStandardMaterial map={gravel} roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 2.5]} receiveShadow><planeGeometry args={[500, 0.9]} /><meshStandardMaterial map={conc} roughness={0.95} /></mesh>
      {/* red cottages with white trim, set back from the road */}
      {[-9, -3, 3, 9, 15, -15].map((x, i) => <House key={x} p={[x, 0, -3.5]} w={5.6} d={4.4} h={2.8} wall="#a63d2f" roof={i % 2 ? '#3a3f4a' : '#4a3a36'} door={['#f4f1ea', '#2f6fae'][i % 2]} num={String(3 + i * 2)} shutter="#f4f1ea" flowers={['#ffd23f', '#ff6f8f', '#ffffff'][i % 3]} />)}
      {[-7.5, -1.5, 5, 11.5, -13].map((x, i) => <Fence key={x} p={[x - 1.6, 0, -0.7]} len={3.2} h={0.75} c={i % 2 ? '#f4f1ea' : '#e8e0c8'} />)}
      {[-6, 0, 6, 12, -12].map((x, i) => <Birch key={x} p={[x + 1.4, 0, -1.4]} s={1 + (i % 3) * 0.12} />)}
      {Array.from({length: 18}).map((_, i) => <Spruce key={i} p={[-30 + i * 3.6 + hash(i, 1) * 1.2, 0, -12 - hash(i, 2) * 5]} s={1.2 + hash(i, 3) * 0.7} />)}
      {Array.from({length: 18}).map((_, i) => <Spruce key={'b' + i} p={[-30 + i * 3.6 + hash(i, 4) * 1.2, 0, 14 + hash(i, 5) * 5]} s={1.2 + hash(i, 6) * 0.7} />)}
      {Array.from({length: 12}).map((_, i) => <Bush key={i} p={[-9 + i * 1.7, 0, 1.15 + (i % 2) * 0.1]} s={0.6 + hash(i, 2) * 0.3} flowers={['#ffd23f', '#ff6f8f', '#ffffff', '#9a7ad8'][i % 4]} />)}
      {[[-7, 7.8], [4.5, 8.4], [10, 7.9]].map(([x, z], i) => <SBall key={i} r0={0.4 + i * 0.1} p={[x, 0.2, z]} c="#8a8a84" r={1} />)}
      {/* postal bicycle leaning on a fence */}
      <group position={[-8.2, 0, 0.4]} rotation={[0, 0.4, 0.12]}>
        {[-0.55, 0.55].map((x) => <mesh key={x} position={[x, 0.33, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.32, 0.025, 8, 24]} /><meshStandardMaterial color="#1c1e24" roughness={0.6} /></mesh>)}
        <SBox s={[1.1, 0.03, 0.03]} p={[0, 0.62, 0]} c="#f2c53d" r={0.4} m={0.4} rot={[0, 0, -0.1]} />
        <SBox s={[0.03, 0.55, 0.03]} p={[-0.1, 0.5, 0]} c="#f2c53d" r={0.4} m={0.4} />
        <SBox s={[0.4, 0.3, 0.3]} p={[-0.7, 0.75, 0]} c="#f2c53d" r={0.5} />
      </group>
      {/* mailbox row: the booklets land one after another */}
      {xs.map((x, i) => {
        const tHit = 0.15 + i * 0.33;
        const age = t - tHit;
        const flap = age > 0 && age < 0.35 ? Math.sin((age / 0.35) * Math.PI) * 0.9 : 0;
        return (
          <group key={i} position={[x, 0, 2.9]}>
            <SBox s={[0.1, 1.0, 0.1]} p={[0, 0.5, 0]} c="#7a5230" r={0.9} />
            <SBox s={[0.42, 0.3, 0.58]} p={[0, 1.15, 0]} c="#1f6fb5" r={0.45} m={0.2} />
            <mesh position={[0, 1.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.21, 0.21, 0.58, 18, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#1f6fb5" roughness={0.45} metalness={0.2} side={THREE.DoubleSide} /></mesh>
            <SBox s={[0.44, 0.05, 0.58]} p={[0, 1.0, 0]} c="#fecc02" r={0.5} />
            <group position={[0, 1.02, 0.3]} rotation={[flap, 0, 0]}><SBox s={[0.34, 0.2, 0.025]} p={[0, 0.1, 0]} c="#e8c24a" r={0.5} /></group>
            <SCyl r0={0.012} h={0.5} p={[0.24, 1.5, -0.1]} c="#e8e8e8" r={0.4} seg={6} cast={false} />
            <group position={[0.24, 1.66, -0.1]} rotation={[0, 0.2 + Math.sin(t * 5 + i) * 0.3, 0]}>
              <SPlane w={0.26} h={0.17} p={[0.13, 0, 0]} map={flag} r={0.7} side={THREE.DoubleSide} />
            </group>
            {/* a little house number sign on the post */}
            <SBox s={[0.16, 0.1, 0.02]} p={[0, 0.78, 0.06]} c="#f4f1ea" r={0.6} />
          </group>
        );
      })}
      {xs.map((x, i) => {
        const tHit = 0.15 + i * 0.33;
        const u = (t - (tHit - 0.45)) / 0.45;
        if (u <= 0 || u >= 1) return null;
        const px = lerp(x + 1.5, x, smooth(u));
        const py = lerp(1.9, 1.1, u) + Math.sin(u * Math.PI) * 0.35;
        const pz = lerp(1.5, 3.15, smooth(u));
        return (
          <group key={'b' + i} position={[px, py, pz]} rotation={[u * 3, 0.6, u * 4]}>
            <SBox s={[0.18, 0.25, 0.015]} p={[0, 0, 0]} c="#1d5fb4" r={0.6} />
            <SPlane w={0.17} h={0.24} p={[0, 0, 0.009]} map={cover} r={0.6} />
          </group>
        );
      })}
      <mesh position={[0, 6, 0]}><cylinderGeometry args={[110, 110, 24, 48, 1, true]} /><meshBasicMaterial map={tl} transparent side={THREE.BackSide} toneMapped={false} depthWrite={false} /></mesh>
      <Sky top="#5ea8e8" bottom="#d7f0ff" r={160} />
      {Array.from({length: 8}).map((_, i) => { const a = (i / 8) * Math.PI * 2 + 0.2; return <Halo key={i} tex={halo} p={[Math.sin(a) * 120, 40 + hash(i, 2) * 20, Math.cos(a) * 120]} w={70} h={24} rot={[0, a + Math.PI, 0]} color="#ffffff" op={0.8} />; })}
      <group visible={false}>{clamp01(t) < -1 && null}</group>
    </group>
  );
};
