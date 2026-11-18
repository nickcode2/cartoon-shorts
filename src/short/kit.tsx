import React, {createContext, useContext, useLayoutEffect, useMemo} from 'react';
import {useDelayRender} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {CARD_H, CARD_W, METERS_PER_PX, SOLE_Y} from '../guard';
import {Post} from '../Painterly';
import {PO, drawPerson} from './people';

export type V3 = [number, number, number];
export const INK = '#120a14';

// ---- 3-tone toon ramp (same as GuardTest)
export const RAMP = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

// brushy shadow edges (same patch as GuardTest, guarded against double patching)
if (!THREE.ShaderChunk.shadowmap_pars_fragment.includes('brushOffset')) {
  const NOISE = `
float sh_h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float sh_n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(sh_h(i),sh_h(i+vec2(1.0,0.0)),f.x), mix(sh_h(i+vec2(0.0,1.0)),sh_h(i+vec2(1.0,1.0)),f.x), f.y); }
vec2 brushOffset(vec2 uv){
  return vec2(sh_n(uv*70.0)-0.5 + 0.5*(sh_n(uv*190.0)-0.5), sh_n(uv*70.0+17.0)-0.5 + 0.5*(sh_n(uv*190.0+9.0)-0.5)) * 0.005;
}
`;
  THREE.ShaderChunk.shadowmap_pars_fragment =
    NOISE +
    THREE.ShaderChunk.shadowmap_pars_fragment.split('shadowCoord.xyz /= shadowCoord.w;').join(
      'shadowCoord.xyz /= shadowCoord.w;\n shadowCoord.xy += brushOffset(shadowCoord.xy);',
    );
}

// ---- math
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const hash = (i: number, j = 0) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---- camera
export interface Pose {
  p: V3;
  l: V3;
  fov?: number;
  roll?: number;
}
export type CamFn = (u: number, t: number) => Pose;
export const move = (a: Pose, b: Pose, ease: (x: number) => number = smooth): CamFn => (u) => {
  const e = ease(u);
  return {
    p: lerp3(a.p, b.p, e),
    l: lerp3(a.l, b.l, e),
    fov: lerp(a.fov ?? 60, b.fov ?? 60, e),
    roll: lerp(a.roll ?? 0, b.roll ?? 0, e),
  };
};
// linear creeping push (never static)
export const lin = (x: number) => clamp01(x);

const CamCtx = createContext<THREE.Vector3>(new THREE.Vector3(0, 1, 5));
export const useCamPos = () => useContext(CamCtx);

const Rig: React.FC<{pose: Pose}> = ({pose}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...pose.p);
  camera.up.set(0, 1, 0);
  camera.lookAt(...pose.l);
  if (pose.roll) camera.rotateZ((pose.roll * Math.PI) / 180);
  camera.fov = pose.fov ?? 60;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return null;
};

// ---- lights
export type LightMode = 'day' | 'dusk' | 'night' | 'indoor' | 'dark';
const LIGHTS: Record<LightMode, {amb: [string, number]; sun: [string, number, V3]; bg: string}> = {
  day: {amb: ['#7fa8ff', 0.95], sun: ['#ffd9a0', 3.0, [-5, 7, 5]], bg: '#9fd6f5'},
  dusk: {amb: ['#9a8be0', 0.85], sun: ['#ff9d5c', 2.3, [-8, 3.2, 3]], bg: '#6a5aa8'},
  night: {amb: ['#4f62c8', 0.8], sun: ['#9fb8ff', 1.1, [-6, 9, 4]], bg: '#101a3e'},
  indoor: {amb: ['#ffe2c0', 1.0], sun: ['#fff0d8', 1.2, [-3, 6, 4]], bg: '#e8d4b8'},
  dark: {amb: ['#2b3a78', 0.55], sun: ['#7f9cff', 0.35, [-3, 6, 4]], bg: '#080c1c'},
};

// Holds the frame capture until the scene has been drawn: invalidate, then clear after two animation frames
// (with a timer fallback, because the web renderer may not run the R3F render loop or throttle rAF).
const DrawGate: React.FC<{frame: number}> = ({frame}) => {
  const {delayRender, continueRender} = useDelayRender();
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const h = delayRender(`three scene drawn (frame ${frame})`, {timeoutInMilliseconds: 10000});
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      continueRender(h);
    };
    invalidate();
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      invalidate();
      r2 = requestAnimationFrame(finish);
    });
    const timer = window.setTimeout(finish, 250);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      window.clearTimeout(timer);
      finish();
    };
  }, [frame]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

export const Stage: React.FC<{
  frame: number;
  pose: Pose;
  light: LightMode;
  ambBoost?: number;
  children: React.ReactNode;
}> = ({frame, pose, light, ambBoost = 1, children}) => {
  const L = LIGHTS[light];
  const camPos = useMemo(() => new THREE.Vector3(), []);
  camPos.set(...pose.p);
  return (
    <ThreeCanvas
      width={1080}
      height={1920}
      shadows="soft"
      flat
      camera={{fov: 60, near: 0.05, far: 400, position: [0, 1.4, 6]}}
      style={{width: 1080, height: 1920}}
    >
      <color attach="background" args={[L.bg]} />
      <ambientLight color={L.amb[0]} intensity={L.amb[1] * ambBoost} />
      <directionalLight
        color={L.sun[0]}
        intensity={L.sun[1]}
        position={L.sun[2]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <Rig pose={pose} />
      <CamCtx.Provider value={camPos}>{children}</CamCtx.Provider>
      <Post frame={frame} />
      <DrawGate frame={frame} />
    </ThreeCanvas>
  );
};

// ---- primitives
export const Box: React.FC<{s: V3; p: V3; c: string; rot?: V3; ink?: number; cast?: boolean; recv?: boolean; basic?: boolean; map?: THREE.Texture}> = ({
  s, p, c, rot, ink = 0.03, cast = true, recv = true, basic, map,
}) => (
  <group position={p} rotation={rot ?? [0, 0, 0]}>
    <mesh castShadow={cast} receiveShadow={recv}>
      <boxGeometry args={s} />
      {basic ? <meshBasicMaterial color={c} map={map} toneMapped={false} /> : <meshToonMaterial gradientMap={RAMP} color={c} map={map} />}
    </mesh>
    {ink > 0 && (
      <mesh scale={[1 + (ink / s[0]) * 2, 1 + (ink / s[1]) * 2, 1 + (ink / s[2]) * 2]}>
        <boxGeometry args={s} />
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
    )}
  </group>
);

export const Cyl: React.FC<{r: number; h: number; p: V3; c: string; r2?: number; rot?: V3; ink?: number; seg?: number; cast?: boolean; basic?: boolean}> = ({
  r, h, p, c, r2, rot, ink = 0.025, seg = 20, cast = true, basic,
}) => (
  <group position={p} rotation={rot ?? [0, 0, 0]}>
    <mesh castShadow={cast} receiveShadow>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
      {basic ? <meshBasicMaterial color={c} toneMapped={false} /> : <meshToonMaterial gradientMap={RAMP} color={c} />}
    </mesh>
    {ink > 0 && (
      <mesh scale={[1 + ink / r, 1 + ink / h, 1 + ink / r]}>
        <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
    )}
  </group>
);

export const Ball: React.FC<{r: number; p: V3; c: string; ink?: number; basic?: boolean; scale?: V3}> = ({r, p, c, ink = 0.025, basic, scale}) => (
  <group position={p} scale={scale ?? [1, 1, 1]}>
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[r, 20, 14]} />
      {basic ? <meshBasicMaterial color={c} toneMapped={false} /> : <meshToonMaterial gradientMap={RAMP} color={c} />}
    </mesh>
    {ink > 0 && (
      <mesh scale={1 + ink / r}>
        <sphereGeometry args={[r, 20, 14]} />
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
    )}
  </group>
);

export const Plane: React.FC<{w: number; h: number; p: V3; c?: string; rot?: V3; map?: THREE.Texture; basic?: boolean; recv?: boolean; opacity?: number; cast?: boolean; side?: THREE.Side}> = ({
  w, h, p, c, rot, map, basic, recv = true, opacity, cast, side,
}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} receiveShadow={recv} castShadow={cast}>
    <planeGeometry args={[w, h]} />
    {basic || opacity !== undefined ? (
      <meshBasicMaterial color={c ?? '#ffffff'} map={map} toneMapped={false} transparent={opacity !== undefined} opacity={opacity ?? 1} side={side ?? THREE.FrontSide} depthWrite={opacity === undefined} />
    ) : (
      <meshToonMaterial gradientMap={RAMP} color={c ?? '#ffffff'} map={map} side={side ?? THREE.FrontSide} />
    )}
  </mesh>
);

export const Floor: React.FC<{w: number; d: number; y?: number; c: string; p?: [number, number]; map?: THREE.Texture}> = ({w, d, y = 0, c, p = [0, 0], map}) => (
  <Plane w={w} h={d} p={[p[0], y, p[1]]} rot={[-Math.PI / 2, 0, 0]} c={c} map={map} />
);

// ---- canvas textures
export function makeTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
  }
  return tex;
}
export const useTex = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]) =>
  useMemo(() => makeTex(w, h, draw, repeat), [key, w, h]); // eslint-disable-line react-hooks/exhaustive-deps

// animated canvas plane (redrawn every frame)
export const LiveTex: React.FC<{w: number; h: number; size: [number, number]; p: V3; rot?: V3; draw: (c: CanvasRenderingContext2D) => void; basic?: boolean}> = ({w, h, size, p, rot, draw, basic = true}) => {
  const {canvas, tex} = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return {canvas, tex};
  }, [w, h]);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  draw(ctx);
  tex.needsUpdate = true;
  return (
    <mesh position={p} rotation={rot ?? [0, 0, 0]}>
      <planeGeometry args={size} />
      {basic ? <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} side={THREE.DoubleSide} /> : <meshToonMaterial gradientMap={RAMP} map={tex} transparent side={THREE.DoubleSide} />}
    </mesh>
  );
};

// ---- character billboard (2D card, real shadow via alphaTest caster, like GuardTest)
export const Person: React.FC<{po: PO; p: V3; s?: number; flip?: boolean; yawK?: number; fixedYaw?: number}> = ({po, p, s = 0.84, flip, yawK = 0.8, fixedYaw}) => {
  const camPos = useCamPos();
  const {canvas, tex} = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W * 2;
    canvas.height = CARD_H * 2;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return {canvas, tex};
  }, []);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  drawPerson(ctx, po);
  tex.needsUpdate = true;
  const w = CARD_W * METERS_PER_PX * s, h = CARD_H * METERS_PER_PX * s;
  const cy = h / 2 - (CARD_H - SOLE_Y) * METERS_PER_PX * s;
  const yaw = fixedYaw ?? yawK * Math.atan2(camPos.x - p[0], camPos.z - p[2]);
  return (
    <group position={p}>
      <group rotation={[0, yaw, 0]} scale={[flip ? -1 : 1, 1, 1]}>
        <mesh position={[0, cy, 0]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.02} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, cy, 0]} castShadow>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} alphaTest={0.5} colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};

// ---- gradient sky dome
export const Sky: React.FC<{top: string; bottom: string; r?: number; stars?: boolean}> = ({top, bottom, r = 150, stars}) => {
  const tex = useTex(`sky${top}${bottom}${stars}`, 8, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(0.55, bottom);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const starTex = useTex('stars', 1024, 512, (c, w, h) => {
    for (let i = 0; i < 260; i++) {
      c.fillStyle = `rgba(255,255,255,${0.4 + hash(i, 3) * 0.6})`;
      c.beginPath();
      c.arc(hash(i, 1) * w, hash(i, 2) * h * 0.55, 1 + hash(i, 4) * 1.6, 0, 7);
      c.fill();
    }
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[r, 24, 16]} />
        <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} depthWrite={false} />
      </mesh>
      {stars && (
        <mesh>
          <sphereGeometry args={[r - 1, 24, 16]} />
          <meshBasicMaterial map={starTex} side={THREE.BackSide} toneMapped={false} transparent depthWrite={false} />
        </mesh>
      )}
    </group>
  );
};

// ---- vehicles (ink-hull boxes). Faces +x.
export const Vehicle: React.FC<{p: V3; kind: 'ambulance' | 'fire' | 'car'; t: number; lightsOn?: boolean; yaw?: number; doorOpen?: number; body?: string}> = ({
  p, kind, t, lightsOn = true, yaw = 0, doorOpen = 0, body,
}) => {
  const flash = Math.floor(t * 6) % 2 === 0;
  const col = body ?? (kind === 'ambulance' ? '#f6f6f2' : kind === 'fire' ? '#d8352f' : '#3f8fd4');
  const long = kind === 'fire' ? 5.2 : kind === 'ambulance' ? 3.8 : 3.4;
  const hgt = kind === 'car' ? 0.75 : 1.35;
  const wheels: number[] = kind === 'fire' ? [-1.7, 0.2, 1.6] : [-long * 0.32, long * 0.32];
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      {kind === 'car' ? (
        <>
          <Box s={[long, 0.62, 1.55]} p={[0, 0.62, 0]} c={col} />
          <Box s={[long * 0.5, 0.5, 1.4]} p={[-long * 0.05, 1.12, 0]} c="#bfe6f7" />
          <Box s={[0.5, 0.08, 1.55]} p={[long * 0.5 - 0.1, 0.78, 0]} c="#ffe08a" ink={0} />
          {/* driver door */}
          <group position={[0.1, 0.62, 0.8]} rotation={[0, -doorOpen, 0]}>
            <Box s={[1.0, 0.56, 0.05]} p={[-0.5, 0, 0]} c="#2f6fae" ink={0.015} />
          </group>
        </>
      ) : (
        <>
          <Box s={[long * 0.66, hgt, 1.7]} p={[-long * 0.17, 0.5 + hgt / 2, 0]} c={col} />
          <Box s={[long * 0.3, hgt * 0.78, 1.7]} p={[long * 0.36, 0.5 + hgt * 0.39, 0]} c={col} />
          <Box s={[long * 0.2, hgt * 0.4, 1.6]} p={[long * 0.42, 0.5 + hgt * 0.62, 0]} c="#bfe6f7" ink={0.015} />
          <Box s={[long * 0.66, 0.2, 1.74]} p={[-long * 0.17, 0.95, 0]} c={kind === 'fire' ? '#f5d142' : '#e5333c'} ink={0.015} />
          <Box s={[0.5, 0.18, 1.5]} p={[long * 0.1, 0.5 + hgt + 0.1, 0]} c="#333" ink={0.01} />
          <Box s={[0.22, 0.2, 0.5]} p={[long * 0.1, 0.5 + hgt + 0.28, -0.4]} c={lightsOn && flash ? '#ff2b2b' : '#661111'} basic ink={0} />
          <Box s={[0.22, 0.2, 0.5]} p={[long * 0.1, 0.5 + hgt + 0.28, 0.4]} c={lightsOn && !flash ? '#3d7bff' : '#142255'} basic ink={0} />
          {kind === 'fire' && (
            <>
              <Box s={[long * 0.6, 0.12, 0.2]} p={[-long * 0.2, 0.5 + hgt + 0.15, 0]} c="#e8e8e8" ink={0.01} />
            </>
          )}
        </>
      )}
      {wheels.map((x) => (
        <Cyl key={x} r={0.38} h={0.24} p={[x, 0.38, 0.88]} c="#1c1d24" rot={[Math.PI / 2, 0, 0]} ink={0.02} cast={false} />
      ))}
      {wheels.map((x) => (
        <Cyl key={x + 'b'} r={0.38} h={0.24} p={[x, 0.38, -0.88]} c="#1c1d24" rot={[Math.PI / 2, 0, 0]} ink={0.02} cast={false} />
      ))}
      {lightsOn && kind !== 'car' && (
        <pointLight position={[long * 0.1, 2.2, 0]} color={flash ? '#ff3030' : '#3b6cff'} intensity={4} distance={9} decay={2} />
      )}
    </group>
  );
};
