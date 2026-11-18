import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {
  CARD_H,
  CARD_W,
  METERS_PER_PX,
  ROLLER_OFFSET_X,
  SOLE_Y,
  drawGuard,
  guardZ,
  rollerY,
} from './guard';
import {Post} from './Painterly';

export const FPS = 30;
export const DURATION = 150; // 5 s

const WALL_X = 2.0;
const INK = '#120a14';
const PINK = '#ff6fb0';

// ---- 3-tone toon ramp
const RAMP = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

// ---- brushy shadow edges: wobble the shadow-map lookup with layered noise
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

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- camera: low angle looking up, wide lens, slow push-in then gentle orbit
function camPose(frame: number) {
  const t = frame / FPS;
  const pivot = new THREE.Vector3(1.3, 1.35, guardZ(t));
  const push = smooth(frame / 85);
  const orbit = smooth((frame - 70) / 80);
  const dist = lerp(5.0, 3.1, push) - 0.2 * (frame / DURATION);
  const az = ((lerp(8, 14, push) + 44 * orbit) * Math.PI) / 180;
  const h = lerp(0.35, 0.55, push);
  const pos = new THREE.Vector3(
    pivot.x - dist * Math.sin(az),
    h,
    pivot.z + dist * Math.cos(az),
  );
  return {pos, pivot};
}

const Rig: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera);
  const {pos, pivot} = camPose(frame);
  camera.position.copy(pos);
  camera.lookAt(pivot);
  camera.updateMatrixWorld();
  return null;
};

// ---- brick textures (256 px per metre, bricks 0.5 m x 0.25 m, dark ink mortar)
const BRICK_W = 128, BRICK_H = 64;
const hash = (i: number, j: number) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function brickBase(ctx: CanvasRenderingContext2D, w: number, h: number, upper: string, lower: string, splitY: number) {
  const rows = Math.ceil(h / BRICK_H), cols = Math.ceil(w / BRICK_W) + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * BRICK_W - (r % 2) * BRICK_W * 0.5;
      const y = r * BRICK_H;
      ctx.fillStyle = y + BRICK_H / 2 > splitY ? upper : lower;
      ctx.fillRect(x, y, BRICK_W, BRICK_H);
      const v = hash(c, r);
      ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.22})` : `rgba(0,30,60,${(0.5 - v) * 0.22})`;
      ctx.fillRect(x, y, BRICK_W, BRICK_H);
    }
  }
}

function brickLines(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.8) {
  const rows = Math.ceil(h / BRICK_H);
  ctx.strokeStyle = `rgba(18,10,20,${alpha})`;
  ctx.lineWidth = 5;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * BRICK_H); ctx.lineTo(w, r * BRICK_H); ctx.stroke();
  }
  for (let r = 0; r < rows; r++) {
    for (let x = -(r % 2) * BRICK_W * 0.5; x <= w + BRICK_W; x += BRICK_W) {
      ctx.beginPath(); ctx.moveTo(x, r * BRICK_H); ctx.lineTo(x, (r + 1) * BRICK_H); ctx.stroke();
    }
  }
}

const LIGHT_BLUE = '#8fd3f0';
const TEAL = '#25b8c4';

const useCanvasTex = (w: number, h: number) =>
  useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return {canvas, tex};
  }, [w, h]);

const PW = 2304, PH = 768; // painted wall: 9 m x 3 m

const PaintedWall: React.FC<{frame: number}> = ({frame}) => {
  const {canvas, tex} = useCanvasTex(PW, PH);
  const ctx = canvas.getContext('2d')!;
  brickBase(ctx, PW, PH, LIGHT_BLUE, TEAL, PH - 0.95 * 256);
  const now = frame / FPS;
  const px = 256;
  const sw = 0.36 * px, sh = 0.26 * px;
  for (let s = 0; s <= now + 1e-6; s += 1 / 90) {
    const z = guardZ(s);
    const y = rollerY(s);
    ctx.fillStyle = PINK;
    ctx.fillRect((z + 3) * px - sw / 2, PH - y * px - sh / 2, sw, sh);
  }
  const zNow = guardZ(now), yNow = rollerY(now);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect((zNow + 3) * px - 6, PH - yNow * px - sh / 2, 12, sh);
  brickLines(ctx, PW, PH, 0.8); // mortar shows through the paint
  tex.needsUpdate = true;
  return (
    <mesh position={[WALL_X, 1.5, 1.5]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
      <planeGeometry args={[9, 3]} />
      <meshToonMaterial gradientMap={RAMP} map={tex} />
    </mesh>
  );
};

const BrickPlane: React.FC<{size: [number, number]; pos: [number, number, number]; rot: [number, number, number]; upper: string; lower: string}> = ({size, pos, rot, upper, lower}) => {
  const w = size[0] * 256, h = size[1] * 256;
  const {canvas, tex} = useCanvasTex(w, h);
  useMemo(() => {
    const ctx = canvas.getContext('2d')!;
    brickBase(ctx, w, h, upper, lower, h - 0.95 * 256);
    brickLines(ctx, w, h, 0.8);
    tex.needsUpdate = true;
  }, [canvas, tex, w, h, upper, lower]);
  return (
    <mesh position={pos} rotation={rot} receiveShadow>
      <planeGeometry args={size} />
      <meshToonMaterial gradientMap={RAMP} map={tex} />
    </mesh>
  );
};

const Plain: React.FC<{color: string; size: [number, number]; pos: [number, number, number]; rot?: [number, number, number]}> = ({color, size, pos, rot}) => (
  <mesh position={pos} rotation={rot ?? [0, 0, 0]} receiveShadow>
    <planeGeometry args={size} />
    <meshToonMaterial gradientMap={RAMP} color={color} />
  </mesh>
);

// box with inverted-hull ink outline
const InkBox: React.FC<{size: [number, number, number]; pos: [number, number, number]; color: string; cast?: boolean; ink?: number}> = ({size, pos, color, cast, ink = 0.03}) => (
  <group position={pos}>
    <mesh castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <meshToonMaterial gradientMap={RAMP} color={color} />
    </mesh>
    <mesh scale={[1 + (ink / size[0]) * 2, 1 + (ink / size[1]) * 2, 1 + (ink / size[2]) * 2]}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={INK} side={THREE.BackSide} />
    </mesh>
  </group>
);

// cylinder pipe with ink hull; axis 'x' or 'z'
const Pipe: React.FC<{axis: 'x' | 'z'; len: number; r: number; pos: [number, number, number]; color: string}> = ({axis, len, r, pos, color}) => {
  const rot: [number, number, number] = axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2];
  return (
    <group position={pos} rotation={rot}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[r, r, len, 20]} />
        <meshToonMaterial gradientMap={RAMP} color={color} />
      </mesh>
      <mesh scale={[1 + 0.03 / r, 1, 1 + 0.03 / r]}>
        <cylinderGeometry args={[r, r, len, 20]} />
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
    </group>
  );
};

const PlateTex: React.FC = () => {
  const {canvas, tex} = useCanvasTex(256, 96);
  useMemo(() => {
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#f1ead6'; c.fillRect(0, 0, 256, 96);
    c.strokeStyle = '#3a3f4a'; c.lineWidth = 6; c.strokeRect(5, 5, 246, 86);
    c.fillStyle = INK; c.font = 'bold 64px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('C-4', 128, 52);
    tex.needsUpdate = true;
  }, [canvas, tex]);
  return <meshBasicMaterial map={tex} />;
};

const CellDoor: React.FC<{x: number}> = ({x}) => {
  const z = -2.94;
  return (
    <group position={[x, 0, z]}>
      {/* frame + slab */}
      <InkBox size={[1.5, 2.4, 0.1]} pos={[0, 1.2, 0]} color="#2f6fae" />
      <InkBox size={[1.24, 2.26, 0.1]} pos={[0, 1.13, 0.06]} color="#3d86c6" />
      {/* observation window with bars */}
      <InkBox size={[0.56, 0.24, 0.08]} pos={[0, 1.7, 0.12]} color="#102a44" ink={0.025} />
      {[-0.2, -0.1, 0, 0.1, 0.2].map((bx) => (
        <mesh key={bx} position={[bx, 1.7, 0.17]}>
          <boxGeometry args={[0.02, 0.22, 0.02]} />
          <meshBasicMaterial color="#9ec3e0" />
        </mesh>
      ))}
      {/* food slot, handle, kick plate */}
      <InkBox size={[0.46, 0.13, 0.05]} pos={[0.0, 0.95, 0.13]} color="#7fb2dc" ink={0.02} />
      <InkBox size={[0.06, 0.2, 0.08]} pos={[0.46, 1.1, 0.16]} color="#dfe8f0" ink={0.02} />
      <InkBox size={[1.1, 0.3, 0.04]} pos={[0, 0.2, 0.13]} color="#9fd0ec" ink={0.02} />
      {/* number plate */}
      <InkBox size={[0.5, 0.2, 0.03]} pos={[0, 2.62, -0.01]} color="#f1ead6" ink={0.02} />
      <mesh position={[0, 2.62, 0.012]}>
        <planeGeometry args={[0.46, 0.17]} />
        <PlateTex />
      </mesh>
    </group>
  );
};

const CagedLight: React.FC<{pos: [number, number, number]}> = ({pos}) => {
  return (
    <group position={pos}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.06, 16]} />
        <meshToonMaterial gradientMap={RAMP} color="#5a6b82" />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <sphereGeometry args={[0.1, 20, 16]} />
        <meshBasicMaterial color={new THREE.Color(3.2, 2.9, 2.2)} toneMapped={false} />
      </mesh>
      {/* cage: meridian arcs + equator ring */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, -0.12, 0]} rotation={[0, (i * Math.PI) / 4, Math.PI / 2]}>
          <torusGeometry args={[0.15, 0.011, 6, 24]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      ))}
      <mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15, 0.011, 6, 24]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <pointLight position={[0, -0.3, 0]} color="#ffe2a0" intensity={2.5} distance={7} decay={2} />
    </group>
  );
};

const BEAM_Z = [-2.2, -0.5, 1.2, 2.9, 4.6];

const Room: React.FC<{frame: number}> = ({frame}) => (
  <group>
    {/* floor, ceiling */}
    <Plain color="#b7d4e6" size={[7, 9.5]} pos={[-1.5, 0, 1.75]} rot={[-Math.PI / 2, 0, 0]} />
    <Plain color="#2b5f93" size={[7, 9.5]} pos={[-1.5, 3, 1.75]} rot={[Math.PI / 2, 0, 0]} />
    {/* brick walls: back + left */}
    <BrickPlane size={[7, 3]} pos={[-1.5, 1.5, -3]} rot={[0, 0, 0]} upper={LIGHT_BLUE} lower={TEAL} />
    <BrickPlane size={[9.5, 3]} pos={[-5, 1.5, 1.75]} rot={[0, Math.PI / 2, 0]} upper={LIGHT_BLUE} lower={TEAL} />
    {/* drop cloth */}
    <Plain color="#f1ead6" size={[1.3, 6]} pos={[1.35, 0.01, 0.2]} rot={[-Math.PI / 2, 0, 0]} />
    {/* ceiling beams */}
    {BEAM_Z.map((bz) => (
      <InkBox key={bz} size={[7, 0.2, 0.22]} pos={[-1.5, 2.9, bz]} color="#3a82d2" />
    ))}
    {/* pipes: along the painted wall and along the back wall */}
    <Pipe axis="z" len={9} r={0.05} pos={[1.9, 2.55, 1.5]} color="#a9c6e6" />
    <Pipe axis="x" len={7} r={0.05} pos={[-1.5, 2.8, -2.9]} color="#a9c6e6" />
    {[-1.5, 0.8, 3.1, 5.4].map((bz) => (
      <InkBox key={bz} size={[0.04, 0.14, 0.1]} pos={[1.96, 2.55, bz]} color="#5b7ea6" ink={0.015} />
    ))}
    <InkBox size={[0.2, 0.2, 0.08]} pos={[1.95, 2.55, -1.0]} color="#d8e4ee" ink={0.02} />
    {/* door + caged ceiling light */}
    <CellDoor x={-0.7} />
    <CagedLight pos={[0.1, 2.88, -1.4]} />
    {/* paint bucket */}
    <group position={[1.05, 0.16, -1.6]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.17, 0.32, 24]} />
        <meshToonMaterial gradientMap={RAMP} color="#d8dde8" />
      </mesh>
      <mesh scale={1.06}>
        <cylinderGeometry args={[0.2, 0.17, 0.32, 24]} />
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 0.165, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 24]} />
        <meshBasicMaterial color={PINK} />
      </mesh>
    </group>
  </group>
);

// ---- guard billboard card (real shadow via alphaTest)
const Guard: React.FC<{frame: number}> = ({frame}) => {
  const {canvas, tex} = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W * 2; canvas.height = CARD_H * 2;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return {canvas, tex};
  }, []);
  const t = frame / FPS;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  drawGuard(ctx, t);
  tex.needsUpdate = true;

  const x = WALL_X - ROLLER_OFFSET_X - 0.01;
  const z = guardZ(t);
  const {pos} = camPose(frame);
  const yaw = 0.55 * Math.atan2(pos.x - x, pos.z - z);
  const w = CARD_W * METERS_PER_PX, h = CARD_H * METERS_PER_PX;
  const cy = h / 2 - (CARD_H - SOLE_Y) * METERS_PER_PX;
  return (
    <group position={[x, 0, z]}>
      <group rotation={[0, yaw, 0]}>
        {/* visible card (soft edge) */}
        <mesh position={[0, cy, 0]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.02} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        {/* shadow caster: same drawing, alphaTest cuts the shadow to its silhouette */}
        <mesh position={[0, cy, 0]} castShadow>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} alphaTest={0.5} colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};

export const GuardTest: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{width: '100%', height: '100%', background: '#222'}}>
      <ThreeCanvas
        width={1080}
        height={1920}
        shadows="soft"
        flat
        camera={{fov: 64, near: 0.1, far: 60, position: [0, 0.4, 6]}}
        style={{width: 1080, height: 1920}}
      >
        <color attach="background" args={['#2b5f93']} />
        <ambientLight color="#7fa8ff" intensity={0.9} />
        <directionalLight
          color="#ffd9a0"
          intensity={3.0}
          position={[-5, 3.4, 2.2]}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <Rig />
        <Room frame={frame} />
        <PaintedWall frame={frame} />
        <Guard frame={frame} />
        <Post frame={frame} />
      </ThreeCanvas>
    </div>
  );
};
