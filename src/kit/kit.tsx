import React, {createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AbsoluteFill, useCurrentFrame, useDelayRender, useRemotionEnvironment} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {CARD_H, CARD_W, METERS_PER_PX, SOLE_Y} from '../guard';
import {Post} from '../Painterly';
import {PO, drawPerson} from '../short/people';
import {SafeZoneOverlay} from './finish';

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

// ---- GPU resource bookkeeping (see STYLE_NOTES.md "Render stability")
// KEEP = shared objects that must never be disposed (RAMP, cached geometries/materials).
// OWNED_TEX = every texture the kit created; the ones no longer reachable from the scene are disposed when a shot ends.
const KEEP = new WeakSet<object>();
KEEP.add(RAMP);
const OWNED_TEX = new Set<THREE.Texture>();
const own = <T extends THREE.Texture>(t: T): T => {
  OWNED_TEX.add(t);
  return t;
};
/** Shared geometry / material caches: one instance per distinct shape or colour, reused by every shot, never disposed. */
const SHARED = new Map<string, THREE.BufferGeometry | THREE.Material>();
export const shared = <T extends THREE.BufferGeometry | THREE.Material>(key: string, make: () => T): T => {
  let o = SHARED.get(key) as T | undefined;
  if (!o) {
    o = make();
    KEEP.add(o);
    SHARED.set(key, o);
  }
  return o;
};
const toonMat = (c: string) => shared('toon' + c, () => new THREE.MeshToonMaterial({gradientMap: RAMP, color: c}));
const basicMat = (c: string) => shared('basic' + c, () => new THREE.MeshBasicMaterial({color: c, toneMapped: false}));
const inkMat = () => shared('ink', () => new THREE.MeshBasicMaterial({color: INK, side: THREE.BackSide}));

const texturesOf = (m: THREE.Material): THREE.Texture[] => {
  const out: THREE.Texture[] = [];
  for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) out.push(v as THREE.Texture);
  return out;
};
/** Dispose geometries and materials under root (skips KEEP). Textures are handled by sweepTextures. */
const disposeTree = (root: THREE.Object3D) => {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry && !KEEP.has(mesh.geometry)) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) if (!KEEP.has(m)) m.dispose();
  });
};
/** Dispose every kit-owned texture that no material in the scene references any more. Returns how many were freed. */
const sweepTextures = (scene: THREE.Scene): number => {
  const used = new Set<THREE.Texture>();
  if ((scene.background as THREE.Texture | null)?.isTexture) used.add(scene.background as THREE.Texture);
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) for (const t of texturesOf(m)) used.add(t);
  });
  let freed = 0;
  for (const t of Array.from(OWNED_TEX)) {
    if (used.has(t) || KEEP.has(t)) continue;
    t.dispose();
    OWNED_TEX.delete(t);
    freed++;
  }
  return freed;
};

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

// Painted shadows (STYLE_NOTES "PAINTED FINISH v8"): a material that defines PAINTED_SHADOWS gets its shadow term cut into three tones with hard,
// slightly brushy edges (cel-style). Materials without the define (all older videos) compile to exactly the same shader as before.
if (!THREE.ShaderChunk.shadowmap_pars_fragment.includes('paintShadow')) {
  const FN = `
float ps_h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float ps_n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(ps_h(i),ps_h(i+vec2(1.0,0.0)),f.x), mix(ps_h(i+vec2(0.0,1.0)),ps_h(i+vec2(1.0,1.0)),f.x), f.y); }
float paintShadow(float s, vec2 uv, float k){
  float r = mix(1.0, s, k);
  #ifdef PAINTED_SHADOWS
    float n = ps_n(uv*55.0)*0.55 + ps_n(uv*170.0)*0.25;
    float t = r + (n - 0.4)*0.2;
    float q = t > 0.8 ? 1.0 : (t > 0.45 ? 0.62 : 0.34);
    return mix(r, q, 0.85);
  #else
    return r;
  #endif
}
`;
  THREE.ShaderChunk.shadowmap_pars_fragment = FN + THREE.ShaderChunk.shadowmap_pars_fragment.split('return mix( 1.0, shadow, shadowIntensity );').join('return paintShadow( shadow, shadowCoord.xy, shadowIntensity );');
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

export const CamCtx = createContext<THREE.Vector3>(new THREE.Vector3(0, 1, 5));
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
export type LightMode = 'day' | 'dusk' | 'night' | 'indoor' | 'dark' | 'foco' | 'foco2';
const LIGHTS: Record<LightMode, {amb: [string, number]; sun: [string, number, V3]; bg: string}> = {
  day: {amb: ['#7fa8ff', 0.95], sun: ['#ffd9a0', 3.0, [-5, 7, 5]], bg: '#9fd6f5'},
  dusk: {amb: ['#9a8be0', 0.85], sun: ['#ff9d5c', 2.3, [-8, 3.2, 3]], bg: '#6a5aa8'},
  night: {amb: ['#4f62c8', 0.8], sun: ['#9fb8ff', 1.1, [-6, 9, 4]], bg: '#101a3e'},
  indoor: {amb: ['#ffe2c0', 1.0], sun: ['#fff0d8', 1.2, [-3, 6, 4]], bg: '#e8d4b8'},
  dark: {amb: ['#2b3a78', 0.55], sun: ['#7f9cff', 0.35, [-3, 6, 4]], bg: '#080c1c'},
  foco2: {amb: ['#8C63DA', 1.3], sun: ['#FFA050', 2.2, [-7, 4, 5]], bg: '#3B3590'}, // channel FocoProibido v2 (brighter, KIT RULES v9): values from channels/FocoProibido.json; new FocoProibido videos use this mode
  foco: {amb: ['#6C42B8', 0.9], sun: ['#F28A3C', 1.5, [-7, 4, 5]], bg: '#1E1A52'}, // channel FocoProibido: clear colour = indigo base (channels/FocoProibido.json)
};


const POST_READY = new WeakMap<object, boolean>();

// Mounts the post-processing (EffectComposer) only while the WebGL context exists and is not lost. On webglcontextlost
// it unmounts, on webglcontextrestored it remounts (new key), so addPass never sees a null context.
const PostGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const gl = useThree((s) => s.gl);
  const usable = () => {
    try {
      const c = gl.getContext();
      return !!c && !c.isContextLost();
    } catch {
      return false;
    }
  };
  const [ok, setOk] = useState(usable);
  const [gen, setGen] = useState(0);
  if (!ok) POST_READY.set(gl, false);
  useEffect(() => {
    const el = gl.domElement;
    const onLost = () => setOk(false);
    const onRestored = () => {
      if (usable()) {
        setGen((g) => g + 1);
        setOk(true);
      }
    };
    el.addEventListener('webglcontextlost', onLost, false);
    el.addEventListener('webglcontextrestored', onRestored, false);
    // context not available yet: poll until it is
    const iv = window.setInterval(() => {
      if (usable()) setOk((o) => (o ? o : (setGen((g) => g + 1), true)));
      else setOk((o) => (o ? false : o));
    }, 50);
    return () => {
      el.removeEventListener('webglcontextlost', onLost, false);
      el.removeEventListener('webglcontextrestored', onRestored, false);
      window.clearInterval(iv);
    };
  }, [gl]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    POST_READY.set(gl, ok);
    if (ok) gl.domElement.dispatchEvent(new Event('postready'));
  }, [ok, gen, gl]);
  return ok ? <React.Fragment key={gen}>{children}</React.Fragment> : null;
};

// Holds the frame capture until the scene has been drawn: invalidate, then clear after two animation frames
// (with a timer fallback, because the web renderer may not run the R3F render loop or throttle rAF).
const WATCHDOG_MS = 4000;
const WATCHDOG_TRIES = 10;
const DrawGate: React.FC<{frame: number}> = ({frame}) => {
  const {delayRender, continueRender} = useDelayRender();
  const invalidate = useThree((s) => s.invalidate);
  const advance = useThree((s) => s.advance);
  const {isRendering} = useRemotionEnvironment();
  const gl = useThree((s) => s.gl);
  const stateRef = useRef({lost: false, pending: null as null | (() => void), redraw: (() => false) as () => boolean});
  // blocked = context lost, or the post-processing is not mounted yet (PostGate)
  const blocked = () => stateRef.current.lost || POST_READY.get(gl) === false;
  // While rendering, R3F runs with frameloop "never" (invalidate does nothing), so we force a synchronous draw of the
  // current frame ourselves (advance runs every useFrame callback, including the post-processing composer), twice:
  // once right after commit and once after the next animation frame (textures uploaded). The canvas is created with
  // preserveDrawingBuffer so the pixels are still there when the frame is captured. Timer fallback for throttled rAF.
  // The delay has a long timeout with retries, continueRender always runs (also on errors), and a lost WebGL context
  // holds the frame until it is restored and redrawn.
  useEffect(() => {
    const el = gl.domElement;
    const st = stateRef.current;
    const onLost = (e: Event) => {
      e.preventDefault(); // required so the browser may restore the context
      st.lost = true;
    };
    const unblock = () => {
      if (st.lost || POST_READY.get(gl) === false) return;
      if (!st.redraw()) return; // draw threw: keep the frame held, the watchdog retries
      const p = st.pending;
      st.pending = null;
      p?.();
    };
    const onRestored = () => {
      st.lost = false;
      unblock();
    };
    el.addEventListener('webglcontextlost', onLost, false);
    el.addEventListener('webglcontextrestored', onRestored, false);
    el.addEventListener('postready', unblock, false);
    return () => {
      el.removeEventListener('webglcontextlost', onLost, false);
      el.removeEventListener('webglcontextrestored', onRestored, false);
      el.removeEventListener('postready', unblock, false);
    };
  }, [gl]);
  useLayoutEffect(() => {
    const st = stateRef.current;
    const h = delayRender(`three scene drawn (frame ${frame})`, {timeoutInMilliseconds: 120000, retries: 2});
    let done = false;
    let released = false;
    let disposed = false;
    let lastErr: unknown = null;
    const release = () => {
      if (released) return;
      released = true;
      continueRender(h);
    };
    // true = the frame was drawn without an exception
    const draw = (): boolean => {
      if (blocked()) return false;
      try {
        if (isRendering) advance(performance.now());
        else invalidate();
        lastErr = null;
        return true;
      } catch (err) {
        lastErr = err;
        console.warn(`three draw failed (frame ${frame})`, err);
        return false;
      }
    };
    st.redraw = draw;
    const logState = (why: string) => {
      try {
        const ctx = gl.getContext();
        console.error(`[drawgate] ${why} (frame ${frame})`, {
          contextLost: ctx ? ctx.isContextLost() : 'no context',
          lostFlag: st.lost,
          postReady: POST_READY.get(gl),
          glError: ctx && !ctx.isContextLost() ? ctx.getError() : 'n/a',
          memory: {...gl.info.memory},
          programs: gl.info.programs?.length ?? 0,
          lastError: lastErr instanceof Error ? `${lastErr.message}\n${lastErr.stack}` : lastErr,
        });
      } catch (e) {
        console.error(`[drawgate] could not read state (frame ${frame})`, e);
      }
    };
    // Safety net: if the frame is still not drawn, log the state, try to restore the context, reset three's GL state
    // and redraw, every WATCHDOG_MS, up to WATCHDOG_TRIES times. After that the delayRender timeout reports the failure.
    let wd = 0;
    let tries = 0;
    const startWatchdog = () => {
      if (wd || disposed || released) return;
      wd = window.setInterval(() => {
        if (released || disposed) {
          window.clearInterval(wd);
          return;
        }
        tries++;
        logState(`not drawn, retry ${tries}/${WATCHDOG_TRIES}`);
        try {
          const ctx = gl.getContext();
          if (ctx && ctx.isContextLost()) ctx.getExtension('WEBGL_lose_context')?.restoreContext();
          gl.resetState();
        } catch (e) {
          console.warn('[drawgate] restore attempt failed', e);
        }
        if (!blocked() && draw()) {
          draw(); // second pass so textures uploaded by the first one are used
          st.pending = null;
          done = true;
          window.clearInterval(wd);
          release();
        } else if (tries >= WATCHDOG_TRIES) {
          window.clearInterval(wd);
          logState('giving up, the delayRender timeout will report the failure');
        }
      }, WATCHDOG_MS);
    };
    const finish = () => {
      if (done) return;
      if (blocked()) {
        // wait for webglcontextrestored / postready (it redraws, then releases); the watchdog and the delayRender timeout bound this
        st.pending = release;
        startWatchdog();
        return;
      }
      if (draw()) {
        done = true;
        release();
      } else {
        startWatchdog(); // draw threw: keep the frame held and retry
      }
    };
    draw();
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      draw();
      r2 = requestAnimationFrame(finish);
    });
    const timer = window.setTimeout(finish, 250);
    return () => {
      disposed = true;
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      window.clearTimeout(timer);
      window.clearInterval(wd);
      finish();
      release(); // never leave the handle open on unmount
    };
  }, [frame]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

/** @deprecated per-shot canvas: remounts a WebGL canvas at every cut and can flash black. Use SingleCanvasVideo. */
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
    <mesh castShadow={cast} receiveShadow={recv} geometry={shared('box' + s.join(), () => new THREE.BoxGeometry(...s))} {...(map ? {} : {material: basic ? basicMat(c) : toonMat(c)})}>
      {map && (basic ? <meshBasicMaterial color={c} map={map} toneMapped={false} /> : <meshToonMaterial gradientMap={RAMP} color={c} map={map} />)}
    </mesh>
    {ink > 0 && (
      <mesh scale={[1 + (ink / s[0]) * 2, 1 + (ink / s[1]) * 2, 1 + (ink / s[2]) * 2]} geometry={shared('box' + s.join(), () => new THREE.BoxGeometry(...s))} material={inkMat()} />
    )}
  </group>
);

export const Cyl: React.FC<{r: number; h: number; p: V3; c: string; r2?: number; rot?: V3; ink?: number; seg?: number; cast?: boolean; basic?: boolean}> = ({
  r, h, p, c, r2, rot, ink = 0.025, seg = 20, cast = true, basic,
}) => (
  <group position={p} rotation={rot ?? [0, 0, 0]}>
    <mesh castShadow={cast} receiveShadow geometry={shared(`cyl${r2 ?? r},${r},${h},${seg}`, () => new THREE.CylinderGeometry(r2 ?? r, r, h, seg))} material={basic ? basicMat(c) : toonMat(c)} />
    {ink > 0 && (
      <mesh scale={[1 + ink / r, 1 + ink / h, 1 + ink / r]} geometry={shared(`cyl${r2 ?? r},${r},${h},${seg}`, () => new THREE.CylinderGeometry(r2 ?? r, r, h, seg))} material={inkMat()} />
    )}
  </group>
);

export const Ball: React.FC<{r: number; p: V3; c: string; ink?: number; basic?: boolean; scale?: V3}> = ({r, p, c, ink = 0.025, basic, scale}) => (
  <group position={p} scale={scale ?? [1, 1, 1]}>
    <mesh castShadow receiveShadow geometry={shared('ball' + r, () => new THREE.SphereGeometry(r, 20, 14))} material={basic ? basicMat(c) : toonMat(c)} />
    {ink > 0 && (
      <mesh scale={1 + ink / r} geometry={shared('ball' + r, () => new THREE.SphereGeometry(r, 20, 14))} material={inkMat()} />
    )}
  </group>
);

export const Plane: React.FC<{w: number; h: number; p: V3; c?: string; rot?: V3; map?: THREE.Texture; basic?: boolean; recv?: boolean; opacity?: number; cast?: boolean; side?: THREE.Side}> = ({
  w, h, p, c, rot, map, basic, recv = true, opacity, cast, side,
}) => (
  <mesh position={p} rotation={rot ?? [0, 0, 0]} receiveShadow={recv} castShadow={cast} geometry={shared(`plane${w},${h}`, () => new THREE.PlaneGeometry(w, h))}>
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
  const tex = own(new THREE.CanvasTexture(canvas));
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
    const tex = own(new THREE.CanvasTexture(canvas));
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
    const tex = own(new THREE.CanvasTexture(canvas));
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


// =====================================================================================================
// SingleCanvasVideo: ONE ThreeCanvas stays mounted for the whole video. Shots only swap the scene content
// (and camera / light preset), so a cut never creates a new WebGL canvas and cannot flash black.
export interface ShotSpec {
  from: number; // first frame
  to: number; // end frame (exclusive)
  light: LightMode | ((t: number) => LightMode);
  ambBoost?: number;
  cam: CamFn;
  /** t = seconds into the shot, u = 0..1 progress, absT = seconds into the video */
  render: (t: number, u: number, absT: number) => React.ReactNode;
  /** dip to a colour over this many frames at the START of the shot (use at location changes instead of a dissolve) */
  dip?: {frames: number; color?: string};
  /** true = the shot supplies its own lights (skips the preset ambient + sun; the preset still sets the background) */
  ownLights?: boolean;
  /** custom post-processing instead of the painterly ink pass (e.g. realistic shots) */
  post?: (frame: number, pose: Pose) => React.ReactNode;
}

const frameLights = (mode: LightMode, boost = 1) => ({L: LIGHTS[mode], boost});

// Wraps one shot's content. When the shot is unmounted (its last frame is over) its geometries and materials are disposed.
const ShotGroup: React.FC<{visible: boolean; children: React.ReactNode}> = ({visible, children}) => {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const g = ref.current;
    return () => {
      if (g) disposeTree(g);
    };
  }, []);
  return (
    <group ref={ref} visible={visible}>
      {children}
    </group>
  );
};

const probe = (): THREE.Group => {
  // common material variants, so their shader programs exist before any shot needs them
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  const mats: THREE.Material[] = [
    new THREE.MeshToonMaterial({gradientMap: RAMP, color: '#ffffff'}),
    new THREE.MeshToonMaterial({gradientMap: RAMP, color: '#ffffff', side: THREE.DoubleSide}),
    new THREE.MeshBasicMaterial({color: '#ffffff', toneMapped: false}),
    new THREE.MeshBasicMaterial({color: INK, side: THREE.BackSide}),
    new THREE.MeshBasicMaterial({transparent: true, alphaTest: 0.02, toneMapped: false, side: THREE.DoubleSide}),
    new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: false, alphaTest: 0.5, side: THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({color: '#ffffff'}),
  ];
  for (const m of mats) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    g.add(mesh);
  }
  g.userData.dispose = () => {
    geo.dispose();
    mats.forEach((m) => m.dispose());
  };
  return g;
};

// Per shot: free textures nobody references any more, log renderer.info (watch for growth across shots) and precompile the
// shaders of everything mounted (current shot + hidden next shot), so no frame pays for a program compile.
// Log lines: "[gpu] {...}"; the same rows are kept in window.__gpuLog.
const GpuMonitor: React.FC<{shot: number; preloaded: boolean}> = ({shot, preloaded}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const first = useRef(true);
  useEffect(() => {
    try {
      if (first.current) {
        first.current = false;
        const pr = probe();
        scene.add(pr);
        gl.compile(pr, camera, scene);
        scene.remove(pr);
        (pr.userData.dispose as () => void)();
      }
      gl.compile(scene, camera);
    } catch (e) {
      console.warn('[gpu] precompile failed', e);
    }
  }, [shot, preloaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const freed = sweepTextures(scene);
    const w = window as unknown as {__gpuLog?: Record<string, number>[]};
    const log = (w.__gpuLog ??= []);
    const m = gl.info.memory;
    const row = {shot, geometries: m.geometries, textures: m.textures, programs: gl.info.programs?.length ?? 0, freedTextures: freed, ownedTextures: OWNED_TEX.size};
    (window as unknown as {__glInfo?: () => Record<string, number>}).__glInfo = () => ({calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, programs: gl.info.programs?.length ?? 0}); // read it in the console after a frame has been drawn
    const prev = log[log.length - 1];
    log.push(row);
    console.info('[gpu]', JSON.stringify(row));
    if (prev && shot > 0 && (row.textures > prev.textures + 40 || row.geometries > prev.geometries + 200)) {
      console.warn('[gpu] resource count grew a lot between shots, check for leaks', JSON.stringify({prev, row}));
    }
  }, [shot]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

export const SingleCanvasVideo: React.FC<{shots: ShotSpec[]; fps?: number; lookahead?: number}> = ({shots, fps = 30, lookahead = 12}) => {
  const frame = useCurrentFrame();
  let idx = shots.findIndex((sh) => frame >= sh.from && frame < sh.to);
  if (idx < 0) idx = frame < shots[0].from ? 0 : shots.length - 1;
  const sh = shots[idx];
  const next = shots[idx + 1];
  const f = frame - sh.from;
  const t = f / fps;
  const u = clamp01(f / Math.max(1, sh.to - sh.from));
  const pose = sh.cam(u, t);
  const mode = typeof sh.light === 'function' ? sh.light(t) : sh.light;
  const {L, boost} = frameLights(mode, sh.ambBoost ?? 1);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  camPos.set(...pose.p);
  const dipOpacity = sh.dip && f < sh.dip.frames ? 1 - f / sh.dip.frames : 0;
  // a hidden copy of the next shot is mounted shortly before the cut so its textures are built and uploaded in advance
  const preload = next && sh.to - frame <= lookahead ? next : null;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <ThreeCanvas width={1080} height={1920} shadows="soft" flat gl={{preserveDrawingBuffer: true}} camera={{fov: 60, near: 0.05, far: 400, position: [0, 1.4, 6]}} style={{width: 1080, height: 1920}}>
        <color attach="background" args={[L.bg]} />
        {!sh.ownLights && <ambientLight color={L.amb[0]} intensity={L.amb[1] * boost} />}
        {!sh.ownLights && <directionalLight color={L.sun[0]} intensity={L.sun[1]} position={L.sun[2]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-near={0.5} shadow-camera-far={40} shadow-bias={-0.0004} shadow-normalBias={0.02} />}
        <Rig pose={pose} />
        <CamCtx.Provider value={camPos}>
          {/* stable keys per shot index: the hidden preloaded copy becomes the visible shot at the cut (no rebuild, no duplicate
              textures); the previous shot unmounts and is disposed */}
          <ShotGroup key={idx} visible>
            {sh.render(t, u, frame / fps)}
          </ShotGroup>
          {preload && (
            <ShotGroup key={idx + 1} visible={false}>
              {preload.render(0, 0, preload.from / fps)}
            </ShotGroup>
          )}
        </CamCtx.Provider>
        {/* post is mounted only while the GL context is usable (see PostGate) */}
        <PostGate>{sh.post ? sh.post(frame, pose) : <Post frame={frame} />}</PostGate>
        <GpuMonitor shot={idx} preloaded={!!preload} />
        <DrawGate frame={frame} />
      </ThreeCanvas>
      <SafeZoneOverlay />
      {dipOpacity > 0 && <AbsoluteFill style={{background: sh.dip?.color ?? '#000', opacity: dipOpacity}} />}
    </AbsoluteFill>
  );
};
