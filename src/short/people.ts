// Three characters in the base style of guard.ts (bean head, thin limbs, dot hands, oval shoes); outfits in code.
import {CARD_H, CARD_W, INK, SOLE_Y, dot, line, oval, poly, roundRect} from '../guard';

export type Who = 'man' | 'neighbor' | 'rescue';
export type Expr = 'calm' | 'smile' | 'laugh' | 'shock' | 'smirk' | 'worry' | 'serious' | 'sad' | 'talk';
export type Prop = 'none' | 'bag' | 'booklet' | 'phone' | 'keys' | 'clip' | 'flash' | 'radio' | 'can' | 'jug' | 'lantern' | 'bagpack';
export type V2 = [number, number];

export interface PO {
  who: Who;
  t: number;
  expr?: Expr;
  walk?: number; // 0 = standing, 1 = normal walk, 2 = run
  hoodUp?: boolean;
  hL?: V2 | null;
  hR?: V2 | null;
  propL?: Prop;
  propR?: Prop;
  tilt?: number; // head tilt, degrees
  look?: number; // pupil offset -1..1
  fingers?: number; // raised fingers on the left hand (0 = none)
  glow?: number; // lantern / flashlight glow 0..1
}

const OUT = {
  man: {skin: '#fddcc4', shade: '#d6c3c1'},
  neighbor: {skin: '#f6c9a6', shade: '#d3ab98'},
  rescue: {skin: '#e9b998', shade: '#c79d87'},
};

const SH_L: V2 = [225, 382];
const SH_R: V2 = [375, 382];
const HANG_L: V2 = [200, 738];
const HANG_R: V2 = [400, 738];

// two-bone arm: shoulder -> elbow -> hand, elbow bends outward
function elbow(s: V2, h: V2, side: number): V2 {
  const L1 = 180, L2 = 170;
  let dx = h[0] - s[0], dy = h[1] - s[1];
  let D = Math.hypot(dx, dy);
  const maxD = (L1 + L2) * 0.98;
  if (D > maxD) { dx *= maxD / D; dy *= maxD / D; D = maxD; }
  const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
  const hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const mx = s[0] + (dx * a) / D, my = s[1] + (dy * a) / D;
  // perpendicular, pick the one pointing outward (away from the body centre) and downward
  const px = -dy / D, py = dx / D;
  const c1: V2 = [mx + px * hh, my + py * hh];
  const c2: V2 = [mx - px * hh, my - py * hh];
  const score = (c: V2) => (c[0] - 300) * side * 1 + c[1] * 0.35;
  return score(c1) > score(c2) ? c1 : c2;
}

function thick(c: CanvasRenderingContext2D, pts: V2[], w: number, color: string) {
  poly(c, pts, w + 12, INK);
  poly(c, pts, w, color);
}

function drawProp(c: CanvasRenderingContext2D, p: Prop, x: number, y: number, t: number, glow: number, side: number) {
  c.save();
  c.translate(x, y);
  switch (p) {
    case 'bag': {
      c.fillStyle = '#d9b384';
      c.beginPath(); c.moveTo(-50, 40); c.lineTo(50, 40); c.lineTo(58, 190); c.lineTo(-58, 190); c.closePath(); c.fill();
      c.strokeStyle = INK; c.lineWidth = 8; c.lineJoin = 'round'; c.stroke();
      c.fillStyle = '#f2c53d'; c.fillRect(-30, 80, 60, 40);
      line(c, [[-28, 40], [0, -4], [28, 40]], 7);
      // a can and a bottle top peek out
      oval(c, -22, 36, 18, 10, '#c0392b', 5);
      oval(c, 24, 30, 12, 12, '#6fc3ff', 5);
      break;
    }
    case 'bagpack': {
      roundRect(c, -60, 20, 120, 150, 30, '#e0752b', 9);
      roundRect(c, -40, 90, 80, 56, 12, '#b85a1c', 6);
      line(c, [[-30, 20], [0, -14], [30, 20]], 8);
      break;
    }
    case 'booklet': {
      c.rotate(side * 0.12);
      roundRect(c, -48, -150, 96, 134, 6, '#1d5fb4', 7);
      c.fillStyle = '#f7c928'; c.fillRect(-48, -92, 96, 22);
      c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(-48, -92, 96, 22);
      line(c, [[-30, -126], [30, -126]], 5, '#ffffff');
      line(c, [[-30, -112], [10, -112]], 5, '#ffffff');
      break;
    }
    case 'phone': {
      c.rotate(side * 0.1);
      roundRect(c, -30, -90, 60, 100, 10, '#222733', 6);
      c.fillStyle = glow > 0.05 ? '#8fe3ff' : '#0c0d12';
      c.fillRect(-23, -80, 46, 78);
      break;
    }
    case 'keys': {
      c.strokeStyle = INK; c.lineWidth = 6;
      c.beginPath(); c.arc(0, 18, 18, 0, 7); c.stroke();
      const sw = Math.sin(t * 10) * 0.12;
      c.rotate(sw);
      for (const a of [-0.4, 0.3]) {
        c.save(); c.rotate(a);
        roundRect(c, -7, 30, 14, 62, 4, '#e8c24a', 5);
        c.restore();
      }
      break;
    }
    case 'clip': {
      roundRect(c, -60, -170, 120, 160, 8, '#9b6b3c', 7);
      c.fillStyle = '#fffdf2'; c.fillRect(-48, -150, 96, 124);
      for (let i = 0; i < 5; i++) line(c, [[-38, -134 + i * 24], [38 - (i % 2) * 20, -134 + i * 24]], 4, '#5f6b80');
      roundRect(c, -22, -184, 44, 22, 5, '#c8ccd6', 5);
      break;
    }
    case 'flash': {
      c.rotate(side * -0.3);
      roundRect(c, -14, -86, 28, 80, 8, '#2a2f3a', 6);
      roundRect(c, -22, -118, 44, 38, 8, '#f2c53d', 6);
      if (glow > 0) {
        const g = c.createRadialGradient(0, -130, 5, 0, -130, 140);
        g.addColorStop(0, `rgba(255,240,170,${0.7 * glow})`); g.addColorStop(1, 'rgba(255,240,170,0)');
        c.fillStyle = g; c.fillRect(-160, -280, 320, 300);
      }
      break;
    }
    case 'radio': {
      roundRect(c, -62, -80, 124, 76, 12, '#c0392b', 7);
      oval(c, -22, -42, 24, 24, '#f4e3d0', 5);
      line(c, [[18, -62], [48, -62]], 5); line(c, [[18, -46], [48, -46]], 5);
      line(c, [[40, -80], [70, -150]], 5);
      break;
    }
    case 'can': {
      roundRect(c, -24, -66, 48, 66, 6, '#d7513b', 6);
      c.fillStyle = '#f3e2c0'; c.fillRect(-24, -46, 48, 20);
      break;
    }
    case 'jug': {
      roundRect(c, -46, -120, 92, 120, 20, '#7cc9f2', 7);
      roundRect(c, -18, -144, 36, 28, 8, '#2f7fb8', 6);
      line(c, [[34, -100], [62, -90], [34, -60]], 6);
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-32, -104, 10, 80);
      break;
    }
    case 'lantern': {
      roundRect(c, -30, -80, 60, 70, 10, '#2b3a4a', 6);
      oval(c, 0, -44, 20, 26, '#ffd77a', 4);
      line(c, [[-20, -80], [0, -108], [20, -80]], 5);
      if (glow > 0) {
        const g = c.createRadialGradient(0, -44, 5, 0, -44, 220);
        g.addColorStop(0, `rgba(255,214,120,${0.55 * glow})`); g.addColorStop(1, 'rgba(255,214,120,0)');
        c.fillStyle = g; c.fillRect(-240, -280, 480, 480);
      }
      break;
    }
    default:
  }
  c.restore();
}

export function drawPerson(c: CanvasRenderingContext2D, o: PO) {
  const {who, t} = o;
  const expr = o.expr ?? 'calm';
  const col = OUT[who];
  c.clearRect(0, 0, CARD_W, CARD_H);
  const walk = o.walk ?? 0;
  const ph = t * Math.PI * 2 * (walk >= 2 ? 2.6 : 1.7);
  const laughing = expr === 'laugh';
  const bob = walk > 0 ? Math.abs(Math.sin(ph)) * (walk >= 2 ? 16 : 9) : Math.sin(t * 2.2) * 2 + (laughing ? Math.sin(t * 24) * 6 : 0);
  const stride = walk >= 2 ? 62 : 38;

  // ---- legs
  const hipY = 640;
  const legs: [number, number, number][] = [
    [268, 262 + (walk > 0 ? Math.sin(ph) * stride : 0), walk > 0 ? Math.max(0, Math.cos(ph)) * (walk >= 2 ? 52 : 30) : 0],
    [332, 338 + (walk > 0 ? -Math.sin(ph) * stride : 0), walk > 0 ? Math.max(0, -Math.cos(ph)) * (walk >= 2 ? 52 : 30) : 0],
  ];
  const THIGH = 150;
  const legPts = legs.map(([hx, ax, lift]) => {
    const hip: V2 = [hx, hipY + bob * 0.4];
    const ankle: V2 = [ax, 940 - lift];
    const dx = ankle[0] - hip[0], dy = ankle[1] - hip[1];
    const D = Math.hypot(dx, dy);
    const k = Math.sqrt(Math.max(0, THIGH * THIGH - (D / 2) * (D / 2)));
    const mx = (hip[0] + ankle[0]) / 2, my = (hip[1] + ankle[1]) / 2;
    const knee: V2 = [mx + (dy / D) * k, my - (dx / D) * k];
    return {hip, knee, ankle, lift, ax};
  });
  for (const L of legPts) {
    if (who === 'man') thick(c, [L.hip, L.knee, L.ankle], 22, '#3d5a8a');
    else if (who === 'rescue') thick(c, [L.hip, L.knee, L.ankle], 24, '#2a3350');
    else {
      poly(c, [L.knee, L.ankle], 11);
      const mid: V2 = [(L.hip[0] + L.knee[0]) / 2, (L.hip[1] + L.knee[1]) / 2];
      thick(c, [L.hip, mid, [L.knee[0] * 0.8 + mid[0] * 0.2, L.knee[1] * 0.8 + mid[1] * 0.2]], 32, '#e8d27a');
    }
    dot(c, L.knee[0], L.knee[1], 7);
  }
  const shoeCol = who === 'man' ? '#f2efe6' : who === 'neighbor' ? '#e5484d' : '#1d1f27';
  for (const L of legPts) oval(c, L.ax - 15, 953 - L.lift, 52, 22, shoeCol, 9);
  if (who === 'rescue') for (const L of legPts) { c.fillStyle = '#ffcc00'; c.fillRect(L.ax - 62, 944 - L.lift, 90, 8); }

  c.save();
  c.translate(0, bob);

  // ---- back of hood
  if (who === 'man') {
    c.fillStyle = '#486f74';
    c.beginPath(); c.ellipse(300, 352, 112, 46, 0, 0, 7); c.fill();
    c.strokeStyle = INK; c.lineWidth = 10; c.stroke();
    if (o.hoodUp) {
      c.fillStyle = '#486f74';
      c.beginPath(); c.ellipse(300, 200, 176, 170, 0, 0, 7); c.fill();
      c.strokeStyle = INK; c.lineWidth = 12; c.stroke();
    }
  }

  // ---- torso
  const torso = (fill: string, shade: string) => {
    roundRect(c, 222, 340, 156, 310, 42, fill, 12);
    c.save();
    c.beginPath(); c.roundRect(222, 340, 156, 310, 42); c.clip();
    c.fillStyle = shade; c.fillRect(222, 590, 156, 80); c.fillRect(340, 340, 40, 310);
    c.restore();
    roundRect(c, 222, 340, 156, 310, 42, 'rgba(0,0,0,0)', 12);
  };
  if (who === 'man') {
    torso('#5c8a8f', '#486f74');
    roundRect(c, 246, 520, 108, 70, 18, '#4f7b80', 7); // kangaroo pocket
    line(c, [[280, 360], [276, 450]], 6, '#f2efe6');
    line(c, [[320, 360], [324, 450]], 6, '#f2efe6');
    c.fillStyle = '#4a6f74'; c.beginPath(); c.ellipse(300, 352, 70, 24, 0, 0, 7); c.fill();
    c.strokeStyle = INK; c.lineWidth = 8; c.stroke();
  } else if (who === 'neighbor') {
    torso('#ff9f43', '#e08229');
    c.fillStyle = '#ffd36b'; c.fillRect(224, 470, 152, 28);
    c.fillStyle = '#e08229'; c.beginPath(); c.ellipse(300, 346, 40, 16, 0, 0, 7); c.fill();
    c.strokeStyle = INK; c.lineWidth = 6; c.stroke();
    c.fillStyle = '#e8d27a'; c.fillRect(224, 600, 152, 52); // shorts waistband
    c.strokeStyle = INK; c.lineWidth = 6; c.strokeRect(224, 600, 152, 52);
  } else {
    torso('#2f3b66', '#242e52'); // navy shirt
    c.save();
    c.beginPath(); c.roundRect(222, 340, 156, 310, 42); c.clip();
    c.fillStyle = '#ff8a1f';
    c.fillRect(222, 360, 156, 270);
    c.fillStyle = '#e07210'; c.fillRect(340, 360, 40, 270);
    c.fillStyle = '#2f3b66'; c.beginPath(); c.moveTo(262, 340); c.lineTo(338, 340); c.lineTo(300, 410); c.closePath(); c.fill();
    c.fillStyle = '#e8f0f2';
    c.fillRect(222, 470, 156, 22); c.fillRect(222, 560, 156, 22);
    c.fillRect(262, 360, 18, 270); c.fillRect(320, 360, 18, 270);
    c.restore();
    roundRect(c, 222, 340, 156, 310, 42, 'rgba(0,0,0,0)', 12);
    line(c, [[300, 410], [300, 630]], 5);
    roundRect(c, 344, 372, 26, 44, 6, '#1d1f27', 5); // shoulder radio
  }

  // ---- arms
  const hL = o.hL ?? HANG_L;
  const hR = o.hR ?? HANG_R;
  const swing = walk > 0 ? Math.sin(ph) * (walk >= 2 ? 40 : 20) : Math.sin(t * 2.2 + 1) * 4;
  const aL: V2 = o.hL ? hL : [hL[0] - swing * 0.3, hL[1] - Math.abs(swing) * 0.6];
  const aR: V2 = o.hR ? hR : [hR[0] + swing * 0.3, hR[1] - Math.abs(swing) * 0.6];
  const arm = (s: V2, h: V2, side: number) => {
    const e = elbow(s, h, side);
    const pts: V2[] = [s, e, h];
    poly(c, pts, 11);
    if (who === 'man') thick(c, [s, e, [e[0] + (h[0] - e[0]) * 0.85, e[1] + (h[1] - e[1]) * 0.85]], 20, '#5c8a8f');
    else if (who === 'rescue') thick(c, [s, e, [e[0] + (h[0] - e[0]) * 0.85, e[1] + (h[1] - e[1]) * 0.85]], 20, '#2f3b66');
    else thick(c, [s, [s[0] + (e[0] - s[0]) * 0.55, s[1] + (e[1] - s[1]) * 0.55]], 24, '#ff9f43');
    dot(c, e[0], e[1], 7);
  };
  arm(SH_L, aL, -1);
  arm(SH_R, aR, 1);
  if (o.propL && o.propL !== 'none') drawProp(c, o.propL, aL[0], aL[1], t, o.glow ?? 0, -1);
  if (o.propR && o.propR !== 'none') drawProp(c, o.propR, aR[0], aR[1], t, o.glow ?? 0, 1);
  dot(c, aL[0], aL[1], 21);
  dot(c, aR[0], aR[1], 21);
  if (o.fingers) {
    for (let i = 0; i < o.fingers; i++) {
      const fx = aL[0] - 30 + i * 30;
      line(c, [[fx, aL[1] - 10], [fx + (i - 1) * 4, aL[1] - 58]], 11);
      dot(c, fx + (i - 1) * 4, aL[1] - 60, 9);
    }
  }

  // ---- head
  const tilt = ((o.tilt ?? 0) + (laughing ? -9 + Math.sin(t * 24) * 3 : 0)) * (Math.PI / 180);
  c.save();
  c.translate(300, 335);
  c.rotate(tilt);
  c.translate(-300, -335);
  const hx0 = 300, hy0 = 205, rx = 142, ry = 133;
  c.save();
  c.beginPath(); c.ellipse(hx0, hy0, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = col.shade; c.fill(); c.clip();
  oval(c, hx0, hy0 - 16, rx + 12, ry - 6, col.skin);
  c.restore();
  c.beginPath(); c.ellipse(hx0, hy0, rx, ry, 0, 0, Math.PI * 2);
  c.strokeStyle = INK; c.lineWidth = 12; c.stroke();
  c.fillStyle = 'rgba(255,150,130,0.4)';
  c.beginPath(); c.arc(222, 262, 28, 0, 7); c.fill();
  c.beginPath(); c.arc(378, 262, 28, 0, 7); c.fill();

  // eyes
  const blink = (t % 2.6) > 2.48 ? 0.15 : 1;
  const look = (o.look ?? 0) * 9;
  const closed = laughing;
  const wide = expr === 'shock';
  for (const ex of [240, 360]) {
    const ey = 240;
    if (closed) {
      poly(c, [[ex - 34, ey + 8], [ex, ey - 22], [ex + 34, ey + 8]], 11);
      continue;
    }
    c.save();
    c.beginPath(); c.rect(ex - 50, ey - 40, 100, 100 * blink); c.clip();
    oval(c, ex, ey, wide ? 40 : 34, wide ? 42 : 31, '#ffffff');
    oval(c, ex + 7 + look, ey + 3, wide ? 15 : 26, wide ? 15 : 27, '#2a1a1c');
    c.restore();
    if (!wide && (expr === 'calm' || expr === 'serious' || expr === 'smirk')) line(c, [[ex - 42, ey - 2], [ex + 40, ey - 2]], 9);
  }
  // brows
  const bl = {calm: [-0, 0], smile: [-6, 0], laugh: [-8, 0], shock: [-24, 0], smirk: [-14, 12], worry: [-10, 0], serious: [8, 8], sad: [-10, 0], talk: [-4, 0]}[expr];
  const slope = expr === 'worry' || expr === 'sad' ? -26 : expr === 'serious' ? 22 : 12;
  line(c, [[196, 190 + bl[0] + 6], [270, 214 + bl[0] - slope + 12]], 12);
  line(c, [[330, 214 + bl[1] + bl[0] * 0 - slope + 12], [404, 190 + bl[1] + bl[0] + 6]], 12);
  // mouth
  const mo = (Math.sin(t * 14) * 0.5 + 0.5);
  if (expr === 'laugh') {
    const open = 0.65 + 0.35 * Math.abs(Math.sin(t * 12));
    c.beginPath(); c.moveTo(236, 300); c.quadraticCurveTo(300, 300 + 120 * open, 364, 300); c.quadraticCurveTo(300, 296, 236, 300);
    c.fillStyle = '#4a1020'; c.fill(); c.strokeStyle = INK; c.lineWidth = 8; c.stroke();
    oval(c, 300, 326 + 14 * open, 34, 12 * open, '#e8647a');
  } else if (expr === 'talk') {
    oval(c, 300, 322, 22, 8 + mo * 18, '#4a1020', 7);
  } else if (expr === 'shock') {
    oval(c, 300, 326, 20, 26, '#4a1020', 7);
  } else if (expr === 'smile') {
    line(c, [[262, 312], [300, 336], [338, 312]], 7);
  } else if (expr === 'smirk') {
    line(c, [[270, 322], [312, 326], [346, 304]], 7);
  } else if (expr === 'sad' || expr === 'worry') {
    line(c, [[266, 334], [300, 314], [334, 334]], 7);
  } else if (expr === 'serious') {
    line(c, [[270, 322], [330, 322]], 7);
  } else {
    line(c, [[272, 320], [300, 326], [328, 320]], 6);
  }
  // nose dot
  dot(c, 300, 282, 5);

  // hair / headgear
  if (who === 'man') {
    if (!o.hoodUp) {
      c.fillStyle = '#4a3326';
      c.beginPath(); c.moveTo(166, 190); c.bezierCurveTo(160, 60, 440, 60, 434, 190); c.bezierCurveTo(410, 130, 350, 112, 300, 120); c.bezierCurveTo(240, 112, 190, 132, 166, 190); c.closePath(); c.fill();
      c.strokeStyle = INK; c.lineWidth = 10; c.stroke();
    } else {
      // hood opening shadow over forehead
      c.fillStyle = '#486f74';
      c.beginPath(); c.moveTo(150, 190); c.bezierCurveTo(150, 60, 450, 60, 450, 190); c.bezierCurveTo(420, 120, 380, 110, 300, 112); c.bezierCurveTo(220, 110, 180, 120, 150, 190); c.closePath(); c.fill();
      c.strokeStyle = INK; c.lineWidth = 11; c.stroke();
    }
    line(c, [[236, 372], [236, 372]], 1);
  } else if (who === 'neighbor') {
    c.fillStyle = '#a3522a';
    c.beginPath();
    c.moveTo(160, 200); c.lineTo(150, 130); c.lineTo(196, 96); c.lineTo(214, 40); c.lineTo(262, 80); c.lineTo(300, 22);
    c.lineTo(338, 80); c.lineTo(386, 40); c.lineTo(404, 96); c.lineTo(450, 130); c.lineTo(440, 200);
    c.bezierCurveTo(410, 140, 350, 124, 300, 128); c.bezierCurveTo(250, 124, 190, 140, 160, 200);
    c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 10; c.lineJoin = 'round'; c.stroke();
  } else {
    // helmet
    c.fillStyle = '#f4f4f0';
    c.beginPath(); c.moveTo(150, 168); c.bezierCurveTo(140, 20, 460, 20, 450, 168); c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 11; c.stroke();
    c.fillStyle = '#ffcc00'; c.beginPath(); c.moveTo(280, 40); c.lineTo(320, 40); c.lineTo(330, 150); c.lineTo(270, 150); c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 6; c.stroke();
    roundRect(c, 136, 150, 328, 30, 14, '#e6e6de', 9); // brim
    line(c, [[170, 260], [166, 330]], 6); line(c, [[430, 260], [434, 330]], 6); // chin strap
    // moustache
    c.fillStyle = '#6a4630';
    c.beginPath(); c.ellipse(276, 308, 34, 12, -0.2, 0, 7); c.ellipse(324, 308, 34, 12, 0.2, 0, 7); c.fill();
  }
  c.restore(); // head
  c.restore(); // bob
}

export {CARD_H, CARD_W, SOLE_Y};
