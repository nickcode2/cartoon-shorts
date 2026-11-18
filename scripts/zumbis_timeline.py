#!/usr/bin/env python3
"""ZUMBIS_PARTE_10: trim the narration and build src/foco/timeline.json from the transcript (audio/zumbis_parte_10_asr.json, faster-whisper small, pt, word timestamps).
The recording holds a lead-in ("Um, dois, tres, testem"), TAKE 1 (3.7-84.4 s) and TAKE 2 (85.4-166.1 s). TAKE 2 is used (later read, one sentence per beat). Sentence starts are corrected with ffmpeg
silencedetect (-35 dB): whisper starts words 0.1-0.3 s early, the end of the silence before a sentence is its real start. Cut = first word of take 2 - 0.4 s (inside real silence).
usage: python3 scripts/zumbis_timeline.py [--audio]   (--audio also writes the trimmed ZUMBIS_PARTE_10/narration.mp3, padded to the video length)"""
import json, re, subprocess, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = f"{ROOT}/audio/zumbis_parte_10_narration_original.mp3"
asr = json.load(open(f"{ROOT}/audio/zumbis_parte_10_asr.json"))
TAKE2_FROM = 85.0
segs = [s for s in asr if s["a"] >= TAKE2_FROM]
sil = subprocess.run(["ffmpeg", "-hide_banner", "-i", ORIG, "-af", "silencedetect=noise=-35dB:d=0.25", "-f", "null", "-"], capture_output=True, text=True).stderr
ends = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", sil)]
def start_of(a):  # real start of a sentence = end of the silence just before it
    c = [e for e in ends if a - 0.08 <= e <= a + 0.55]
    return c[0] if c else a
first = start_of(segs[0]["a"]); CUT = round(first - 0.4, 3)
FPS = 30
# merge ASR segments into sentences (a segment ending without . ! ? continues in the next one)
sent = []; cur = None
for s in segs:
    if cur is None: cur = {"a": s["a"], "w": list(s["w"]), "t": s["t"]}
    else: cur["w"] += s["w"]; cur["t"] += " " + s["t"]
    if re.search(r"[.!?]\s*$", s["t"]): sent.append(cur); cur = None
if cur: sent.append(cur)
out_s = []; words = []
for s in sent:
    st = start_of(s["w"][0][0]); d = st - s["w"][0][0]
    ws = [[round(w[0] + d - CUT, 3), round(w[1] + d - CUT, 3), w[2].strip()] for w in s["w"]]
    # a word that starts before the corrected sentence start (whisper jitter) is clamped
    ws = [[max(a, round(st - CUT, 3)), b, t] for a, b, t in ws]
    out_s.append({"t": s["t"].strip(), "a": round(st - CUT, 3), "b": round(ws[-1][1], 3)}); words += ws
def wt(text, nth=0, after=0.0):  # time of the nth occurrence of a word (after a time)
    c = [w for w in words if w[2].strip(".,!?").lower() == text.lower() and w[0] >= after]
    return c[nth][0]
S = {i: out_s[i]["a"] for i in range(len(out_s))}
# beat anchors (shot id -> trimmed seconds)
A = [("1", 0.0), ("2", S[1]), ("3", wt("vidro")), ("4", S[2]), ("5", S[3]), ("6", S[4]), ("7", S[5]), ("8", wt("olha")), ("9a", S[6]), ("9b", wt("corre", after=S[6])), ("10", S[7]), ("11", S[8]), ("12", wt("caminho")),
     ("13", S[9]), ("14", S[10]), ("15", S[11]), ("16", S[12]), ("17", S[13]), ("18", S[14]), ("19", S[15]), ("20a", S[16]), ("20b", wt("crianças")), ("21", S[18]), ("22", S[19]), ("23", S[20]),
     ("24a", S[22]), ("24b", wt("correm", after=S[22])), ("24c", wt("não", after=S[22])), ("24d", S[23])]
speech_end = out_s[-1]["b"]; VIDEO = round(speech_end + 1.0 + 1e-9, 2); frames = int(round(VIDEO * FPS))
cuts = [{"id": i, "f": int(round(t * FPS))} for i, t in A]
for a, b in zip(cuts, cuts[1:]): assert b["f"] - a["f"] >= 12, (a, b)
json.dump({"fps": FPS, "frames": frames, "videoSec": frames / FPS, "take": 2, "cutSec": CUT, "firstWord": round(first - CUT, 3), "speechEnd": speech_end,
           "note": "Times in seconds of the TRIMMED narration (original minus cutSec). Take 2 of the recording (85.4-166.1 s of the original); lead-in and take 1 are removed. Sentence starts = end of the silence before them (ffmpeg silencedetect -35 dB), word times from faster-whisper small (pt).",
           "cuts": cuts, "sentences": out_s, "words": words}, open(f"{ROOT}/src/foco/timeline.json", "w"), ensure_ascii=False, indent=1)
print("cut at", CUT, "first word", round(first - CUT, 3), "speech end", speech_end, "video", VIDEO, "s", frames, "frames,", len(out_s), "sentences")
for c, (i, t) in zip(cuts, A): print(i, round(t, 2), c["f"])
if "--audio" in sys.argv:
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", str(CUT), "-i", ORIG, "-af", "apad", "-t", str(VIDEO), "-c:a", "libmp3lame", "-b:a", "192k", f"{ROOT}/ZUMBIS_PARTE_10/narration.mp3"], check=True)
    print("wrote ZUMBIS_PARTE_10/narration.mp3 (trimmed, padded to", VIDEO, "s)")
