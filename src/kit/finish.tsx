// Global finish kit (see STYLE_NOTES.md "GLOBAL STYLE v3"): palette, glow sprites, rim light, safe-zone overlay,
// painted-brush textures, and a designed Book prop. Everything here follows the Render stability rules:
// shared geometry/material through the kit cache, no per-frame allocations, textures via makeTex/useTex.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {AbsoluteFill} from 'remotion';
import {V3, hash, makeTex} from './kit';
import {CENTER_BOX} from './camera';

// ---- Palette (main hue + vibrant companion). Main hues must dominate every frame.
export const PAL = {
  blueViolet: {base: '#6A6CC0', vivid: '#5A4FDB'},
  lavender: {base: '#DCDDF3', vivid: '#C7CBFF'},
  indigo: {base: '#352A57', vivid: '#1E1448'},
  lilac: {base: '#BBA8E3', vivid: '#A583F2'},
  rose: {base: '#E9A6B3', vivid: '#F37A92'},
  // lighting accents taken from the references (not surface colours)
  key: '#FFC93C', // golden-yellow key light
  rim: '#FF7A4D', // orange/coral rim on characters
  coral: '#F58A6B', // warm gradient partner of rose
  glowWarm: '#FFE9A8',
} as const;
export const CLOTHES = ['#A8D8B9' /* sage mint */, '#E9A6B3' /* dusty rose */, '#8EC3F0' /* soft sky blue */, '#BBA8E3' /* lilac */, '#F5C2A0' /* peach */] as const;

// ---- Safe zone (fractions of the 1080x1920 frame)
export const SAFE = {x0: 0.18, x1: 0.81, y0: 0.14, y1: 0.82};
/** Is a screen point (px, 1080x1920) inside the safe zone? Use it in tests or asserts for key subjects. */
export const inSafe = (x: number, y: number) => x >= SAFE.x0 * 1080 && x <= SAFE.x1 * 1080 && y >= SAFE.y0 * 1920 && y <= SAFE.y1 * 1920;
/** Project a world point with the shot camera and test it against the safe zone. */
export const worldInSafe = (p: THREE.Vector3, cam: THREE.PerspectiveCamera) => {
  const v = p.clone().project(cam); // debug/test use only, not per frame in renders
  return inSafe((v.x * 0.5 + 0.5) * 1080, (0.5 - v.y * 0.5) * 1920);
};
/** Debug overlay. Enabled with `?safe=1` in the Studio URL or `window.__safe = true`. Never shows in a render unless on. */
export const SafeZoneOverlay: React.FC<{on?: boolean}> = ({on}) => {
  const q = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('safe') === '1' || (window as unknown as {__safe?: boolean}).__safe === true);
  if (!(on ?? q)) return null;
  // CENTER FRAME overlay: only the central box (CENTER_BOX in camera.ts) and its centre cross. No outside bands any more.
  const {x0, x1, y0, y1} = CENTER_BOX;
  const cx = ((x0 + x1) / 2) * 1080, cy = ((y0 + y1) / 2) * 1920;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: x0 * 1080, top: y0 * 1920, width: (x1 - x0) * 1080, height: (y1 - y0) * 1920, border: '4px dashed #00ff9c', background: 'rgba(0,255,156,0.05)', boxSizing: 'border-box'}} />
      <div style={{position: 'absolute', left: cx - 24, top: cy - 2, width: 48, height: 4, background: '#00ff9c'}} />
      <div style={{position: 'absolute', left: cx - 2, top: cy - 24, width: 4, height: 48, background: '#00ff9c'}} />
    </AbsoluteFill>
  );
};

// ---- Soft floor (kit room helper): wide planks, gentle per-plank tone, faint seams, a thin rim-light line on the seam edge that faces the key light.
// Replaces the streaky look of v2/rooms `paintPlanks` for kit videos (that one stays for CrisisShortV2). Painted once into a tiled texture, no per-frame work.
export const paintSoftFloor = (base: string, plankH = 96, rim = 'rgba(255,226,170,0.20)') => (c: CanvasRenderingContext2D, w: number, h: number) => {
  const n = parseInt(base.slice(1), 16), ch = (k: number, v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  const col = (k: number) => `rgb(${ch(k, (n >> 16) & 255)},${ch(k, (n >> 8) & 255)},${ch(k, n & 255)})`;
  const rows = Math.floor(h / plankH);
  for (let i = 0; i < rows; i++) {
    const y = i * plankH, g = c.createLinearGradient(0, y, 0, y + plankH);
    const k = 0.95 + hash(i, 3) * 0.1; // gentle tone step per plank (was +-14%)
    g.addColorStop(0, col(k * 1.03)); g.addColorStop(1, col(k * 0.97));
    c.fillStyle = g; c.fillRect(0, y, w, plankH);
    c.fillStyle = 'rgba(30,15,40,0.10)'; // faint end-joint
    c.fillRect(hash(i, 8) * w, y, 2, plankH);
    c.fillStyle = 'rgba(25,12,35,0.16)'; c.fillRect(0, y, w, 2); // soft seam
    c.fillStyle = rim; c.fillRect(0, y + 2, w, 2); // rim light from the key (upper-left): lit edge just below each seam
  }
  const v = c.createLinearGradient(0, 0, w, 0); // one broad soft light falloff instead of grain streaks
  v.addColorStop(0, 'rgba(255,240,210,0.07)'); v.addColorStop(1, 'rgba(30,20,60,0.07)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
};

// ---- Cheap glow: additive soft sprite (shared texture + material, never per-frame allocation).
const glowTex = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (!t) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
    }
    return t;
  };
})();
/** Glow around a lamp / key prop: HDR emissive core is the prop's job, this adds the halo. `size` in metres. */
export const Glow: React.FC<{p: V3; size?: number; color?: string; intensity?: number}> = ({p, size = 1.2, color = PAL.glowWarm, intensity = 1}) => {
  const mat = useMemo(() => new THREE.SpriteMaterial({map: glowTex(), color, transparent: true, opacity: 0.85 * intensity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}), [color, intensity]);
  React.useEffect(() => () => mat.dispose(), [mat]); // sprite materials are not visited by the kit's mesh disposal
  return <sprite position={p} scale={[size, size, 1]} material={mat} renderOrder={20} />;
};

/** Rim light for characters: a warm orange/rose edge from behind. Place it behind and above the character, opposite the camera. */
export const RimLight: React.FC<{p: V3; color?: string; intensity?: number}> = ({p, color = PAL.rim, intensity = 2.2}) => (
  <pointLight position={p} color={color} intensity={intensity} distance={8} decay={2} />
);
/** Orange rim drawn into a character card canvas: call after drawing the body, with the card context (2D, source-atop). */
export const drawRimOnCard = (c: CanvasRenderingContext2D, w: number, h: number, color: string = PAL.rim, side: 1 | -1 = 1) => {
  c.save();
  c.globalCompositeOperation = 'source-atop';
  const g = c.createLinearGradient(side > 0 ? w : 0, 0, side > 0 ? w * 0.8 : w * 0.2, 0);
  g.addColorStop(0, color + 'cc');
  g.addColorStop(1, color + '00');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.restore();
};

// ---- Painted finish: brush-stroke texture overlay for surfaces (multiply into a base colour map).
/** Painted surface texture: base colour + visible directional brush strokes + darker pooled edges. Use as `map` on standard materials. */
/** Single switch (STYLE_NOTES "PAINTED FINISH v8"): false = surfaces use clean colour textures, the painted feel lives only in shadows and ink lines. */
export const PAINTED_SURFACES = false;
export const paintedTexture = (key: string, base: string, shadow: string, light: string, repeat: [number, number] = [1, 1], seed = 1) =>
  makeTex(512, 512, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    if (!PAINTED_SURFACES) {
      const g = c.createLinearGradient(0, 0, 0, h); // clean surface: a very soft top-to-bottom light falloff, no brush strokes
      g.addColorStop(0, light + '1a'); g.addColorStop(1, shadow + '14');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      return;
    }
    let s = seed * 9301;
    const r = () => ((s = (s * 49297 + 233280) % 233280) / 233280);
    for (let i = 0; i < 520; i++) {
      const x = r() * w, y = r() * h, len = 40 + r() * 120, ang = -0.5 + r() * 0.4, wd = 6 + r() * 18;
      c.strokeStyle = (r() > 0.5 ? light : shadow) + (r() > 0.5 ? '30' : '22');
      c.lineWidth = wd;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      c.stroke();
    }
  }, repeat);

// ---- Designed props: never a plain box. Book = cover boards, spine, page block, title, bevel, thickness.
export const Book: React.FC<{p: V3; rot?: V3; w?: number; h?: number; t?: number; cover?: string; title?: string; pageColor?: string}> = ({p, rot = [0, 0, 0], w = 0.22, h = 0.3, t = 0.04, cover = PAL.blueViolet.base, title = 'BOOK', pageColor = '#f4eedd'}) => {
  const coverTex = useMemo(() => makeTex(256, 340, (c, cw, ch) => {
    c.fillStyle = cover; c.fillRect(0, 0, cw, ch);
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 6; c.strokeRect(14, 14, cw - 28, ch - 28);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 44px Fredoka, sans-serif'; c.fillText(title, cw / 2, ch * 0.4);
  }), [cover, title]);
  const pagesTex = useMemo(() => makeTex(64, 64, (c, cw, ch) => {
    c.fillStyle = pageColor; c.fillRect(0, 0, cw, ch);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 4; y < ch; y += 5) c.fillRect(0, y, cw, 1);
  }), [pageColor]);
  const bd = 0.012; // board thickness, bevelled by the slightly smaller page block
  return (
    <group position={p} rotation={rot}>
      {/* page block, inset so the cover boards overhang */}
      <mesh castShadow receiveShadow position={[0.004, 0, 0]}>
        <boxGeometry args={[w - 0.02, t - 2 * bd, h - 0.014]} />
        <meshStandardMaterial map={pagesTex} roughness={0.9} />
      </mesh>
      {/* front and back boards */}
      <mesh castShadow receiveShadow position={[0, t / 2 - bd / 2, 0]}>
        <boxGeometry args={[w, bd, h]} />
        <meshStandardMaterial map={coverTex} roughness={0.65} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, -t / 2 + bd / 2, 0]}>
        <boxGeometry args={[w, bd, h]} />
        <meshStandardMaterial color={cover} roughness={0.65} />
      </mesh>
      {/* rounded spine */}
      <mesh castShadow receiveShadow position={[-w / 2 + 0.002, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[t / 2, t / 2, h, 12, 1, false, Math.PI, Math.PI]} />
        <meshStandardMaterial color={cover} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
