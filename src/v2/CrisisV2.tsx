// CrisisShortV2: same script / audio / timing / shot list as CrisisShort, rebuilt in the approved style on the single-canvas kit.
import React, {useLayoutEffect, useMemo, useState} from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useDelayRender} from 'remotion';
import {SingleCanvasVideo} from '../kit/kit';
import {FREDOKA, waitForFredoka} from '../kit/PopLabel';
import {useMouthFlap} from './cast';
import {buildShots} from './shots';

export const CrisisShortV2: React.FC<{audio?: boolean}> = ({audio = true}) => {
  const [ready, setReady] = useState(false);
  const frame = useCurrentFrame();
  // neighbor's line "What, is the world ending?" (8.08 s .. 9.7 s = shot 5, frames 242..294) drives his mouth from the real voice file
  const speak = useMouthFlap(frame, 242, 294);
  const {delayRender, continueRender} = useDelayRender();
  useLayoutEffect(() => {
    const h = delayRender('Fredoka font', {timeoutInMilliseconds: 15000});
    waitForFredoka()
      .then(() => document.fonts.load(`700 100px ${FREDOKA}`))
      .catch(() => undefined)
      .then(() => {
        setReady(true);
        continueRender(h);
      });
  }, [delayRender, continueRender]);
  const shots = useMemo(() => buildShots(speak), [speak]);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {ready && <SingleCanvasVideo shots={shots} fps={30} />}
      {audio && <Audio src={staticFile('mix.mp3')} />}
    </AbsoluteFill>
  );
};
