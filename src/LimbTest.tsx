// LimbTest: HoodieCurved (hoodie man head/body/face + curved limbs from limbs.ts), 9:16, exactly 30 frames at 30 fps = 1.0 s, hard hold, no fade.
// Static camera, plain neutral studio. Beats: 0.0-0.5 s two walk steps along a short path, 0.5-0.8 s one arm raised to a ~90 degree bend
// (stopping the walk at the same time), 0.8-1.0 s hold with the left knee bent. Motion kit with rig = RIG_GLOW; no glow on limbs.
import React, {useMemo} from 'react';
import {EffectComposer, ToneMapping} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';
import {Pose, ShotSpec, SingleCanvasVideo, V3, lerp, move} from './kit/kit';
import {EXPR} from './kit/hoodieMan';
import {HoodieCurved} from './kit/hoodieCurved';
import {RIG_GLOW, defaultStride, easeInOut, easeInOutSine, walk} from './kit/motion';

export const LT_FPS = 30;
export const LT_FRAMES = 30;
const S = 0.84;
const STRIDE = defaultStride(RIG_GLOW, S); // metres per step
const WALK_END = 0.5; // s, walking stops
const DIST = 2 * STRIDE; // two steps = one full cycle, ends on the contact pose
const X0 = -DIST / 2;
const HOLD_T = 24 / LT_FPS; // pose is frozen from 0.8 s on
const ARM_UP: [number, number] = [518, 248]; // right hand: upper arm out sideways, forearm straight up = 90 degree elbow (150 / 140 px arm)
const KNEE_FOOT: [number, number, number] = [222, 846, 0]; // left ankle: up and back under the hip so the knee points forward at ~90 degrees

const cam = move({p: [0, 1.0, 3.4], l: [0, 0.95, 0], fov: 60}, {p: [0, 1.0, 3.4], l: [0, 0.95, 0], fov: 60}); // static

const Scene: React.FC<{t: number}> = ({t: tRaw}) => {
  const t = Math.min(tRaw, HOLD_T);
  const w = t < WALK_END ? Math.sin((t / WALK_END) * Math.PI * 0.5) : 1; // walk progress, ends with zero speed
  const dist = DIST * w;
  const k = 1 - easeInOut((t - 0.4) / 0.25); // walk intensity: full, then eases to standing
  const wk = walk(dist, {rig: RIG_GLOW, scale: S, intensity: k, dir: 1});
  const e = easeInOut((t - WALK_END) / 0.3); // arm raise 0.5 -> 0.8 s
  const kk = easeInOutSine((t - 0.6) / 0.2); // knee lift 0.6 -> 0.8 s
  const h1 = wk.hands![1]!;
  const hands: [[number, number] | null, [number, number] | null] = [wk.hands![0], [lerp(h1[0], ARM_UP[0], e), lerp(h1[1], ARM_UP[1], e)]];
  const f0 = wk.feet![0];
  const feet: [[number, number, number], [number, number, number]] = [[lerp(f0[0], KNEE_FOOT[0], kk), lerp(f0[1], KNEE_FOOT[1], kk), lerp(f0[2], 0, kk)], wk.feet![1]];
  const body = {...wk.body, dx: (wk.body!.dx ?? 0) + 18 * kk};
  const p: V3 = [X0 + dist, 0, 0];
  return (
    <>
      <mesh position={[0, 3, -3]}><planeGeometry args={[24, 12]} /><meshBasicMaterial color="#d9dbe0" /></mesh>
      <mesh position={[0, 0, -3]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[24, 24]} /><meshBasicMaterial color="#c6c9cf" /></mesh>
      <HoodieCurved pose={{t, expr: EXPR.neutral, turn: 0.3, ...wk, hands, feet, body}} p={p} s={S} yawK={0} />
    </>
  );
};

export const LimbTest: React.FC = () => {
  const shots: ShotSpec[] = useMemo(
    () => [{
      from: 0,
      to: LT_FRAMES,
      light: 'indoor',
      ownLights: true,
      cam: cam as (u: number, t: number) => Pose,
      post: () => (
        <EffectComposer multisampling={4}>
          <ToneMapping mode={ToneMappingMode.LINEAR} />
        </EffectComposer>
      ),
      render: (t) => <Scene t={t} />,
    }],
    [],
  );
  return <SingleCanvasVideo shots={shots} fps={LT_FPS} />;
};
