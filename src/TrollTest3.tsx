// TrollTest3: reaction-face test, 9:16, exactly 3.0 s = 90 frames at 30 fps, silent, hard hold at the end (no fade).
// Cast: Ruri alone (t-shirt). 0.0-1.0 s medium shot, Ruri talks (mouth flap, one normal blink, blinkPhase 0.6 -> blink at 0.5-0.62 s).
// 1.0-2.5 s (frames 30-75): hard cut to the troll face on Ruri's head for 1.5 s (showReaction), one blink in the middle. 2.5-3.0 s: Ruri's own face again, everything frozen (hold).
// Camera: ONE locked medium shot (tiny drift 0.03 m, frozen from 2.5 s), CENTER_BOX respected, head fully inside incl. the 9 % pop (checks below, results in console "[trolltest3]" / window.__troll3).
// PALETTE (5 hues, vibrancy about 7/10): teal walls #35a3a8, violet floor #6e55b3 + lavender ceiling (finish PAL), coral rug/accents #e5604d, mustard #f0b03c (Ruri's shirt, lamp, rug border),
// warm cream window/lamp light #fff0c8. Everything on the set is a standard material; props share ONE box/cylinder/sphere/plane geometry and shared materials (shared()).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {EffectComposer, ToneMapping} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import {CamFn, ShotSpec, SingleCanvasVideo, V3, clamp01, shared} from './kit/kit';
import {EXPR} from './kit/hoodieMan';
import {Ruri} from './kit/hoodieCurved';
import {METERS_PER_PX, SOLE_Y} from './guard';
import {RIG_GLOW, idle, standFeet} from './kit/motion';
import {CENTER_BOX, assertFramed, frameFocal, headInBox, lockedShot} from './kit/camera';
import {Glow} from './kit/finish';
import {Room} from './KitTest6';
import {makeReactionDraw, reactionDraw, showReaction, useReactionFace} from './kit/reactionFace';

export const TT3_FPS = 30;
export const TT3_FRAMES = 90;

const S = 0.84;
const M = METERS_PER_PX * S;
const RUG_Y = 0.016; // rug top, Ruri stands on it
const HEAD_Y = (SOLE_Y - 205) * M + RUG_Y;
const HEAD_R = 0.25 * 1.09 + 0.005; // head radius incl. the entry pop
const HOLD = 2.5; // s: everything frozen from here
const TALK_END = 1.0; // s
const SHIRT = '#f0b03c';

// reaction: frames 30-75 (1.0 s to 2.5 s), the duration would normally come from the narration
const REACT = showReaction('funny', 30, 45, {blinkCount: 1});

// ---------------------------------------------------------------- camera (pure math, built once)
const buildCam = (): CamFn => {
  const f = frameFocal({p: [0, HEAD_Y, 0], r: 0.25, head: true, name: 'Ruri head'}, {fov: 60, yaw: 0, pitch: -3, span: 0.4});
  const locked = lockedShot(f.p, f.l, {drift: 0.03, fov: 60});
  return (_u, t) => locked(clamp01(Math.min(t, HOLD) / HOLD), t);
};

// ---------------------------------------------------------------- set: shared geometry and materials
const BOX = () => shared('t3box', () => new THREE.BoxGeometry(1, 1, 1));
const CYL = () => shared('t3cyl', () => new THREE.CylinderGeometry(1, 1, 1, 20));
const OPEN_CONE = () => shared('t3shade', () => new THREE.CylinderGeometry(0.4, 1, 1, 24, 1, true));
const BALL = () => shared('t3ball', () => new THREE.SphereGeometry(1, 16, 12));
const PLANE = () => shared('t3plane', () => new THREE.PlaneGeometry(1, 1));
const MAT = (c: string, r = 0.6, ei = 0, side: THREE.Side = THREE.FrontSide) =>
  shared(`t3m${c}${r}${ei}${side}`, () => new THREE.MeshStandardMaterial({color: c, roughness: r, emissive: ei ? c : '#000000', emissiveIntensity: ei, side}));
const Part: React.FC<{g: THREE.BufferGeometry; m: THREE.Material; p: V3; s: V3; rot?: V3; cast?: boolean}> = ({g, m, p, s, rot, cast = true}) => (
  <mesh geometry={g} material={m} position={p} scale={s} rotation={rot ?? [0, 0, 0]} castShadow={cast} receiveShadow />
);

const Lights: React.FC = () => (
  <>
    <hemisphereLight args={['#d4f1ee', '#4a3a8a', 1.15]} />
    <ambientLight intensity={0.25} />
    <directionalLight color="#ffd9a0" intensity={2.3} position={[-3, 4.2, 4]} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-camera-near={0.5} shadow-camera-far={16} shadow-bias={-0.0005} shadow-normalBias={0.02} />
    <pointLight color="#ffd28a" intensity={5} distance={4.5} decay={2} position={[0.5, 2.05, -1.5]} />
  </>
);

// Window with a light glow: frame bars, cross muntins, sill, emissive glass, additive glow sprite. 9 meshes.
const Window: React.FC<{p: V3}> = ({p: [x, y, z]}) => (
  <group>
    <Part g={PLANE()} m={MAT('#fff0c8', 0.5, 1.7)} p={[x, y, z + 0.01]} s={[0.62, 0.9, 1]} cast={false} />
    <Part g={BOX()} m={MAT('#f3e6d0', 0.5)} p={[x, y + 0.48, z + 0.03]} s={[0.76, 0.06, 0.07]} />
    <Part g={BOX()} m={MAT('#f3e6d0', 0.5)} p={[x, y - 0.48, z + 0.03]} s={[0.76, 0.06, 0.07]} />
    <Part g={BOX()} m={MAT('#f3e6d0', 0.5)} p={[x - 0.35, y, z + 0.03]} s={[0.06, 1.0, 0.07]} />
    <Part g={BOX()} m={MAT('#f3e6d0', 0.5)} p={[x + 0.35, y, z + 0.03]} s={[0.06, 1.0, 0.07]} />
    <Part g={BOX()} m={MAT('#f3e6d0', 0.5)} p={[x, y, z + 0.03]} s={[0.64, 0.03, 0.04]} />
    <Part g={BOX()} m={MAT('#f3e6d0', 0.5)} p={[x, y, z + 0.03]} s={[0.03, 0.92, 0.04]} />
    <Part g={BOX()} m={MAT(SHIRT, 0.55)} p={[x, y - 0.53, z + 0.09]} s={[0.88, 0.05, 0.16]} />
    <Glow p={[x, y, z + 0.25]} size={2.6} color="#ffd98a" intensity={0.8} />
  </group>
);

// Shelf: board, two brackets, then (cut these first if it ever gets too heavy) 3 books, a pot with a plant, a vase.
const Shelf: React.FC<{p: V3}> = ({p: [x, y, z]}) => (
  <group>
    <Part g={BOX()} m={MAT('#8a5fc4', 0.6)} p={[x, y, z + 0.1]} s={[0.78, 0.04, 0.2]} />
    <Part g={BOX()} m={MAT('#4d3b8f', 0.6)} p={[x - 0.3, y - 0.09, z + 0.05]} s={[0.03, 0.14, 0.1]} />
    <Part g={BOX()} m={MAT('#4d3b8f', 0.6)} p={[x + 0.3, y - 0.09, z + 0.05]} s={[0.03, 0.14, 0.1]} />
    <Part g={BOX()} m={MAT('#e5604d', 0.6)} p={[x - 0.31, y + 0.12, z + 0.1]} s={[0.06, 0.2, 0.13]} />
    <Part g={BOX()} m={MAT('#f0b03c', 0.6)} p={[x - 0.24, y + 0.105, z + 0.1]} s={[0.06, 0.17, 0.13]} />
    <Part g={BOX()} m={MAT('#2a8f96', 0.6)} p={[x - 0.17, y + 0.115, z + 0.1]} s={[0.06, 0.19, 0.13]} />
    <Part g={CYL()} m={MAT('#e5604d', 0.6)} p={[x + 0.08, y + 0.07, z + 0.1]} s={[0.065, 0.1, 0.065]} />
    <Part g={BALL()} m={MAT('#2a8f96', 0.7)} p={[x + 0.08, y + 0.17, z + 0.1]} s={[0.09, 0.08, 0.09]} />
    <Part g={BALL()} m={MAT('#f0b03c', 0.5)} p={[x + 0.27, y + 0.09, z + 0.1]} s={[0.065, 0.07, 0.065]} />
  </group>
);

// Hanging lamp: cord, open conical shade (emissive inside and out), bulb, glow sprite. 4 meshes + sprite.
const HangLamp: React.FC<{p: V3}> = ({p: [x, y, z]}) => (
  <group>
    <Part g={CYL()} m={MAT('#2b2350', 0.6)} p={[x, y + 0.3, z]} s={[0.008, 0.6, 0.008]} cast={false} />
    <Part g={OPEN_CONE()} m={MAT('#f0b03c', 0.5, 0.55, THREE.DoubleSide)} p={[x, y, z]} s={[0.26, 0.24, 0.26]} cast={false} />
    <Part g={BALL()} m={MAT('#fff0c8', 0.4, 2.2)} p={[x, y - 0.05, z]} s={[0.05, 0.05, 0.05]} cast={false} />
    <Glow p={[x, y - 0.12, z + 0.05]} size={1.5} color="#ffd98a" intensity={0.9} />
  </group>
);

// Rug: mustard border + coral field, two thin boxes (floor y 0).
const Rug: React.FC = () => (
  <group>
    <Part g={BOX()} m={MAT('#f0b03c', 0.9)} p={[0, RUG_Y / 2 - 0.002, -1.0]} s={[2.9, RUG_Y, 2.6]} cast={false} />
    <Part g={BOX()} m={MAT('#e5604d', 0.9)} p={[0, RUG_Y / 2, -1.0]} s={[2.55, RUG_Y + 0.003, 2.25]} cast={false} />
  </group>
);

// ---------------------------------------------------------------- scene
const speakAt = (t: number) => (t >= TALK_END ? 0 : Math.min(1, t / 0.1, (TALK_END - t) / 0.1) * (0.25 + 0.6 * Math.abs(Math.sin(t * Math.PI * 3.4))));
const Scene: React.FC<{t: number}> = ({t}) => {
  const face = useReactionFace(REACT.face);
  const draw = useMemo(makeReactionDraw, []);
  const frame = Math.round(t * TT3_FPS); // raw frame (the hold below freezes the acting, not the frame count)
  const tt = Math.min(t, HOLD);
  const reaction = reactionDraw(REACT, face, frame, draw);
  return (
    <>
      <Lights />
      <Room id="T3" wall="#35a3a8" stripe="#4db5b8" floor="#6e55b3" />
      <Window p={[-1.05, 1.75, -2.97]} />
      <Shelf p={[1.12, 1.05, -3.0]} />
      <HangLamp p={[0.5, 2.3, -1.6]} />
      <Rug />
      <Ruri
        pose={{t: tt, expr: EXPR.neutral, turn: 0, speak: speakAt(tt), blinkPhase: 0.6, ...idle(tt, 3), feet: standFeet(RIG_GLOW)}}
        p={[0, RUG_Y, 0]} s={S} yawK={0} outfit="tshirt" outfitColor={SHIRT} reaction={reaction}
      />
    </>
  );
};

// ---------------------------------------------------------------- checks (setup time)
function runChecks(cam: CamFn): string[] {
  const lines: string[] = [];
  const head = {p: [0, HEAD_Y, 0] as V3, r: HEAD_R, name: 'Ruri head (with pop)'};
  try { assertFramed('trolltest3', cam, () => ({p: head.p, r: HEAD_R, head: true, name: 'Ruri head'}), TT3_FRAMES / TT3_FPS, () => [head]); lines.push('PASS assertFramed (u 0, 0.5, 1)'); } catch (e) { lines.push(`FAIL assertFramed: ${(e as Error).message}`); }
  const bad: number[] = [];
  for (let f = 0; f < TT3_FRAMES; f++) if (!headInBox(cam(f / TT3_FRAMES, f / TT3_FPS), head)) bad.push(f);
  lines.push(bad.length ? `FAIL head in CENTER_BOX on ${bad.length} frames, first ${bad.slice(0, 5).join(',')}` : `PASS head inside CENTER_BOX (${CENTER_BOX.x0}-${CENTER_BOX.x1} x ${CENTER_BOX.y0}-${CENTER_BOX.y1}) on all ${TT3_FRAMES} frames`);
  const mid = REACT.start + Math.floor(REACT.dur / 2);
  lines.push(REACT.start + REACT.dur === 75 && REACT.blinkAt.some((b) => REACT.start + b <= mid && mid <= REACT.start + b + REACT.blinkFrames) ? 'PASS reaction 30-75, blink in the middle' : 'FAIL reaction timing');
  return lines;
}

export const TrollTest3: React.FC = () => {
  const shots: ShotSpec[] = useMemo(() => {
    const cam = buildCam();
    const lines = runChecks(cam);
    (window as unknown as {__troll3?: string[]}).__troll3 = lines;
    lines.forEach((l) => (l.startsWith('FAIL') ? console.error('[trolltest3]', l) : console.info('[trolltest3]', l)));
    return [
      {
        from: 0, to: TT3_FRAMES, light: 'indoor', ownLights: true, cam,
        post: () => (
          <EffectComposer multisampling={4}>
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          </EffectComposer>
        ),
        render: (t) => <Scene t={t} />,
      },
    ];
  }, []);
  return <SingleCanvasVideo shots={shots} fps={TT3_FPS} />;
};
