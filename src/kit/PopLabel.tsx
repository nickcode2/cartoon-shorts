// Pop-up information label. USE ONLY when it adds information: country names on maps, key numbers/phrases from the
// narration ("72 HOURS", "3 DAYS"). Never as decoration or a scene title. (In-world signs belong to the set, not here.)
// Style: plain white Fredoka text, thick black outline, subtle soft white glow. No colour, no gradients.
// Screen-fixed plane drawn at the focus distance (so depth of field keeps it sharp), pops in with a quick scale-up.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {loadFont} from '@remotion/google-fonts/Fredoka';
import {Pose, clamp01} from './kit';

export const {fontFamily: FREDOKA, waitUntilDone: waitForFredoka} = loadFont('normal', {weights: ['700'], subsets: ['latin']});

const easeOutBack = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
const LW = 800, LH = 200; // plane size in screen px

export const PopLabel: React.FC<{
  text: string;
  pose: Pose;
  f: number; // current frame of the shot
  start: number; // frame it pops in
  ready: boolean; // font loaded (wait with waitForFredoka inside useDelayRender)
  focus: THREE.Vector3; // the character / subject, sets the draw distance
  cy?: number; // centre, screen px from the top (safe zone starts at 269)
  hold?: number; // frames before it disappears (omit = stays)
}> = ({text, pose, f, start, ready, focus, cy = 330, hold}) => {
  const {canvas, tex} = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = LW * 2;
    canvas.height = LH * 2;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return {canvas, tex};
  }, []);
  // Verify Fredoka is really loaded (not the fallback). If not, hold the label back and log it, never draw it in a fallback face.
  const fontOk = ready && typeof document !== 'undefined' && document.fonts.check(`700 40px ${FREDOKA}`, text);
  if (ready && !fontOk && f === start) console.error('[font] Fredoka not available, pop label hidden (fallback font would be used):', text);
  const visible = fontOk && f >= start && (hold === undefined || f < start + hold);
  const k = (f - start) / 9;
  const glow = f < start ? 0 : 0.5 + 0.5 * Math.exp(-(f - start) / 9);
  const c = canvas.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  if (visible) {
    c.save();
    c.translate(canvas.width / 2, canvas.height / 2);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    let fs = 230;
    c.font = `700 ${fs}px ${FREDOKA}`;
    fs *= Math.min(1, 1200 / c.measureText(text).width);
    c.font = `700 ${fs}px ${FREDOKA}`;
    // subtle soft white glow
    c.shadowColor = `rgba(255,255,255,${0.7 * glow})`;
    c.shadowBlur = 40 * (0.6 + glow * 0.4);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillText(text, 0, 0);
    c.shadowBlur = 0;
    c.shadowColor = 'transparent';
    // thick black outline, then plain white fill
    c.strokeStyle = '#000000';
    c.lineWidth = Math.max(18, fs * 0.2);
    c.strokeText(text, 0, 0);
    c.fillStyle = '#ffffff';
    c.fillText(text, 0, 0);
    c.restore();
  }
  tex.needsUpdate = true;
  const p = new THREE.Vector3(...pose.p), l = new THREE.Vector3(...pose.l);
  const fwd = l.clone().sub(p).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  const D = p.distanceTo(focus);
  const mpp = (2 * D * Math.tan(((pose.fov ?? 60) * Math.PI) / 360)) / 1920;
  const pos = p.clone().add(fwd.clone().multiplyScalar(D)).add(up.clone().multiplyScalar((960 - cy) * mpp));
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd.clone().negate()));
  const sc = k < 0 ? 0.0001 : Math.max(0.0001, easeOutBack(clamp01(k)));
  const rot = (1 - clamp01(k)) * -0.1;
  return (
    <group position={pos} quaternion={q}>
      <group scale={[sc, sc, 1]} rotation={[0, 0, rot]}>
        <mesh renderOrder={50}>
          <planeGeometry args={[LW * mpp, LH * mpp]} />
          <meshBasicMaterial map={tex} color={new THREE.Color(1.1, 1.1, 1.1)} transparent alphaTest={0.02} depthTest={false} depthWrite toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
};
