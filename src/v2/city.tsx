// City at night (blackout, storm, hero block), hospital and fire scenes for CrisisShortV2.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {LiveTex, Sky, V3, clamp01, hash, lerp, useCamPos} from '../kit/kit';
import {Ctx, Halo, SBall, SBox, SCyl, SPlane, blot, fitText, lgr, outlined, paintHalo} from './gfx';
import {Vehicle2, ctex, paintAsphalt, paintConcrete} from './street';

// ---------------------------------------------------------------- window facades (d == w per class so uniform scaling never distorts the windows)
const CLS = [
  {w: 6, h: 26, cols: 5, rows: 17},
  {w: 8, h: 15, cols: 6, rows: 10},
  {w: 10, h: 8, cols: 7, rows: 5},
];
const facadeTex = (ci: number, seed: number, emit: boolean) => {
  const cl = CLS[ci];
  const W = 256, H = Math.round((256 * cl.h) / cl.w);
  return ctex(`fac${ci}_${seed}_${emit}`, W, H, (c, w, h) => {
    c.fillStyle = emit ? '#000000' : ['#2a3050', '#332f4a', '#2b3a52'][seed % 3];
    c.fillRect(0, 0, w, h);
    const cw = w / cl.cols, ch = h / cl.rows;
    for (let i = 0; i < cl.cols; i++)
      for (let j = 0; j < cl.rows; j++) {
        const lit = hash(seed * 31 + i, j + ci * 7) > 0.34;
        const x = i * cw + cw * 0.18, y = j * ch + ch * 0.2, ww = cw * 0.64, hh = ch * 0.6;
        if (emit) {
          if (!lit) continue;
          c.fillStyle = hash(i, j + seed) > 0.55 ? '#ffd27a' : hash(i, j + seed + 5) > 0.5 ? '#fff0c8' : '#bfe0ff';
          c.fillRect(x, y, ww, hh);
        } else {
          c.fillStyle = lgr(c, x, y, x, y + hh, [[0, '#2c3a62'], [1, '#10163a']]);
          c.fillRect(x, y, ww, hh);
          c.fillStyle = 'rgba(160,190,255,0.12)'; c.fillRect(x, y, ww, hh * 0.25);
        }
      }
    if (!emit) { blot(c, seed, 12, w, h, 30, 90, '0,0,0', 0.18); for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, i * (h / 6), w, 3); } }
  });
};
const paintStreet = (c: Ctx, w: number, h: number) => {
  paintAsphalt(c, w, h);
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(240,200,60,0.85)'; for (let x = 0; x < w; x += w / 4) c.fillRect(x, h / 2 - 5, w / 8, 10);
  c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(0, 10, w, 8); c.fillRect(0, h - 18, w, 8);
};
const paintSkyline = (c: Ctx, w: number, h: number) => {
  c.clearRect(0, 0, w, h);
  for (let i = 0; i < 110; i++) {
    const bw = 30 + hash(i, 1) * 50, bh = 60 + hash(i, 2) * 180, x = hash(i, 3) * w;
    c.fillStyle = '#1a2040'; c.fillRect(x, h - bh, bw, bh);
    for (let k = 0; k < 40; k++) { if (hash(i, k + 9) < 0.45) continue; c.fillStyle = hash(i, k) > 0.5 ? '#ffd27a' : '#fff0c8'; c.fillRect(x + 4 + hash(i, k + 20) * (bw - 10), h - bh + 6 + hash(i, k + 30) * (bh - 12), 4, 5); }
  }
};

const Bldg: React.FC<{p: V3; ci: number; seed: number; s: number; on: number; roofC?: string}> = ({p, ci, seed, s, on, roofC = '#1a1f38'}) => {
  const cl = CLS[ci];
  const mats = useMemo(() => {
    const fac = new THREE.MeshStandardMaterial({map: facadeTex(ci, seed % 3, false), emissiveMap: facadeTex(ci, seed % 3, true), emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.7, roughness: 0.7});
    const roof = new THREE.MeshStandardMaterial({color: roofC, roughness: 1});
    return {fac, roof, arr: [fac, fac, roof, roof, fac, fac]};
  }, [ci, seed, roofC]);
  mats.fac.emissiveIntensity = on * 1.7;
  return (
    <mesh position={[p[0], (cl.h * s) / 2, p[2]]} scale={s} material={mats.arr} receiveShadow>
      <boxGeometry args={[cl.w, cl.h, cl.w]} />
    </mesh>
  );
};

export const Rain: React.FC<{t: number}> = ({t}) => {
  const cam = useCamPos();
  return (
    <group>
      {Array.from({length: 160}).map((_, i) => {
        const x = cam.x + (hash(i, 1) - 0.5) * 24, z = cam.z - 4 - hash(i, 2) * 30;
        const y = cam.y + 12 - ((t * 24 + hash(i, 3) * 24) % 24);
        return (
          <mesh key={i} position={[x, y, z]} rotation={[0, 0, 0.18]}>
            <planeGeometry args={[0.05, 1.1]} />
            <meshBasicMaterial color="#cdd8ff" transparent opacity={0.5} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
};
export const Bolt: React.FC<{p: V3; on: boolean}> = ({p, on}) =>
  on ? (
    <LiveTex w={256} h={512} size={[10, 24]} p={p} draw={(c) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 10; c.lineJoin = 'round'; c.shadowColor = '#bcd0ff'; c.shadowBlur = 24;
      c.beginPath(); let x = 130, y = 0; c.moveTo(x, y);
      for (let i = 0; i < 9; i++) { x += (hash(i, 8) - 0.5) * 90; y += 56; c.lineTo(x, y); }
      c.stroke();
    }} />
  ) : null;

export const OFF0 = 40.75; // blackout starts (seconds on the audio clock)
const S = 14, NG = 6;

export const CityNight: React.FC<{absT: number; storm?: number; hero?: boolean; bright?: number; candles?: boolean}> = ({absT, storm = 0, hero, bright = 1, candles}) => {
  const halo = ctex('halo', 256, 256, paintHalo);
  const street = ctex('street', 512, 128, paintStreet, [60, 1]);
  const skyline = ctex('skyline', 2048, 256, paintSkyline);
  const offAt = (k: number) => OFF0 + ((k * 7) % 16) * 0.055;
  const flick = (k: number) => {
    const a = absT - offAt(k);
    return a < 0 ? 1 : a < 0.12 ? (Math.floor(a * 40) % 2 === 0 ? 0 : 1) : 0;
  };
  const cells = useMemo(() => {
    const arr: {x: number; z: number; ci: number; seed: number; s: number; k: number}[] = [];
    for (let i = -NG; i <= NG; i++)
      for (let j = -NG; j <= NG; j++) {
        const k = (i + NG) * 31 + (j + NG);
        const core = Math.max(Math.abs(i), Math.abs(j));
        const r = hash(k, 3);
        const ci = core <= 1 ? (r > 0.3 ? 0 : 1) : core <= 3 ? (r > 0.6 ? 0 : r > 0.25 ? 1 : 2) : r > 0.8 ? 1 : 2;
        arr.push({x: i * S + (hash(k, 1) - 0.5) * 2, z: j * S - 10 + (hash(k, 2) - 0.5) * 2, ci, seed: Math.floor(hash(k, 5) * 3), s: 0.8 + hash(k, 4) * 0.3, k});
      }
    return arr;
  }, []);
  const darkFrac = clamp01((absT - OFF0) / 0.9);
  const lampOn = absT < OFF0 + 0.5;
  const flash = storm > 0.5;
  const cars = Array.from({length: 22}, (_, i) => {
    const along = i % 2 === 0;
    const lane = (Math.floor(hash(i, 1) * 8) - 4) * S + S / 2 - 10 + (along ? 0 : 10);
    const sp = (6 + hash(i, 2) * 5) * (hash(i, 3) > 0.5 ? 1 : -1);
    const tt = Math.min(absT, OFF0 + 0.6 * hash(i, 9));
    const pos = (((hash(i, 4) * 160 + tt * sp) % 160) + 160) % 160 - 80;
    return {along, lane: along ? lane : (Math.floor(hash(i, 1) * 8) - 4) * S + S / 2, pos, dir: Math.sign(sp)};
  });
  const hx = hero ? 0 : 999;
  return (
    <group>
      <hemisphereLight args={flash ? ['#dfe6ff', '#8a96c8', 2.4] : ['#4f62c8', '#101a3e', darkFrac > 0.5 ? 0.7 : 0.55]} />
      <directionalLight color="#9fb8ff" intensity={flash ? 2.5 : 0.9} position={[-30, 60, 30]} />
      <ambientLight intensity={0.05} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><planeGeometry args={[800, 800]} /><meshStandardMaterial color="#141a33" roughness={1} /></mesh>
      {/* streets between the blocks */}
      {Array.from({length: NG * 2 + 1}).map((_, i) => (
        <group key={i}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, (i - NG) * S - 10 + S / 2]}><planeGeometry args={[240, 4.5]} /><meshStandardMaterial map={street} roughness={0.55} metalness={0.2} /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[(i - NG) * S + S / 2, 0.001, -10]}><planeGeometry args={[240, 4.5]} /><meshStandardMaterial map={street} roughness={0.55} metalness={0.2} /></mesh>
        </group>
      ))}
      {cells.map((c) => {
        if (hero && Math.abs(c.x) < 12 && c.z > -6 && c.z < 18) return null;
        return <Bldg key={c.k} p={[c.x, 0, c.z]} ci={c.ci} seed={c.seed} s={c.s} on={flick(c.k) * bright} />;
      })}
      {hero && <HeroBlock p={[hx, 0, 4]} absT={absT} candles={candles} />}
      {/* street lamps */}
      {Array.from({length: 49}).map((_, n) => {
        const i = (n % 7) - 3, j = Math.floor(n / 7) - 3;
        const x = i * S + S / 2 - 2.6, z = j * S - 10 + S / 2 - 2.6;
        return (
          <group key={n} position={[x, 0, z]}>
            <SCyl r0={0.07} h={5} p={[0, 2.5, 0]} c="#2e3340" r={0.6} seg={6} cast={false} />
            <mesh position={[0, 5.05, 0]}><sphereGeometry args={[0.28, 10, 8]} /><meshStandardMaterial color={lampOn ? new THREE.Color(3.4, 2.7, 1.5) : '#2b2f4a'} emissive="#ffb560" emissiveIntensity={lampOn ? 1 : 0} toneMapped={false} /></mesh>
            {lampOn && <Halo tex={halo} p={[0, 5, 0.3]} w={3.2} color="#ffc27a" op={0.5} />}
          </group>
        );
      })}
      {/* cars driving until the power goes */}
      {cars.map((c, i) => (
        <group key={i} position={c.along ? [c.pos, 0, c.lane] : [c.lane, 0, c.pos - 10]} rotation={[0, c.along ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? -Math.PI / 2 : Math.PI / 2), 0]}>
          <SBox s={[2.0, 0.6, 1.0]} p={[0, 0.45, 0]} c="#3a3f5a" r={0.5} m={0.4} cast={false} />
          <SBox s={[1.0, 0.4, 0.9]} p={[-0.1, 0.9, 0]} c="#2b3048" r={0.3} m={0.5} cast={false} />
          {absT < OFF0 + 0.6 * hash(i, 9) && <>
            <mesh position={[1.02, 0.5, 0.3]}><boxGeometry args={[0.06, 0.12, 0.2]} /><meshBasicMaterial color={new THREE.Color(3, 3, 2.4)} toneMapped={false} /></mesh>
            <mesh position={[1.02, 0.5, -0.3]}><boxGeometry args={[0.06, 0.12, 0.2]} /><meshBasicMaterial color={new THREE.Color(3, 3, 2.4)} toneMapped={false} /></mesh>
            <mesh position={[-1.02, 0.5, 0.3]}><boxGeometry args={[0.06, 0.1, 0.2]} /><meshBasicMaterial color={new THREE.Color(2.5, 0.2, 0.2)} toneMapped={false} /></mesh>
            <mesh position={[-1.02, 0.5, -0.3]}><boxGeometry args={[0.06, 0.1, 0.2]} /><meshBasicMaterial color={new THREE.Color(2.5, 0.2, 0.2)} toneMapped={false} /></mesh>
          </>}
        </group>
      ))}
      {/* far skyline on every side, goes dark with the city */}
      <mesh position={[0, 30, -10]}>
        <cylinderGeometry args={[210, 210, 60, 64, 1, true]} />
        <meshBasicMaterial map={skyline} transparent side={THREE.BackSide} toneMapped={false} color={new THREE.Color(1, 1, 1).multiplyScalar(lerp(0.9, 0.06, darkFrac) * (flash ? 1.5 : 1))} depthWrite={false} />
      </mesh>
      <mesh position={[-60, 70, -150]}><sphereGeometry args={[6, 20, 14]} /><meshBasicMaterial color="#f4f1d8" toneMapped={false} /></mesh>
      <Sky top={flash ? '#dfe6ff' : storm > 0 ? '#27336e' : '#0b1030'} bottom={flash ? '#b9c6f5' : storm > 0 ? '#4a5aa6' : '#2b2f6a'} r={300} stars={darkFrac > 0.5 && storm === 0} />
    </group>
  );
};

const HeroBlock: React.FC<{p: V3; absT: number; candles?: boolean}> = ({p, absT, candles}) => {
  const w = 14, h = 30, d = 8;
  const tex = ctex('hero', 512, 1024, (c, tw, th) => {
    c.fillStyle = '#3a3f66'; c.fillRect(0, 0, tw, th);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 20; j++) {
      c.fillStyle = lgr(c, 0, 18 + j * 49, 0, 52 + j * 49, [[0, '#1c2250'], [1, '#0c1032']]); c.fillRect(14 + i * 62, 18 + j * 49, 44, 34);
      c.fillStyle = 'rgba(120,150,255,0.18)'; c.fillRect(14 + i * 62, 18 + j * 49, 44, 8);
    }
    for (let j = 0; j < 20; j++) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 52 + j * 49, tw, 4); }
  });
  const lit = [[2, 5], [5, 9], [3, 14], [6, 3], [1, 11], [4, 7], [0, 16]];
  return (
    <group position={p}>
      <mesh position={[0, h / 2, 0]} receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      <SBox s={[w + 0.6, 0.6, d + 0.6]} p={[0, h + 0.3, 0]} c="#2b3048" r={0.9} />
      <SBox s={[3, 1.6, 3]} p={[-3, h + 1.4, 0]} c="#2b3048" r={0.9} />
      <SCyl r0={0.05} h={4} p={[3, h + 2.6, 0]} c="#555a66" r={0.5} seg={6} />
      {lit.map(([i, j], k) => {
        const on = candles !== false && hash(k, 3) * 2 + 57.9 > absT && Math.floor(absT * 7 + k) % 5 !== 0;
        if (!on) return null;
        return (
          <mesh key={k} position={[-w / 2 + ((14 + 22 + i * 62) / 512) * w, h - ((18 + 17 + j * 49) / 1024) * h, d / 2 + 0.03]}>
            <planeGeometry args={[(44 / 512) * w, (34 / 1024) * h]} />
            <meshBasicMaterial color={new THREE.Color(2.4, 1.7, 0.6)} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};

// ================================================================================================== emergency scenes
const FlameCard: React.FC<{p: V3; w: number; h: number; t: number; seed: number}> = ({p, w, h, t, seed}) => {
  const {canvas, tex} = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 384;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return {canvas, tex};
  }, []);
  const c = canvas.getContext('2d')!;
  c.clearRect(0, 0, 256, 384);
  const layers: [string, number][] = [['#e8321c', 1], ['#ff8a1f', 0.74], ['#ffd84a', 0.46]];
  for (const [col, k] of layers) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(24 + (1 - k) * 60, 384);
    const n = 4;
    for (let i = 0; i <= n; i++) {
      const fx = 24 + (1 - k) * 60 + ((208 - (1 - k) * 120) * i) / n;
      const fh = 384 - (150 + 190 * k * (0.55 + 0.45 * Math.sin(t * 9 + i * 1.9 + seed * 3))) * (i % 2 === 0 ? 0.85 : 1.2);
      c.quadraticCurveTo(fx - 20, fh + 90, fx, fh);
    }
    c.lineTo(232 - (1 - k) * 60, 384);
    c.closePath();
    c.fill();
  }
  tex.needsUpdate = true;
  return (
    <mesh position={p} renderOrder={5}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} color={new THREE.Color(2.0, 1.6, 1.2)} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
};

const paintBrick = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#7a4b3a'; c.fillRect(0, 0, w, h);
  const bh = h / 16, bw = w / 6;
  for (let r = 0; r < 16; r++) for (let i = -1; i < 7; i++) {
    const x = i * bw + (r % 2 ? bw / 2 : 0);
    c.fillStyle = `rgb(${120 + hash(r, i) * 40},${66 + hash(r, i + 3) * 24},${52 + hash(r, i + 6) * 20})`;
    c.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
  }
  blot(c, 4, 20, w, h, 20, 80, '0,0,0', 0.2);
};
const paintHospital = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#e9eef2'; c.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) {
    c.fillStyle = hash(r, i) > 0.3 ? '#ffe9a8' : '#2a3350'; c.fillRect(20 + i * (w / 9), 30 + r * (h / 4.4), w / 9 - 34, h / 4.4 - 60);
    c.fillStyle = '#c3ccd6'; c.fillRect(20 + i * (w / 9) + (w / 9 - 34) / 2 - 2, 30 + r * (h / 4.4), 4, h / 4.4 - 60);
  }
  blot(c, 5, 16, w, h, 40, 140, '120,130,150', 0.1);
};
const paintEmergencySign = (c: Ctx, w: number, h: number) => {
  c.fillStyle = '#d93a40'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#ffffff'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  fitText(c, 'EMERGENCY', w * 0.8, h * 0.5);
  c.fillStyle = '#ffffff'; c.fillText('EMERGENCY', w / 2, h / 2 + 3);
};
const Hydrant: React.FC<{p: V3}> = ({p}) => (
  <group position={p}>
    <SCyl r0={0.12} h={0.6} p={[0, 0.3, 0]} c="#d93a40" r={0.5} seg={14} />
    <SBall r0={0.13} p={[0, 0.62, 0]} c="#d93a40" r={0.5} />
    <SCyl r0={0.05} h={0.34} p={[0, 0.4, 0]} rot={[0, 0, Math.PI / 2]} c="#b32a30" r={0.5} seg={10} />
  </group>
);
const Cone: React.FC<{p: V3}> = ({p}) => (
  <group position={p}>
    <mesh position={[0, 0.25, 0]} castShadow><coneGeometry args={[0.14, 0.5, 14]} /><meshStandardMaterial color="#f08a24" roughness={0.6} /></mesh>
    <SBox s={[0.34, 0.03, 0.34]} p={[0, 0.015, 0]} c="#f08a24" r={0.6} />
    <mesh position={[0, 0.27, 0]}><cylinderGeometry args={[0.085, 0.1, 0.07, 14]} /><meshStandardMaterial color="#ffffff" roughness={0.5} /></mesh>
  </group>
);

const Row: React.FC<{z: number; from: number; n: number; seed: number; lit: number}> = ({z, from, n, seed, lit}) => (
  <group>
    {Array.from({length: n}).map((_, i) => {
      const ci = (hash(seed + i, 1) > 0.5 ? 1 : 2), w = ci === 1 ? 8 : 10;
      return <Bldg key={i} p={[from + i * 11, 0, z]} ci={ci} seed={(seed + i) % 3} s={0.95 + hash(seed + i, 2) * 0.2} on={lit} />;
    })}
  </group>
);

const GroundStrip: React.FC<{z: number; w: number; map: THREE.Texture; y?: number}> = ({z, w, map, y = 0}) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, z]} receiveShadow><planeGeometry args={[400, w]} /><meshStandardMaterial map={map} roughness={0.85} /></mesh>
);

export const HospitalSet: React.FC<{t: number}> = ({t}) => {
  const halo = ctex('halo', 256, 256, paintHalo);
  const road = ctex('roadH', 1024, 512, (c, w, h) => { paintAsphalt(c, w, h); c.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 8; i++) c.fillRect(i * 128 + 20, h * 0.4, 80, 10); }, [40, 1]);
  const conc = ctex('conc', 256, 256, paintConcrete, [330, 1]);
  const hosp = ctex('hospfacade', 1024, 512, paintHospital);
  const sign = ctex('emsign', 512, 128, paintEmergencySign);
  const aOn = Math.floor(t * 3) % 2 === 0;
  return (
    <group>
      <hemisphereLight args={['#5e72d0', '#1c2040', 0.75]} />
      <directionalLight color="#9fb8ff" intensity={0.9} position={[-8, 12, 10]} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={12} shadow-camera-bottom={-8} shadow-camera-near={0.5} shadow-camera-far={50} shadow-bias={-0.0003} shadow-normalBias={0.02} shadow-radius={4} />
      <pointLight position={[0, 2.6, -1.2]} color="#ffe3a8" intensity={40} distance={14} decay={2} />
      <ambientLight intensity={0.08} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><planeGeometry args={[600, 600]} /><meshStandardMaterial color="#1b2038" roughness={1} /></mesh>
      <GroundStrip z={0.2} w={5.5} map={conc} />
      <GroundStrip z={5.8} w={6.5} map={road} y={0.002} />
      <GroundStrip z={10.6} w={3} map={conc} />
      <SBox s={[400, 0.14, 0.2]} p={[0, 0, 3.0]} c="#8a8e9a" r={0.9} cast={false} />
      <SBox s={[400, 0.14, 0.2]} p={[0, 0, 9.1]} c="#8a8e9a" r={0.9} cast={false} />
      {/* hospital block with a lit entrance */}
      <SBox s={[18, 10, 8]} p={[0, 5, -6.5]} c="#e9eef2" r={0.8} />
      <SPlane w={18} h={10} p={[0, 5, -2.49]} map={hosp} r={0.5} emap ei={0.55} />
      <SBox s={[19, 0.5, 9]} p={[0, 10.2, -6.5]} c="#c9d2da" r={0.8} />
      <SBox s={[5, 0.25, 2.8]} p={[0, 3.3, -1.1]} c="#d93a40" r={0.6} />
      {[-2.3, 2.3].map((x) => <SBox key={x} s={[0.14, 3.2, 0.14]} p={[x, 1.6, -0.1]} c="#e8edf1" r={0.5} />)}
      <SBox s={[3.6, 2.7, 0.2]} p={[0, 1.4, -2.4]} c="#cfd6dc" r={0.5} />
      <mesh position={[0, 1.4, -2.28]}><planeGeometry args={[3.3, 2.5]} /><meshBasicMaterial color={new THREE.Color(1.8, 1.55, 1.1)} toneMapped={false} /></mesh>
      <SBox s={[0.06, 2.5, 0.06]} p={[0, 1.4, -2.25]} c="#cfd6dc" r={0.5} />
      <SPlane w={4.2} h={1.05} p={[0, 4.15, -2.47]} map={sign} r={0.4} emap ei={0.9} />
      {/* red cross sign on the roof, glowing */}
      <SBox s={[3.2, 3.2, 0.3]} p={[0, 12.2, -6.5]} c="#ffffff" r={0.5} emissive="#ffffff" ei={0.5} />
      <mesh position={[0, 12.2, -6.32]}><boxGeometry args={[2.2, 0.7, 0.04]} /><meshBasicMaterial color={new THREE.Color(3, 0.3, 0.3)} toneMapped={false} /></mesh>
      <mesh position={[0, 12.2, -6.32]}><boxGeometry args={[0.7, 2.2, 0.04]} /><meshBasicMaterial color={new THREE.Color(3, 0.3, 0.3)} toneMapped={false} /></mesh>
      <Halo tex={halo} p={[0, 12.2, -6]} w={9} color="#ff6a6a" op={0.35} />
      {/* surrounding blocks and trees, street lamps, hedges */}
      <Row z={-6.5} from={-60} n={5} seed={3} lit={0.9} />
      <Row z={-6.5} from={22} n={5} seed={7} lit={0.9} />
      <Row z={20} from={-60} n={11} seed={11} lit={0.8} />
      {[-14, -8, 8, 14].map((x) => <LampN key={x} p={[x, 0, 2.7]} tex={halo} />)}
      {[-6, 6].map((x) => <group key={x} position={[x, 0, -1.6]}><SBox s={[3.4, 0.7, 0.8]} p={[0, 0.35, 0]} c="#2f6a40" r={0.95} /></group>)}
      {/* ambulances: one parked, one backing in, plus a gurney at the door */}
      <Vehicle2 p={[6.8, 0, 4.4]} yaw={Math.PI} kind="ambulance" t={t} />
      <Vehicle2 p={[lerp(-18, -5, clamp01(t / 1.1)), 0, 6.6]} kind="ambulance" t={t + 0.2} />
      <group position={[3.2, 0, 0.6]} rotation={[0, 0.3, 0]}>
        <SBox s={[1.8, 0.08, 0.6]} p={[0, 0.8, 0]} c="#e8edf1" r={0.4} />
        <SBox s={[1.7, 0.1, 0.5]} p={[0, 0.88, 0]} c="#4f9ad6" r={0.8} />
        {[-0.8, 0.8].map((x) => <SBox key={x} s={[0.05, 0.6, 0.5]} p={[x, 0.45, 0]} c="#9aa3ad" r={0.3} m={0.8} />)}
        {[-0.8, 0.8].map((x) => [-0.2, 0.2].map((z) => <SBall key={x + '_' + z} r0={0.06} p={[x, 0.07, z]} c="#22252c" r={0.7} />))}
      </group>
      <Cone p={[-1.5, 0, 7.6]} /><Cone p={[-2.2, 0, 7.2]} /><Cone p={[1.5, 0, 8.2]} />
      <mesh position={[0, 8, 0]} visible={false}><boxGeometry args={[0.01, 0.01, 0.01]} /></mesh>
      <mesh position={[0, 40, 0]}><cylinderGeometry args={[150, 150, 80, 48, 1, true]} /><meshBasicMaterial map={ctex('skyline', 2048, 256, paintSkyline)} transparent side={THREE.BackSide} toneMapped={false} color="#9fb0e0" depthWrite={false} /></mesh>
      <Sky top="#14193a" bottom="#5a4a8a" r={280} />
      {void aOn}
    </group>
  );
};

const LampN: React.FC<{p: V3; tex: THREE.Texture}> = ({p, tex}) => (
  <group position={p}>
    <SCyl r0={0.07} h={5.2} p={[0, 2.6, 0]} c="#2e3340" r={0.6} seg={6} cast={false} />
    <SBox s={[0.9, 0.06, 0.06]} p={[0.4, 5.2, 0]} c="#2e3340" r={0.6} cast={false} />
    <mesh position={[0.8, 5.12, 0]}><boxGeometry args={[0.45, 0.1, 0.25]} /><meshStandardMaterial color={new THREE.Color(3.4, 2.7, 1.5)} emissive="#ffb560" toneMapped={false} /></mesh>
    <Halo tex={tex} p={[0.8, 5.0, 0.3]} w={3.4} color="#ffc27a" op={0.5} />
  </group>
);

export const FireSet: React.FC<{t: number; hose: boolean}> = ({t, hose}) => {
  const halo = ctex('halo', 256, 256, paintHalo);
  const brick = ctex('burnbrick', 512, 1024, paintBrick, [2, 1]);
  const road = ctex('roadH', 1024, 512, (c, w, h) => { paintAsphalt(c, w, h); c.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 8; i++) c.fillRect(i * 128 + 20, h * 0.4, 80, 10); }, [40, 1]);
  const conc = ctex('conc', 256, 256, paintConcrete, [330, 1]);
  const flick = 0.8 + 0.2 * Math.sin(t * 17) * Math.sin(t * 9);
  return (
    <group>
      <hemisphereLight args={['#8e5a70', '#2a1a2a', 0.8]} />
      <directionalLight color="#ff9a5a" intensity={1.2} position={[-9, 5, 9]} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={12} shadow-camera-bottom={-8} shadow-camera-near={0.5} shadow-camera-far={50} shadow-bias={-0.0003} shadow-normalBias={0.02} shadow-radius={4} />
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 6, 1.2]} color="#ff8a3a" intensity={120 * flick} distance={26} decay={1.6} />
      <pointLight position={[0, 3, 3]} color="#ff7a30" intensity={50 * flick} distance={14} decay={2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><planeGeometry args={[600, 600]} /><meshStandardMaterial color="#2a2634" roughness={1} /></mesh>
      <GroundStrip z={0.4} w={5.5} map={conc} />
      <GroundStrip z={6.0} w={6.5} map={road} y={0.002} />
      <GroundStrip z={10.8} w={3} map={conc} />
      <SBox s={[400, 0.14, 0.2]} p={[0, 0, 3.2]} c="#8a8e9a" r={0.9} cast={false} />
      {/* the burning building: textured brick, black windows with fire behind, flames and smoke */}
      <SBox s={[9, 9, 5]} p={[0, 4.5, -5]} c="#7a4b3a" r={0.9} />
      <SPlane w={9} h={9} p={[0, 4.5, -2.49]} map={brick} r={0.9} />
      <SBox s={[9.4, 0.4, 5.4]} p={[0, 9.2, -5]} c="#3a2a28" r={0.9} />
      {[-3, 0, 3].map((x) => [2, 4.8, 7.4].map((y) => (
        <group key={x + '_' + y}>
          <SBox s={[1.2, 1.3, 0.12]} p={[x, y, -2.45]} c="#14100f" r={0.9} />
          {y > 3 && <mesh position={[x, y, -2.37]}><planeGeometry args={[1.0, 1.1]} /><meshBasicMaterial color={new THREE.Color(2.6 * flick, 1.1 * flick, 0.25)} toneMapped={false} /></mesh>}
          <SBox s={[1.5, 0.1, 0.2]} p={[x, y - 0.75, -2.35]} c="#c9bfa8" r={0.8} cast={false} />
        </group>
      )))}
      {[-3, 0, 3].map((x, i) => <FlameCard key={i} p={[x, 5.8 + (i % 2) * 1.2, -2.2]} w={2.4} h={3.4} t={t} seed={i} />)}
      <FlameCard p={[0, 10.6, -4.5]} w={5} h={5} t={t} seed={7} />
      {Array.from({length: 8}).map((_, i) => {
        const u = (t * 0.5 + i / 8) % 1;
        return <mesh key={i} position={[-1.5 + hash(i, 1) * 3, 10 + u * 8, -4 + hash(i, 2)]}><sphereGeometry args={[0.9 + u * 1.8, 14, 10]} /><meshBasicMaterial color={`rgb(${58 - u * 16},${54 - u * 16},${66 - u * 16})`} transparent opacity={0.65 * (1 - u * 0.5)} depthWrite={false} toneMapped={false} /></mesh>;
      })}
      {Array.from({length: 18}).map((_, i) => {
        const u = (t * 0.9 + hash(i, 5)) % 1;
        return <mesh key={'e' + i} position={[-3.5 + hash(i, 6) * 7 + Math.sin(t * 3 + i) * 0.3, 3 + u * 9, -2 + hash(i, 7)]}><sphereGeometry args={[0.05, 6, 6]} /><meshBasicMaterial color={new THREE.Color(3, 1.4, 0.3)} toneMapped={false} /></mesh>;
      })}
      <Halo tex={halo} p={[0, 6, -1.5]} w={14} h={12} color="#ff7a30" op={0.35 * flick} />
      {/* neighbours and the long street */}
      <Row z={-6.5} from={-66} n={5} seed={5} lit={0.7} />
      <Row z={-6.5} from={20} n={6} seed={9} lit={0.7} />
      <Row z={20} from={-60} n={11} seed={13} lit={0.7} />
      {[-14, -9, 9, 14].map((x) => <LampN key={x} p={[x, 0, 3.4]} tex={halo} />)}
      <Vehicle2 p={[3.8, 0, 5.2]} yaw={Math.PI} kind="fire" t={t} />
      <Hydrant p={[-3.2, 0, 1.2]} />
      <Cone p={[-0.5, 0, 7.8]} /><Cone p={[0.5, 0, 7.6]} /><Cone p={[1.4, 0, 7.9]} />
      {/* hose line + spray arc */}
      <mesh position={[0, 0.06, 1.8]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 6, 8]} /><meshStandardMaterial color="#e8c24a" roughness={0.7} /></mesh>
      {hose && Array.from({length: 18}).map((_, i) => {
        const u = (t * 1.6 + i / 18) % 1;
        return <mesh key={i} position={[lerp(2.4, 0.4, u), 2.0 + Math.sin(u * Math.PI) * 2.2, lerp(2.6, -1.8, u)]}><sphereGeometry args={[0.1, 8, 8]} /><meshBasicMaterial color="#bfe9ff" toneMapped={false} /></mesh>;
      })}
      <mesh position={[0, 40, 0]}><cylinderGeometry args={[150, 150, 80, 48, 1, true]} /><meshBasicMaterial map={ctex('skyline', 2048, 256, paintSkyline)} transparent side={THREE.BackSide} toneMapped={false} color="#c08a8a" depthWrite={false} /></mesh>
      <Sky top="#2a1a3a" bottom="#a8503a" r={280} />
    </group>
  );
};
