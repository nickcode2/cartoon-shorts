// Soft bloom on bright things (lamps, sun, coins), light vignette and a subtle warm grade. Spread into an EffectComposer next to FocusDof:
//   <EffectComposer multisampling={4}><FocusDof .../>{gradeEffects()}</EffectComposer>
// Bloom threshold 1.0: only HDR / emissive things glow; the pure white (1.0) character cards do not, so they never gray or halo.
import React from 'react';
import {Bloom, BrightnessContrast, HueSaturation, Vignette} from '@react-three/postprocessing';
export const gradeEffects = (): React.ReactElement[] => [
  <Bloom key="bloom" intensity={0.55} luminanceThreshold={1.0} luminanceSmoothing={0.15} mipmapBlur />,
  <HueSaturation key="hs" hue={0.0} saturation={0.1} />,
  <BrightnessContrast key="bc" brightness={0.0} contrast={0.07} />,
  <Vignette key="vg" offset={0.32} darkness={0.42} />,
];
