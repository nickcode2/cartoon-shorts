// Still sheet of the fixed expression set, for approving the hoodie man's face. Plain 2D canvas (no WebGL).
import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EXPR, ExprName, drawHairDebug, drawHoodieMan, hairReport} from './hoodieMan';

const NAMES: ExprName[] = ['neutral', 'smug', 'angry', 'surprised', 'laughing'];
export const SHEET_W = 1920;
export const SHEET_H = 1300; // row 1: expressions, row 2: hair check (debug overlay: head ellipse magenta, hair loop cyan, tips yellow)

export const ExpressionSheet: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  useLayoutEffect(() => {
    const cv = ref.current!;
    const c = cv.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#e9e2d0';
    c.fillRect(0, 0, SHEET_W, SHEET_H);
    const card = document.createElement('canvas');
    card.width = 1200;
    card.height = 2000;
    const cc = card.getContext('2d')!;
    NAMES.forEach((n, i) => {
      cc.setTransform(2, 0, 0, 2, 0, 0);
      drawHoodieMan(cc, {t: 0.5 + frame / 30, expr: EXPR[n], turn: 0, hips: 0});
      cc.setTransform(1, 0, 0, 1, 0, 0);
      const cw = SHEET_W / NAMES.length;
      // crop: card x 108..492, y 40..560 (head + torso)
      c.drawImage(card, 216, 80, 768, 1040, i * cw, 40, cw, (cw * 1040) / 768 > SHEET_H - 40 ? SHEET_H - 40 : (cw * 1040) / 768);
      c.fillStyle = '#241726';
      c.font = '600 34px sans-serif';
      c.textAlign = 'center';
      c.fillText(n, i * cw + cw / 2, 34);
    });
    // ---- hair check row: extreme turns, tilt and nod, with the debug overlay and the numeric report (also logged)
    const rep = hairReport();
    const HAIR_POSES: {n: string; pose: Parameters<typeof drawHoodieMan>[1]}[] = [
      {n: 'turn -1', pose: {t: 0.5, expr: EXPR.neutral, turn: -1}},
      {n: 'turn 0', pose: {t: 0.5, expr: EXPR.neutral}},
      {n: 'turn +1', pose: {t: 0.5, expr: EXPR.neutral, turn: 1}},
      {n: 'laughing shake', pose: {t: 0.5 + frame / 30, expr: EXPR.laughing}},
      {n: 'roll 10 + nod 14', pose: {t: 0.5, expr: EXPR.smug, headRoll: 10, nod: 14}},
    ];
    const cw = SHEET_W / HAIR_POSES.length, rowY = 660;
    c.fillStyle = '#d9d1bd';
    c.fillRect(0, rowY - 10, SHEET_W, SHEET_H - rowY + 10);
    HAIR_POSES.forEach((hp, i) => {
      cc.setTransform(2, 0, 0, 2, 0, 0);
      drawHoodieMan(cc, hp.pose);
      // overlay follows the head transform only approximately (it is drawn untransformed): it marks the REST geometry
      if (i === 1) drawHairDebug(cc);
      cc.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(card, 216, 40, 768, 740, i * cw, rowY + 40, cw, (cw * 740) / 768);
      c.fillStyle = '#241726';
      c.font = '600 30px sans-serif';
      c.textAlign = 'center';
      c.fillText(hp.n, i * cw + cw / 2, rowY + 30);
    });
    c.font = '700 34px sans-serif';
    c.fillStyle = rep.ok ? '#0a7a3b' : '#b00020';
    c.textAlign = 'left';
    c.fillText(rep.ok ? 'HAIR CHECK: OK' : 'HAIR CHECK: FAIL - ' + rep.issues.join('; '), 24, SHEET_H - 24);
    if (frame === 0) console.info('[hair]', JSON.stringify(rep));
  }, [frame]);
  return (
    <AbsoluteFill>
      <canvas ref={ref} width={SHEET_W} height={SHEET_H} style={{width: SHEET_W, height: SHEET_H}} />
    </AbsoluteFill>
  );
};
