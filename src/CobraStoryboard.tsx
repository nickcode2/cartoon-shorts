// COBRA_EFFECT PHASE 1: storyboard stills. Studio only (no render needed), no animation, no narration timing.
//   CobraStoryboard      15 sequences x 15 frames (0.5 s), one per SHOT, each a fully static hero pose with its final camera angle,
//                        troll face / tint / pop-up label already visible. Built on the single-canvas kit (one WebGL canvas, hard cuts, [gpu] log per shot).
//   CobraStoryboardGrid  the same 15 stills as a contact sheet, 3 columns x 5 rows of 9:16 cells (1080 x 3200), one canvas, one scissored pass per cell.
// Frame to print for shot n (middle of its 15 frames): (n - 1) * 15 + 7 -> 7, 22, 37, 52, 67, 82, 97, 112, 127, 142, 157, 172, 187, 202, 217.
// Open ?safe=1 on the Studio URL for the CENTER_BOX overlay (CobraStoryboard only).
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, useDelayRender, useRemotionEnvironment} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import {EffectComposer} from '@react-three/postprocessing';
import {ShotSpec, SingleCanvasVideo} from './kit/kit';
import {FocusDof} from './kit/Dof';
import {SHOTS, ShotDef, useFredoka} from './cobra/shots';

export const CS_FPS = 30;
export const CS_SHOT_FRAMES = 15;
export const CS_FRAMES = SHOTS.length * CS_SHOT_FRAMES; // 225
export const GRID_W = 1080, GRID_H = 3200, GRID_COLS = 3, GRID_ROWS = 5;

const ShotView: React.FC<{def: ShotDef; ss: number}> = ({def, ss}) => {
  const ready = useFredoka();
  return <def.Body cam={def.cam} ready={ready} ss={ss} />;
};

export const CobraStoryboard: React.FC = () => {
  const shots: ShotSpec[] = useMemo(() => SHOTS.map((s, i) => ({
    from: i * CS_SHOT_FRAMES, to: (i + 1) * CS_SHOT_FRAMES, light: 'day', ownLights: true, cam: () => s.cam,
    post: (_f, pose) => (<EffectComposer multisampling={4}><FocusDof pose={pose} focal={s.focal} r={s.r} /></EffectComposer>),
    render: () => <ShotView def={s} ss={2048} />,
  })), []);
  return <SingleCanvasVideo shots={shots} fps={CS_FPS} />;
};

// ---------------------------------------------------------------- contact sheet
const SET_BG: Record<string, string> = {STREET: '#9fd6f5', OFFICE: '#e8d4b8', GARAGE: '#9fd6f5'};
const MultiView: React.FC = () => {
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene), size = useThree((s) => s.size);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const cams = useMemo(() => SHOTS.map((s) => { const c = new THREE.PerspectiveCamera(s.cam.fov ?? 62, 9 / 16, 0.05, 400); c.position.set(...s.cam.p); c.lookAt(...s.cam.l); c.updateMatrixWorld(); return c; }), []);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const W = size.width / GRID_COLS, H = size.height / GRID_ROWS;
    gl.autoClear = false; gl.setScissorTest(true);
    SHOTS.forEach((s, i) => {
      const cx = i % GRID_COLS, cy = Math.floor(i / GRID_COLS), x = cx * W, y = size.height - (cy + 1) * H;
      groups.current.forEach((g, j) => { if (g) g.visible = j === i; });
      gl.setViewport(x, y, W, H); gl.setScissor(x, y, W, H); gl.setClearColor(col.set(SET_BG[s.set]), 1); gl.clear(true, true, true);
      gl.render(scene, cams[i]);
    });
    groups.current.forEach((g) => { if (g) g.visible = false; });
    gl.setScissorTest(false);
  }, 1);
  return (
    <>
      {SHOTS.map((s, i) => (<group key={s.n} ref={(g) => { groups.current[i] = g; }} visible={false}><ShotView def={s} ss={1024} /></group>))}
    </>
  );
};
const GridGate: React.FC = () => {
  const {delayRender, continueRender} = useDelayRender();
  const invalidate = useThree((s) => s.invalidate), advance = useThree((s) => s.advance), {isRendering} = useRemotionEnvironment();
  useLayoutEffect(() => {
    const h = delayRender('storyboard grid drawn', {timeoutInMilliseconds: 120000});
    let done = false, r2 = 0;
    const draw = () => { try { if (isRendering) advance(performance.now()); else invalidate(); } catch (e) { console.warn('grid draw failed', e); } };
    const finish = () => { if (done) return; done = true; draw(); continueRender(h); };
    draw();
    const r1 = requestAnimationFrame(() => { draw(); r2 = requestAnimationFrame(finish); });
    const t = window.setTimeout(finish, 2500);
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); window.clearTimeout(t); finish(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};
export const CobraStoryboardGrid: React.FC = () => {
  const W = GRID_W / GRID_COLS, H = GRID_H / GRID_ROWS;
  return (
    <AbsoluteFill style={{background: '#111'}}>
      <ThreeCanvas width={GRID_W} height={GRID_H} shadows="soft" flat gl={{preserveDrawingBuffer: true}} camera={{fov: 60, near: 0.05, far: 400, position: [0, 1.4, 6]}} style={{width: GRID_W, height: GRID_H}}>
        <MultiView />
        <GridGate />
      </ThreeCanvas>
      {SHOTS.map((s, i) => (
        <div key={s.n} style={{position: 'absolute', left: (i % GRID_COLS) * W, top: Math.floor(i / GRID_COLS) * H, width: W, height: H, boxSizing: 'border-box', border: '3px solid #111', pointerEvents: 'none'}}>
          <div style={{position: 'absolute', left: 8, top: 8, background: 'rgba(0,0,0,0.72)', color: '#fff', font: '700 22px/1.2 Helvetica, Arial, sans-serif', padding: '5px 9px', borderRadius: 8, maxWidth: W - 30}}>
            {s.n} · {s.set} {s.angle}{s.troll !== '-' ? ` · face: ${s.troll}` : ''}
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
