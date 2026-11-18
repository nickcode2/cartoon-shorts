// HEAD MOTION SHEET (KIT RULES v9, 2026-11-17): one row per character type (men, women, children, elderly), 8 columns: rest, look up (+30), look down (-30), tilt (roll -18 / +18), shake (yaw -40 / +40), up + tilt.
// Open HeadMotionSheet in Studio and LOOK: hats and hair must stay seated on the head (brim at the brow, nothing floating), the fringe must stay above the brows, no hat / hair pixels over the face. On mount it logs the numeric checks as [qa-motion] (window.__qaMotion).
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, useDelayRender, useRemotionEnvironment} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import {Person, SPECS, headPos, poseOf} from './kit/person';
import {motionReport} from './kit/headgear';
import './shop/cast';
import './shop/shots';

const D = Math.PI / 180;
export const HM_W = 1080, HM_H = 1920;
/** men (hat / hair), women (hat / hair), children, elderly */
export const HM_ROLES = ['manCap', 'pusher', 'womanHat', 'mother', 'kidGirl', 'kidBoy', 'elderLady', 'elderGent'];
export const HM_COLS: {name: string; yaw: number; pitch: number; roll: number}[] = [
  {name: 'rest', yaw: 0, pitch: 0, roll: 0}, {name: 'look up +30', yaw: 0, pitch: 30, roll: 0}, {name: 'look down -30', yaw: 0, pitch: -30, roll: 0}, {name: 'tilt -18', yaw: 0, pitch: 0, roll: -18},
  {name: 'tilt +18', yaw: 0, pitch: 0, roll: 18}, {name: 'shake -40', yaw: -40, pitch: 0, roll: 0}, {name: 'shake +40', yaw: 40, pitch: 0, roll: 0}, {name: 'up +25, tilt 15', yaw: 0, pitch: 25, roll: 15},
];
const COLS = HM_COLS.length, ROWS = HM_ROLES.length, CW = HM_W / COLS, CH = HM_H / ROWS;
const cell = (role: string) => { const h = headPos(role, [0, 0, 0], 0.9), sc = SPECS[role].scale, d = 1.9 * (0.8 + 0.2 * sc), cam: [number, number, number] = [0, h[1] + 0.04, d]; return {cam, look: [0, h[1] - 0.02, 0] as [number, number, number]}; };
const Multi: React.FC<{names: string[]}> = ({names}) => {
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene), groups = useRef<(THREE.Group | null)[]>([]), col = useMemo(() => new THREE.Color('#bfe3ea'), []);
  const cams = useMemo(() => names.map((n) => { const c = cell(n), k = new THREE.PerspectiveCamera(34, CW / CH, 0.05, 50); k.position.set(...c.cam); k.lookAt(...c.look); k.updateMatrixWorld(); return k; }), [names]);
  useFrame(() => {
    gl.autoClear = false; gl.setScissorTest(true);
    names.forEach((_n, r) => { for (let c = 0; c < COLS; c++) { const i = r * COLS + c, x = c * CW, y = HM_H - (r + 1) * CH; groups.current.forEach((g, j) => { if (g) g.visible = j === i; }); gl.setViewport(x, y, CW, CH); gl.setScissor(x, y, CW, CH); gl.setClearColor(col, 1); gl.clear(true, true, true); gl.render(scene, cams[r]); } });
    groups.current.forEach((g) => { if (g) g.visible = false; }); gl.setScissorTest(false);
  }, 1);
  return (<>
    <hemisphereLight args={['#FFF3D6', '#8A6A50', 2.2]} /><directionalLight color="#FFE2B0" intensity={1.7} position={[-6, 9, 5]} />
    {names.flatMap((n, r) => HM_COLS.map((col, c) => {
      const i = r * COLS + c, a = col.yaw * D, cam = cell(n).cam, pose = poseOf([0, 0, 0], cam, {headFwd: [Math.sin(a), Math.cos(a)], face: 'happyArc', headPitch: col.pitch * D, headRoll: col.roll * D});
      return (<group key={i} ref={(g) => { groups.current[i] = g; }} visible={false}><Person role={n} p={[0, 0, 0]} s={0.9} cam={cam} pose={pose} noCane /></group>);
    }))}
  </>);
};
const Gate: React.FC = () => {
  const {delayRender, continueRender} = useDelayRender(), invalidate = useThree((s) => s.invalidate), advance = useThree((s) => s.advance), {isRendering} = useRemotionEnvironment();
  useLayoutEffect(() => { const h = delayRender('turnaround', {timeoutInMilliseconds: 180000}); let done = false, r2 = 0; const draw = () => { try { if (isRendering) advance(performance.now()); else invalidate(); } catch (e) { console.warn(e); } }; const fin = () => { if (done) return; done = true; draw(); continueRender(h); }; draw(); const r1 = requestAnimationFrame(() => { draw(); r2 = requestAnimationFrame(fin); }); const t = window.setTimeout(fin, 3000); return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); window.clearTimeout(t); fin(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};
const HeadMotionSheetImpl: React.FC = () => {
  const names = HM_ROLES;
  useMemo(() => {
    const rows = names.flatMap((r) => motionReport(r, SPECS[r].kind, SPECS[r].gear)), bad = rows.filter((x) => !x.ok);
    const lines = [`${bad.length ? 'FAIL' : 'PASS'} head motion: ${rows.length} checks over ${names.length} characters (pitch -35 / -20 / +20 / +35 and roll -20 / +20, combined with yaw 0 / 45 / 90): hat gap < 3 % of head width, no hat / hair over the face`, ...bad.slice(0, 10).map((x) => `FAIL ${x.role} yaw ${x.yaw} pitch ${x.pitch} roll ${x.roll}: gap ${(x.gap * 100).toFixed(1)} % ${x.note}`)];
    (window as unknown as {__qaMotion?: string[]}).__qaMotion = lines; lines.forEach((l) => (l.startsWith('FAIL') ? console.error('[qa-motion]', l) : console.info('[qa-motion]', l)));
    return 0;
  }, [names]);
  return (
    <AbsoluteFill style={{background: '#111'}}>
      <ThreeCanvas width={HM_W} height={HM_H} flat gl={{preserveDrawingBuffer: true}} camera={{fov: 30, near: 0.05, far: 50, position: [0, 1.4, 3]}} style={{width: HM_W, height: HM_H}}><Multi names={names} /><Gate /></ThreeCanvas>
      {names.map((n, r) => HM_COLS.map((col, c) => (<div key={`${n}${c}`} style={{position: 'absolute', left: c * CW, top: r * CH, width: CW, height: CH, boxSizing: 'border-box', border: '1px solid #000', pointerEvents: 'none'}}><div style={{position: 'absolute', left: 3, top: 3, background: 'rgba(0,0,0,0.7)', color: '#fff', font: '700 10px Helvetica, Arial', padding: '1px 4px', borderRadius: 4}}>{c === 0 ? `${n} ` : ''}{col.name}</div></div>)))}
    </AbsoluteFill>
  );
};
export const HeadMotionSheet: React.FC = () => <HeadMotionSheetImpl />;
