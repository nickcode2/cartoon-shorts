// Timing for the short, locked to audio/voiceover_clean.mp3 (70.38 s, 2112 frames at 30 fps).
export const FPS = 30;
export const TOTAL = 2112;

// First frame of each shot (index 0 = shot 1). Shot n ends where shot n+1 starts.
export const STARTS = [
  0, 72, 138, 192, 242, 294, 345, 402, 459, 528, 579, 654, 731, 807, 891, 972, 1050, 1125, 1176, 1242, 1307, 1375,
  1428, 1476, 1526, 1611, 1684, 1740, 1790, 1851, 1909, 1960, 2035,
];
export const shotRange = (n: number): [number, number] => [STARTS[n - 1], n < STARTS.length ? STARTS[n] : TOTAL];

// Location changes get a dissolve (outgoing shot is held DISS frames longer and fades out over the next shot).
export const DISSOLVE_AFTER = new Set([3, 8, 10, 12, 13, 14, 15, 17, 18, 20, 21, 22, 24, 27, 28, 30, 32]);
export const DISS = 9;

// Sentence start times in seconds on the clean file (word-level STT cross-checked with silencedetect).
export const LINES = {
  buy: 0.2, laughs: 6.62, world: 8.08, hands: 9.8, gov: 11.48, conspiracy: 12.66, europe: 15.3, keep: 19.26,
  sweden: 24.36, title: 27.31, france: 30.56, uk: 33.34, why: 37.52, because: 39.22, help: 43.56, rescue: 45.84,
  waiting: 49.2, without: 50.86, nolights: 53.7, water: 56.12, three: 59.68, officials: 60.76, stops: 63.64,
  fridge: 65.34, empty: 66.8, keys: 67.84,
};
// Key words (seconds, clean file) used for sound cues and on-screen action.
export const W = {
  buys: 1.86, water: 2.94, cans: 3.8, radio: 4.82, flash: 5.72, laugh: 6.62, world: 8.86, booklet: 10.8, gov: 11.48,
  zip: 23.5,
};
