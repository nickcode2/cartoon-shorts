// HEAD TURNAROUND CONTACT SHEETS (kit QA, 2026-11-17): every character at 8 head yaws (0, 30, 60, 90, 135, 180, -60, -90) with the full 3D gear on, 6 characters per sheet (8 columns x 6 rows,
// 135 x 320 cells on a 1080 x 1920 canvas). Open HeadTurnaroundSheet1..N in Studio and LOOK: hats, hair, beards and mustaches must stay on the head in every column.
// On mount it also logs the numeric checks: [qa-attach] (hat ring vs head art at every yaw, hair / beard offsets) and [qa-relief] (the relief shadow is dark and on the lower right).
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, useDelayRender, useRemotionEnvironment} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import {Person, SPECS, headPos, poseOf} from './kit/person';
import {ATTACH_YAWS, attachReport, facialReport, faceVisibilityReport, fitReport} from './kit/headgear';
import {runReliefCheck} from './kit/qa';
import './shop/cast';
import './shop/shots';

export const TA_W = 1080, TA_H = 1920, COLS = 8, ROWS = 6, CW = TA_W / COLS, CH = TA_H / ROWS;
const roles = () => Object.keys(SPECS);
export const TURN_SHEETS = () => Math.ceil(roles().length / ROWS);
const cell = (role: string) => { const h = headPos(role, [0, 0, 0], 0.9), sc = SPECS[role].scale, d = 1.9 * (0.8 + 0.2 * sc), cam: [number, number, number] = [0, h[1] + 0.04, d]; return {cam, look: [0, h[1] - 0.02, 0] as [number, number, number]}; };
const Multi: React.FC<{names: string[]}> = ({names}) => {
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene), groups = useRef<(THREE.Group | null)[]>([]), col = useMemo(() => new THREE.Color('#bfe3ea'), []);
  const cams = useMemo(() => names.map((n) => { const c = cell(n), k = new THREE.PerspectiveCamera(34, CW / CH, 0.05, 50); k.position.set(...c.cam); k.lookAt(...c.look); k.updateMatrixWorld(); return k; }), [names]);
  useFrame(() => {
    gl.autoClear = false; gl.setScissorTest(true);
    names.forEach((_n, r) => { for (let c = 0; c < COLS; c++) { const i = r * COLS + c, x = c * CW, y = TA_H - (r + 1) * CH; groups.current.forEach((g, j) => { if (g) g.visible = j === i; }); gl.setViewport(x, y, CW, CH); gl.setScissor(x, y, CW, CH); gl.setClearColor(col, 1); gl.clear(true, true, true); gl.render(scene, cams[r]); } });
    groups.current.forEach((g) => { if (g) g.visible = false; }); gl.setScissorTest(false);
  }, 1);
  return (<>
    <hemisphereLight args={['#FFF3D6', '#8A6A50', 2.2]} /><directionalLight color="#FFE2B0" intensity={1.7} position={[-6, 9, 5]} />
    {names.flatMap((n, r) => ATTACH_YAWS.map((yw, c) => {
      const i = r * COLS + c, a = (yw * Math.PI) / 180, cam = cell(n).cam, pose = poseOf([0, 0, 0], cam, {headFwd: [Math.sin(a), Math.cos(a)], face: 'happyArc'});
      return (<group key={i} ref={(g) => { groups.current[i] = g; }} visible={false}><Person role={n} p={[0, 0, 0]} s={0.9} cam={cam} pose={pose} noCane /></group>);
    }))}
  </>);
};
const Gate: React.FC = () => {
  const {delayRender, continueRender} = useDelayRender(), invalidate = useThree((s) => s.invalidate), advance = useThree((s) => s.advance), {isRendering} = useRemotionEnvironment();
  useLayoutEffect(() => { const h = delayRender('turnaround', {timeoutInMilliseconds: 180000}); let done = false, r2 = 0; const draw = () => { try { if (isRendering) advance(performance.now()); else invalidate(); } catch (e) { console.warn(e); } }; const fin = () => { if (done) return; done = true; draw(); continueRender(h); }; draw(); const r1 = requestAnimationFrame(() => { draw(); r2 = requestAnimationFrame(fin); }); const t = window.setTimeout(fin, 3000); return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); window.clearTimeout(t); fin(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};
const Sheet: React.FC<{sheet: number}> = ({sheet}) => {
  const names = useMemo(() => roles().slice((sheet - 1) * ROWS, sheet * ROWS), [sheet]);
  useMemo(() => {
    const rows = roles().flatMap((r) => [...attachReport(r, SPECS[r].kind, SPECS[r].gear), ...facialReport(r, SPECS[r].kind, SPECS[r].facial), ...faceVisibilityReport(r, SPECS[r].kind, SPECS[r].gear), ...fitReport(r, SPECS[r].kind, SPECS[r].gear)]), bad = rows.filter((x) => !x.ok);
    const lines = [`${bad.length ? 'FAIL' : 'PASS'} accessory attachment: ${rows.length} checks over ${roles().length} characters x ${ATTACH_YAWS.length} yaws (3D hats / hair: gap < 3 % of head width, hat on the crown; 2D face props inside the face silhouette; no hat / hair over the face features; hair clear of the hat)`, ...bad.slice(0, 10).map((x) => `FAIL ${x.role}@${x.yaw}: gap ${(x.gap * 100).toFixed(1)} % ${x.note}`)];
    const rel = runReliefCheck(); (window as unknown as {__qaAttach?: string[]}).__qaAttach = [...lines, ...rel]; [...lines, ...rel].forEach((l) => (l.startsWith('FAIL') ? console.error('[qa-attach]', l) : console.info('[qa-attach]', l)));
    return 0;
  }, []);
  return (
    <AbsoluteFill style={{background: '#111'}}>
      <ThreeCanvas width={TA_W} height={TA_H} flat gl={{preserveDrawingBuffer: true}} camera={{fov: 30, near: 0.05, far: 50, position: [0, 1.4, 3]}} style={{width: TA_W, height: TA_H}}><Multi names={names} /><Gate /></ThreeCanvas>
      {names.map((n, r) => ATTACH_YAWS.map((yw, c) => (<div key={`${n}${c}`} style={{position: 'absolute', left: c * CW, top: r * CH, width: CW, height: CH, boxSizing: 'border-box', border: '1px solid #000', pointerEvents: 'none'}}><div style={{position: 'absolute', left: 3, top: 3, background: 'rgba(0,0,0,0.7)', color: '#fff', font: '700 11px Helvetica, Arial', padding: '1px 4px', borderRadius: 4}}>{c === 0 ? `${n} ` : ''}{yw}</div></div>)))}
    </AbsoluteFill>
  );
};
export const HeadTurnaroundSheet1: React.FC = () => <Sheet sheet={1} />;
export const HeadTurnaroundSheet2: React.FC = () => <Sheet sheet={2} />;
export const HeadTurnaroundSheet3: React.FC = () => <Sheet sheet={3} />;
export const HeadTurnaroundSheet4: React.FC = () => <Sheet sheet={4} />;
export const HeadTurnaroundSheet5: React.FC = () => <Sheet sheet={5} />;
