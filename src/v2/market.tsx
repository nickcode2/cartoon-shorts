// Supermarket sets for CrisisShortV2: the aisle (from CharacterTest) with the water / beans / radio displays, a shopping cart, and the checkout.
import React, {useLayoutEffect, useRef} from 'react';
import * as THREE from 'three';
import {V3, hash, lerp, useTex} from '../kit/kit';
import {FREDOKA, Halo, Lamp, SBall, SBox, SCyl, SPlane, blot, label, lgr, outlined, paintAO, paintArrow, paintCeiling, paintFarShelf, paintFloorTiles, paintHalo, paintHeader, paintMural, paintPaint, paintSign, paintSpark, paintWarn, rr, shade, fitText} from './gfx';

// ------------------------------------------------------------------ products: instanced 3D boxes, cans and bottles with real packaging textures
export const AISLE = 1.5; // aisle half width (shelf front edge at |x| = AISLE - 0.12)
const NBOX = 6, NCAN = 4, NBOT = 3;
interface Placed {boxes: THREE.Matrix4[][]; cans: THREE.Matrix4[][]; bottles: THREE.Matrix4[][]}
let placed: Placed | null = null;
function placeProducts(): Placed {
  if (placed) return placed;
  const boxes = Array.from({length: NBOX}, () => [] as THREE.Matrix4[]);
  const cans = Array.from({length: NCAN}, () => [] as THREE.Matrix4[]);
  const bottles = Array.from({length: NBOT}, () => [] as THREE.Matrix4[]);
  const pos = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const push = (arr: THREE.Matrix4[], x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number) => {
    pos.set(x, y, z);
    sc.set(sx, sy, sz);
    q.setFromAxisAngle(up, yaw);
    arr.push(new THREE.Matrix4().compose(pos, q, sc));
  };
  let seed = 1;
  for (const sd of [-1, 1])
    for (let tier = 0; tier < 5; tier++)
      for (let row = 0; row < 2; row++) {
        const x = sd * (AISLE - 0.02 + row * 0.14);
        const base = 0.125 + tier * 0.43;
        const face = sd < 0 ? Math.PI / 2 : -Math.PI / 2;
        let z = -1.4 - hash(seed, 1) * 0.05;
        let i = 0;
        while (z > -13.5) {
          seed++;
          const k = hash(seed, i), v = hash(seed, i + 50);
          const jitter = (hash(seed, i + 90) - 0.5) * 0.1;
          if (hash(seed, i + 130) > 0.94) { z -= 0.12; i++; continue; }
          if (k < 0.42) {
            const w = 0.12 + hash(seed, i + 3) * 0.06, h = 0.23 + hash(seed, i + 4) * 0.08 + row * 0.02;
            push(boxes[Math.floor(v * NBOX)], x, base + h / 2, z - w / 2, face + jitter, w, h, 0.09);
            z -= w + 0.012;
          } else if (k < 0.72) {
            const d = 0.078, h = 0.11, stack = hash(seed, i + 7) > 0.55 ? 2 : 1;
            for (let s2 = 0; s2 < stack; s2++) push(cans[Math.floor(v * NCAN)], x, base + h / 2 + s2 * h, z - d / 2, face + jitter * 3, d, h, d);
            z -= d + 0.008;
          } else {
            const d = 0.07, h = 0.26 + row * 0.02;
            push(bottles[Math.floor(v * NBOT)], x, base + h / 2, z - d / 2, face + jitter * 3, d, h, d);
            z -= d + 0.01;
          }
          i++;
        }
      }
  placed = {boxes, cans, bottles};
  return placed;
}

const Inst: React.FC<{mats: THREE.Matrix4[]; geo: 'box' | 'cyl'; map: THREE.Texture; cap?: string; r?: number; m?: number}> = ({mats, geo, map, cap = '#c9ccd2', r = 0.55, m = 0}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = ref.current!;
    mats.forEach((mx, i) => im.setMatrixAt(i, mx));
    im.instanceMatrix.needsUpdate = true;
  }, [mats]);
  if (!mats.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, mats.length]} castShadow receiveShadow frustumCulled={false}>
      {geo === 'box' ? <boxGeometry args={[1, 1, 1]} /> : <cylinderGeometry args={[0.5, 0.5, 1, 20]} />}
      {geo === 'box' ? (
        <meshStandardMaterial map={map} roughness={r} metalness={m} />
      ) : (
        <>
          <meshStandardMaterial attach="material-0" map={map} roughness={r} metalness={m} />
          <meshStandardMaterial attach="material-1" color={cap} roughness={0.35} metalness={0.7} />
          <meshStandardMaterial attach="material-2" color={cap} roughness={0.35} metalness={0.7} />
        </>
      )}
    </instancedMesh>
  );
};

// ------------------------------------------------------------------ the aisle
const SEG = 4;
export const Aisle: React.FC<{t: number; ready: boolean; extras?: boolean}> = ({t, ready, extras = true}) => {
  const P = placeProducts();
  const boxTex = Array.from({length: NBOX}, (_, i) => useTex(`bx${i}${ready}`, 256, 384, (c) => c.drawImage(label('box', i, ready), 0, 0)));
  const canTex = Array.from({length: NCAN}, (_, i) => useTex(`cn${i}${ready}`, 512, 256, (c) => c.drawImage(label('can', i, ready), 0, 0)));
  const botTex = Array.from({length: NBOT}, (_, i) => useTex(`bt${i}${ready}`, 256, 512, (c) => c.drawImage(label('bottle', i, ready), 0, 0)));
  const farTex = [useTex('fs0' + ready, 2048, 1024, paintFarShelf(3, ready)), useTex('fs1' + ready, 2048, 1024, paintFarShelf(11, ready)), useTex('fs2' + ready, 2048, 1024, paintFarShelf(23, ready))];
  const floor = useTex('floorT', 1024, 1024, paintFloorTiles, [26 / 1.2, 70 / 1.2]);
  const ceil = useTex('ceilT', 512, 512, paintCeiling, [22, 58]);
  const wallTex = useTex('wallP', 512, 512, paintPaint('#e9dcc0'), [14, 1]);
  const halo = useTex('halo', 256, 256, paintHalo);
  const spark = useTex('spark', 256, 256, paintSpark);
  const ao = useTex('ao', 128, 8, paintAO);
  const arrow = useTex('arrowT', 128, 128, paintArrow);
  const warn = useTex('warnT', 128, 128, paintWarn);
  const hdr = [
    useTex('hd0' + ready, 1024, 128, paintHeader('SNACKS', '#d93a40', ready)),
    useTex('hd1' + ready, 1024, 128, paintHeader('DRINKS', '#2f7fd0', ready)),
    useTex('hd2' + ready, 1024, 128, paintHeader('CEREAL', '#f08a24', ready)),
    useTex('hd3' + ready, 1024, 128, paintHeader('PASTA', '#3aa65b', ready)),
  ];
  const sg = [
    useTex('sg0' + ready, 512, 256, paintSign('AISLE 7', 'SNACKS  *  DRINKS', '#2f7fd0', ready)),
    useTex('sg1' + ready, 512, 256, paintSign('SALE', 'ALL WEEK  *  2 FOR 1', '#d93a40', ready)),
    useTex('sg2' + ready, 512, 256, paintSign('FRESH', 'FRUIT  *  VEG  *  BAKERY', '#3aa65b', ready)),
  ];
  const mural = useTex('mural' + ready, 2048, 768, paintMural(ready));
  const lampZ = [0.5, -2.5, -5.5, -8.5, -11.5, -14.5, -17.5, -20.5];
  const tw = (i: number) => 1 + 0.25 * Math.sin(t * 5 + i * 1.7);
  const segs = Array.from({length: 12}, (_, k) => k);
  return (
    <group>
      {/* lighting: warm key (soft shadows), cool sky fill, ambient, ceiling point lights */}
      <hemisphereLight args={['#bcd6ff', '#e9d3b4', 1.2]} />
      <directionalLight color="#ffd0a0" intensity={1.9} position={[3.4, 5, 5.5]} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-camera-near={0.5} shadow-camera-far={30} shadow-bias={-0.0003} shadow-normalBias={0.02} shadow-radius={4} />
      <directionalLight color="#a8c8ff" intensity={0.8} position={[-4, 2.5, 3]} />
      <ambientLight color="#ffffff" intensity={0.12} />
      {[0.5, -5.5, -11.5, -17.5].map((z) => <pointLight key={z} position={[0, 3.2, z]} color="#fff0d2" intensity={14} distance={11} decay={2} />)}

      {/* shell: extends far beyond any camera view */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -17]} receiveShadow>
        <planeGeometry args={[28, 70]} />
        <meshStandardMaterial map={floor} roughness={0.36} metalness={0.04} />
      </mesh>
      <SPlane w={28} h={70} p={[0, 3.6, -17]} rot={[Math.PI / 2, 0, 0]} map={ceil} r={0.9} recv={false} />
      <SPlane w={70} h={3.6} p={[-14, 1.8, -17]} rot={[0, Math.PI / 2, 0]} map={wallTex} r={0.85} />
      <SPlane w={70} h={3.6} p={[14, 1.8, -17]} rot={[0, -Math.PI / 2, 0]} map={wallTex} r={0.85} />
      <SPlane w={28} h={3.6} p={[0, 1.8, -24]} c="#eadcbc" r={0.85} />
      <SPlane w={28} h={3.6} p={[0, 1.8, 9]} rot={[0, Math.PI, 0]} c="#eadcbc" r={0.85} />
      <SPlane w={9} h={3.0} p={[0, 1.6, -23.94]} map={mural} r={0.8} emap ei={0.25} />

      {/* ceiling: fixtures with glow, ducts */}
      {lampZ.map((z) => (
        <group key={z}>
          <Lamp p={[0, 3.56, z]} />
          <Lamp p={[3, 3.56, z]} />
          <Lamp p={[-3, 3.56, z]} />
          <Halo tex={halo} p={[0, 3.4, z + 0.2]} w={2.2} color="#fff0c8" op={0.5} />
          <Halo tex={halo} p={[0, 0.015, z - 0.2]} w={1.4} h={3.4} rot={[-Math.PI / 2, 0, 0]} color="#fff6dc" op={0.28} />
        </group>
      ))}
      <SCyl r0={0.14} h={60} p={[1.7, 3.38, -17]} rot={[Math.PI / 2, 0, 0]} c="#c3cad6" r={0.4} m={0.7} cast={false} />
      <SCyl r0={0.07} h={60} p={[-1.9, 3.44, -17]} rot={[Math.PI / 2, 0, 0]} c="#c9373d" r={0.5} m={0.2} cast={false} />

      {/* shelving: textured backing + real boards + 3D products */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <SBox s={[0.7, 2.3, 46]} p={[sd * (AISLE + 0.6), 1.15, -17]} c="#d3d9df" r={0.6} m={0.2} />
          {segs.map((k) => {
            const z = 1 - SEG * k;
            const near = k >= 1 && k <= 3; // products are real 3D here, the backing sits behind them
            return (
              <group key={k}>
                <SPlane w={SEG} h={2.2} p={[sd * (near ? AISLE + 0.28 : AISLE - 0.02), 1.15, z]} rot={[0, -sd * (Math.PI / 2), 0]} map={farTex[(k + (sd > 0 ? 1 : 0)) % 3]} r={0.8} />
                <SPlane w={SEG - 0.1} h={0.45} p={[sd * (AISLE - 0.13), 2.5, z]} rot={[0, -sd * (Math.PI / 2), 0]} map={hdr[(k + (sd > 0 ? 2 : 0)) % 4]} r={0.6} emap ei={0.45} />
                <SBox s={[0.1, 2.75, 0.1]} p={[sd * (AISLE - 0.1), 1.375, z + SEG / 2]} c="#2c6fc0" r={0.45} m={0.3} cast={false} />
              </group>
            );
          })}
          {[0, 1, 2, 3, 4].map((tr) => (
            <SBox key={tr} s={[0.4, 0.04, 46]} p={[sd * (AISLE + 0.08), 0.105 + tr * 0.43, -17]} c="#e4e1d8" r={0.45} m={0.3} />
          ))}
          <SBox s={[0.42, 0.1, 46]} p={[sd * (AISLE + 0.07), 0.05, -17]} c="#334463" r={0.6} />
        </group>
      ))}
      {P.boxes.map((mt, i) => <Inst key={'b' + i} mats={mt} geo="box" map={boxTex[i]} r={0.6} />)}
      {P.cans.map((mt, i) => <Inst key={'c' + i} mats={mt} geo="cyl" map={canTex[i]} r={0.4} m={0.35} />)}
      {P.bottles.map((mt, i) => <Inst key={'t' + i} mats={mt} geo="cyl" map={botTex[i]} cap="#f4f1e8" r={0.3} m={0.05} />)}

      {/* hanging signs */}
      {[[-5.2, 0], [-9.5, 1], [-14, 2]].map(([z, i]) => (
        <group key={z}>
          <SBox s={[0.012, 0.7, 0.012]} p={[-0.5, 3.25, z]} c="#555a66" r={0.4} m={0.8} cast={false} />
          <SBox s={[0.012, 0.7, 0.012]} p={[0.5, 3.25, z]} c="#555a66" r={0.4} m={0.8} cast={false} />
          <SBox s={[1.5, 0.76, 0.05]} p={[0, 2.82, z]} c="#f4f4f4" r={0.5} />
          <SPlane w={1.46} h={0.73} p={[0, 2.82, z + 0.03]} map={sg[i]} r={0.5} emap ei={0.4} />
          <SPlane w={1.46} h={0.73} p={[0, 2.82, z - 0.03]} rot={[0, Math.PI, 0]} map={sg[i]} r={0.5} emap ei={0.4} />
        </group>
      ))}

      {/* floor: markings, glossy spill, baked contact AO along the shelf bases and walls */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <SPlane w={0.06} h={46} p={[sd * (AISLE - 0.28), 0.004, -17]} rot={[-Math.PI / 2, 0, 0]} c="#e8bd2c" r={0.5} recv />
          <mesh position={[sd * (AISLE - 0.4), 0.006, -17]} rotation={[-Math.PI / 2, 0, 0]} scale={[sd, 1, 1]} renderOrder={1}>
            <planeGeometry args={[0.8, 46]} />
            <meshBasicMaterial map={ao} color="#000000" transparent opacity={0.6} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
        </group>
      ))}
      {[-5.5, -11].map((z) => <SPlane key={z} w={0.55} h={0.55} p={[0, 0.005, z]} rot={[-Math.PI / 2, 0, 0]} map={arrow} r={0.5} />)}
      <mesh position={[0.45, 0.008, -3.6]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <circleGeometry args={[0.38, 32]} />
        <meshStandardMaterial color="#b6d8f2" roughness={0.04} metalness={0.0} transparent opacity={0.55} depthWrite={false} />
      </mesh>

      {/* props */}
      <group position={[-0.9, 0, -3.6]} rotation={[0, 0.25, 0]}>
        <SBox s={[0.62, 0.34, 0.5]} p={[0, 0.17, 0]} c="#b8793d" r={0.85} />
        {Array.from({length: 14}).map((_, i) => (
          <SBall key={i} r0={0.075} p={[-0.2 + (i % 5) * 0.1, 0.4 + Math.floor(i / 5) * 0.08, -0.12 + (i % 3) * 0.12]} c={['#f08a24', '#f5a02d', '#ee7a1c'][i % 3]} r={0.45} />
        ))}
      </group>
      <group position={[1.0, 0, -4.4]} rotation={[0, -0.2, 0]}>
        {[[-0.27, 0.14], [0.27, 0.14], [0, 0.14], [-0.14, 0.42], [0.14, 0.42], [0, 0.7]].map(([x, y], i) => (
          <group key={i} position={[x, y, 0]}>
            <SBox s={[0.26, 0.28, 0.36]} p={[0, 0, 0]} c="#cc2f36" r={0.5} />
            <SPlane w={0.2} h={0.1} p={[0, 0.02, 0.182]} c="#ffffff" r={0.6} />
            {[-0.06, 0.06].map((xx) => <SCyl key={xx} r0={0.028} h={0.09} p={[xx, 0.18, 0]} c="#f4f1e8" r={0.3} seg={12} cast={false} />)}
          </group>
        ))}
      </group>
      <group position={[-0.45, 0, -6]} rotation={[0, 0.5, 0]}>
        <SPlane w={0.34} h={0.5} p={[0, 0.25, 0.1]} rot={[-0.28, 0, 0]} map={warn} r={0.4} cast side={THREE.DoubleSide} />
        <SPlane w={0.34} h={0.5} p={[0, 0.25, -0.1]} rot={[0.28, Math.PI, 0]} map={warn} r={0.4} cast side={THREE.DoubleSide} />
      </group>
      <group position={[0.6, 0, -8.6]} rotation={[0, -0.3, 0]}>
        <SBox s={[0.6, 0.04, 0.85]} p={[0, 0.38, 0]} c="#c9d2da" r={0.3} m={0.8} />
        <SBox s={[0.6, 0.34, 0.03]} p={[0, 0.56, 0.42]} c="#c9d2da" r={0.3} m={0.8} />
        <SBox s={[0.6, 0.34, 0.03]} p={[0, 0.56, -0.42]} c="#c9d2da" r={0.3} m={0.8} />
        <SBox s={[0.03, 0.34, 0.85]} p={[0.3, 0.56, 0]} c="#c9d2da" r={0.3} m={0.8} />
        <SBox s={[0.03, 0.34, 0.85]} p={[-0.3, 0.56, 0]} c="#c9d2da" r={0.3} m={0.8} />
        <SBox s={[0.66, 0.04, 0.05]} p={[0, 0.95, 0.5]} c="#cc2f36" r={0.5} />
        {[-0.2, 0.2].map((x) => [-0.34, 0.34].map((z) => <SBall key={x + '' + z} r0={0.045} p={[x, 0.05, z]} c="#222" r={0.7} />))}
        <SBox s={[0.18, 0.2, 0.16]} p={[-0.1, 0.5, 0.1]} c="#e8bd2c" r={0.6} />
        <SBox s={[0.2, 0.26, 0.16]} p={[0.12, 0.53, -0.12]} c="#3aa65b" r={0.6} />
      </group>
      <group position={[0.1, 0, -19.5]}>
        {[[-0.4, 0.2], [0.4, 0.2], [0, 0.6]].map(([x, y], i) => <SBox key={i} s={[0.7, 0.4, 0.7]} p={[x, y, 0]} c={['#b8793d', '#cc2f36', '#2f7fd0'][i]} r={0.8} />)}
      </group>

      {/* bright glints on packaging and the spill */}
      {[[-1.4, 1.3, -3.2], [-1.4, 0.8, -4.6], [1.38, 1.6, -3.8], [1.38, 0.9, -6.2], [-1.4, 1.75, -6.5], [0.45, 0.05, -3.6]].map((q, i) => (
        <Halo key={i} tex={spark} p={q as V3} w={0.4 * tw(i)} color="#fff6d8" op={0.8} rot={[0, q[0] < -1 ? Math.PI / 2 : q[0] > 1 ? -Math.PI / 2 : 0, 0]} />
      ))}
    </group>
  );
};

// =========================================================================================== props for the shopping trip
const paintWire = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.clearRect(0, 0, w, h);
  c.strokeStyle = '#d6dbe2';
  c.lineWidth = 8;
  for (let i = 0; i <= 4; i++) {
    c.beginPath(); c.moveTo((i * w) / 4, 0); c.lineTo((i * w) / 4, h); c.stroke();
    c.beginPath(); c.moveTo(0, (i * h) / 4); c.lineTo(w, (i * h) / 4); c.stroke();
  }
};
const paintJugLabel = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = '#f5fbff'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#2f7fd0'; c.fillRect(0, 0, w, h * 0.16); c.fillRect(0, h * 0.84, w, h * 0.16);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  fitText(c, 'WATER', w * 0.72, h * 0.5);
  c.fillStyle = '#1f5fa8';
  c.fillText('WATER', w / 2, h * 0.5);
};
const paintBeanLabel = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, 0, h, [[0, '#d9552b'], [1, '#a93a1c']]); c.fillRect(0, 0, w, h);
  c.fillStyle = '#f6e7b8'; c.fillRect(0, h * 0.12, w, h * 0.06); c.fillRect(0, h * 0.82, w, h * 0.06);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const x of [w * 0.25, w * 0.75]) {
    fitText(c, 'BEANS', w * 0.36, h * 0.3);
    outlined(c, 'BEANS', x, h * 0.45, '#fff6dc', 'rgba(60,20,10,0.85)', 8);
    c.fillStyle = '#7a3a1c';
    for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(x - 30 + k * 20, h * 0.68, 8, 5, 0.4, 0, 7); c.fill(); }
  }
};
const paintBelt = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = '#23262e'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#2d313b';
  for (let i = 0; i < 8; i++) c.fillRect((i * w) / 8, 0, w / 16, h);
  c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, 0, w, 4);
};
const paintSignFit = (title: string, sub: string, bg: string) => (c: CanvasRenderingContext2D, w: number, h: number) => {
  rr(c, 0, 0, w, h, 22, lgr(c, 0, 0, 0, h, [[0, shade(bg, 1.25)], [1, shade(bg, 0.78)]]));
  c.textAlign = 'center'; c.textBaseline = 'middle';
  fitText(c, title, w * 0.8, 130);
  outlined(c, title, w / 2, h * 0.4, '#ffffff', 'rgba(30,15,25,0.7)', 12);
  fitText(c, sub, w * 0.8, 46);
  c.fillStyle = '#fff6d8';
  c.fillText(sub, w / 2, h * 0.78);
};
const paintPrice = (text: string) => (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = '#10241a'; c.fillRect(0, 0, w, h);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  fitText(c, text, w * 0.8, 70);
  c.fillStyle = '#7dffb0';
  c.fillText(text, w / 2, h / 2);
};

export const Jug: React.FC<{p: V3; rot?: V3; tex: THREE.Texture}> = ({p, rot, tex}) => (
  <group position={p} rotation={rot ?? [0, 0, 0]}>
    <mesh castShadow receiveShadow>
      <cylinderGeometry args={[0.13, 0.13, 0.4, 20]} />
      <meshStandardMaterial color="#68b7ee" roughness={0.18} transparent opacity={0.9} />
    </mesh>
    <mesh position={[0, 0.24, 0]} castShadow>
      <cylinderGeometry args={[0.055, 0.1, 0.1, 16]} />
      <meshStandardMaterial color="#68b7ee" roughness={0.18} transparent opacity={0.9} />
    </mesh>
    <mesh position={[0, 0.3, 0]}>
      <cylinderGeometry args={[0.05, 0.05, 0.04, 12]} />
      <meshStandardMaterial color="#1f5fa8" roughness={0.4} />
    </mesh>
    <mesh position={[0, 0.02, 0]}>
      <cylinderGeometry args={[0.134, 0.134, 0.17, 20, 1, true, -Math.PI / 2, Math.PI]} />
      <meshStandardMaterial map={tex} roughness={0.4} side={THREE.DoubleSide} />
    </mesh>
  </group>
);

export const BeanCan: React.FC<{p: V3; rot?: V3; tex: THREE.Texture}> = ({p, rot, tex}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} castShadow receiveShadow>
    <cylinderGeometry args={[0.05, 0.05, 0.11, 18]} />
    <meshStandardMaterial attach="material-0" map={tex} roughness={0.4} metalness={0.3} />
    <meshStandardMaterial attach="material-1" color="#c9ccd2" roughness={0.35} metalness={0.7} />
    <meshStandardMaterial attach="material-2" color="#c9ccd2" roughness={0.35} metalness={0.7} />
  </mesh>
);

export const useShopTex = () => ({
  jug: useTex('jugLabel', 512, 128, paintJugLabel),
  can: useTex('beanLabel', 512, 128, paintBeanLabel),
  wire: useTex('wire', 128, 128, paintWire, [3, 2]),
});

/** Shopping cart. Front of the cart faces +z. `jugs` / `cans` = how many are inside. */
export const Cart: React.FC<{p: V3; yaw?: number; jugs: number; cans: number; extra?: number}> = ({p, yaw = 0, jugs, cans, extra = 0}) => {
  const T = useShopTex();
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <SBox s={[0.56, 0.03, 0.92]} p={[0, 0.34, 0]} c="#9aa3ad" r={0.35} m={0.7} />
      {[[0, 0.62, 0.46, 0], [0, 0.62, -0.46, 0], [0.28, 0.62, 0, 1], [-0.28, 0.62, 0, 1]].map(([x, y, z, side], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, side ? Math.PI / 2 : 0, side ? 0 : 0.0]}>
          <planeGeometry args={[side ? 0.92 : 0.56, 0.5]} />
          <meshStandardMaterial map={T.wire} transparent alphaTest={0.35} side={THREE.DoubleSide} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      <SBox s={[0.6, 0.03, 0.04]} p={[0, 0.88, -0.46]} c="#d9393f" r={0.5} />
      <SBox s={[0.04, 0.7, 0.04]} p={[0.26, 0.55, -0.46]} c="#9aa3ad" r={0.35} m={0.7} />
      <SBox s={[0.04, 0.7, 0.04]} p={[-0.26, 0.55, -0.46]} c="#9aa3ad" r={0.35} m={0.7} />
      <SBox s={[0.04, 0.3, 0.04]} p={[0.2, 0.18, 0.36]} c="#9aa3ad" r={0.35} m={0.7} />
      <SBox s={[0.04, 0.3, 0.04]} p={[-0.2, 0.18, 0.36]} c="#9aa3ad" r={0.35} m={0.7} />
      {[[-0.2, 0.36], [0.2, 0.36], [-0.2, -0.36], [0.2, -0.36]].map(([x, z], i) => (
        <SBall key={i} r0={0.05} p={[x, 0.05, z]} c="#22252c" r={0.7} />
      ))}
      {Array.from({length: jugs}).map((_, i) => <Jug key={i} tex={T.jug} p={[-0.14 + (i % 2) * 0.28, 0.56, 0.22 - Math.floor(i / 2) * 0.28]} />)}
      {Array.from({length: cans}).map((_, i) => <BeanCan key={i} tex={T.can} p={[-0.17 + (i % 4) * 0.115, 0.41 + Math.floor(i / 12) * 0.11, -0.12 - Math.floor((i % 12) / 4) * 0.12]} />)}
      {extra > 0 && <SBox s={[0.3, 0.18, 0.2]} p={[0.1, 0.47, -0.3]} c="#c0392b" r={0.5} />}
      {extra > 1 && <SCyl r0={0.035} h={0.28} p={[-0.1, 0.5, -0.3]} rot={[0, 0, Math.PI / 2]} c="#f2c53d" r={0.4} />}
    </group>
  );
};

/** Floor displays in the aisle: water jugs on a pallet (left), beans pyramid (right), radio + flashlight endcap. */
export const AisleDisplays: React.FC<{ready: boolean; jugsLeft: number; cansLeft: number}> = ({jugsLeft, cansLeft}) => {
  const T = useShopTex();
  const banner = useTex('bnW', 512, 256, paintSignFit('WATER', 'STOCK UP', '#2f7fd0'));
  const banner2 = useTex('bnB', 512, 256, paintSignFit('BEANS', '12 FOR 10', '#d9552b'));
  const banner3 = useTex('bnR', 512, 256, paintSignFit('RADIOS', 'AND LIGHTS', '#3aa65b'));
  const jugPos: V3[] = [];
  for (let l = 0; l < 2; l++) for (let i = 0; i < 6; i++) jugPos.push([-0.32 + (i % 3) * 0.3, 0.26 + 0.2 + l * 0.42, -0.2 + Math.floor(i / 3) * 0.3]);
  const canPos: V3[] = [];
  [[4, 0], [3, 1], [2, 2], [1, 3]].forEach(([n, row]) => { for (let i = 0; i < n; i++) canPos.push([-0.23 + row * 0.058 + i * 0.116, 0.16 + 0.11 * row + 0.055, 0]); });
  return (
    <group>
      {/* water: pallet + jugs */}
      <group position={[-0.95, 0, -2.3]} rotation={[0, 0.2, 0]}>
        <SBox s={[0.95, 0.12, 0.8]} p={[0, 0.06, 0]} c="#b8793d" r={0.9} />
        {jugPos.slice(0, jugsLeft).map((q, i) => <Jug key={i} p={[q[0], q[1] - 0.05, q[2]]} tex={T.jug} />)}
        <SBox s={[0.03, 1.2, 0.03]} p={[-0.45, 0.6, 0.38]} c="#555a66" r={0.4} m={0.8} cast={false} />
        <SBox s={[0.03, 1.2, 0.03]} p={[0.45, 0.6, 0.38]} c="#555a66" r={0.4} m={0.8} cast={false} />
        <SBox s={[1.0, 0.5, 0.04]} p={[0, 1.3, 0.38]} c="#f4f4f4" r={0.5} />
        <SPlane w={0.94} h={0.47} p={[0, 1.3, 0.405]} map={banner} r={0.5} emap ei={0.35} />
      </group>
      {/* beans: crate + pyramid */}
      <group position={[0.95, 0, -2.3]} rotation={[0, -0.25, 0]}>
        <SBox s={[0.8, 0.16, 0.5]} p={[0, 0.08, 0]} c="#b8793d" r={0.9} />
        {canPos.slice(0, cansLeft).map((q, i) => <BeanCan key={i} p={[q[0], q[1], q[2]]} tex={T.can} />)}
        {canPos.slice(0, cansLeft).map((q, i) => <BeanCan key={'b' + i} p={[q[0], q[1], q[2] - 0.11]} tex={T.can} />)}
        <SBox s={[0.03, 1.1, 0.03]} p={[-0.38, 0.55, 0.24]} c="#555a66" r={0.4} m={0.8} cast={false} />
        <SBox s={[0.03, 1.1, 0.03]} p={[0.38, 0.55, 0.24]} c="#555a66" r={0.4} m={0.8} cast={false} />
        <SBox s={[0.9, 0.46, 0.04]} p={[0, 1.18, 0.24]} c="#f4f4f4" r={0.5} />
        <SPlane w={0.84} h={0.42} p={[0, 1.18, 0.265]} map={banner2} r={0.5} emap ei={0.35} />
      </group>
      {/* radios + flashlights endcap */}
      <group position={[-1.05, 0, -6.6]} rotation={[0, Math.PI / 2 - 0.12, 0]}>
        <SBox s={[1.1, 1.5, 0.4]} p={[0, 0.75, 0]} c="#d3d9df" r={0.6} m={0.2} />
        {[0.25, 0.6, 0.95, 1.3].map((y) => <SBox key={y} s={[1.06, 0.03, 0.42]} p={[0, y, 0.01]} c="#e4e1d8" r={0.45} m={0.3} />)}
        {[0, 1, 2].map((i) => (
          <group key={i} position={[-0.32 + i * 0.32, 0.5, 0.06]}>
            <SBox s={[0.26, 0.16, 0.12]} p={[0, 0.08, 0]} c={['#c0392b', '#2f4a78', '#2d2d33'][i]} r={0.5} />
            <SCyl r0={0.04} h={0.012} p={[-0.05, 0.08, 0.066]} rot={[Math.PI / 2, 0, 0]} c="#f4e3d0" r={0.5} seg={14} />
            <SBox s={[0.008, 0.14, 0.008]} p={[0.1, 0.22, 0]} c="#c9ccd2" r={0.3} m={0.8} cast={false} />
          </group>
        ))}
        {[0, 1, 2, 3].map((i) => <SCyl key={'f' + i} r0={0.03} h={0.2} p={[-0.38 + i * 0.25, 0.86, 0.06]} rot={[0, 0, Math.PI / 2]} c={['#f2c53d', '#e8523a', '#2f7fd0', '#3aa65b'][i]} r={0.4} seg={14} />)}
        {[0, 1, 2, 3].map((i) => <SCyl key={'g' + i} r0={0.03} h={0.2} p={[-0.38 + i * 0.25, 1.2, 0.06]} rot={[0, 0, Math.PI / 2]} c={['#f2c53d', '#e8523a', '#2f7fd0', '#3aa65b'][i]} r={0.4} seg={14} />)}
        <SBox s={[1.0, 0.4, 0.04]} p={[0, 1.78, 0.18]} c="#f4f4f4" r={0.5} />
        <SPlane w={0.94} h={0.37} p={[0, 1.78, 0.205]} map={banner3} r={0.5} emap ei={0.35} />
      </group>
    </group>
  );
};

// =========================================================================================== checkout
const paintLaneNo = (n: string) => (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = '#d93a40'; c.fillRect(0, 0, w, h);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  fitText(c, n, w * 0.5, h * 0.7);
  c.fillStyle = '#ffffff';
  c.fillText(n, w / 2, h / 2 + 3);
};
const paintStoreView = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = lgr(c, 0, 0, 0, h, [[0, '#7fc4f0'], [0.6, '#dff2fb'], [0.62, '#7bbf6a'], [1, '#5d9a52']]); c.fillRect(0, 0, w, h);
  blot(c, 5, 16, w, h * 0.6, 50, 160, '255,255,255', 0.5);
  c.fillStyle = '#6d7480'; c.fillRect(0, h * 0.72, w, h * 0.28);
  for (let i = 0; i < 10; i++) {
    const x = 40 + i * (w / 10);
    c.fillStyle = ['#d93a40', '#2f7fd0', '#f2c53d', '#eee', '#3aa65b'][i % 5];
    c.beginPath(); c.roundRect(x, h * 0.74, 130, 56, 14); c.fill();
    c.fillStyle = '#23262e'; c.beginPath(); c.arc(x + 28, h * 0.74 + 58, 12, 0, 7); c.arc(x + 102, h * 0.74 + 58, 12, 0, 7); c.fill();
  }
  c.fillStyle = '#4b8a40';
  for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(60 + i * (w / 9), h * 0.55, 46 + (i % 3) * 14, 0, 7); c.fill(); }
};

export const Checkout: React.FC<{t: number; beep: number; belt: number; ready: boolean}> = ({t, beep, belt, ready}) => {
  const floor = useTex('floorT', 1024, 1024, paintFloorTiles, [26 / 1.2, 70 / 1.2]);
  const ceil = useTex('ceilT', 512, 512, paintCeiling, [22, 58]);
  const wall = useTex('wallP', 512, 512, paintPaint('#e9dcc0'), [14, 1]);
  const halo = useTex('halo', 256, 256, paintHalo);
  const beltTex = useTex('belt', 128, 64, paintBelt, [10, 1]);
  const view = useTex('storeview', 1024, 256, paintStoreView);
  const price = useTex('price', 256, 96, paintPrice('86.40'));
  const lane = [useTex('ln3', 128, 128, paintLaneNo('3')), useTex('ln4', 128, 128, paintLaneNo('4')), useTex('ln2', 128, 128, paintLaneNo('2'))];
  const T = useShopTex();
  beltTex.offset.x = -belt * 0.35;
  void ready;
  const renderLane = ({z, n, active}: {z: number; n: number; active?: boolean}) => (
    <group key={z} position={[0, 0, z]}>
      <SBox s={[2.8, 0.76, 0.7]} p={[-0.2, 0.38, 0]} c="#3a4251" r={0.5} />
      <SBox s={[2.8, 0.03, 0.74]} p={[-0.2, 0.775, 0]} c="#c9d2da" r={0.3} m={0.8} />
      <mesh position={[-0.35, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.3, 0.52]} />
        <meshStandardMaterial map={beltTex} roughness={0.8} />
      </mesh>
      <SBox s={[0.9, 0.76, 0.7]} p={[1.65, 0.38, 0]} c="#2f6fae" r={0.5} />
      <SBox s={[0.9, 0.03, 0.74]} p={[1.65, 0.775, 0]} c="#e8edf1" r={0.35} m={0.3} />
      <SBox s={[0.32, 0.03, 0.4]} p={[0.9, 0.8, 0]} c="#9ad8ee" r={0.15} emissive={beep ? '#ff3a3a' : '#222'} ei={beep ? 1.6 : 0.1} />
      {/* register + screen */}
      <SBox s={[0.34, 0.12, 0.3]} p={[1.65, 0.86, 0.08]} c="#2d313b" r={0.5} />
      <group position={[1.65, 1.0, 0.08]} rotation={[-0.25, 0, 0]}>
        <SBox s={[0.34, 0.2, 0.03]} p={[0, 0, 0]} c="#2d313b" r={0.5} />
        {active && <SPlane w={0.3} h={0.16} p={[0, 0, 0.02]} map={price} r={0.4} emap ei={0.9} />}
      </group>
      <SBox s={[0.14, 0.08, 0.1]} p={[1.9, 0.84, 0.25]} c="#1a1d24" r={0.5} />
      {/* bag rack + divider + candy shelf */}
      <SBox s={[0.04, 0.5, 0.04]} p={[2.2, 0.75, 0.2]} c="#9aa3ad" r={0.3} m={0.8} cast={false} />
      <SBox s={[0.2, 0.01, 0.01]} p={[2.1, 1.0, 0.2]} c="#9aa3ad" r={0.3} m={0.8} cast={false} />
      <SBox s={[0.5, 0.9, 0.3]} p={[-1.75, 0.45, 0.62]} c="#d93a40" r={0.5} />
      {[0, 1, 2, 3].map((i) => <SBox key={i} s={[0.4, 0.07, 0.04]} p={[-1.75, 0.2 + i * 0.2, 0.78]} c={['#f2c53d', '#3aa65b', '#2f7fd0', '#fff'][i]} r={0.5} />)}
      {/* lane number light on a pole */}
      <SBox s={[0.05, 1.7, 0.05]} p={[2.0, 1.65, -0.3]} c="#9aa3ad" r={0.3} m={0.8} cast={false} />
      <SBox s={[0.34, 0.34, 0.06]} p={[2.0, 2.58, -0.3]} c="#d93a40" r={0.4} />
      <SPlane w={0.3} h={0.3} p={[2.0, 2.58, -0.268]} map={lane[n % 3]} r={0.4} emap ei={0.8} />
      <SPlane w={0.3} h={0.3} p={[2.0, 2.58, -0.332]} rot={[0, Math.PI, 0]} map={lane[n % 3]} r={0.4} emap ei={0.8} />
    </group>
  );
  return (
    <group>
      <hemisphereLight args={['#bcd6ff', '#e9d3b4', 1.2]} />
      <directionalLight color="#ffd0a0" intensity={1.9} position={[3.4, 5, 5.5]} castShadow shadow-mapSize={[4096, 4096]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-camera-near={0.5} shadow-camera-far={30} shadow-bias={-0.0003} shadow-normalBias={0.02} shadow-radius={4} />
      <directionalLight color="#a8c8ff" intensity={0.8} position={[-4, 2.5, 3]} />
      <ambientLight color="#ffffff" intensity={0.12} />
      {[[0, -1], [0, -6], [-4, -3.5], [4, -3.5]].map(([x, z]) => <pointLight key={x + '_' + z} position={[x, 3.2, z]} color="#fff0d2" intensity={14} distance={10} decay={2} />)}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -8]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial map={floor} roughness={0.36} metalness={0.04} />
      </mesh>
      <SPlane w={40} h={40} p={[0, 3.6, -8]} rot={[Math.PI / 2, 0, 0]} map={ceil} r={0.9} recv={false} />
      <SPlane w={40} h={3.6} p={[-18, 1.8, -8]} rot={[0, Math.PI / 2, 0]} map={wall} r={0.85} />
      <SPlane w={40} h={3.6} p={[18, 1.8, -8]} rot={[0, -Math.PI / 2, 0]} map={wall} r={0.85} />
      <SPlane w={40} h={3.6} p={[0, 1.8, 12]} rot={[0, Math.PI, 0]} map={wall} r={0.85} />
      {/* storefront at the back: glass wall with the car park outside */}
      <SPlane w={40} h={3.6} p={[0, 1.8, -17]} c="#cfd6dc" r={0.7} />
      <SPlane w={16} h={2.7} p={[0, 1.7, -16.95]} map={view} r={0.5} emap ei={0.9} />
      {[-6, -3, 0, 3, 6].map((x) => <SBox key={x} s={[0.1, 2.9, 0.12]} p={[x * 1.33, 1.6, -16.9]} c="#2c6fc0" r={0.45} m={0.3} cast={false} />)}
      {[-12, -8, -4, 0, 4, 8, 12].map((x) => [1, -4, -7].map((z) => <group key={x + '_' + z}><Lamp p={[x, 3.56, z]} s={[1.4, 0.4]} /><Halo tex={halo} p={[x, 3.4, z]} w={2} color="#fff0c8" op={0.35} /></group>))}
      {/* lanes: active one at z = 0 */}
      {renderLane({z: 0, n: 0, active: true})}
      {renderLane({z: -3.4, n: 1})}
      {renderLane({z: -6.8, n: 2})}
      {renderLane({z: 3.4, n: 1})}
      {/* basket stacks, magazine rack, carts parked against the wall */}
      {[-3, 4].map((x, k) => (
        <group key={x} position={[x * 1.6, 0, 2 + k * 0.5]}>
          {[0, 1, 2, 3, 4].map((i) => <SBox key={i} s={[0.5, 0.06, 0.34]} p={[0, 0.14 + i * 0.08, 0]} c={['#d93a40', '#2f7fd0'][i % 2]} r={0.5} />)}
        </group>
      ))}
      <group position={[-3.8, 0, 1]}>
        <SBox s={[1.2, 1.5, 0.3]} p={[0, 0.75, 0]} c="#d3d9df" r={0.6} />
        {Array.from({length: 18}).map((_, i) => <SBox key={i} s={[0.16, 0.22, 0.02]} p={[-0.48 + (i % 6) * 0.19, 0.4 + Math.floor(i / 6) * 0.38, 0.17]} c={['#d93a40', '#2f7fd0', '#f2c53d', '#3aa65b', '#7a52c8', '#f08a24'][i % 6]} r={0.5} />)}
      </group>
      {[8, 10.4].map((x, i) => <Cart key={x} p={[x * 0.9, 0, 6 + i * 0.1]} yaw={Math.PI / 2} jugs={0} cans={0} />)}
      {/* floor markings + AO along lane bases */}
      <SPlane w={14} h={0.08} p={[0, 0.004, 1.2]} rot={[-Math.PI / 2, 0, 0]} c="#e8bd2c" r={0.5} />
      <mesh position={[-0.2, 0.006, 0.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 1.3]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <group visible={false}>{T && null}</group>
    </group>
  );
};

/** Items sliding along the checkout belt toward the scanner. */
export const BeltItems: React.FC<{t: number}> = ({t}) => {
  const T = useShopTex();
  const items = [
    {kind: 'jug', t0: 0.05}, {kind: 'can', t0: 0.5}, {kind: 'radio', t0: 0.95}, {kind: 'torch', t0: 1.4},
  ];
  return (
    <group position={[0, 0.82, 0]}>
      {items.map((it, i) => {
        const age = t - it.t0;
        if (age < 0) return null;
        const x = Math.min(0.55, -1.2 + age * 1.5);
        if (age > 2.4) return null;
        return (
          <group key={i} position={[x, 0, 0]}>
            {it.kind === 'jug' && <Jug p={[0, 0.2, 0]} tex={T.jug} />}
            {it.kind === 'can' && <>{[0, 1, 2].map((k) => <BeanCan key={k} p={[(k - 1) * 0.11, 0.055, 0]} tex={T.can} />)}</>}
            {it.kind === 'radio' && <><SBox s={[0.34, 0.2, 0.14]} p={[0, 0.1, 0]} c="#c0392b" r={0.5} /><SBox s={[0.01, 0.2, 0.01]} p={[0.12, 0.3, 0]} c="#c9ccd2" r={0.3} m={0.8} cast={false} /></>}
            {it.kind === 'torch' && <><SCyl r0={0.035} h={0.24} p={[0, 0.04, 0]} rot={[0, 0, Math.PI / 2]} c="#2a2f3a" r={0.4} seg={12} /><SCyl r0={0.05} h={0.08} p={[0.14, 0.04, 0]} rot={[0, 0, Math.PI / 2]} c="#f2c53d" r={0.4} seg={12} /></>}
          </group>
        );
      })}
    </group>
  );
};
