import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {DISS, DISSOLVE_AFTER, FPS, STARTS, TOTAL, shotRange} from './data';
import {Stage, clamp01} from './kit';
import {SHOTS, absOf} from './shots';

const ShotView: React.FC<{n: number; len: number; diss: boolean}> = ({n, len, diss}) => {
  const f = Math.max(0, useCurrentFrame());
  const def = SHOTS[n];
  const t = f / FPS;
  const u = clamp01(f / len);
  const pose = def.cam(u, t);
  const light = typeof def.light === 'function' ? def.light(t) : def.light;
  const opacity = diss && f >= len ? Math.max(0, 1 - (f - len + 1) / DISS) : 1;
  return (
    <AbsoluteFill style={{opacity, zIndex: 1000 - n, background: '#000'}}>
      <Stage frame={f} pose={pose} light={light} ambBoost={def.ambBoost}>
        {def.render(t, u, absOf(n, t))}
      </Stage>
    </AbsoluteFill>
  );
};

export const CrisisShort: React.FC<{audio?: boolean}> = ({audio = true}) => (
  <AbsoluteFill style={{background: '#000'}}>
    {STARTS.map((_, i) => {
      const n = i + 1;
      const [a, b] = shotRange(n);
      const diss = DISSOLVE_AFTER.has(n);
      return (
        <Sequence key={n} from={a} durationInFrames={b - a + (diss ? DISS : 0)} premountFor={20} styleWhilePremounted={{opacity: 0}}>
          <ShotView n={n} len={b - a} diss={diss} />
        </Sequence>
      );
    })}
    {audio && <Audio src={staticFile('mix.mp3')} />}
  </AbsoluteFill>
);

export {TOTAL};
