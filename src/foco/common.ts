// ZUMBIS_PARTE_10 / channel FocoProibido: shared constants and hooks. Palette and light values come from channels/FocoProibido.json (src/kit/channel.ts), never hard-coded elsewhere.
//   70 % purple / indigo, 20 % orange / gold, 10 % other. Shadows purple, never black. Danger red only on eyes / alerts. Characters stay pure white (card rim: orange left, purple fill right).
import React, {useLayoutEffect} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {getChannel} from '../kit/channel';
import {setCardLight} from '../kit/rickRig';

export const CH = getChannel('FocoProibido_v1'); // pinned to the ORIGINAL profile (2026-11-17): the channel was brightened by KIT RULES v9, this video must stay identical. New FocoProibido videos load 'FocoProibido'.
export const PAL = CH.palette as {dominant: string[]; base: string[]; secondary: Record<'gold' | 'coral' | 'lavender' | 'cream', string>; danger: string; skyTop: string; skyMid: string; skyHorizon: string; clear: string};
export const C = {
  purple: PAL.dominant[0], purpleL: PAL.dominant[1], orange: PAL.dominant[2], night: PAL.base[0], indigo: PAL.base[1], violet: PAL.base[2],
  gold: PAL.secondary.gold, coral: PAL.secondary.coral, lav: PAL.secondary.lavender, cream: PAL.secondary.cream, red: PAL.danger,
  // derived darker / lighter steps INSIDE the palette family (same hue, other value): used for walls, asphalt, shadows
  deep: '#0F0D2E', wall1: '#231D5C', wall2: '#2B2368', wall3: '#33297A', trim: '#4A2B8F', road: '#1B1748', road2: '#241E5A', slab: '#32286F', orangeD: '#B2561E', goldD: '#B58A2E',
} as const;
export const HDR = {gold: new THREE.Color(2.6, 1.95, 0.75), orange: new THREE.Color(2.4, 1.1, 0.35), cream: new THREE.Color(2.4, 2.2, 1.7), red: new THREE.Color(3.2, 0.12, 0.2)};

/** CARD LIGHT of the channel (orange rim left, purple shadow / fill right): set during the render of the video root, reset when it unmounts so other videos are untouched. */
export function useChannelCards(): void {
  setCardLight({on: true, shadow: 'rgba(43,35,104,0.42)', rim: 'rgba(242,138,60,0.92)', fill: 'rgba(108,66,184,0.26)'});
  useLayoutEffect(() => () => setCardLight(null), []);
}
/** Scene fog of the channel (purple distance haze). Reference counted because the kit mounts a hidden copy of the next shot before the cut. */
export const SceneFog: React.FC<{near?: number; far?: number}> = ({near = CH.fog!.near, far = CH.fog!.far}) => {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    const u = scene.userData as {fogUsers?: number}; u.fogUsers = (u.fogUsers ?? 0) + 1; scene.fog = new THREE.Fog(CH.fog!.color, near, far);
    return () => { u.fogUsers = (u.fogUsers ?? 1) - 1; if (!u.fogUsers) scene.fog = null; };
  }, [scene, near, far]);
  return null;
};
export const GRADE = CH.grade;
export const mulberry = (a: number) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/** Sheet mode: QA sheets and the storyboard grid mount many copies of the world at once; the big textures are then shared (see `mt` in sets.tsx). Set during render, cleared on unmount. */
export function useSheetMode(): void {
  (window as unknown as {__sheet?: boolean}).__sheet = true;
  useLayoutEffect(() => () => { (window as unknown as {__sheet?: boolean}).__sheet = false; }, []);
}
/** The city is bigger than the kit's default far plane (400 m): the sky dome and the far skyline need up to about 600 m. Reference counted like the fog (the next shot is mounted before the previous one is removed). */
export function useFarPlane(far: number): void {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera, scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    const u = scene.userData as {farUsers?: number; farBase?: number}; if (!u.farUsers) u.farBase = camera.far; u.farUsers = (u.farUsers ?? 0) + 1; camera.far = far; camera.updateProjectionMatrix();
    return () => { u.farUsers = (u.farUsers ?? 1) - 1; if (!u.farUsers) { camera.far = u.farBase ?? 400; camera.updateProjectionMatrix(); } };
  }, [camera, scene, far]);
}
