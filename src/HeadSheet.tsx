// HeadSheet: 2D-canvas-only contact sheet for the rickRig characters (no WebGL, no audio).
// Row 1: black silhouettes. Rows 2-4: each character at facing yaw 0 / 45 / 90 / 135 / 180 deg (torso + head, card yaw 0 so facing = yaw). Rows 5-7: the 8-face library.
import React, {useLayoutEffect, useRef} from 'react';
import {CH, CW, PXM, DEG, FACE_LIBRARY, Kind, REST, drawHead, drawHeadSilhouette, drawRick, drawTorsoSilhouette, solve} from './kit/rickRig';
import {TINT_COLORS, TintState, TintZone} from './kit/tint';
import {SHAPES} from './kit/data/shapes';
import {sitPose} from './kit/sit';

export const HS_W = 1800, HS_H = 4300;
const EIGHT = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] as Kind[];
const KINDS: Kind[] = ['cop', 'prisoner', 'tall'];
const YAWS = [0, 45, 90, 135, 180];
export const HeadSheet: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current!.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#DDE5EB'; c.fillRect(0, 0, HS_W, HS_H);
    KINDS.forEach((k, i) => { c.save(); c.translate(300 + i * 600, 190); c.scale(0.85, 0.85); drawHeadSilhouette(c, k); c.restore(); });
    KINDS.forEach((k, r) => YAWS.forEach((y, i) => {
      const card = document.createElement('canvas'); card.width = CW; card.height = CH; const cc = card.getContext('2d')!;
      const dir: [number, number] = [Math.sin(y * DEG), Math.cos(y * DEG)], pose = {...REST, fwd: dir, face: 'annoyed' as const};
      drawRick(cc, k, pose, solve(k, pose, 0), 0);
      c.drawImage(card, i * 350 + 40, 370 + r * 340, 270, 300);
      c.fillStyle = '#233853'; c.font = '20px sans-serif'; c.fillText(`${k} yaw ${y}`, i * 350 + 40, 370 + r * 340 + 320);
    }));
    KINDS.forEach((k, i) => { // stepping poses (profile and from the front): ONE gentle arc per leg and arm, no knee
      for (const [j, y] of [[0, 90], [1, 0]] as [number, number][]) {
        const card = document.createElement('canvas'); card.width = CW; card.height = CH; const cc = card.getContext('2d')!;
        const pose = {...REST, fwd: [Math.sin(y * DEG), Math.cos(y * DEG)] as [number, number], legSw: [0.55, -0.55] as [number, number], bend: [1, 0] as [number, number], armSw: [-0.5, 0.5] as [number, number], face: 'smug' as const};
        drawRick(cc, k, pose, solve(k, pose, 0), 0);
        c.drawImage(card, i * 600 + j * 290 + 20, 1380, 270, 300);
      }
    });
    KINDS.forEach((k, r) => FACE_LIBRARY.forEach((f, i) => { c.save(); c.translate(112 + i * 225, 1820 + r * 150); c.scale(0.45, 0.45); drawHead(c, k, f); c.restore(); }));
    c.fillStyle = '#233853'; c.font = '20px sans-serif'; c.fillText(FACE_LIBRARY.join('   '), 20, 2300 - 12);
    // 8 generated characters (c1..c8): black head silhouettes, black torso silhouettes, then full characters (front view, deadpan)
    c.fillText('generated characters c1..c8: head silhouettes / torso silhouettes / characters', 20, 2345);
    EIGHT.forEach((k, i) => {
      c.save(); c.translate(112 + i * 225, 2450); c.scale(0.42, 0.42); drawHeadSilhouette(c, k); c.restore();
      const t = document.createElement('canvas'); t.width = CW; t.height = CH; const tc = t.getContext('2d')!; drawTorsoSilhouette(tc, k); c.drawImage(t, 0, 280, CW, 340, 6 + i * 225, 2610, 216, 87);
      const card = document.createElement('canvas'); card.width = CW; card.height = CH; const cc = card.getContext('2d')!, pose = {...REST, face: 'deadpan' as const};
      drawRick(cc, k, pose, solve(k, pose, 0), 0); c.drawImage(card, 6 + i * 225, 2740, 216, 240); c.fillStyle = '#233853'; c.fillText(k, 100 + i * 225, 3000);
    });
    // narration-driven head tint API: partial and full tints on the same head, intensity 0.8 (heads are white by default)
    c.fillText('tint API: cheeks (embarrassed) / around-eyes (angry) / forehead (cold) / upper-half (angry) / full (sick) / none (default)', 20, 3045);
    const demo: [TintState, TintZone][] = [['embarrassed', 'cheeks'], ['angry', 'around-eyes'], ['cold', 'forehead'], ['angry', 'upper-half'], ['sick', 'full']];
    void TINT_COLORS;
    [...demo, null].forEach((d, i) => { c.save(); c.translate(150 + i * 290, 3200); c.scale(0.9, 0.9); drawHead(c, 'prisoner', 'deadpan', 0, d ? [{state: d[0], zone: d[1], k: 0.8}] : []); c.restore(); });
    // MY drawn shapes (characters/shapes, via scripts/build_shapes.mjs): every loaded head and body as a black silhouette
    c.fillStyle = '#233853'; c.fillText(`loaded shapes: ${SHAPES.heads.map((h) => h.name).join(', ')} / ${SHAPES.bodies.map((b) => b.name).join(', ')}`, 20, 3345);
    SHAPES.heads.forEach((h, i) => { c.save(); c.translate(150 + i * 300, 3480); c.fillStyle = '#12202E'; c.beginPath(); h.pts.forEach((q, k) => (k ? c.lineTo(q[0] * 220, (q[1] - 0.5) * 220) : c.moveTo(q[0] * 220, (q[1] - 0.5) * 220))); c.closePath(); c.fill(); c.restore(); c.fillText(h.name, 110 + i * 300, 3610); });
    SHAPES.bodies.forEach((b, i) => { c.save(); c.translate(1150 + i * 300, 3400); c.fillStyle = '#12202E'; c.beginPath(); b.pts.forEach((q, k) => (k ? c.lineTo(q[0] * 230, q[1] * 230 - 0) : c.moveTo(q[0] * 230, q[1] * 230 - 0))); c.closePath(); c.fill(); c.restore(); c.fillText(b.name, 1110 + i * 300, 3660); });
    // SITTING (flat preview of the 3D limbs): table front, table 3/4, bench front, bench 3/4, and mirrored 3/4
    c.fillText('sitting: table front / table 3/4 / bench front / bench 3/4 / bench 3/4 mirrored (flat preview; the scene draws 3D tubes)', 20, 3700);
    ([['table', 'front', false], ['table', 'three-quarter', false], ['bench', 'front', false], ['bench', 'three-quarter', false], ['bench', 'three-quarter', true]] as ['table' | 'bench', 'front' | 'three-quarter', boolean][]).forEach(([seat, view, mir], i) => {
      const r = sitPose('cop', {seat, view, camYaw: 0, mirror: mir}), card = document.createElement('canvas'); card.width = CW; card.height = CH; const cc = card.getContext('2d')!;
      drawRick(cc, 'cop', r.pose, solve('cop', r.pose, 0), 0);
      const dy = r.yOffset / PXM; c.drawImage(card, 0, -dy * 0, CW, CH, i * 350 + 20, 3720 + dy * 0.3, 300, 333);
      if (seat === 'table') { c.fillStyle = '#b07a3a'; const ty = 3720 + (CH - (r.tableTop - r.yOffset) / PXM) * 0.333; c.fillRect(i * 350 + 100, ty, 230, 8); c.fillStyle = '#233853'; }
    });
  }, []);
  return <canvas ref={ref} width={HS_W} height={HS_H} style={{width: HS_W, height: HS_H}} />;
};
