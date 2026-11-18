// LooksTest: OUTDOOR DAY (a descending aerial establishing move that ends at the entrance) -> NIGHT interior (orange desk, seated character in 3/4 + a standing one).
// 9:16, 30 fps, 150 frames, silent. Characters are 2D cards with 3D limbs (kit/rickRig). The cut from outside to inside is a short dip to deep navy.
import React, {useMemo} from 'react';
import {EffectComposer} from '@react-three/postprocessing';
import {CamFn, ShotSpec, SingleCanvasVideo, V3} from './kit/kit';
import {FocusDof} from './kit/Dof';
import {LOOKS, LookLights, LookSet, Sky, aerialDescent} from './kit/looks';
import {REST, Rick, RickPose} from './kit/rickRig';
import {sitPose} from './kit/sit';
import {bounceAt} from './kit/bounce';

export const LK_FPS = 30, LK_FRAMES = 150, LK_CUT = 78;
const aerial = aerialDescent([2, 52, 30], [0.4, 1.7, 7.5], [0, 0, -4], [0, 1.4, -8], 48, 60);
const camA: CamFn = (u) => aerial(u);
const CAM_B: V3 = [0.3, 1.25, 3.2];
const camB: CamFn = (u) => ({p: [CAM_B[0] + 0.12 * u, CAM_B[1], CAM_B[2] - 0.35 * u], l: [0.4, 1.0, -3], fov: 58, roll: 0});
const standing = (fx: number, f: number): RickPose => ({...REST, fwd: [fx, 1], bounce: bounceAt([{kind: 'start', f0: 8, k: 0.6}], f, 220), face: 'deadpan'});
const Outdoor: React.FC<{f: number}> = ({f}) => (
  <>
    <Sky look="outdoorDay" /><LookLights look="outdoorDay" /><LookSet look="outdoorDay" />
    <Rick kind="c2" pose={standing(0.25, f)} p={[-0.3, 0.2, -6.4]} cam={aerial(Math.min(1, f / LK_CUT)).p} s={1} />
    <Rick kind="c6" pose={standing(-0.2, f)} p={[1.6, 0.2, -6.6]} cam={aerial(Math.min(1, f / LK_CUT)).p} s={1} />
  </>
);
const Night: React.FC<{f: number}> = ({f}) => {
  const camYaw = Math.atan2(CAM_B[0] - 0.9, CAM_B[2] + 3.4), sit = useMemo(() => sitPose('c4', {seat: 'table', view: 'three-quarter', camYaw, mirror: false}), [camYaw]);
  const pose: RickPose = {...sit.pose, face: f % 40 < 30 ? 'smug' : 'deadpan', bounce: bounceAt([{kind: 'sit', f0: 4, k: 0.8, dir: 1}], f, 220)};
  return (
    <>
      <Sky look="night" /><LookLights look="night" /><LookSet look="night" />
      <pointLight color="#ff9a40" intensity={18} distance={8} decay={1.4} position={[1.5, 1.35, -2.55]} />
      <Rick kind="c4" pose={pose} p={[0.9, sit.yOffset, -3.4]} cam={CAM_B} s={1} />
      <Rick kind="c7" pose={{...REST, fwd: [0.4, 1], face: 'annoyed', bounce: bounceAt([{kind: 'turn', f0: 20, k: 0.7, dir: 1}], f, 220)}} p={[-1.6, 0, -2.4]} cam={CAM_B} s={1} />
    </>
  );
};
export const LooksTest: React.FC = () => {
  const shots: ShotSpec[] = useMemo(() => [
    {from: 0, to: LK_CUT, light: 'day', ownLights: true, cam: camA, post: (_f, pose) => <EffectComposer multisampling={4}><FocusDof pose={pose} focal={[0, 1.2, -6.4]} r={60} /></EffectComposer>, render: (t) => <Outdoor f={Math.round(t * LK_FPS)} />},
    {from: LK_CUT, to: LK_FRAMES, light: 'night', ownLights: true, cam: camB, dip: {frames: 8, color: LOOKS.night.sky[0]}, post: (_f, pose) => <EffectComposer multisampling={4}><FocusDof pose={pose} focal={[0.9, 1.0, -3.4]} r={40} /></EffectComposer>, render: (t) => <Night f={Math.round(t * LK_FPS)} />},
  ], []);
  return <SingleCanvasVideo shots={shots} fps={LK_FPS} />;
};
