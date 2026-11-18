// In-scene label: anchored to a 3D point (a country, a prop, a number beside a subject) and follows the camera, so it moves with
// the world instead of sitting in a fixed overlay. Rises out of the anchor with a scale/slide-in. Fredoka 700, white, thick black
// outline, subtle white glow. USE ONLY WHEN IT INFORMS (country names, key numbers/phrases). Never as decoration or a scene title.
// Render stability: the texture is drawn once (makeTex, tracked and swept by the kit), no per-frame allocations (module scratch
// objects), geometry/material are created in the component and disposed with the shot.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Pose, V3, clamp01, makeTex} from './kit';
import {FREDOKA} from './PopLabel';

const easeOutBack = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
const TW = 1024, TH = 256; // texture px
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3(), _l = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

const Label3DImpl: React.FC<{
  text: string;
  anchor: V3; // world point the label belongs to (e.g. centre of the country, top surface)
  pose: Pose; // current shot camera pose (billboard + size)
  f: number; // frame of the shot
  start: number; // frame it starts rising
  ready: boolean; // font loaded (waitForFredoka inside useDelayRender)
  rise?: number; // metres it rises above the anchor (default 0.35 * label height)
  px?: number; // on-screen text height in px at the anchor distance (default 150; keeps it readable at any camera distance)
  slide?: number; // metres of sideways slide-in (default 0)
  hold?: number; // frames before it disappears (omit = stays)
  lift?: number; // resting height above the anchor in label heights (default 1.1)
}> = ({text, anchor, pose, f, start, ready, rise, px = 150, slide = 0, hold, lift = 1.1}) => {
  const fontOk = ready && typeof document !== 'undefined' && document.fonts.check(`700 40px ${FREDOKA}`, text);
  if (ready && !fontOk && f === start) console.error('[font] Fredoka not available, 3D label hidden:', text);
  const tex = useMemo(
    () =>
      fontOk
        ? makeTex(TW, TH, (c, w, h) => {
            c.translate(w / 2, h / 2);
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.lineJoin = 'round';
            let fs = 170;
            c.font = `700 ${fs}px ${FREDOKA}`;
            fs *= Math.min(1, 880 / c.measureText(text).width);
            c.font = `700 ${fs}px ${FREDOKA}`;
            c.shadowColor = 'rgba(255,255,255,0.7)';
            c.shadowBlur = 34;
            c.fillStyle = 'rgba(255,255,255,0.5)';
            c.fillText(text, 0, 0);
            c.shadowBlur = 0;
            c.shadowColor = 'transparent';
            c.strokeStyle = '#000';
            c.lineWidth = Math.max(16, fs * 0.2);
            c.strokeText(text, 0, 0);
            c.fillStyle = '#fff';
            c.fillText(text, 0, 0);
          })
        : null,
    [fontOk, text],
  );
  const k = (f - start) / 12;
  if (!tex || k < 0 || (hold !== undefined && f >= start + hold)) return null;
  _p.set(...pose.p);
  _l.set(...pose.l);
  _f.copy(_l).sub(_p).normalize();
  _r.crossVectors(_f, UP).normalize();
  _u.crossVectors(_r, _f).normalize();
  _q.setFromRotationMatrix(_m.makeBasis(_r, _u, _f.negate()));
  const D = Math.max(0.2, _p.distanceTo(_l.set(...anchor)));
  const mpp = (2 * D * Math.tan(((pose.fov ?? 50) * Math.PI) / 360)) / 1920; // metres per screen px at the anchor
  const hM = px * mpp, wM = hM * (TW / TH);
  const e = easeOutBack(clamp01(k)), e2 = 1 - Math.pow(1 - clamp01(k), 3);
  const up = lift * hM, r = rise ?? 0.35 * hM;
  const pos: V3 = [anchor[0] + _r.x * slide * (1 - e2), anchor[1] + up - r * (1 - e2), anchor[2] + _r.z * slide * (1 - e2)];
  const sc = Math.max(0.0001, e);
  return (
    <group position={pos} quaternion={_q}>
      <mesh scale={[sc, sc, 1]} renderOrder={50}>
        <planeGeometry args={[wM, hM]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.02} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
};

/** Default anchor for pop-up labels (kit default 2026-11-16): on the camera axis (centred horizontally), in the UPPER part of the frame (yFrac = 0.24 of the frame height from the top,
 *  inside the safe zone), at the depth of the focal point, so it sits above the focal point. Use with `lift={0}` and px about 90 (60 % of the first version). */
export function upperThirdAnchor(pose: Pose, focal: V3, yFrac = 0.24): V3 {
  const p = new THREE.Vector3(...pose.p), l = new THREE.Vector3(...pose.l), f = l.clone().sub(p).normalize(), r = new THREE.Vector3().crossVectors(f, UP).normalize(), u = new THREE.Vector3().crossVectors(r, f).normalize();
  const D = new THREE.Vector3(...focal).sub(p).dot(f), t = Math.tan(((pose.fov ?? 62) * Math.PI) / 360), ndc = 1 - 2 * yFrac;
  const a = p.addScaledVector(f, D).addScaledVector(u, ndc * D * t);
  return [a.x, a.y, a.z];
}
export const LABEL_PX = 90;

/** Pop-up labels are OFF by default (kit default 2026-11-16): the editor adds text and captions. Set SHOW_LABELS = true, or pass `show` on a single label, only when the script says so. */
export const SHOW_LABELS = false;
export const Label3D: React.FC<React.ComponentProps<typeof Label3DImpl> & {show?: boolean}> = ({show, ...p}) => (show || SHOW_LABELS ? <Label3DImpl {...p} /> : null);
