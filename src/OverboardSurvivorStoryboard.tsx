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
import {ENTRIES, ENTRY_FRAMES, buildCam, gradeImagine} from './OverboardSurvivor';

export const SB_FPS = 30, SB_SHOT = 15, SB_FRAMES = ENTRIES.length * SB_SHOT;
export const GRID_W = 1080, GRID_COLS = 5, GRID_ROWS = Math.ceil(ENTRIES.length / GRID_COLS), CELL_W = GRID_W / GRID_COLS, CELL_H = 384, GRID_H = GRID_ROWS * CELL_H;
const HERO = ENTRIES.map((e, i) => { const n = ENTRY_FRAMES[i].to - ENTRY_FRAMES[i].from, f = Math.min(n - 1, e.hero), cam = buildCam(e).cam(f, n); return {f, n, cam}; });
const View: React.FC<{i: number; ss: number}> = ({i, ss}) => { const B = ENTRIES[i].Body; return <B f={HERO[i].f} n={HERO[i].n} c={HERO[i].cam} ss={ss} />; };

export const OverboardSurvivorStoryboard: React.FC = () => {
  const shots: ShotSpec[] = useMemo(() => ENTRIES.map((e, i) => ({from: i * SB_SHOT, to: (i + 1) * SB_SHOT, light: e.light, ownLights: true, cam: () => HERO[i].cam, post: (_f: number, pose: any) => (<EffectComposer multisampling={4}><FocusDof pose={pose} focal={e.focus(HERO[i].f)} r={e.h * 0.5} />{e.imagine ? gradeImagine() : gradeEffects()}</EffectComposer>), render: () => <View i={i} ss={2048} />})), []);
  return <SingleCanvasVideo shots={shots} fps={SB_FPS} />;
};
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
export const OverboardSurvivorStoryboardGrid: React.FC = () => (
  <AbsoluteFill style={{background: '#111'}}>
    <ThreeCanvas width={GRID_W} height={GRID_H} shadows="soft" flat gl={{preserveDrawingBuffer: true}} camera={{fov: 60, near: 0.05, far: 400, position: [0, 1.4, 6]}} style={{width: GRID_W, height: GRID_H}}><Multi /><Gate /></ThreeCanvas>
    {ENTRIES.map((e, i) => (<div key={e.id} style={{position: 'absolute', left: (i % GRID_COLS) * CELL_W, top: Math.floor(i / GRID_COLS) * CELL_H, width: CELL_W, height: CELL_H, boxSizing: 'border-box', border: '2px solid #111', pointerEvents: 'none'}}><div style={{position: 'absolute', left: 6, top: 6, background: 'rgba(0,0,0,0.72)', color: '#fff', font: '700 18px Helvetica, Arial, sans-serif', padding: '3px 7px', borderRadius: 6}}>{e.id} {e.zone}</div></div>))}
  </AbsoluteFill>
);
