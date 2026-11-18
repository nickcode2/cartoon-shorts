#!/usr/bin/env python3
"""OVERBOARD_SURVIVOR audio: writes OVERBOARD_SURVIVOR/sfx.wav and ambience.wav (44.1 kHz, 16 bit, stereo), both exactly 80.0 s (2400 frames at 30 fps). No music.
Cue times come from src/ocean/timeline.json (take start frames). All sounds are synthesized with numpy / scipy (no samples).
SFX: a soft whoosh on every cut and every fast camera move, ship horn, crowd cheer, splash, underwater muffle, heartbeat, creaks, jellyfish hum, current whoosh, shark-fin sting,
deep sub-bass rumble for the huge shape (then silence on "Gone"), helicopter rotor, rope winch. AMBIENCE: night ocean + a distant ship engine (low, fading as the ship leaves), far deck music early, gulls from sunrise."""
import json, os, wave
import numpy as np
from scipy import signal

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'src/ocean/timeline.json')))
FPS, FRAMES = TL['fps'], TL['frames']
N = int(round(FRAMES / FPS * SR))
rng = np.random.default_rng(11)
cut = {c['id']: c['f'] for c in TL['cuts']}
fr = lambda f: f / FPS
t = lambda d: np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def lp(x, fc, o=2): return signal.sosfilt(signal.butter(o, min(fc, SR / 2 - 100), 'low', fs=SR, output='sos'), x)
def hp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return signal.sosfilt(signal.butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def env(n, a=0.01, r=0.1):
    e = np.ones(n); na, nr = max(1, int(a * SR)), max(1, int(r * SR)); e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def sine(f, d): return np.sin(2 * np.pi * f * t(d))
def sweep(f0, f1, d): f = np.linspace(f0, f1, int(d * SR)); return np.sin(2 * np.pi * np.cumsum(f) / SR)

# ---------------------------------------------------------------- sounds (mono float arrays)
def whoosh(d=0.35, k=1.0): n = bp(noise(d), 300, 2400) * np.sin(np.linspace(0, np.pi, int(d * SR))) ** 2; return 0.5 * k * n / (np.max(np.abs(n)) + 1e-9) * 0.6
def horn(d=2.2): x = (sine(110, d) + 0.6 * sine(165, d) + 0.35 * sine(220, d) + 0.2 * sine(330, d)) * env(int(d * SR), 0.12, 0.9); return 0.32 * lp(x, 900)
def cheer(d=1.8): n = bp(noise(d), 500, 3200); a = 0.6 + 0.4 * np.abs(lp(noise(d), 9)) * 14; return 0.5 * n * np.minimum(a, 1.4) * env(len(n), 0.15, 0.7) / 3
def splash(d=1.4): n = hp(noise(d), 400) * np.exp(-t(d) * 3.2); b = lp(noise(d), 300) * np.exp(-t(d) * 5) * 1.2; return 0.8 * (n * 0.5 + b) / 2
def bubbles(d=1.0):
    x = np.zeros(int(d * SR)); m = 600
    for s0 in rng.uniform(0, d - 0.05, 12):
        i = int(s0 * SR); seg = np.sin(2 * np.pi * rng.uniform(500, 1500) * t(m / SR)) * np.exp(-t(m / SR) * 160); x[i:i + m] += seg[:len(x[i:i + m])]
    return 0.25 * x
def under(d=2.5): n = lp(noise(d), 380, 3); return 0.55 * n / (np.max(np.abs(n)) + 1e-9) * env(len(n), 0.3, 0.4) * 0.5
def heart(beats=4, bpm=70):
    out = np.zeros(int(beats * 60 / bpm * SR) + SR)
    for b in range(beats):
        for off, g in [(0.0, 1.0), (0.26, 0.7)]:
            i = int((b * 60 / bpm + off) * SR); d = 0.16; x = sine(52, d) * np.exp(-t(d) * 22) * g + lp(noise(d), 160) * np.exp(-t(d) * 40) * 0.5 * g; out[i:i + len(x)] += x
    return 0.9 * out
def creak(d=1.1): f = 120 + 60 * np.abs(np.sin(2 * np.pi * 1.7 * t(d))) + 25 * lp(noise(d), 14) * 8; ph = 2 * np.pi * np.cumsum(f) / SR; return 0.2 * np.sign(np.sin(ph)) * lp(np.abs(noise(d)), 8) * 4 * env(len(ph), 0.1, 0.4) * 0.3
def hum(d=2.5): x = (sine(246, d) + 0.5 * sine(369, d)) * (0.6 + 0.4 * np.sin(2 * np.pi * 3.2 * t(d))); return 0.1 * x * env(len(x), 0.4, 0.6)
def current(d=1.8): n = bp(noise(d), 120, 1400, 3) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.9 * t(d))); return 0.5 * n / (np.max(np.abs(n)) + 1e-9) * 0.7 * env(len(n), 0.3, 0.5)
def sting(d=1.6): x = (sine(110, d) + sine(116.5, d) + 0.6 * sine(233, d) + 0.5 * sine(246, d)) * np.exp(-t(d) * 1.6); n = hp(noise(d), 3000) * np.exp(-t(d) * 6) * 0.15; return 0.28 * x * env(len(x), 0.02, 0.5) + n
def rumble(d=6.0, k=1.0): x = (sine(34, d) + 0.7 * sine(47, d) + 0.5 * sine(61, d)) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.35 * t(d))); sw = np.sin(np.linspace(0, np.pi, int(d * SR))) ** 1.5; return 0.85 * k * x * sw / 2.2
def rotor(d=3.0, k=1.0):
    x = np.zeros(int(d * SR)); per = 1 / 17.0
    for i in range(int(d / per)):
        j = int(i * per * SR); m = int(0.07 * SR); seg = lp(noise(0.07), 700)[:m] * np.exp(-np.arange(m) / SR * 55); x[j:j + m] += seg[:len(x) - j]
    return 0.6 * k * (x / (np.max(np.abs(x)) + 1e-9) * 0.7 + 0.15 * lp(noise(d), 500)) * env(len(x), 0.4, 0.5)
def winch(d=2.0, k=1.0):
    x = np.zeros(int(d * SR)); m = 300
    for s0 in np.arange(0.0, d - 0.02, 0.055):
        i = int(s0 * SR); seg = 0.5 * np.sin(2 * np.pi * 1900 * t(m / SR)) * np.exp(-np.arange(m) / SR * 700); x[i:i + m] += seg[:len(x[i:i + m])]
    return k * (0.5 * x + 0.12 * sine(95, d) * env(len(x), 0.1, 0.3) + 0.06 * lp(noise(d), 600))
def gull():
    d = 0.5; f = 1800 + 700 * np.sin(2 * np.pi * 5 * t(d)) * np.exp(-t(d) * 3); ph = 2 * np.pi * np.cumsum(f) / SR; return 0.12 * np.sin(ph) * np.sin(np.linspace(0, np.pi, len(ph))) ** 1.5

cues = []  # (seconds, mono array, gain)
def add(sec, x, g=1.0): cues.append((sec, x, g))
ids = [c['id'] for c in TL['cuts']]
for k, i in enumerate(ids[1:], 1): add(fr(cut[i]) - 0.05, whoosh(0.32), 0.5)  # a whoosh on every cut
for i in ['1', '2', '13b', '18', '21', '22', '28a']: add(fr(cut[i]) + 0.1, whoosh(0.6), 0.45)  # big camera moves
for i in ['10a', '10b', '10c']: add(fr(cut[i]) + 0.0, whoosh(0.45), 0.6)  # the 270 degree arc
add(0.6, horn(2.4), 0.55); add(fr(cut['2']) + 0.1, horn(2.0), 0.4)  # ship horn
add(fr(cut['4']) + 0.02, splash(1.5), 1.0); add(fr(cut['4']) + 0.4, bubbles(0.8), 0.6)
add(fr(cut['7a']) + 0.05, cheer(1.8), 0.9); add(fr(cut['7b']) + 0.2, cheer(1.8), 1.0)
add(fr(cut['9']) + 0.1, under(2.0), 0.5)
for i, k in [('12a', 1.0), ('12b', 1.0)]: add(fr(cut[i]), hum(2.6), k); add(fr(cut[i]) + 0.1, under(2.4), 0.45)
add(fr(cut['12b']) + 0.75, bubbles(0.7), 0.8)
add(fr(cut['13a']), current(1.9), 1.0); add(fr(cut['13b']), current(1.9), 0.9)
add(fr(cut['14a']) + 0.2, sting(1.7), 0.9); add(fr(cut['14b']) + 0.1, sting(1.6), 0.8)
add(fr(cut['15']), heart(6, 66), 0.9)  # heartbeat through the imagined sequence
add(fr(cut['16']) - 0.3, heart(6, 74), 0.9); add(fr(cut['16']), under(3.6), 0.5)
add(fr(cut['16']) - 0.2, rumble(5.2, 1.0), 1.0)  # sub-bass swell under the huge shape, then silence on "Gone"
add(fr(cut['20a']) + 0.4, creak(1.1), 0.9); add(fr(cut['20a']) + 1.3, creak(0.8), 0.6)
add(fr(cut['25']) - 0.2, rotor(4.6, 1.0), 1.0); add(fr(cut['25']) + 0.1, winch(1.9, 0.9), 0.8); add(fr(cut['26']), winch(1.5, 0.9), 0.8)
add(fr(cut['28a']), rotor(2.8, 0.45), 0.8)
for s in [fr(cut['23a']) + 0.5, fr(cut['24']) + 0.3]: add(s, gull(), 0.7)

def render():
    L = np.zeros(N); R = np.zeros(N)
    for sec, x, g in cues:
        i = int(max(0, sec) * SR)
        if i >= N: continue
        pan = rng.uniform(-0.25, 0.25); seg = (x * g)[:N - i]; L[i:i + len(seg)] += seg * (1 - pan) * 0.6; R[i:i + len(seg)] += seg * (1 + pan) * 0.6
    # the rumble ends in silence: duck everything but the heartbeat during the last second of take 18 ("Gone.")
    g0, g1 = int(fr(cut['18']) * SR) + int(2.3 * SR), int(fr(cut['19']) * SR)
    duck = np.ones(N); duck[g0:g1] = np.linspace(1, 0.0, g1 - g0) ** 0.5; duck[g1 - int(0.08 * SR):g1] = 0; return L * duck, R * duck
def ambience():
    d = N / SR; tt = np.arange(N) / SR
    sea = lp(noise(d), 550, 2) * (0.5 + 0.5 * np.abs(lp(noise(d), 0.35)) * 5)  # slow swells
    wind = bp(noise(d), 200, 1200) * 0.35 * (0.6 + 0.4 * np.abs(lp(noise(d), 0.2)) * 6)
    lap = hp(noise(d), 2500) * 0.02 * (0.4 + 0.6 * np.abs(lp(noise(d), 2.5)) * 6)
    ship_amp = np.interp(tt, [0, fr(cut['4']), fr(cut['4']) + 6, fr(cut['9']), fr(cut['13b']) + 2, fr(cut['21']), fr(cut['21']) + 3, d], [0.5, 1.0, 0.55, 0.12, 0.05, 0.4, 0.2, 0.0])  # distant ship engine: loud near the ship, far away in the water, back when it turns around
    engine = (np.sin(2 * np.pi * 48 * tt) + 0.6 * np.sin(2 * np.pi * 96.4 * tt) + 0.3 * np.sin(2 * np.pi * 144 * tt)) * (0.85 + 0.15 * np.sin(2 * np.pi * 7 * tt)) * ship_amp * 0.07
    music = np.zeros(N)  # far deck music, only while we are on the ship (a quiet, band-limited lounge chord pulse)
    for f0, a in [(262, 1), (330, 0.8), (392, 0.7), (523, 0.4)]: music += np.sin(2 * np.pi * f0 * tt) * a
    music = bp(music * (0.5 + 0.5 * np.sin(2 * np.pi * 1.9 * tt)), 250, 1800) * 0.01
    music *= np.clip(np.interp(tt, [0, fr(cut['4']), fr(cut['4']) + 2.5], [1, 1, 0]) + np.interp(tt, [fr(cut['5']), fr(cut['5']) + 0.1, fr(cut['9']) - 0.3, fr(cut['9'])], [0, 1, 1, 0]), 0, 1)
    gulls = np.zeros(N)
    for s in np.arange(fr(cut['19']) + 0.8, d - 1.0, 2.6):
        i = int(s * SR); x = gull() * 0.8; gulls[i:i + len(x)] += x[:N - i]
        if rng.random() < 0.6: j = int((s + 0.35) * SR); gulls[j:j + len(x)] += x[:max(0, N - j)] * 0.6
    gulls *= np.interp(tt, [fr(cut['19']), fr(cut['19']) + 1.0, d], [0, 1, 1])
    under_bed = lp(noise(d), 220, 2) * 0.35 * (np.interp(tt, [fr(cut['12a']) - 0.1, fr(cut['12a']) + 0.2, fr(cut['12b']) + 2.4, fr(cut['12b']) + 2.6], [0, 1, 1, 0]) + np.interp(tt, [fr(cut['16']), fr(cut['16']) + 0.3, fr(cut['19']) - 0.05, fr(cut['19'])], [0, 1, 1, 0]))
    day = np.interp(tt, [fr(cut['19']) - 0.1, fr(cut['19'])], [0, 1])
    L = (sea * 0.2 + wind * 0.05 + lap + engine + music + gulls + under_bed * 0.3) * (1 - 0.3 * day) + sea * 0.05 * day
    R = np.roll(L, 211) * 0.97
    return L, R
def save(name, L, R):
    pk = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-9); k = 0.85 / pk if pk > 0.85 else 1.0
    st = (np.stack([L * k, R * k], 1) * 32767).astype('<i2')
    with wave.open(os.path.join(ROOT, 'OVERBOARD_SURVIVOR', name), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
    print(name, round(len(st) / SR, 3), 's', 'peak', round(float(pk), 3))
os.makedirs(os.path.join(ROOT, 'OVERBOARD_SURVIVOR'), exist_ok=True)
L, R = render(); save('sfx.wav', L, R)
a, b = ambience(); save('ambience.wav', a, b)
