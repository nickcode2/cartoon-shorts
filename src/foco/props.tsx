// ZUMBIS_PARTE_10 hero props (real 3D, designed, cheap): golden TOWER, old RADIO (grip anchors + sound-wave rings), giant SPRINKLERS + real-3D RAIN CURTAIN (falling streaks, arcs, mist),
// heavy DOOR, glass burst, sparks, dust cloud. Everything is built once per mount (useMemo: disposed with the shot), shared geometry / materials through shared(), animation = props only
// (instance data rewritten in place or a shader time uniform), no allocation per frame.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RAMP, V3, hash, makeTex, shared} from '../kit/kit';
import {B, Cy, Sp, bm, tm} from '../cobra/common';
import {C, HDR} from './common';

const hdr = (k: keyof typeof HDR) => shared('foco-hdr-' + k, () => new THREE.MeshBasicMaterial({color: HDR[k], toneMapped: false, fog: false}));
const addMat = (map: THREE.Texture, color: string, op: number) => new THREE.MeshBasicMaterial({map, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false});
const addSprite = (map: THREE.Texture, color: string, op: number) => new THREE.SpriteMaterial({map, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false});
const radialTex = (c: CanvasRenderingContext2D, w: number, h: number) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); };
const PLANE = () => shared('foco-plane', () => new THREE.PlaneGeometry(1, 1));
const mat4 = (o: THREE.Object3D) => { o.updateMatrix(); return o.matrix; };

// ================================================================= the golden TOWER (real 3D, glowing). base (0, y0, 0); y0 = roof of the podium.
export const TOWER_H = 82;
export const Tower: React.FC<{y0?: number; pulse?: number}> = ({y0 = 22, pulse = 0}) => {
  const {core, ribs, rings, crown} = useMemo(() => {
    const prof: THREE.Vector2[] = [[7.4, 0], [6.6, 4], [5.9, 14], [5.0, 32], [4.2, 48], [3.4, 62], [2.5, 72], [1.6, 78], [1.0, 82]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(prof, 12), n = g.getAttribute('position').count, col = new Float32Array(n * 3), k = new THREE.Color();
    for (let i = 0; i < n; i++) { const y = g.getAttribute('position').getY(i) / 82; k.setRGB(1.05 + 0.35 * y, 0.62 + 0.3 * y, 0.12 + 0.1 * y); col.set([k.r, k.g, k.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const ribs = new THREE.InstancedMesh(shared('foco-rib', () => new THREE.BoxGeometry(0.28, 1, 0.5)), shared('foco-ribm', () => new THREE.MeshBasicMaterial({color: new THREE.Color(1.3, 1.0, 0.5), toneMapped: false, fog: false})), 12), o = new THREE.Object3D();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, r = 5.4; o.position.set(Math.cos(a) * r, 40, Math.sin(a) * r); o.rotation.set(0, -a, 0); o.scale.set(1, 80, 1); ribs.setMatrixAt(i, mat4(o)); }
    ribs.frustumCulled = false;
    const rings = [10, 26, 42, 58, 72].map((y) => ({y, r: 7.2 - y * 0.055 + 0.5}));
    return {core: g, ribs, rings, crown: null};
  }, []);
  void crown;
  return (
    <group position={[0, y0, 0]}>
      <mesh geometry={core}><meshBasicMaterial vertexColors toneMapped={false} fog={false} /></mesh>
      <primitive object={ribs} />
      {rings.map((q) => <mesh key={q.y} position={[0, q.y, 0]} rotation={[Math.PI / 2, 0, 0]} material={hdr('orange')}><torusGeometry args={[q.r, 0.34, 6, 24]} /></mesh>)}
      <mesh position={[0, 84.2, 0]} material={hdr('cream')}><sphereGeometry args={[1.5 + pulse * 0.2, 12, 8]} /></mesh>
      <TowerGlow y0={0} />
    </group>
  );
};
const TowerGlow: React.FC<{y0: number}> = () => {
  const {halo, beam, base} = useMemo(() => {
    const tex = makeTex(128, 128, radialTex), beamTex = makeTex(8, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    return {halo: addSprite(tex, C.gold, 0.55), beam: addMat(beamTex, C.gold, 0.16), base: addSprite(tex, C.orange, 0.5)};
  }, []);
  return (
    <group>
      {[[0, 62, 0, 70], [0, 20, 0, 52], [0, 84, 0, 38]].map(([x, y, z, s], i) => <sprite key={i} position={[x, y, z]} scale={[s, s, 1]} material={i === 2 ? halo : i === 1 ? base : halo} />)}
      <mesh position={[0, 120, 0]} material={beam}><cylinderGeometry args={[1.6, 5, 220, 14, 1, true]} /></mesh>
    </group>
  );
};

// ================================================================= the old RADIO (hero). origin = bottom centre; faces +z; 0.34 m wide, 0.22 tall, 0.13 deep (bigger than life x1.0: readable)
export const RADIO_W = 0.34, RADIO_H = 0.22;
/** Grip anchors of the radio in radio-local coords: handle = top-centre arc (carry), knob = the right tuning knob on the front. */
export const RADIO_GRIPS = {handle: [0, RADIO_H + 0.075, 0] as V3, knob: [0.105, 0.075, 0.075] as V3, knobL: [-0.105, 0.075, 0.075] as V3};
export const Radio: React.FC<{p: V3; ry?: number; knob?: number; level?: number; t?: number}> = ({p, ry = 0, knob = 0, level = 0, t = 0}) => {
  const {body, panel} = useMemo(() => {
    const sh = new THREE.Shape(); const w = RADIO_W / 2, h = RADIO_H, r = 0.035; sh.moveTo(-w + r, 0); sh.lineTo(w - r, 0); sh.quadraticCurveTo(w, 0, w, r); sh.lineTo(w, h - r * 1.6); sh.quadraticCurveTo(w, h, w - r * 1.6, h); sh.lineTo(-w + r * 1.6, h); sh.quadraticCurveTo(-w, h, -w, h - r * 1.6); sh.lineTo(-w, r); sh.quadraticCurveTo(-w, 0, -w + r, 0);
    const g = new THREE.ExtrudeGeometry(sh, {depth: 0.11, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 6}); g.translate(0, 0, -0.055);
    const slots = new THREE.PlaneGeometry(1, 1);
    return {body: g, panel: slots};
  }, []);
  const slots = useMemo(() => { const m = new THREE.InstancedMesh(shared('foco-slot', () => new THREE.BoxGeometry(0.1, 0.007, 0.004)), tm(C.deep), 9), o = new THREE.Object3D(); for (let i = 0; i < 9; i++) { o.position.set(-0.075, 0.03 + i * 0.0125, 0.0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); } m.frustumCulled = false; return m; }, []);
  const pulse = 0.5 + 0.5 * Math.sin(t * 40); // the dial lamp flickers with the static
  void panel;
  return (
    <group position={p} rotation={[0, ry, 0]} userData={{qaBox: {name: 'radio', c: [0, RADIO_H / 2, 0], h: [RADIO_W / 2, RADIO_H / 2, 0.07]}}}>
      <mesh geometry={body} castShadow><primitive object={tm(C.orangeD)} attach="material" /></mesh>
      <mesh geometry={body} scale={[1.04, 1.03, 1.12]} position={[0, -0.003, 0]}><primitive object={bm('#120A14', THREE.BackSide)} attach="material" /></mesh>
      {/* front: cream dial window with a gold needle, speaker grille with slots, two knobs, base feet */}
      <B p={[-0.07, 0.15, 0.062]} s={[0.15, 0.06, 0.012]} c={C.cream} basic cast={false} /><B p={[-0.07 + 0.04 * Math.sin(knob * 2) , 0.15, 0.07]} s={[0.006, 0.05, 0.006]} c={C.gold} basic cast={false} />
      <mesh position={[0.095, 0.15, 0.068]} material={hdr('gold')} scale={0.4 + 0.6 * pulse * (level > 0 ? 1 : 0)}><sphereGeometry args={[0.012, 8, 6]} /></mesh>
      <B p={[-0.07, 0.075, 0.058]} s={[0.15, 0.1, 0.008]} c={C.lav} cast={false} /><group position={[0, 0, 0.064]}><primitive object={slots} /></group>
      {[[0.105, 0.075], [0.105, 0.145]].map(([x, y], i) => <group key={i} position={[x, y, 0.066]} rotation={[0, 0, i === 0 ? knob : -knob * 0.6]}><Cy p={[0, 0, 0.02]} r={i === 0 ? 0.026 : 0.019} h={0.04} c={C.gold} rot={[Math.PI / 2, 0, 0]} ink={0.002} cast={false} /><B p={[0, 0.014, 0.043]} s={[0.006, 0.014, 0.004]} c={C.deep} basic cast={false} /></group>)}
      {[-0.12, 0.12].map((x) => <Cy key={x} p={[x, -0.006, 0]} r={0.016} h={0.014} c={C.deep} cast={false} />)}
      {/* top carry handle (arc of tube) and a telescopic antenna folded at the back left */}
      <mesh position={[0, RADIO_H, 0]} rotation={[0, 0, 0]}><torusGeometry args={[0.075, 0.011, 6, 14, Math.PI]} /><primitive object={tm(C.goldD)} attach="material" /></mesh>
      <Cy p={[-0.12, RADIO_H + 0.14, -0.04]} r={0.004} h={0.28} c={C.lav} rot={[0.0, 0, -0.5]} cast={false} /><Sp p={[-0.19, RADIO_H + 0.27, -0.04]} s={[0.011, 0.011, 0.011]} c={C.gold} cast={false} />
      {level > 0 && <SoundRings t={t} />}
    </group>
  );
};
/** 3D sound-wave pulses: expanding torus rings (cream / orange HDR, additive) leaving the speaker front; each lives 1 s, 5 in the air. Static: they jitter a little. */
export const SoundRings: React.FC<{t: number; n?: number; far?: number}> = ({t, n = 5, far = 2.4}) => {
  const mats = useMemo(() => [hdr('cream'), hdr('orange')], []);
  return (<group position={[-0.02, 0.1, 0.07]}>{Array.from({length: n}, (_, i) => { const u = (((t * 1.5 + i / n) % 1) + 1) % 1, s = 0.12 + u * far, j = 1 + 0.06 * Math.sin(t * 90 + i * 3); return <mesh key={i} position={[0, 0, u * far * 0.35]} scale={[s * j, s * 0.85 / j, s]} material={mats[i % 2]} visible={u < 0.96}><torusGeometry args={[1, 0.018 * (1 - u * 0.6) + 0.004, 5, 28]} /></mesh>; })}</group>);
};
/** World position of a radio grip anchor for a radio at p with yaw ry. */
export const radioGrip = (p: V3, ry: number, which: keyof typeof RADIO_GRIPS): V3 => { const g = RADIO_GRIPS[which], c = Math.cos(ry), s = Math.sin(ry); return [p[0] + g[0] * c + g[2] * s, p[1] + g[1], p[2] - g[0] * s + g[2] * c]; };

// ================================================================= the heavy DOOR (hero): frame with thickness, steel leaf with panels + studs, wheel handle, hinges. Origin = floor centre of the opening; hinge on the left (-x).
export const DOOR = {w: 1.9, h: 2.9, t: 0.24, hinge: 0.18}; // hinge = gap between the hinge axis and the leaf edge (keeps the open leaf out of the jamb)
export const doorHandle = (p: V3, ry: number, ang: number): V3 => { // world position of the handle grip for the leaf opened by `ang` rad about the left hinge
  const hx = -DOOR.w / 2, lx = DOOR.w - 0.34, c = Math.cos(ang), s = Math.sin(ang), x = hx + lx * c, z = -lx * s * 1 + 0.16; const cy = Math.cos(ry), sy = Math.sin(ry); return [p[0] + x * cy + z * sy, p[1] + 0.62, p[2] - x * sy + z * cy];
};
export const Door: React.FC<{p: V3; ry?: number; ang?: number; scale?: number}> = ({p, ry = 0, ang = 0, scale = 1}) => {
  const studs = useMemo(() => { const m = new THREE.InstancedMesh(shared('foco-stud', () => new THREE.SphereGeometry(0.03, 6, 5)), tm(C.goldD), 40), o = new THREE.Object3D(); let k = 0; for (const x of [0.5, 1.6]) for (let j = 0; j < 8; j++) { o.position.set(x - DOOR.w / 2, 0.35 + j * 0.3, 0.145); o.updateMatrix(); m.setMatrixAt(k++, o.matrix); } for (const y of [0.3, 2.62]) for (let i = 0; i < 6; i++) { o.position.set(0.55 + i * 0.16 - DOOR.w / 2, y, 0.145); o.updateMatrix(); m.setMatrixAt(k++, o.matrix); } m.count = k; m.frustumCulled = false; return m; }, []);
  const hx = -DOOR.w / 2;
  return (
    <group position={p} rotation={[0, ry, 0]} scale={scale}>
      {/* frame: two jambs + lintel + threshold, thick enough to hide the wall gap (door never passes through the frame: the leaf sits 4 cm inside the reveal) */}
      <B p={[hx - 0.12, DOOR.h / 2, 0]} s={[0.24, DOOR.h + 0.2, DOOR.t + 0.3]} c={C.trim} ink={0.008} /><B p={[-hx + 0.12, DOOR.h / 2, 0]} s={[0.24, DOOR.h + 0.2, DOOR.t + 0.3]} c={C.trim} ink={0.008} /><B p={[0, DOOR.h + 0.1, 0]} s={[DOOR.w + 0.48, 0.24, DOOR.t + 0.3]} c={C.trim} ink={0.008} /><B p={[0, 0.02, 0]} s={[DOOR.w, 0.04, DOOR.t + 0.2]} c={C.violet} cast={false} />
      <group position={[hx, 0, 0]} rotation={[0, -ang, 0]}>
        <group position={[-hx, 0, 0]}>
          <B p={[0, DOOR.h / 2 + 0.03, 0]} s={[DOOR.w - 0.36, DOOR.h - 0.14, 0.12]} c={C.violet} ink={0.006} />
          {[0.75, 2.15].map((y) => <B key={y} p={[0, y, 0.07]} s={[DOOR.w - 0.5, 0.9, 0.04]} c={C.wall3} cast={false} />)}
          <B p={[0, 1.45, 0.075]} s={[DOOR.w - 0.1, 0.08, 0.05]} c={C.orangeD} cast={false} />
          <primitive object={studs} />
          {/* wheel handle: hub, spokes, rim, plus a lever bar (the grip anchor sits on the rim) */}
          <group position={[DOOR.w / 2 - 0.34, 0.62, 0.16]}><Cy p={[0, 0, 0]} r={0.05} h={0.1} c={C.goldD} rot={[Math.PI / 2, 0, 0]} ink={0.003} /><mesh><torusGeometry args={[0.13, 0.018, 6, 18]} /><primitive object={tm(C.gold)} attach="material" /></mesh>{[0, 1, 2].map((i) => <B key={i} p={[0, 0, 0]} s={[0.26, 0.016, 0.016]} c={C.gold} rot={[0, 0, (i * Math.PI) / 3]} cast={false} />)}</group>
          {[0.35, 1.45, 2.55].map((y) => <Cy key={y} p={[-DOOR.w / 2 + 0.04, y, 0.0]} r={0.05} h={0.22} c={C.goldD} ink={0.003} cast={false} />)}
        </group>
      </group>
    </group>
  );
};

// ================================================================= giant SPRINKLERS (on the roof ring) + the RAIN CURTAIN
export const SPR = {n: 12, R: 17.3, y: 22.9, k: 1.8, top: 4.2};
export const sprinklerPos = (i: number): V3 => { const a = (i / SPR.n) * Math.PI * 2; return [Math.cos(a) * SPR.R, SPR.y, Math.sin(a) * SPR.R]; };
export const Sprinklers: React.FC<{y0?: number; spin?: number}> = ({y0 = 0, spin = 0}) => {
  const mesh = useMemo(() => {
    // one merged head: riser pipe, elbow, dome body, two arms with nozzle cones (the arms turn with `spin`: separate group below)
    return null;
  }, []);
  void mesh;
  return (
    <group position={[0, y0, 0]}>
      {Array.from({length: SPR.n}, (_, i) => { const a = (i / SPR.n) * Math.PI * 2, p = sprinklerPos(i); return (
        <group key={i} position={[p[0], SPR.y - 0.9, p[2]]} scale={SPR.k} rotation={[0, -a + Math.PI / 2, 0]}>
          <Cy p={[0, 0.9, 0]} r={0.34} h={1.8} c={C.goldD} ink={0.015} /><Cy p={[0, 0.25, 0]} r={0.5} h={0.5} c={C.orangeD} ink={0.015} cast={false} />
          <Sp p={[0, 2.0, 0]} s={[0.62, 0.52, 0.62]} c={C.orange} ink={0.02} />
          <group position={[0, 2.25, 0]} rotation={[0, spin + i, 0]}>
            <Cy p={[0, 0.05, 0]} r={0.16} h={0.36} c={C.goldD} ink={0.01} cast={false} />
            {[1, -1].map((s) => <group key={s} rotation={[0, s > 0 ? 0 : Math.PI, 0]}><B p={[0.55, 0.2, 0]} s={[1.1, 0.16, 0.16]} c={C.gold} ink={0.008} cast={false} /><Cy p={[1.15, 0.2, 0]} r={0.2} h={0.22} c={C.orangeD} rot={[0, 0, Math.PI / 2 - 0.5]} ink={0.008} cast={false} /></group>)}
          </group>
        </group>); })}
    </group>
  );
};
const RAIN_VS = `
uniform float uT; uniform float uOn; attribute vec4 aO; attribute vec4 aV; varying float vA; varying float vH;
void main(){
  float life = aV.w; float t = mod(uT + aO.w * life, life);
  vec3 g = vec3(0.0, -9.0, 0.0); vec3 p0 = aO.xyz + aV.xyz * t + 0.5 * g * t * t; vec3 vel = aV.xyz + g * t;
  vec4 vp = viewMatrix * vec4(p0, 1.0); vec3 vv = mat3(viewMatrix) * normalize(vel) * (0.9 + 0.01 * length(vel)) * position.y * 1.0;
  vec3 side = normalize(cross(vv, vp.xyz)) * position.x * 0.2;
  vec4 mv = vec4(vp.xyz - vv + side, 1.0);
  vA = (1.0 - position.y * 0.0) * uOn * smoothstep(0.0, 0.06 * life, t) * (1.0 - smoothstep(0.9 * life, life, t));
  vH = clamp(p0.y / 24.0, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}`;
const RAIN_FS = `uniform vec3 uHi; uniform vec3 uLo; varying float vA; varying float vH; void main(){ gl_FragColor = vec4(mix(uLo, uHi, vH) * 1.7, 0.7 * vA); }`;
export const RainCurtain: React.FC<{t: number; on: number; cx?: number; cz?: number; y0?: number}> = ({t, on, cx = 0, cz = 0, y0 = 0}) => {
  const R_ = useMemo(() => {
    const uT = {value: 0}, uOn = {value: 0}, N = 2400, M = SPR.n * 90, q = new THREE.PlaneGeometry(1, 1); q.translate(0, -0.5, 0); q.scale(1, 2.2, 1);
    const geo = new THREE.InstancedBufferGeometry(); geo.index = q.index; geo.setAttribute('position', q.getAttribute('position')); geo.setAttribute('uv', q.getAttribute('uv')); geo.instanceCount = N + M;
    const O = new Float32Array((N + M) * 4), V = new Float32Array((N + M) * 4);
    for (let i = 0; i < N; i++) { const a = hash(i, 1) * Math.PI * 2, r = 19.0 + hash(i, 2) * 1.6; O.set([Math.cos(a) * r, SPR.y + 0.5, Math.sin(a) * r, hash(i, 3)], i * 4); V.set([Math.cos(a) * 0.5, -14 - hash(i, 4) * 4, Math.sin(a) * 0.5, 1.75], i * 4); } // the curtain: streaks falling from the roof edge to the street
    for (let k = 0; k < M; k++) { const i = N + k, s = Math.floor(k / 90), p = sprinklerPos(s), a = (s / SPR.n) * Math.PI * 2, sp = 7 + hash(i, 5) * 4, el = 0.15 + hash(i, 6) * 0.5, ja = (hash(i, 7) - 0.5) * 0.6; O.set([p[0] + 0.9 * Math.cos(a), SPR.y + SPR.top, p[2] + 0.9 * Math.sin(a), hash(i, 8)], i * 4); V.set([Math.cos(a + ja) * sp * Math.cos(el), sp * Math.sin(el) + 1, Math.sin(a + ja) * sp * Math.cos(el), 2.4], i * 4); } // sprinkler arcs reaching the street
    geo.setAttribute('aO', new THREE.InstancedBufferAttribute(O, 4)); geo.setAttribute('aV', new THREE.InstancedBufferAttribute(V, 4));
    const mat = new THREE.ShaderMaterial({uniforms: {uT, uOn, uHi: {value: new THREE.Color(C.cream)}, uLo: {value: new THREE.Color(C.lav)}}, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide});
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 30;
    const veilTex = makeTex(256, 64, (c, w, h) => { for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,241,214,${0.15 + hash(i, 2) * 0.5})`; c.fillRect(hash(i, 1) * w, 0, 1 + hash(i, 3) * 3, h); } const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-in'; c.fillStyle = g; c.fillRect(0, 0, w, h); }); veilTex.wrapS = THREE.RepeatWrapping; veilTex.repeat.set(14, 1); const veil = new THREE.MeshBasicMaterial({map: veilTex, color: C.gold, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false}), mistTex = makeTex(128, 128, radialTex), mist = addSprite(mistTex, C.lav, 0.22), warm = addSprite(mistTex, C.orange, 0.18);
    return {uT, uOn, mesh, mist, warm, veil};
  }, []);
  R_.uT.value = t; R_.uOn.value = on; R_.veil.opacity = 0.34 * on; (R_.veil.map as THREE.Texture).offset.y = 0;
  return (
    <group position={[cx, y0, cz]}>
      <primitive object={R_.mesh} />
      <mesh position={[0, 11.2, 0]} material={R_.veil}><cylinderGeometry args={[19.9, 20.4, 22.4, 64, 1, true]} /></mesh>
      {on > 0.02 && Array.from({length: 22}, (_, i) => { const a = (i / 22) * Math.PI * 2, r = 19 + 2 * hash(i, 5); return <sprite key={i} position={[Math.cos(a) * r, 2.0 + hash(i, 6) * 2, Math.sin(a) * r]} scale={[9, 5, 1]} material={i % 3 ? R_.mist : R_.warm} />; })}
      {on > 0.02 && <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[18.5, 28, 40]} /><meshBasicMaterial color={C.violet} transparent opacity={0.4 * on} depthWrite={false} fog={false} /></mesh>}
    </group>
  );
};

// ================================================================= FX: glass burst, sparks, dust, floating dust motes (all instanced, time driven)
/** Shards flying out of a window (3D triangles, spin + gravity). t0 = start second, n shards. */
export const GlassBurst: React.FC<{p: V3; dir: [number, number]; t: number; t0: number; n?: number; seed?: number}> = ({p, dir, t, t0, n = 70, seed = 1}) => {
  const m = useMemo(() => { const g = new THREE.TetrahedronGeometry(0.12, 0), mm = new THREE.InstancedMesh(g, shared('foco-shard', () => new THREE.MeshToonMaterial({color: C.lav, gradientMap: RAMP})), n); mm.frustumCulled = false; return {mm, o: new THREE.Object3D()}; }, [n]);
  const u = Math.max(0, t - t0);
  for (let i = 0; i < n; i++) { const sp = 2.5 + hash(i, seed) * 5.5, a = Math.atan2(dir[0], dir[1]) + (hash(i, seed + 1) - 0.5) * 1.5, vy = 1 + hash(i, seed + 2) * 4, s = 0.4 + hash(i, seed + 3) * 1.1; m.o.position.set(p[0] + Math.sin(a) * sp * u, Math.max(0.04, p[1] + vy * u - 4.9 * u * u), p[2] + Math.cos(a) * sp * u); m.o.rotation.set(u * (3 + i % 5), u * (2 + i % 3), u * 4); m.o.scale.setScalar(u > 0 ? s * (1 - 0.3 * Math.min(1, u / 1.8)) : 0.001); m.o.updateMatrix(); m.mm.setMatrixAt(i, m.o.matrix); }
  m.mm.instanceMatrix.needsUpdate = true;
  return <group userData={{noClutter: true}}><primitive object={m.mm} /></group>;
};
/** Sparks thrown by scraping claws: short HDR streaks with gravity, restarting every `period` seconds while `on`. */
export const Sparks: React.FC<{p: V3; dir: [number, number]; t: number; on: number; n?: number; period?: number}> = ({p, dir, t, on, n = 90, period = 0.5}) => {
  const m = useMemo(() => { const mm = new THREE.InstancedMesh(shared('foco-spark', () => new THREE.BoxGeometry(0.008, 0.008, 0.08)), shared('foco-spark-m', () => new THREE.MeshBasicMaterial({color: new THREE.Color(2.0, 0.95, 0.3), toneMapped: false, fog: false})), n); mm.frustumCulled = false; return {mm, o: new THREE.Object3D()}; }, [n]);
  for (let i = 0; i < n; i++) { const ph = (((t / period) + hash(i, 4)) % 1 + 1) % 1, a = Math.atan2(dir[0], dir[1]) + (hash(i, 5) - 0.5) * 1.1, sp = 1.5 + hash(i, 6) * 3.2, u = ph * 0.55; m.o.position.set(p[0] + Math.sin(a) * sp * u, p[1] + (1.6 + hash(i, 7) * 2) * u - 4.9 * u * u, p[2] + Math.cos(a) * sp * u); m.o.lookAt(m.o.position.x + Math.sin(a), m.o.position.y + 0.4 - 3 * u, m.o.position.z + Math.cos(a)); m.o.scale.setScalar(on * (1 - ph) * (0.6 + hash(i, 8))); m.o.updateMatrix(); m.mm.setMatrixAt(i, m.o.matrix); }
  m.mm.instanceMatrix.needsUpdate = true;
  return <group userData={{noClutter: true}}><primitive object={m.mm} /></group>;
};
/** Soft dust / debris cloud made of billboards that grow and drift (lavender with a warm core). k = 0..1 strength. */
export const DustCloud: React.FC<{p: V3; t: number; k: number; r?: number; n?: number}> = ({p, t, k, r = 3, n = 26}) => {
  const {a, b} = useMemo(() => { const tx = makeTex(128, 128, radialTex); return {a: addSprite(tx, C.lav, 0.1), b: addSprite(tx, C.orange, 0.08)}; }, []);
  return (<group position={p}>{Array.from({length: n}, (_, i) => { const u = (hash(i, 1) * 2 - 1), v = hash(i, 2), w = (hash(i, 3) * 2 - 1), s = r * (0.5 + hash(i, 4)) * (0.4 + 0.8 * k); return <sprite key={i} position={[u * r * k + Math.sin(t * 0.8 + i) * 0.3, v * r * 0.7 * k, w * r * k]} scale={[s, s * 0.8, 1]} material={i % 4 === 0 ? b : a} visible={k > 0.02} />; })}</group>);
};
/** Floating dust motes (gold, additive) around a point: positions rewritten in place from the frame count. */
export const Motes: React.FC<{c: V3; ext?: V3; n?: number; f: number}> = ({c, ext = [14, 6, 14], n = 110, f}) => {
  const {pts, base} = useMemo(() => { const tx = makeTex(32, 32, (cx, w, h) => { const g = cx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,230,170,1)'); g.addColorStop(1, 'rgba(255,230,170,0)'); cx.fillStyle = g; cx.fillRect(0, 0, w, h); }); const base = new Float32Array(n * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const pts = new THREE.Points(geo, new THREE.PointsMaterial({map: tx, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: C.gold, fog: false})); pts.frustumCulled = false; for (let i = 0; i < n; i++) base.set([(hash(i, 1) - 0.5) * 2, hash(i, 2), (hash(i, 3) - 0.5) * 2], i * 3); return {pts, base}; }, [n]);
  const arr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < n; i++) { arr.array[i * 3] = c[0] + base[i * 3] * ext[0] + 0.3 * Math.sin(f * 0.02 + i); arr.array[i * 3 + 1] = c[1] + base[i * 3 + 1] * ext[1] + 0.2 * Math.sin(f * 0.015 + i * 1.7); arr.array[i * 3 + 2] = c[2] + base[i * 3 + 2] * ext[2] + 0.3 * Math.cos(f * 0.013 + i * 0.6); }
  arr.needsUpdate = true;
  return <primitive object={pts} />;
};
