#!/usr/bin/env python3
"""OVERBOARD_SURVIVOR: trim the narration and write src/ocean/timeline.json (38 takes, cut frames synced to the sentence / phrase starts).
Original: audio/overboard_survivor_narration_original.mp3 (a "1, 2, 3, testing" lead-in, then one take of the script, 81.4 s). Word times: audio/overboard_survivor_asr.json (faster-whisper small, en).
Whisper starts words 0.05-0.3 s early, so a phrase start is the END of the silence before it (ffmpeg silencedetect -35 dB / 0.25 s), as in the other videos.
CUT = first word ("A man falls...", real start 2.293 s) - 0.4 s = 1.893 s, inside real silence (the lead-in "testing" ends at 1.775 s). Video = 80.0 s = 2400 frames, narration padded with silence to that length.
usage: python3 scripts/overboard_timeline.py [--audio]   (--audio also writes OVERBOARD_SURVIVOR/narration.mp3)"""
import json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = f"{ROOT}/audio/overboard_survivor_narration_original.mp3"
OUT = f"{ROOT}/src/ocean/timeline.json"
FPS, TOTAL_S = 30, 80.0
sil = subprocess.run(["ffmpeg", "-hide_banner", "-i", ORIG, "-af", "silencedetect=noise=-35dB:d=0.25", "-f", "null", "-"], capture_output=True, text=True).stderr
ends = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", sil)]
def snap(t):  # the end of the silence just before t (within -0.1 .. +0.6 s) = the real start of the phrase; otherwise t itself
    c = [e for e in ends if t - 0.1 <= e <= t + 0.6]
    return c[0] if c else t
FIRST = snap(2.24); CUT = round(FIRST - 0.4, 3)
# take table: (id, original-recording time of the take start, what the narration says there). Times are phrase starts (snapped to the silence end) or word starts inside a phrase (from whisper).
T = [
 ('1', None, 'A man falls off a cruise ship.'), ('2', 3.90, 'At night.'), ('3', 5.336, 'Nobody sees it.'), ('4', 6.803, 'He hits the water, and the ship keeps sailing.'),
 ('5', 10.069, 'Wait, what? Nobody noticed?'), ('6', 12.919, "You see, he'd only been on board for a day."), ('7a', 15.843, 'Minutes earlier, he\'d won an air...'), ('7b', 17.50, '...guitar contest with his sister.'),
 ('8', 19.526, "Then he went to the bathroom. And that's the last thing he remembers."), ('9', 23.993, 'He wakes up alone in the dark water.'),
 ('10a', 26.574, 'No boat,'), ('10b', 27.585, 'no lights,'), ('10c', 28.757, 'nothing.'), ('11', 29.794, 'So, he treads water.'),
 ('12a', 31.770, 'Jellyfish drift by, glowing in the dark,'), ('12b', 34.491, 'their tentacles brushing his legs.'), ('13a', 36.809, 'A strong current drags him...'), ('13b', 38.55, '...farther and farther from the ship,'),
 ('14a', 40.454, 'and every shadow in the water...'), ('14b', 42.20, '...could be a shark.'), ('15', 43.745, 'Now imagine something even bigger,'), ('16', 46.035, 'something enormous sliding silently...'), ('17', 47.90, '...far below him.'),
 ('18', 49.952, 'Dark. Massive. Gone.'), ('19', 53.244, "The sun comes up, and he's still swimming."), ('20a', 56.097, 'Back on the ship,'), ('20b', 58.20, 'his sister realizes he never came back.'),
 ('21', 59.784, 'The ship turns around and retraces its route,'), ('22', 62.602, 'but one person in a huge ocean is just a tiny dot.'), ('23a', 66.577, 'Almost 20 hours later,'), ('23b', 68.22, 'a cargo ship crew spots'),
 ('23c', 69.44, 'a person,'), ('24', 70.485, 'still alive.'), ('25', 71.899, 'A helicopter lowers a rescuer'), ('26', 73.50, 'and pulls him out.'), ('27', 75.139, 'The guy who vanished after winning an air guitar contest'),
 ('28a', 78.193, 'survived almost a day alone'), ('28b', 80.30, 'in the Gulf of Mexico.'),
]
starts = [0 if t is None else int(round((snap(t) - CUT) * FPS)) for _, t, _ in T]
FRAMES = int(TOTAL_S * FPS)
cuts = [{"id": T[i][0], "f": starts[i], "line": T[i][2]} for i in range(len(T))]
asr = json.load(open(f"{ROOT}/audio/overboard_survivor_asr.json"))
sentences = [{"t": s["t"], "a": round(s["a"] - CUT, 3), "b": round(s["b"] - CUT, 3)} for s in asr]
json.dump({"fps": FPS, "frames": FRAMES, "videoSec": TOTAL_S, "narrationTrimStart": CUT, "firstWord": 0.4,
           "note": "Seconds of the TRIMMED narration (original minus cut). Phrase starts = end of the silence before them (ffmpeg silencedetect); word times inside phrases from faster-whisper small (en).",
           "cuts": cuts, "sentences": sentences}, open(OUT, "w"), indent=1)
print("cut", CUT, "frames", FRAMES)
for i, c in enumerate(cuts):
    nxt = cuts[i + 1]["f"] if i + 1 < len(cuts) else FRAMES
    print(f"{c['id']:>4} f{c['f']:>5}-{nxt:<5} {(nxt - c['f']) / FPS:4.2f}s  {c['line']}")
if "--audio" in sys.argv:
    os.makedirs(f"{ROOT}/OVERBOARD_SURVIVOR", exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", str(CUT), "-i", ORIG, "-af", f"apad=whole_dur={TOTAL_S}", "-t", str(TOTAL_S), "-ar", "44100", "-b:a", "192k", f"{ROOT}/OVERBOARD_SURVIVOR/narration.mp3"], check=True)
    print("wrote OVERBOARD_SURVIVOR/narration.mp3")
