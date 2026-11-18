# AIRPLANE_WINDOWS notes

Composition `AirplaneWindows` (with audio `public/mix_airplane.mp3`) and `AirplaneWindowsSilent` (for client-side render). 2220 frames at 30 fps (74.0 s).
Audio build: `python3 audio/make_airplane_audio.py` (needs numpy and scipy, installed with `pip3 install --user numpy scipy`). Clean export: `AIRPLANE_WINDOWS/` (narration, sfx, ambience, 24-bit 48 kHz stereo, 74.0 s each).

## Trim
Original `audio/voiceover.mp3`: warm-up ends about 1.75 s, first word at 2.157 s. Cut at 1.80 s (silent to -45 dB), so the first word starts 0.357 s into the clean file (rule asks 0.4 s; the real pause is shorter). 30 ms fade-in.

## Timing method
No ASR installed. Sentence times come from `ffmpeg silencedetect` (-38 dB, 0.1 s) mapped to the script by syllable rate (about 4.7 to 5.5 syllables per second). Good to about 3 frames per sentence; inside a sentence (e.g. "Passengers love it") words are interpolated.

## Sources (searched 2026-11-13, secondary sources only)
- Comet failures were metal fatigue at the corners of the square windows; a Comet fuselage was tested in a water tank, repeatedly pressurised and depressurised; the redesigned Comet 4 (1958) had oval windows and thicker skin: https://migflug.com/afterburner/the-worlds-first-jet-airliner-and-why-it-fell-apart/ and https://migflug.com/afterburner/de-havilland-comet-first-jet-airliner-metal-fatigue-square-windows/. Cycle counts, registrations and the ADF-window detail from these pages are NOT used (unverified against the RAE report).
- Bleed (breather) hole: small hole in the MIDDLE pane of the three-pane window; it equalises cabin pressure into the gap, so the OUTER pane carries the load and the middle pane is the backup; also prevents fogging: https://www.sciencealert.com/here-s-why-there-s-a-tiny-hole-in-airplane-windows , https://www.mentalfloss.com/transportation/planes-airports/why-airplane-windows-have-tiny-holes
- Script says the hole is "at the bottom of every pane"; in the model it is in the middle pane near the bottom, per the sources.

## Estimates, untested
Window sizes, tank size, fuselage radius, swell amount (7.5 percent, exaggerated), crack path, all timings of the pressure cycles (16 frames per pulse), sound levels.
