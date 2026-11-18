// QA CONTACT SHEETS (ShoppingCartQASheet1..4): 5 shots per sheet, 5 frames per shot (0, 25, 50, 75, 100 %), 25 cells of 216x384 on one 1080x1920 canvas, with the focus centre (cross) and the
// framing box drawn on top. Open them in Studio and look: red cross = focus centre, cyan rectangle = framing box (must stay inside the cell), dashed green = CENTER_BOX.
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, useDelayRender, useRemotionEnvironment} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import {CENTER_BOX, toScreen} from './kit/camera';
import {EntryBody, ENTRIES, sheetCells} from './ShoppingCart';
import {looseFloorObjects, collisionCheck, headOverlapCheck, heldFramingCheck} from './kit/qa';

/** PIXEL CHECK (kit default): reads the drawn canvas, per cell. Flags (a) a nearly uniform region > 15 % of the cell (flat plane), (b) black / white holes > 10 %, (c) the clear colour showing > 15 %. */
const CLEAR: Record<string, [number, number, number]> = {aisle: [0xcd, 0xef, 0xf5], register: [0xcd, 0xef, 0xf5], entrance: [0xcd, 0xef, 0xf5], garage: [0x9f, 0xd6, 0xf5]};
function pixelCheck(cv: HTMLCanvasElement, cells: ReturnType<typeof sheetCells>): string[] {
  const W = 1080, H = 1920, t = document.createElement('canvas'); t.width = W; t.height = H; const x = t.getContext('2d', {willReadFrequently: true})!; x.drawImage(cv, 0, 0, W, H); const out: string[] = [], BW = 27, BH = 48;
  cells.forEach((c, i) => {
    const ox = (i % 5) * CW, oy = Math.floor(i / 5) * CH, mean: number[][] = [], flat: boolean[] = [], std: number[] = []; let hole = 0, clear = 0; const cl = CLEAR[ENTRIES[c.i].zone];
    for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) { const d = x.getImageData(ox + bx * BW, oy + by * BH, BW, BH).data; let r = 0, g = 0, b = 0, n = 0; for (let q = 0; q < d.length; q += 16) { r += d[q]; g += d[q + 1]; b += d[q + 2]; n++; } r /= n; g /= n; b /= n; let v = 0; for (let q = 0; q < d.length; q += 16) v += (d[q] - r) ** 2 + (d[q + 1] - g) ** 2 + (d[q + 2] - b) ** 2; const sd = Math.sqrt(v / n / 3); mean.push([r, g, b]); std.push(sd); flat.push(sd < 4.5); if ((r + g + b) / 3 < 6 || (r + g + b) / 3 > 249) hole++; if (Math.abs(r - cl[0]) < 3 && Math.abs(g - cl[1]) < 3 && Math.abs(b - cl[2]) < 3) clear++; }
    let uni = 0; for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) { const i0 = by * 8 + bx; if (!flat[i0]) continue; const nb = [[bx - 1, by], [bx + 1, by], [bx, by - 1], [bx, by + 1]].filter(([a, b]) => a >= 0 && a < 8 && b >= 0 && b < 8).map(([a, b]) => b * 8 + a); if (nb.every((j) => flat[j] && Math.abs(mean[j][0] - mean[i0][0]) + Math.abs(mean[j][1] - mean[i0][1]) + Math.abs(mean[j][2] - mean[i0][2]) < 14)) uni++; }
    const bad = uni / 64 > 0.15 || hole / 64 > 0.1 || clear / 64 > 0.15; out.push(`${bad ? 'FAIL' : 'PASS'} pixels ${c.id}@${c.f}: flat ${(uni / 64 * 100).toFixed(0)} % holes ${(hole / 64 * 100).toFixed(0)} % clear ${(clear / 64 * 100).toFixed(0)} %`);
  });
  return out;
}

const CW = 216, CH = 384;
export const SHEETS = 4; // 18 shots: 5 + 5 + 5 + 3
/** GENERIC OCCLUSION CHECK (kit default): raycast from the camera to the focus against EVERY mesh of the cell's scene except a short ignore list (inverted-hull outlines and sky = BackSide, additive FX, points, huge planes). Any hit before the focus = blocked. */
const IGNORE_RADIUS = 40;
function occlusionCheck(group: THREE.Group, c: ReturnType<typeof sheetCells>[number]): string[] {
  const o = new THREE.Vector3(...c.pose.p), t = new THREE.Vector3(...c.focus), dir = t.clone().sub(o), dist = dir.length(); dir.normalize();
  const rc = new THREE.Raycaster(o, dir, 0.05, Math.max(0.1, dist - c.h * 0.5)); rc.camera = new THREE.PerspectiveCamera(); // sprites (glints) need a camera to raycast
  group.updateWorldMatrix(true, true);
  const out: string[] = [], sph = new THREE.Sphere();
  for (const h of rc.intersectObject(group, true)) {
    const m = h.object as THREE.Mesh, mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material & {color?: THREE.Color; opacity: number};
    if ((m as unknown as {isPoints?: boolean}).isPoints || !mat || mat.side === THREE.BackSide || mat.blending === THREE.AdditiveBlending || (mat.transparent && mat.opacity < 0.95 && !(mat as THREE.MeshBasicMaterial).alphaTest)) continue;
    if (!(m as THREE.InstancedMesh).isInstancedMesh && m.geometry) { m.geometry.computeBoundingSphere(); sph.copy(m.geometry.boundingSphere!).applyMatrix4(m.matrixWorld); if (sph.radius > IGNORE_RADIUS) continue; } // sky, ground, far field planes
    out.push(`${m.geometry?.type}${(m as THREE.InstancedMesh).isInstancedMesh ? `[inst ${h.instanceId}]` : ''} #${mat.color?.getHexString() ?? '?'} at ${h.distance.toFixed(2)} m of ${dist.toFixed(2)} (point ${h.point.x.toFixed(1)}, ${h.point.y.toFixed(1)}, ${h.point.z.toFixed(1)})`);
  }
  return out;
}
const Multi: React.FC<{cells: ReturnType<typeof sheetCells>}> = ({cells}) => {
  const cnt = useRef(0), done = useRef(false), gl = useThree((s) => s.gl), scene = useThree((s) => s.scene), groups = useRef<(THREE.Group | null)[]>([]), col = useMemo(() => new THREE.Color(), []);
  const cams = useMemo(() => cells.map((c) => { const k = new THREE.PerspectiveCamera(c.pose.fov ?? 62, 9 / 16, 0.05, 400); k.position.set(...c.pose.p); k.lookAt(...c.pose.l); if (c.pose.roll) k.rotateZ((c.pose.roll * Math.PI) / 180); k.updateMatrixWorld(); return k; }), [cells]);
  useFrame(() => {
    gl.autoClear = false; gl.setScissorTest(true);
    cells.forEach((c, i) => { const x = (i % 5) * CW, y = 1920 - (Math.floor(i / 5) + 1) * CH; groups.current.forEach((g, j) => { if (g) g.visible = j === i; }); gl.setViewport(x, y, CW, CH); gl.setScissor(x, y, CW, CH); gl.setClearColor(col.set('#cdeff5'), 1); gl.clear(true, true, true); gl.render(scene, cams[i]); });
    groups.current.forEach((g) => { if (g) g.visible = false; }); gl.setScissorTest(false);
    cnt.current++; if (!done.current && cnt.current >= 3) { done.current = true; const res: string[] = []; cells.forEach((c, i) => { const g = groups.current[i]; if (!g) return; const hits = occlusionCheck(g, c); res.push(`${hits.length ? 'FAIL' : 'PASS'} occlusion ${c.id}@${c.f}${hits.length ? ': ' + hits.slice(0, 3).join(' | ') : ''}`); }); const clut = cells.map((c, i) => { const g = groups.current[i]; const n = g ? looseFloorObjects(g) : 0; return `${n > 15 ? 'FAIL' : 'PASS'} clutter ${c.id}@${c.f}: ${n} small loose floor objects`; }); const col = cells.map((c, i) => { const g = groups.current[i]; const hits = g ? [...collisionCheck(g), ...headOverlapCheck(g, cams[i]), ...(c.f >= 0.25 * c.n ? heldFramingCheck(g, cams[i]) : [])] : []; return `${hits.length ? 'FAIL' : 'PASS'} collision ${c.id}@${c.f}${hits.length ? ': ' + hits.slice(0, 4).join(' | ') : ''}`; }); (window as unknown as {__qaCol?: string[]}).__qaCol = col; col.forEach((l) => (l.startsWith('FAIL') ? console.error('[qa-col]', l) : console.info('[qa-col]', l))); (window as unknown as {__qaClutter?: string[]}).__qaClutter = clut; clut.forEach((l) => (l.startsWith('FAIL') ? console.error('[qa-clutter]', l) : console.info('[qa-clutter]', l)));
    (window as unknown as {__qaOcc?: string[]}).__qaOcc = res; res.forEach((l) => (l.startsWith('FAIL') ? console.error('[qa-occ]', l) : console.info('[qa-occ]', l))); }
  }, 1);
  return <>{cells.map((c, i) => <group key={i} ref={(g) => { groups.current[i] = g; }} visible={false}><EntryBody i={c.i} f={c.f} n={c.n} c={c.pose} ss={512} /></group>)}</>;
};
const Gate: React.FC<{cells: ReturnType<typeof sheetCells>}> = ({cells}) => {
  const gl = useThree((s) => s.gl), {delayRender, continueRender} = useDelayRender(), invalidate = useThree((s) => s.invalidate), advance = useThree((s) => s.advance), {isRendering} = useRemotionEnvironment();
  useLayoutEffect(() => { const h = delayRender('qa sheet', {timeoutInMilliseconds: 180000}); let done = false, r2 = 0; const draw = () => { try { if (isRendering) advance(performance.now()); else invalidate(); } catch (e) { console.warn(e); } }; const fin = () => { if (done) return; done = true; draw(); continueRender(h); window.setTimeout(() => { try { const r = pixelCheck(gl.domElement, cells); (window as unknown as {__qaPix?: string[]}).__qaPix = r; r.forEach((l) => (l.startsWith('FAIL') ? console.error('[qa-pixels]', l) : console.info('[qa-pixels]', l))); } catch (e) { console.warn('pixel check failed', e); } }, 6000); }; draw(); const r1 = requestAnimationFrame(() => { draw(); r2 = requestAnimationFrame(fin); }); const t = window.setTimeout(fin, 4000); return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); window.clearTimeout(t); fin(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};
const Sheet: React.FC<{sheet: number}> = ({sheet}) => {
  const cells = useMemo(() => [1, 2, 3, 4, 5].filter((k) => (sheet - 1) * 5 + k <= 18).flatMap((k) => sheetCells((sheet - 1) * 5 + k)), [sheet]);
  return (
    <AbsoluteFill style={{background: '#111'}}>
      <ThreeCanvas width={1080} height={1920} shadows="soft" flat gl={{preserveDrawingBuffer: true}} camera={{fov: 60, near: 0.05, far: 400, position: [0, 1.4, 6]}} style={{width: 1080, height: 1920}}><Multi cells={cells} /><Gate cells={cells} /></ThreeCanvas>
      {cells.map((c, i) => {
        const x0 = (i % 5) * CW, y0 = Math.floor(i / 5) * CH, s = toScreen(c.pose, c.focus), px = (v: number, w: number) => (v / w);
        const up: [number, number, number] = c.axis === 'z' ? [0, 0, c.h / 2] : [0, c.h / 2, 0], q1 = toScreen(c.pose, [c.focus[0] - up[0], c.focus[1] - up[1], c.focus[2] - up[2]]), q2 = toScreen(c.pose, [c.focus[0] + up[0], c.focus[1] + up[1], c.focus[2] + up[2]]), a = s.x / 1080 - 0.02, b = s.x / 1080 + 0.02, d = Math.min(q1.y, q2.y) / 1920, e = Math.max(q1.y, q2.y) / 1920; void px; // cyan = the focus height (size band)
        return (
          <div key={i} style={{position: 'absolute', left: x0, top: y0, width: CW, height: CH, boxSizing: 'border-box', border: '1px solid #000', overflow: 'hidden'}}>
            <div style={{position: 'absolute', left: CENTER_BOX.x0 * CW, top: CENTER_BOX.y0 * CH, width: (CENTER_BOX.x1 - CENTER_BOX.x0) * CW, height: (CENTER_BOX.y1 - CENTER_BOX.y0) * CH, border: '1px dashed #00ff9c'}} />
            <div style={{position: 'absolute', left: a * CW, top: d * CH, width: (b - a) * CW, height: (e - d) * CH, border: '2px solid #00e5ff', boxSizing: 'border-box'}} />
            <div style={{position: 'absolute', left: (s.x / 1080) * CW - 9, top: (s.y / 1920) * CH - 1, width: 18, height: 2, background: '#ff2d2d'}} /><div style={{position: 'absolute', left: (s.x / 1080) * CW - 1, top: (s.y / 1920) * CH - 9, width: 2, height: 18, background: '#ff2d2d'}} />
            <div style={{position: 'absolute', left: 3, top: 3, background: 'rgba(0,0,0,0.7)', color: '#fff', font: '700 11px Helvetica, Arial', padding: '2px 4px', borderRadius: 4}}>{c.id} {c.ang} f{c.f}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
export const ShoppingCartQASheet1: React.FC = () => <Sheet sheet={1} />;
export const ShoppingCartQASheet2: React.FC = () => <Sheet sheet={2} />;
export const ShoppingCartQASheet3: React.FC = () => <Sheet sheet={3} />;
export const ShoppingCartQASheet4: React.FC = () => <Sheet sheet={4} />;
// qa 1794937965
