// Reaction faces: a flat SVG face (characters/faces/<name>.svg) that REPLACES Ruri's whole head (hair and face) for a few frames, then cuts back.
// SVG contract (see STYLE_NOTES "TROLL FACE REACTIONS"): viewBox 93x111, four layers by id: white_bg (white head silhouette), lines (all black strokes, incl. the mouth),
// right_eye and left_eye (named from the CHARACTER's point of view, so right_eye is on the viewer's left). Other groups are ignored.
//
// Cost: the SVG is fetched and rasterized ONCE per face into 4 plain 2D canvases (CPU memory, no GPU resource, nothing per frame except drawImage calls).
// The cache is reference counted: the canvases are freed when the last component using the face unmounts. The face is drawn into Ruri's existing card canvas,
// so the card texture, its disposal and the [gpu] numbers are unchanged.
//
// Use:  const spec = showReaction('funny', 30, 45);              // face, start frame, duration in frames (1 to 1.5 s = 30 to 45 frames at 30 fps)
//       const face = useReactionFace('funny');                   // inside the scene component (delays the render until loaded)
//       const out = useMemo(makeReactionDraw, []);               // reused every frame
//       <Ruri reaction={reactionDraw(spec, face, frame, out)} .../>
// Mouth never moves. Only the eyes blink (scaleY about each eye's own bounding-box centre).
import {useEffect, useState} from 'react';
import {useDelayRender} from 'remotion';
import funnyUrl from '../../characters/faces/funny.svg';

/** Faces by name. Add a file to characters/faces/ and register it here (and in characters/faces/FACES.md). */
const FACE_URLS: Record<string, string> = {funny: funnyUrl};

/** Ruri's head box on the 600x1000 card (the head ellipse: centre 300,205, radii 142 x 133). The SVG viewBox is fitted into it, aspect kept. */
export const HEAD_BOX = {cx: 300, cy: 205, w: 284, h: 266};

const RS = 5; // raster pixels per viewBox unit (the face is drawn about 2.4 card px per unit on a 2x card, so 5 is sharp even with the pop)
const BLINK_SQUASH = 0.1; // eye scaleY at the closed frame
const LAYERS = ['white_bg', 'lines', 'right_eye', 'left_eye'] as const;

interface Eye { cv: HTMLCanvasElement; cx: number; cy: number } // cx, cy = bounding-box centre in raster px
export interface ReactionFace {
  name: string;
  vbW: number;
  vbH: number;
  bg: HTMLCanvasElement;
  lines: HTMLCanvasElement;
  eyes: [Eye, Eye];
}

// ---------------------------------------------------------------- loading and cache
interface Entry { promise: Promise<ReactionFace>; face: ReactionFace | null; refs: number }
const CACHE = new Map<string, Entry>();

async function rasterize(name: string, url: string): Promise<ReactionFace> {
  const text = await (await fetch(url)).text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const vb = (doc.documentElement.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((v) => !isFinite(v))) throw new Error(`[reactionFace] ${name}: missing or invalid viewBox`);
  for (const id of LAYERS) if (!doc.querySelector(`#${id}`)) throw new Error(`[reactionFace] ${name}: layer id="${id}" not found in the SVG`);
  const W = Math.round(vb[2] * RS), H = Math.round(vb[3] * RS);
  const layer = async (keep: string): Promise<HTMLCanvasElement> => {
    const d = doc.cloneNode(true) as Document;
    for (const id of LAYERS) if (id !== keep) d.querySelector(`#${id}`)?.remove();
    const svg = d.documentElement;
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    const href = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type: 'image/svg+xml'}));
    try {
      const img = new Image();
      img.src = href;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      cv.getContext('2d')!.drawImage(img, 0, 0, W, H);
      return cv;
    } finally { URL.revokeObjectURL(href); }
  };
  const [bg, lines, re, le] = await Promise.all(LAYERS.map(layer));
  const eye = (cv: HTMLCanvasElement, label: string): Eye => { // bounding box of the painted pixels, measured once
    const px = cv.getContext('2d')!.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) throw new Error(`[reactionFace] ${name}: layer ${label} is empty`);
    return {cv, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2};
  };
  return {name, vbW: vb[2], vbH: vb[3], bg, lines, eyes: [eye(re, 'right_eye'), eye(le, 'left_eye')]};
}

const acquire = (name: string): Entry => {
  let e = CACHE.get(name);
  if (!e) {
    const url = FACE_URLS[name];
    if (!url) throw new Error(`[reactionFace] unknown face "${name}" (known: ${Object.keys(FACE_URLS).join(', ')})`);
    const entry: Entry = {promise: rasterize(name, url), face: null, refs: 0};
    entry.promise.then((f) => { entry.face = f; });
    CACHE.set(name, entry);
    e = entry;
  }
  e.refs++;
  return e;
};
const release = (name: string) => {
  const e = CACHE.get(name);
  if (!e) return;
  e.refs--;
  setTimeout(() => { // deferred so a StrictMode unmount/remount does not free a face that is about to be used again
    if (e.refs > 0 || CACHE.get(name) !== e) return;
    CACHE.delete(name);
    const f = e.face;
    if (f) for (const cv of [f.bg, f.lines, f.eyes[0].cv, f.eyes[1].cv]) { cv.width = 0; cv.height = 0; }
  }, 0);
};

/** Loads (once, cached) and returns the face, or null while loading. Holds the frame (delayRender) until it is ready. Frees it on unmount. */
export function useReactionFace(name: string): ReactionFace | null {
  const {delayRender, continueRender} = useDelayRender();
  const [face, setFace] = useState<ReactionFace | null>(() => CACHE.get(name)?.face ?? null);
  const [handle] = useState<number | null>(() => (CACHE.get(name)?.face ? null : delayRender(`reaction face ${name}`)));
  useEffect(() => {
    let live = true, done = handle === null;
    const finish = () => { if (!done) { done = true; continueRender(handle as number); } };
    const e = acquire(name);
    e.promise.then((f) => { if (live) setFace(f); finish(); }, (err) => { console.error(err); finish(); });
    return () => { live = false; finish(); release(name); };
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps
  return face;
}

// ---------------------------------------------------------------- timing
export interface ReactionSpec {
  face: string;
  start: number; // first frame the face is shown
  dur: number; // frames; the face is shown for start <= frame < start + dur, then Ruri's own head is back
  popAmt: number; // entry scale pop (0.09 = 9 %)
  popFrames: number; // frames the pop takes to settle
  blinkAt: number[]; // blink start, in frames after `start`
  blinkFrames: number; // frames per blink
  flip: boolean; // mirror the face horizontally (only one face file exists)
}
export interface ReactionOpts {
  popAmt?: number; // default 0.09 (8-10 %)
  popFrames?: number; // default 4
  blinkCount?: number; // default 1: that many blinks, evenly spread over the duration
  blinkAt?: number[]; // explicit blink start frames (after `start`); overrides blinkCount
  blinkFrames?: number; // default 7 (6-8)
  flip?: boolean; // default false
}
/** showReaction('funny', startFrame, durationFrames): the duration comes from the narration (30-45 frames at 30 fps is 1 to 1.5 s). Estimates, untested: pop 9 % / 4 frames, blink 7 frames, eyes to scaleY 0.1. */
export function showReaction(faceName: string, startFrame: number, durationFrames: number, o: ReactionOpts = {}): ReactionSpec {
  const blinkFrames = o.blinkFrames ?? 7;
  const n = Math.max(0, o.blinkCount ?? 1);
  const blinkAt = o.blinkAt ?? Array.from({length: n}, (_, i) => Math.max(0, Math.round((durationFrames * (i + 1)) / (n + 1) - blinkFrames / 2)));
  return {face: faceName, start: startFrame, dur: durationFrames, popAmt: o.popAmt ?? 0.09, popFrames: o.popFrames ?? 4, blinkAt, blinkFrames, flip: o.flip ?? false};
}

/** What drawRuri needs for one frame. Create ONE per component with makeReactionDraw and let reactionDraw refill it (no per-frame allocation). */
/** tint = optional pre-tinted copy of the face's white_bg (see makeTintedBg), drawn over the white fill with alpha tintK; the caller sets both after reactionDraw. */
export interface ReactionDraw { face: ReactionFace | null; scale: number; blink: number /* 0 open .. 1 closed */; flip: boolean; tint: HTMLCanvasElement | null; tintK: number }
export const makeReactionDraw = (): ReactionDraw => ({face: null, scale: 1, blink: 0, flip: false, tint: null, tintK: 0});
/** Builds ONCE (useMemo) a copy of the face's white_bg with a radial colour gradient (stops from the centre to the edge) clipped to the head silhouette. CPU canvas only. */
export function makeTintedBg(f: ReactionFace, stops: [number, string][]): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = f.bg.width; cv.height = f.bg.height;
  const g = cv.getContext('2d')!;
  g.drawImage(f.bg, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createRadialGradient(cv.width * 0.45, cv.height * 0.4, 0, cv.width * 0.5, cv.height * 0.5, Math.max(cv.width, cv.height) * 0.62);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
  return cv;
}
const easeOut = (x: number) => 1 - (1 - x) ** 3;

/** Fills `out` for this frame; returns null when the face is not shown (outside the window or still loading), so Ruri draws her normal head. */
export function reactionDraw(spec: ReactionSpec, face: ReactionFace | null, frame: number, out: ReactionDraw): ReactionDraw | null {
  const age = frame - spec.start;
  if (!face || age < 0 || age >= spec.dur) return null;
  out.face = face;
  out.flip = spec.flip;
  out.scale = 1 + spec.popAmt * (1 - easeOut(Math.min(1, age / spec.popFrames)));
  let b = 0;
  for (let i = 0; i < spec.blinkAt.length; i++) {
    const p = (age - spec.blinkAt[i]) / spec.blinkFrames;
    if (p >= 0 && p < 1) b = Math.max(b, Math.sin(p * Math.PI)); // 0 -> 1 -> 0 over the blink
  }
  out.blink = b;
  return out;
}

// ---------------------------------------------------------------- drawing (inside drawRuri's head transform, in place of glow + head + face + hair)
/** blurs = Ruri's outer glow passes [blur px, alpha] (null = glow off, WHITE_GLOW); outerA = outer glow strength. K = canvas raster scale (shadowBlur is not scaled by the transform).
 *  Outer glow follows the white_bg silhouette. The inner edge glow is white on the white fill, so it is invisible and is not drawn. */
export function drawReactionHead(c: CanvasRenderingContext2D, K: number, r: ReactionDraw, blurs: readonly (readonly [number, number])[] | null, outerA: number): void {
  const f = r.face;
  if (!f || !f.bg.width) return;
  const F = Math.min(HEAD_BOX.w / f.vbW, HEAD_BOX.h / f.vbH); // card px per viewBox unit
  c.save();
  c.translate(HEAD_BOX.cx, HEAD_BOX.cy);
  c.scale(r.flip ? -r.scale : r.scale, r.scale);
  c.translate((-f.vbW * F) / 2, (-f.vbH * F) / 2);
  c.scale(F / RS, F / RS);
  if (blurs) {
    c.shadowColor = '#ffffff';
    for (let i = 0; i < blurs.length; i++) {
      c.shadowBlur = blurs[i][0] * K;
      c.globalAlpha = blurs[i][1] * outerA;
      c.drawImage(f.bg, 0, 0);
    }
    c.shadowBlur = 0; c.shadowColor = 'rgba(0,0,0,0)'; c.globalAlpha = 1;
  }
  c.drawImage(f.bg, 0, 0);
  if (r.tint && r.tintK > 0) { c.globalAlpha = r.tintK; c.drawImage(r.tint, 0, 0); c.globalAlpha = 1; }
  c.drawImage(f.lines, 0, 0);
  const sy = 1 - (1 - BLINK_SQUASH) * r.blink;
  for (let i = 0; i < 2; i++) {
    const e = f.eyes[i];
    if (sy === 1) { c.drawImage(e.cv, 0, 0); continue; }
    c.save();
    c.translate(e.cx, e.cy); c.scale(1, sy); c.translate(-e.cx, -e.cy);
    c.drawImage(e.cv, 0, 0);
    c.restore();
  }
  c.restore();
}

/** Builds ONCE a copy of the face's white_bg with a colour GRADIENT in one zone ('cheeks' | 'around-eyes' | 'forehead' | 'upper-half' | 'full'), clipped to the silhouette.
 *  Draw it over the white fill with alpha = the tint strength (ReactionDraw.tint / tintK). colours = [light, mid, deep] (kit/tint.ts). CPU canvas only. */
export function makeZoneTint(f: ReactionFace, colors: [string, string, string], zone: 'cheeks' | 'around-eyes' | 'forehead' | 'upper-half' | 'full'): HTMLCanvasElement {
  const cv = document.createElement('canvas'), W = f.bg.width, H = f.bg.height;
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.drawImage(f.bg, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const lin = (y0: number, y1: number, stops: [number, string][]) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  const blob = (x: number, y: number, r: number) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, hexA(colors[1], 0.95)); gr.addColorStop(0.55, hexA(colors[0], 0.5)); gr.addColorStop(1, hexA(colors[0], 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  if (zone === 'full') lin(0, H, [[0, hexA(colors[0], 0.9)], [0.55, hexA(colors[1], 0.8)], [1, hexA(colors[2], 0.55)]]);
  else if (zone === 'upper-half') lin(0, H * 0.62, [[0, hexA(colors[1], 0.95)], [0.6, hexA(colors[0], 0.6)], [1, hexA(colors[0], 0)]]);
  else if (zone === 'forehead') lin(0, H * 0.4, [[0, hexA(colors[1], 0.95)], [1, hexA(colors[0], 0)]]);
  else for (const e of f.eyes) blob(e.cx, zone === 'cheeks' ? e.cy + H * 0.2 : e.cy, W * (zone === 'cheeks' ? 0.2 : 0.26));
  return cv;
}
const hexA = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

// ---------------------------------------------------------------- face props (kit default 2026-11-16)
// Everything that sits on a character's face / head (helmet, hat, mustache, glasses, ...) is listed per character in FACE_PROPS. While a troll face is active
// the troll card replaces the whole face AND all of these: `activeFaceProps` returns [] then; when the reaction ends the list comes back.
// Characters draw their props only for names returned here (see src/cobra/cast.tsx).
export const FACE_PROPS: Record<string, string[]> = {};
export const registerFaceProps = (kind: string, props: string[]): void => { FACE_PROPS[kind] = props; };
export const activeFaceProps = (kind: string, troll: ReactionDraw | null | undefined): string[] => (troll && troll.face ? [] : FACE_PROPS[kind] ?? []);
