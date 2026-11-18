// Cheap depth of field driven by the FOCAL point of the plan row (STYLE_NOTES "DEPTH OF FIELD v8").
// Uses postprocessing's disc-kernel bokeh (so bright lights become soft discs) computed at HALF resolution (resolutionScale 0.5, one extra pass,
// no extra samples). Focus distance = depth of the focal point along the view axis; range comes from the focal radius. Pure math per frame: no
// allocations except two small vectors reused from module scratch; the effect object lives in the single EffectComposer that the kit keeps mounted
// for the whole video (it is created once, not per shot). Switch off with DOF_ENABLED = false or soften with DOF_STRENGTH.
import React from 'react';
import {DepthOfField} from '@react-three/postprocessing';
import {Pose, V3} from './kit';

export const DOF_ENABLED = true;
export const DOF_STRENGTH = 1.0; // 0 = no blur, 1 = default, 2 = very strong
export const DOF_RES = 0.5; // blur resolution scale (0.5 = half resolution; 0.35 for an even cheaper blur)

/** Focus distance (metres along the view axis) and range for a pose and a focal point with radius r. */
export function dofParams(pose: Pose, focal: V3, r = 0.4) {
  const fx = pose.l[0] - pose.p[0], fy = pose.l[1] - pose.p[1], fz = pose.l[2] - pose.p[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  const d = ((focal[0] - pose.p[0]) * fx + (focal[1] - pose.p[1]) * fy + (focal[2] - pose.p[2]) * fz) / fl;
  const focus = Math.max(0.2, d);
  const range = Math.min(6, Math.max(0.7, r * 3 + focus * 0.18));
  return {focus, range};
}

export const FocusDof: React.FC<{pose: Pose; focal: V3; r?: number}> = ({pose, focal, r}) => {
  const {focus, range} = dofParams(pose, focal, r);
  return <DepthOfField worldFocusDistance={focus} worldFocusRange={range} bokehScale={3.0 * DOF_STRENGTH} resolutionScale={DOF_RES} />;
};
