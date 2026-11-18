// OVERBOARD_SURVIVOR storyboard stills. OverboardSurvivorStoryboard = one 15-frame sequence per entry at its HERO frame (static pose, final-ish camera), one WebGL canvas, hard cuts;
// OverboardSurvivorStoryboardGrid = the same stills as one contact sheet (4 x 5 cells of 270 x 480, 1080 x 2400). Studio only. Frame to print for entry k (0-based): k * 15 + 7.
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, useDelayRender, useRemotionEnvironment} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import {EffectComposer} from '@react-three/postprocessing';
import {ShotSpec, SingleCanvasVideo} from './kit/kit';
import {FocusDof} from './kit/Dof';
import {gradeEffects} from './kit/Grade';
import {Sea} from './ocean/base';
import {Heli} from './ocean/ships';
import {Pose} from './kit/kit';

export const GRID_W = 1080, GRID_COLS = 2, CELL_W = 540, CELL_H = 960, GRID_H = 1920;
const ENTRIES = [{id: 'front', zone: 'heli'}, {id: 'side', zone: 'heli'}, {id: 'rear', zone: 'heli'}, {id: 'top', zone: 'heli'}];
const HERO: {cam: Pose}[] = [[0, 2, 24], [24, 3, 0], [0, 2, -24], [3, 26, 6]].map((p) => ({cam: {p: p as [number, number, number], l: [-1.5, 1, 0] as [number, number, number], fov: 50}}));
const View: React.FC<{i: number; ss: number}> = () => (<><Sea mode="day" g={0} focus={[0, 5, 0]} ss={1024} /><Heli p={[0, 6, 0]} yaw={0} f={9} cable={4} /></>);
const Multi: React.FC = () => {
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene), size = useThree((s) => s.size), groups = useRef<(THREE.Group | null)[]>([]), col = useMemo(() => new THREE.Color('#2a6f86'), []);
  const cams = useMemo(() => HERO.map((h) => { const c = new THREE.PerspectiveCamera(h.cam.fov ?? 62, CELL_W / CELL_H, 0.05, 400); c.position.set(...h.cam.p); c.lookAt(...h.cam.l); if (h.cam.roll) c.rotateZ((h.cam.roll * Math.PI) / 180); c.updateMatrixWorld(); return c; }), []);
  useFrame(() => {
    gl.autoClear = false; gl.setScissorTest(true);
    ENTRIES.forEach((_e, i) => { const x = (i % GRID_COLS) * CELL_W, y = size.height - (Math.floor(i / GRID_COLS) + 1) * CELL_H; groups.current.forEach((g, j) => { if (g) g.visible = j === i; }); gl.setViewport(x, y, CELL_W, CELL_H); gl.setScissor(x, y, CELL_W, CELL_H); gl.setClearColor(col, 1); gl.clear(true, true, true); gl.render(scene, cams[i]); });
    groups.current.forEach((g) => { if (g) g.visible = false; }); gl.setScissorTest(false);
  }, 1);
  return <>{ENTRIES.map((e, i) => <group key={e.id} ref={(g) => { groups.current[i] = g; }} visible={false}><View i={i} ss={1024} /></group>)}</>;
};
const Gate: React.FC = () => {
  const {delayRender, continueRender} = useDelayRender(), invalidate = useThree((s) => s.invalidate), advance = useThree((s) => s.advance), {isRendering} = useRemotionEnvironment();
  useLayoutEffect(() => { const h = delayRender('grid drawn', {timeoutInMilliseconds: 180000}); let done = false, r2 = 0; const draw = () => { try { if (isRendering) advance(performance.now()); else invalidate(); } catch (e) { console.warn(e); } }; const fin = () => { if (done) return; done = true; draw(); continueRender(h); }; draw(); const r1 = requestAnimationFrame(() => { draw(); r2 = requestAnimationFrame(fin); }); const t = window.setTimeout(fin, 3000); return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); window.clearTimeout(t); fin(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};
export const OverboardSurvivorHeliSheet: React.FC = () => (
  <AbsoluteFill style={{background: '#111'}}>
    <ThreeCanvas width={GRID_W} height={GRID_H} shadows="soft" flat gl={{preserveDrawingBuffer: true}} camera={{fov: 60, near: 0.05, far: 400, position: [0, 1.4, 6]}} style={{width: GRID_W, height: GRID_H}}><Multi /><Gate /></ThreeCanvas>
    {ENTRIES.map((e, i) => (<div key={e.id} style={{position: 'absolute', left: (i % GRID_COLS) * CELL_W, top: Math.floor(i / GRID_COLS) * CELL_H, width: CELL_W, height: CELL_H, boxSizing: 'border-box', border: '2px solid #111', pointerEvents: 'none'}}><div style={{position: 'absolute', left: 6, top: 6, background: 'rgba(0,0,0,0.72)', color: '#fff', font: '700 18px Helvetica, Arial, sans-serif', padding: '3px 7px', borderRadius: 6}}>{e.id}</div></div>))}
  </AbsoluteFill>
);
