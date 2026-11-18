// CHANNEL PROFILES (kit default, 2026-11-17). The first line of a video prompt "CHANNEL: <name>" loads channels/<name>.json; no channel line = GlintGaze.
// Only environment colour, light, fog, haze, dust and grade come from the profile. Characters stay pure white and every camera / QA / rig rule is identical for all channels.
import gaze from '../../channels/GlintGaze.json';
import world from '../../channels/GlintWorld.json';
import foco from '../../channels/FocoProibido.json';
import focoV1 from '../../channels/FocoProibido_v1.json';

export interface Channel {
  name: string;
  palette: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  light: {hemisphere: {sky: string; ground: string; intensity: number}; key: {color: string; intensity: number; position: number[]}; rim: {color: string; side: string}; fill: null | {color: string; side: string; intensity: number}; lampGlow: number[]; coralRim?: string};
  fog: null | {color: string; near: number; far: number};
  haze: null | {color: string; opacity: number};
  dust?: {count: number; color: string; opacity: number};
  brightness?: {baselineLum: number; minFactor: number; nearBlackMax: number; note?: string}; // KIT RULES v9: FocoProibido only (mean luminance of every shot >= minFactor x baselineLum, near-black share <= nearBlackMax)
  grade: {bloom: number; bloomThreshold: number; saturation: number; contrast: number; brightness: number; vignetteOffset: number; vignetteDarkness: number};
}
export const CHANNELS: Record<string, Channel> = {GlintGaze: gaze as unknown as Channel, GlintWorld: world as unknown as Channel, FocoProibido: foco as unknown as Channel, FocoProibido_v1: focoV1 as unknown as Channel}; // _v1 = the original dark profile, frozen for ZUMBIS_PARTE_10 and as the brightness baseline
export const DEFAULT_CHANNEL = 'GlintGaze';
/** Load a profile by the name on the prompt's "CHANNEL:" line (case-insensitive); unknown or missing = GlintGaze. */
export function getChannel(name?: string): Channel {
  const k = Object.keys(CHANNELS).find((n) => n.toLowerCase() === (name ?? '').trim().toLowerCase());
  return CHANNELS[k ?? DEFAULT_CHANNEL];
}
