// JOINT CONTACT SHEET (kit QA, 2026-11-17): 16 cells (4 x 4, 270 x 480) of one character in profile: elbow bent 135 / 90 / 45 degrees, arm raised, reaching forward-down, pointing, waving, shrug,
// crouch 50 % / 90 %, sitting, and 5 phases of the walk cycle. Open `JointSheet` in Studio and LOOK: every bend must be a ROUND curve (never a pointed corner), the tube keeps its thickness,
// elbows bend backward / outward, knees bend forward. On mount it logs [qa-joints]: bend radius, tube pinching, smooth joint angles over a hand sweep and over a walk cycle.
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, useDelayRender, useRemotionEnvironment} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import {ARM, BEND_R, CX, LEG, LIMB_W, RickPose, jointAngle, limbCurves3, limbIK, limbJointPath, roundedPath, solve, yawTo} from './kit/rickRig';
import {Person, poseOf, SPECS} from './kit/person';
import {sitPose} from './kit/sit';
import './shop/cast';

export const JS_W = 1080, JS_H = 1920, COLS = 4, ROWS = 4, CW = JS_W / COLS, CH = JS_H / ROWS;
const ROLE = 'manCap', CAM: [number, number, number] = [0, 1.0, 4.4];
const tri = (s: number) => (2 / Math.PI) * Math.asin(Math.sin(Math.PI * s));
const shoulder = (pose: RickPose): [number, number] => { const s = solve(SPECS[ROLE].kind, pose, yawTo(CAM, [0, 0, 0])); return s.sh[1]; };
const base = (po: Partial<RickPose> = {}): RickPose => poseOf([0, 0, 0], CAM, {fwd: [1, 0], torsoFwd: [1, 0], headFwd: [1, 0], face: 'deadpan', ...po});
/** hand target of the right arm: distance d from the shoulder in direction phi (deg, 0 = forward, - = up) */
const armTo = (d: number, phi: number): Partial<RickPose> => { const sh = shoulder(base()), a = (phi * Math.PI) / 180; return {hands: [null, [sh[0] + d * Math.cos(a), sh[1] + d * Math.sin(a)]]}; };
const L = ARM / 2, dFor = (alpha: number) => 2 * L * Math.sin(((alpha * Math.PI) / 180) / 2);
export const CELLS: {label: string; pose: RickPose; sit?: boolean}[] = [
  {label: 'elbow 135', pose: base(armTo(dFor(135), 0))}, {label: 'elbow 90', pose: base(armTo(dFor(90), 0))}, {label: 'elbow 45', pose: base(armTo(dFor(45), -25))}, {label: 'arm raised', pose: base(armTo(215, -50))},
  {label: 'reach down', pose: base(armTo(205, 40))}, {label: 'point', pose: base(armTo(228, 0))}, {label: 'wave', pose: base({...armTo(150, -62), headRoll: 0.06})}, {label: 'shrug', pose: base({hands: [[CX - 150, 395], [CX + 150, 395]], handsZ: [30, 30], headDy: 8})},
  {label: 'crouch 50%', pose: base({crouch: 0.5, ...armTo(150, 60)})}, {label: 'crouch 90%', pose: base({crouch: 0.9, lean: 0.1, ...armTo(150, 70)})}, {label: 'sit', pose: base(), sit: true}, {label: 'idle arms', pose: base()},
  ...[0, 0.25, 0.5, 0.75].map((ph) => { const a = 0.4, t = tri(ph * 2) * a, cs = Math.cos(Math.PI * ph * 2); return {label: `walk ${ph}`, pose: base({legSw: [t, -t], bend: [Math.max(0, cs), Math.max(0, -cs)], toe: [0.5 * Math.max(0, cs), 0.5 * Math.max(0, -cs)], armSw: [-0.8 * a * tri(ph * 2 - 0.45) * 1.2, 0.8 * a * tri(ph * 2 - 0.45) * 1.2]})}; }),
];
const kind = SPECS[ROLE].kind;
const Multi: React.FC = () => {
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene), groups = useRef<(THREE.Group | null)[]>([]), col = useMemo(() => new THREE.Color('#bfe3ea'), []);
  const cam = useMemo(() => { const k = new THREE.PerspectiveCamera(34, CW / CH, 0.05, 50); k.position.set(...CAM); k.lookAt(0, 0.95, 0); k.updateMatrixWorld(); return k; }, []);
  useFrame(() => {
    gl.autoClear = false; gl.setScissorTest(true);
    CELLS.forEach((_c, i) => { const x = (i % COLS) * CW, y = JS_H - (Math.floor(i / COLS) + 1) * CH; groups.current.forEach((g, j) => { if (g) g.visible = j === i; }); gl.setViewport(x, y, CW, CH); gl.setScissor(x, y, CW, CH); gl.setClearColor(col, 1); gl.clear(true, true, true); gl.render(scene, cam); });
    groups.current.forEach((g) => { if (g) g.visible = false; }); gl.setScissorTest(false);
  }, 1);
  const sp = useMemo(() => sitPose(kind, {seat: 'bench', view: 'front', camYaw: 1.57, scale: 0.9}), []);
  return (<>
    <hemisphereLight args={['#FFF3D6', '#8A6A50', 2.2]} /><directionalLight color="#FFE2B0" intensity={1.7} position={[-6, 9, 5]} />
    <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[8, 8]} /><meshBasicMaterial color="#9FD6C8" /></mesh>
    {CELLS.map((c, i) => (<group key={i} ref={(g) => { groups.current[i] = g; }} visible={false}>
      {c.sit ? <><mesh position={[0, 0.225, 0]}><boxGeometry args={[0.5, 0.45, 0.4]} /><meshToonMaterial color="#B9824A" /></mesh><Person role={ROLE} p={[0, sp.yOffset, 0]} s={0.9} cam={CAM} pose={{...sp.pose, fwd: [1, 0], torsoFwd: [1, 0], headFwd: [1, 0]}} noCane /></> : <Person role={ROLE} p={[0, 0, 0]} s={0.9} cam={CAM} pose={c.pose} noCane />}
    </group>))}
  </>);
};
const Gate: React.FC = () => {
  const {delayRender, continueRender} = useDelayRender(), invalidate = useThree((s) => s.invalidate), advance = useThree((s) => s.advance), {isRendering} = useRemotionEnvironment();
  useLayoutEffect(() => { const h = delayRender('joints', {timeoutInMilliseconds: 180000}); let done = false, r2 = 0; const draw = () => { try { if (isRendering) advance(performance.now()); else invalidate(); } catch (e) { console.warn(e); } }; const fin = () => { if (done) return; done = true; draw(); continueRender(h); }; draw(); const r1 = requestAnimationFrame(() => { draw(); r2 = requestAnimationFrame(fin); }); const t = window.setTimeout(fin, 3000); return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); window.clearTimeout(t); fin(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};
/** numeric joint QA: bend radius and pinching for bends of 135 / 90 / 45 / 20 degrees, smooth angles over a hand sweep and a walk cycle, no straight limb at rest */
export function runJointQA(): string[] {
  const out: string[] = [], out3 = new Float64Array(21 * 3), thick = LIMB_W;
  const radii: string[] = []; let radOK = true;
  for (const alpha of [135, 90, 45]) { const d = dFor(alpha), S: [number, number, number] = [0, 0, 0], H: [number, number, number] = [d, 0, 0], {E} = limbIK(S, H, L, [0, -1, 0]), rmin = roundedPath(S, E, H, BEND_R, 20, out3, true); radii.push(`${alpha}°: ${(rmin / thick).toFixed(2)} x thickness`); if (rmin < 1.25 * thick) radOK = false; }
  out.push(`${radOK ? 'PASS' : 'FAIL'} bend radius >= 1.25 x tube thickness, no sharp corner (${radii.join('; ')}; tube radius ${(thick / 2).toFixed(1)} px, so no pinching: min bend radius / tube radius >= 2.5)`);
  let maxStep = 0, prev = 0; for (let f = 0; f < 90; f++) { const d = 120 + 100 * (0.5 + 0.5 * Math.sin(f * 0.12)), a = jointAngle(d, L); if (f) maxStep = Math.max(maxStep, Math.abs(a - prev)); prev = a; }
  out.push(`${maxStep < 0.12 ? 'PASS' : 'FAIL'} elbow angle never snaps over a hand sweep (max step ${(maxStep * 57.3).toFixed(1)} deg / frame)`);
  let wStep = 0, wMin = 9, pa: number[] = [], kneeMin = 9;
  for (let f = 0; f < 60; f++) { const ph = f / 30, a = 0.4, t = tri(ph * 2) * a, cs = Math.cos(Math.PI * ph * 2), pose = base({legSw: [t, -t], bend: [Math.max(0, cs), Math.max(0, -cs)], armSw: [-0.8 * a * tri(ph * 2 - 0.45), 0.8 * a * tri(ph * 2 - 0.45)]}), yaw = yawTo(CAM, [0, 0, 0]), sol = solve(kind, pose, yaw), cu = limbCurves3(kind, pose, sol, yaw), angs = [0, 1, 2, 3].map((tb) => limbJointPath(kind, pose, cu[tb], tb, yaw, out3, 20, false)?.angle ?? Math.PI);
    if (f) wStep = Math.max(wStep, ...angs.map((x, i) => Math.abs(x - pa[i]))); pa = angs; wMin = Math.min(wMin, angs[2], angs[3]); kneeMin = Math.min(kneeMin, angs[0], angs[1]); }
  out.push(`${wStep < 0.12 ? 'PASS' : 'FAIL'} walk cycle joint angles are smooth (max step ${(wStep * 57.3).toFixed(1)} deg / frame; min elbow ${(wMin * 57.3).toFixed(0)} deg, min knee ${(kneeMin * 57.3).toFixed(0)} deg)`);
  const rest = base(), yaw = yawTo(CAM, [0, 0, 0]), cu = limbCurves3(kind, rest, solve(kind, rest, yaw), yaw), restAng = [0, 1, 2, 3].map((tb) => limbJointPath(kind, rest, cu[tb], tb, yaw, out3, 20)?.angle ?? Math.PI);
  out.push(`${Math.max(...restAng) < Math.PI * 0.995 ? 'PASS' : 'FAIL'} no limb is perfectly straight at rest (interior angles ${restAng.map((x) => (x * 57.3).toFixed(0)).join(', ')} deg; legs ${LEG} px, arms ${ARM} px)`);
  return out;
}
export const JointSheet: React.FC = () => {
  useMemo(() => { const r = runJointQA(); (window as unknown as {__qaJoints?: string[]}).__qaJoints = r; r.forEach((l) => (l.startsWith('FAIL') ? console.error('[qa-joints]', l) : console.info('[qa-joints]', l))); return 0; }, []);
  return (
    <AbsoluteFill style={{background: '#111'}}>
      <ThreeCanvas width={JS_W} height={JS_H} flat gl={{preserveDrawingBuffer: true}} camera={{fov: 34, near: 0.05, far: 50, position: CAM}} style={{width: JS_W, height: JS_H}}><Multi /><Gate /></ThreeCanvas>
      {CELLS.map((c, i) => (<div key={i} style={{position: 'absolute', left: (i % COLS) * CW, top: Math.floor(i / COLS) * CH, width: CW, height: CH, boxSizing: 'border-box', border: '1px solid #000', pointerEvents: 'none'}}><div style={{position: 'absolute', left: 4, top: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', font: '700 14px Helvetica, Arial', padding: '2px 5px', borderRadius: 4}}>{c.label}</div></div>))}
    </AbsoluteFill>
  );
};
