// Canvas2D drawing of the guard, rebuilt from characters/base_reference.jpg.
// Design canvas 600x1000, soles at y = 975.

export const CARD_W = 600;
export const CARD_H = 1000;
export const METERS_PER_PX = 0.0021; // card is 2.1 m tall
export const SOLE_Y = 975;

export const INK = '#241726';
const SKIN = '#fddcc4';
const SKIN_SHADE = '#d6c3c1';
const UNI = '#5a7db4';
const UNI_SHADE = '#47679a';
const CAP = '#2b3a67';
const CAP_DARK = '#1f2b4d';
const GOLD = '#f2c53d';
const PINK = '#ff6fb0';

// Roller path shared with the wall paint (world metres).
export const rollerY = (t: number) => 1.35 - 0.38 * Math.cos(2 * Math.PI * t);
export const guardZ = (t: number) => -0.9 + 0.35 * t;

const ROLLER_HAND_X = 505;
export const ROLLER_OFFSET_X = (575 - 300) * METERS_PER_PX; // roller outer edge from card centre

export function line(
  c: CanvasRenderingContext2D,
  pts: [number, number][],
  w: number,
  color = INK,
) {
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 3) c.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
  else for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();
}

export function poly(c: CanvasRenderingContext2D, pts: [number, number][], w: number, color = INK) {
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();
}

export function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.fillStyle = INK;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

export function oval(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  stroke = 0,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = INK;
    c.lineWidth = stroke;
    c.stroke();
  }
}

export function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke = 0,
) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = INK;
    c.lineWidth = stroke;
    c.lineJoin = 'round';
    c.stroke();
  }
}

export function drawGuard(c: CanvasRenderingContext2D, t: number) {
  c.clearRect(0, 0, CARD_W, CARD_H);
  const bob = Math.sin(t * 2 * Math.PI * 1.0) * 3; // follows the stroke rhythm
  const step = Math.sin(t * 2 * Math.PI * 1.0 * 1.0);

  // ---- crouch: deepest when the roller is lowest (t = 0 of each stroke)
  const crouch = Math.pow(0.5 + 0.5 * Math.cos(t * 2 * Math.PI), 1.5);
  const d = 34 * crouch; // px the hips drop
  const lift1 = Math.max(0, step) * 6 * (1 - crouch);
  const lift2 = Math.max(0, -step) * 6 * (1 - crouch);

  // ---- legs with knee joints (thigh + shin keep their length, knees push toward the wall)
  const THIGH = 150;
  const leg = (hipX: number, ankleX: number, lift: number) => {
    const hip: [number, number] = [hipX, 640 + d];
    const ankle: [number, number] = [ankleX, 940 - lift];
    const dx = ankle[0] - hip[0], dy = ankle[1] - hip[1];
    const D = Math.hypot(dx, dy);
    const k = Math.sqrt(Math.max(0, THIGH * THIGH - (D / 2) * (D / 2)));
    const mx = (hip[0] + ankle[0]) / 2, my = (hip[1] + ankle[1]) / 2;
    const knee: [number, number] = [mx + (dy / D) * k, my - (dx / D) * k];
    poly(c, [hip, knee, ankle], 11);
    if (k > 4) dot(c, knee[0], knee[1], 8);
  };
  leg(268, 262, lift1);
  leg(332, 338, lift2);
  oval(c, 247, 953 - lift1, 52, 22, INK);
  oval(c, 353, 953 - lift2, 52, 22, INK);

  c.save();
  c.translate(0, bob + d);

  // ---- left arm (hanging) with round dot hand
  const sway = Math.sin(t * 2 * Math.PI * 1.0 + 1) * 6;
  line(c, [[225, 382], [188 + sway, 560], [200 + sway, 722]], 11);
  dot(c, 200 + sway, 738, 21);

  // ---- right arm + roller
  const hy = SOLE_Y - rollerY(t) / METERS_PER_PX - (bob + d); // hand stays on the painted path
  const hx = ROLLER_HAND_X;
  line(c, [[375, 382], [hx - 20, (382 + hy) / 2 + 40], [hx, hy]], 11);
  // roller frame and cylinder
  line(c, [[hx, hy], [hx + 34, hy]], 7);
  roundRect(c, hx + 30, hy - 55, 40, 110, 16, PINK, 8);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fillRect(hx + 40, hy - 40, 7, 78);
  dot(c, hx, hy, 21);

  // ---- torso: slim capsule in uniform
  roundRect(c, 222, 340, 156, 310, 42, UNI, 12);
  c.save();
  c.beginPath();
  c.roundRect(222, 340, 156, 310, 42);
  c.clip();
  c.fillStyle = UNI_SHADE;
  c.fillRect(222, 580, 156, 80); // lower shade
  c.fillStyle = UNI_SHADE;
  c.fillRect(340, 340, 40, 310); // side shade
  c.restore();
  roundRect(c, 222, 340, 156, 310, 42, 'rgba(0,0,0,0)', 12);
  // belt + buckle
  c.fillStyle = '#1c1a24';
  c.fillRect(224, 598, 152, 24);
  roundRect(c, 288, 596, 26, 28, 5, GOLD, 4);
  // collar / tie
  c.fillStyle = '#f2efe6';
  c.beginPath();
  c.moveTo(262, 346); c.lineTo(338, 346); c.lineTo(300, 408); c.closePath();
  c.fill();
  c.strokeStyle = INK; c.lineWidth = 5; c.stroke();
  c.fillStyle = '#7a2230';
  c.beginPath();
  c.moveTo(292, 392); c.lineTo(308, 392); c.lineTo(314, 520); c.lineTo(300, 538); c.lineTo(286, 520); c.closePath();
  c.fill();
  // buttons
  for (const y of [560]) { c.fillStyle = GOLD; c.beginPath(); c.arc(300, y, 7, 0, 7); c.fill(); }
  // chest badge (shield)
  c.fillStyle = GOLD;
  c.beginPath();
  c.moveTo(250, 430); c.lineTo(282, 430); c.lineTo(282, 462); c.quadraticCurveTo(266, 482, 250, 462); c.closePath();
  c.fill();
  c.strokeStyle = INK; c.lineWidth = 4; c.stroke();
  // shoulder epaulette hint
  line(c, [[238, 362], [270, 352]], 6, '#f2c53d');
  line(c, [[362, 362], [330, 352]], 6, '#f2c53d');

  // ---- head (bean, h/w .94) with underside shade
  const hx0 = 300, hy0 = 205, rx = 142, ry = 133;
  c.save();
  c.beginPath();
  c.ellipse(hx0, hy0, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = SKIN_SHADE;
  c.fill();
  c.clip();
  oval(c, hx0, hy0 - 16, rx + 12, ry - 6, SKIN);
  c.restore();
  c.beginPath();
  c.ellipse(hx0, hy0, rx, ry, 0, 0, Math.PI * 2);
  c.strokeStyle = INK; c.lineWidth = 12; c.stroke();

  // blush
  c.fillStyle = 'rgba(255,150,130,0.45)';
  c.beginPath(); c.arc(222, 262, 30, 0, 7); c.fill();
  c.beginPath(); c.arc(378, 262, 30, 0, 7); c.fill();

  // half-lidded eyes, glancing toward the wall (right)
  const blink = (t % 2.2) > 2.1 ? 0.15 : 1;
  for (const ex of [240, 360]) {
    const ey = 240;
    c.save();
    c.beginPath();
    c.rect(ex - 50, ey - 2, 100, 60 * blink);
    c.clip();
    oval(c, ex, ey, 34, 31, '#ffffff');
    oval(c, ex + 7, ey + 3, 26, 27, '#2a1a1c');
    c.restore();
    line(c, [[ex - 42, ey - 2], [ex + 40, ey - 2]], 9);
  }
  // thick eyebrows, slightly furrowed
  line(c, [[196, 190], [270, 214]], 12);
  line(c, [[330, 214], [404, 190]], 12);
  // mouth
  line(c, [[282, 318], [318, 318]], 6);

  // ---- cap
  c.fillStyle = CAP;
  c.beginPath();
  c.moveTo(168, 156);
  c.bezierCurveTo(168, 40, 432, 40, 432, 156);
  c.closePath();
  c.fill();
  c.strokeStyle = INK; c.lineWidth = 11; c.lineJoin = 'round'; c.stroke();
  roundRect(c, 160, 140, 280, 34, 14, CAP_DARK, 10);
  oval(c, 300, 178, 120, 16, CAP_DARK, 9); // visor
  roundRect(c, 160, 140, 280, 34, 14, CAP_DARK, 10);
  c.fillStyle = GOLD;
  c.beginPath(); c.arc(300, 96, 18, 0, 7); c.fill();
  c.strokeStyle = INK; c.lineWidth = 5; c.stroke();

  c.restore();
}
