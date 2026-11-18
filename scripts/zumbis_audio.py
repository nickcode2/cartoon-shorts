#!/usr/bin/env python3
"""ZUMBIS_PARTE_10 audio: writes ZUMBIS_PARTE_10/sfx.wav and ambience.wav (44.1 kHz, 16 bit, stereo), both exactly the length of the video (frames from src/foco/timeline.json at 30 fps). No music.
Cue times come from the cut frames (src/foco/timeline.json) and the action times of src/foco/shots.tsx (glass burst, the grab, the radio, the door, the zombies hitting the water). All sounds are synthesized with numpy / scipy (no samples).
SFX: whoosh on every cut and every fast move, claws scraping + sparks, glass burst, steps + breath, radio static at MAX volume that moves away, wing flaps + swarm roar, water curtain, bodies hitting the ground, crowd murmur + soft kids breathing,
heavy door, night wind. AMBIENCE: night city wind + distant growls, low."""
import json, os, wave
import numpy as np
from scipy.signal import lfilter

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'src/foco/timeline.json')))
FPS, FRAMES = TL['fps'], TL['frames']
N = int(round(FRAMES / FPS * SR))
rng = np.random.default_rng(11)
T = lambda d: np.arange(int(d * SR)) / SR
cut = {c['id']: c['f'] / FPS for c in TL['cuts']}
def env(n, a=0.005, r=0.1):
    e = np.ones(n); na, nr = max(1, int(a * SR)), max(1, min(n, int(r * SR))); e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def lp(x, fc, order=1):
    a = np.exp(-2 * np.pi * fc / SR); y = x
    for _ in range(order): y = lfilter([1 - a], [1, -a], y)
    return y
def hp(x, fc): return x - lp(x, fc)
def bp(x, lo, hi): return lp(hp(x, lo), hi)
def noise(d): return rng.standard_normal(int(d * SR))
def sine(f, d): return np.sin(2 * np.pi * f * T(d))
def fm(f, d): ph = 2 * np.pi * np.cumsum(f) / SR; return np.sin(ph)
def slow(d, rate, depth=1.0, seed=0):  # slow random modulation 0..1
    r = np.random.default_rng(seed); k = max(2, int(d * rate) + 2); pts = r.random(k); x = np.interp(np.linspace(0, k - 1, int(d * SR)), np.arange(k), pts); return 1 - depth + depth * x

# ---------------------------------------------------------------- sounds (mono float arrays)
def whoosh(d=0.35, bright=1800):
    n = noise(d); sweep = np.sin(np.linspace(0, np.pi, len(n))) ** 2; b = lp(n, bright) * sweep + 0.4 * bp(n, 300, 900) * sweep; return 0.5 * b
def step(f0=140, g=0.5): d = 0.13; return g * lp(noise(d), 420) * np.exp(-T(d) * 36) + 0.25 * g * sine(f0, d) * np.exp(-T(d) * 50)
def pant(d=0.5): n = bp(noise(d), 400, 2400) * (0.5 + 0.5 * np.sin(2 * np.pi * 2.6 * T(d) - 1.2)) ** 2; return 0.22 * n * env(len(n), 0.05, 0.2)
def flap(d=0.28, g=0.5): n = lp(noise(d), 650) * np.sin(np.linspace(0, np.pi, int(d * SR))) ** 1.5; return g * (n + 0.5 * lp(noise(d), 160) * np.exp(-T(d) * 12))
def flaps(d, rate=7.0, g=0.4, seed=1):  # a swarm of flaps: random-density flap events
    out = np.zeros(int(d * SR)); r = np.random.default_rng(seed)
    for k in range(int(d * rate)):
        s = int(r.random() * max(0.05, d - 0.3) * SR); f = flap(0.2 + 0.15 * r.random(), g * (0.4 + 0.6 * r.random())); out[s:s + len(f)] += f[:len(out) - s]
    return out
def roar(d, lo=70, hi=700, g=0.5, seed=2):  # swarm roar: low rumble + growl formants, slow swell
    n = noise(d); a = bp(n, lo, hi) * slow(d, 6, 0.6, seed) + 0.6 * lp(n, 120, 2); sw = np.sin(np.linspace(0, np.pi, len(n))) ** 0.7; return g * a * sw
def growl(d=1.4, f=62, g=0.45):
    fr = f * (1 + 0.12 * np.sin(2 * np.pi * 5.5 * T(d))) * (1 - 0.15 * T(d) / d); ph = fm(fr, d); x = (np.sign(ph) * 0.4 + ph) * (0.6 + 0.4 * np.sin(2 * np.pi * 22 * T(d))); return g * lp(x, 520, 2) * env(len(x), 0.08, 0.5)
def scrape(d=1.6): # claws on asphalt: gritty noise with a metallic squeal
    n = hp(noise(d), 1200) * (0.5 + 0.5 * slow(d, 28, 1, 5)); sq = 0.12 * fm(2400 + 600 * np.sin(2 * np.pi * 3 * T(d)), d) * slow(d, 9, 1, 6); return 0.55 * (n + sq) * env(len(n), 0.04, 0.3)
def sparks(d=1.6): n = hp(noise(d), 4500); p = (rng.random(len(n)) > 0.9985).astype(float); p = lp(p * 60, 1500); return 0.3 * n * np.clip(p, 0, 1) * env(len(n), 0.02, 0.3)
def glass(d=1.4):  # burst: noise crack + a swarm of high tinkles
    n = noise(d); crack = hp(n, 1500) * np.exp(-T(d) * 14); out = 0.9 * crack
    for k in range(34):
        s = int((0.02 + rng.random() * 0.9) * SR); f = 2800 + rng.random() * 5200; tk = sine(f, 0.12) * np.exp(-T(0.12) * 38) * (0.15 + 0.3 * rng.random()); out[s:s + len(tk)] += tk[:len(out) - s]
    return 0.6 * out + 0.4 * lp(n, 200) * np.exp(-T(d) * 22)
def thud(d=0.4, f=70, g=0.8): return g * (sine(f, d) * np.exp(-T(d) * 14) + 0.5 * lp(noise(d), 300) * np.exp(-T(d) * 30))
def splat(d=0.35): return 0.35 * (bp(noise(d), 300, 3000) * np.exp(-T(d) * 18)) + 0.25 * lp(noise(d), 160) * np.exp(-T(d) * 25)
def static(d, g=1.0, seed=3):  # radio static at max volume: bright noise, AM crackle, tuning sweeps
    r = np.random.default_rng(seed); n = r.standard_normal(int(d * SR)); b = bp(n, 700, 7000) * (0.7 + 0.5 * slow(d, 40, 1, seed)); sw = fm(500 + 400 * np.sin(2 * np.pi * 0.7 * T(d)) + 700 * slow(d, 3, 1, seed + 1), d) * 0.14 * slow(d, 5, 1, seed + 2)
    cr = (r.random(len(n)) > 0.9992).astype(float); cr = lp(cr * 40, 3000); return g * np.clip(b + sw + 0.8 * hp(cr * n, 2000), -1.6, 1.6) * 0.6
def water(d, g=0.5): n = noise(d); return g * (bp(n, 500, 5000) * 0.6 + lp(n, 220, 2) * 0.8) * (0.85 + 0.15 * slow(d, 4, 1, 9))
def drip(): d = 0.18; return 0.25 * sine(1500, d) * np.exp(-T(d) * 40)
def creak(d=1.1): f = 160 + 90 * np.sin(2 * np.pi * 2.2 * T(d)) + 60 * T(d); return 0.28 * (fm(f, d) + 0.5 * fm(f * 2.01, d)) * np.exp(-T(d) * 1.6) * slow(d, 14, 0.6, 12)
def clunk(d=0.5): return 0.8 * (lp(noise(d), 800) * np.exp(-T(d) * 18) + sine(95, d) * np.exp(-T(d) * 9))
def murmur(d, g=0.3, seed=4): r = np.random.default_rng(seed); n = r.standard_normal(int(d * SR)); return g * bp(n, 180, 1400) * (0.6 + 0.4 * slow(d, 3, 1, seed)) * (0.5 + 0.5 * slow(d, 0.7, 1, seed + 1))
def kid_breath(d, g=0.25, seed=5): n = bp(np.random.default_rng(seed).standard_normal(int(d * SR)), 300, 2200); return g * n * (0.5 + 0.5 * np.sin(2 * np.pi * 0.42 * T(d))) ** 2
def wind(d, g=0.5, seed=6): n = np.random.default_rng(seed).standard_normal(int(d * SR)); return g * (bp(n, 90, 700) * slow(d, 0.35, 0.8, seed) + 0.4 * bp(n, 600, 2400) * slow(d, 0.5, 1, seed + 1))
def run_steps(d, rate=3.2, g=0.5, seed=1, per=1):
    out = np.zeros(int(d * SR)); r = np.random.default_rng(seed)
    for p in range(per):
        k = 0.0
        while k < d - 0.15:
            s = int((k + r.random() * 0.04) * SR); st = step(110 + 40 * r.random(), g * (0.7 + 0.3 * r.random())); out[s:s + len(st)] += st[:len(out) - s]; k += (1 / rate) * (0.9 + 0.2 * r.random())
    return out

# ---------------------------------------------------------------- cue list
sfx = np.zeros((N, 2))
def put(sec, x, g=1.0, pan=0.0):
    s = int(max(0, sec) * SR); x = x[:max(0, N - s)]; l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4); sfx[s:s + len(x), 0] += g * l * x; sfx[s:s + len(x), 1] += g * r * x
ids = [c['id'] for c in TL['cuts']]
for i, c in enumerate(ids[1:], 1): put(cut[c] - 0.05, whoosh(0.32 + 0.1 * (i % 3), 1500 + 600 * (i % 4)), 0.55, [-0.5, 0.4, 0, 0.6, -0.3][i % 5])  # a whoosh on EVERY cut
# fast moves inside shots
for sec, g in [(cut['5'] + 1.4, 0.5), (cut['9b'] + 0.5, 0.5), (cut['10'] + 0.6, 0.6), (cut['11'] + 0.9, 0.55), (cut['12'] + 0.4, 0.4), (cut['15'] + 1.6, 0.5), (cut['19'] + 1.0, 0.45), (cut['20a'] + 1.2, 0.35), (cut['23'] + 1.5, 0.45)]: put(sec, whoosh(0.5, 2200), g)
# 1: panicked run toward camera (5 runners), the sky full of zombies diving: swarm roar swells, flaps, flybys
put(0.0, run_steps(cut['2'], 3.4, 0.55, 1, 3), 0.8); put(0.2, np.concatenate([pant(0.5)] * int(cut['2'] / 0.5)), 0.7); put(0.4, roar(cut['2'] - 0.4, 60, 620, 0.55, 2), 0.9); put(0.8, flaps(cut['2'] - 1, 9, 0.35, 3), 0.8)
for k, s in enumerate([2.0, 3.4, 5.0]): put(s, whoosh(0.9, 900) * 1.2, 0.8, [-0.8, 0.7, -0.2][k])
# 2: claws on asphalt + sparks
put(cut['2'], scrape(cut['3'] - cut['2']), 0.9, 0.1); put(cut['2'] + 0.05, sparks(cut['3'] - cut['2']), 0.7, -0.1); put(cut['2'], flaps(cut['3'] - cut['2'], 8, 0.3, 4), 0.6)
# 3: glass bursts (the hero window at cut 3 + 0.9 s), a zombie crashes out, runners go on
put(cut['3'], run_steps(cut['4'] - cut['3'], 3.4, 0.5, 2, 3), 0.7); put(cut['3'] + 0.9, glass(1.5), 1.0, -0.4); put(cut['3'] + 0.95, thud(0.4, 80, 0.6), 0.8, -0.4); put(cut['3'] + 1.0, growl(1.1, 78, 0.5), 0.8, -0.3); put(cut['3'] + 1.3, flaps(1.2, 9, 0.45, 5), 0.8)
# 4: steps, Ana trips (frame 26), a gasp + scuff, Caio grabs (frame 56), pull, run again (frame 84)
put(cut['4'], run_steps(26 / 30, 3.4, 0.5, 3, 2), 0.7); put(cut['4'] + 26 / 30, thud(0.35, 120, 0.4), 0.8); put(cut['4'] + 26 / 30, lp(noise(0.5), 1400) * np.exp(-T(0.5) * 9) * 0.5, 0.7); put(cut['4'] + 0.9, pant(0.6), 0.9); put(cut['4'] + 56 / 30, thud(0.2, 190, 0.35), 0.7); put(cut['4'] + 84 / 30, run_steps(cut['5'] - cut['4'] - 84 / 30, 3.3, 0.5, 4, 2), 0.7)
put(cut['4'], roar(cut['5'] - cut['4'], 60, 500, 0.35, 8), 0.7)
# 5 / 6: the golden tower (soft shimmer rising), then the wall of zombies hovering: dense flaps + low growls
shim = (sine(523, 2.8) + 0.6 * sine(784, 2.8) + 0.4 * sine(1046, 2.8)) * np.sin(np.linspace(0, np.pi, int(2.8 * SR))) ** 2 * 0.1; put(cut['5'], shim, 0.8)
put(cut['5'], flaps(cut['7'] - cut['5'], 12, 0.25, 6), 0.6); put(cut['6'], roar(cut['7'] - cut['6'], 50, 360, 0.5, 9), 0.8); put(cut['6'] + 0.8, growl(1.6, 55, 0.5), 0.7, 0.3); put(cut['6'] + 2.0, growl(1.5, 66, 0.4), 0.6, -0.4)
# 7 / 8: Bruno stops (steps die away, breath), calm determined close-up (heartbeat-like low pulses, wind)
put(cut['7'], run_steps(0.9, 3.0, 0.45, 5, 2), 0.7); put(cut['7'] + 0.4, pant(1.0), 0.8)
for k in range(5): put(cut['8'] + 0.2 + k * 0.6, thud(0.25, 52, 0.45), 0.5)
# 9a: RADIO STATIC AT MAX VOLUME; 9b: it moves away (pan sweep, level and brightness fall) while Bruno runs
a9, b9, e9 = cut['9a'], cut['9b'], cut['10']
put(a9, thud(0.18, 220, 0.4), 0.8)  # knob click
st = static(b9 - a9 + 0.2, 1.0, 3); put(a9 + 0.25, st, 0.95, 0.0)
away = static(7.0, 1.0, 4); dec = np.exp(-T(7.0) * 0.55)
away_lp = away * 0; seg = int(0.25 * SR)
for i in range(0, len(away), seg):  # brightness falls with the distance (cutoff 7 kHz -> 700 Hz)
    fc = 7000 * np.exp(-np.log(10) * i / len(away)); chunk = lp(away[i:i + seg], max(500, fc)); away_lp[i:i + seg] = chunk
pan = np.linspace(-0.2, 0.9, len(away)); sfx_l = np.cos((pan + 1) * np.pi / 4) * away_lp * dec * 0.9; sfx_r = np.sin((pan + 1) * np.pi / 4) * away_lp * dec * 0.9; s0 = int(b9 * SR); n0 = min(len(sfx_l), N - s0); sfx[s0:s0 + n0, 0] += sfx_l[:n0]; sfx[s0:s0 + n0, 1] += sfx_r[:n0]
put(b9, run_steps(e9 - b9 + 3.0, 3.5, 0.6, 6, 1), 0.8, -0.1); put(b9, pant(1.0), 0.6)
# 10 / 11: the swarm turns and swallows him: roar at peak, flaps, screeches, then a hush when the dust settles
put(e9 - 0.2, roar(cut['11'] - e9 + 1.2, 50, 800, 0.8, 10), 1.0); put(e9, flaps(cut['11'] - e9 + 1.0, 18, 0.55, 7), 1.0); put(e9 + 0.5, growl(1.6, 72, 0.6), 0.9, 0.3); put(e9 + 1.3, growl(1.2, 58, 0.55), 0.8, -0.5)
for k in range(4): put(e9 + 0.2 + k * 0.45, (bp(noise(0.7), 1800, 5200) * np.sin(np.linspace(0, np.pi, int(0.7 * SR))) ** 2) * 0.22, 0.8, [-0.6, 0.5, -0.1, 0.7][k])
put(cut['11'], roar(cut['12'] - cut['11'], 50, 700, 0.9, 11), 1.0); put(cut['11'] + 0.8, thud(0.6, 60, 0.9), 0.9); put(cut['11'] + 0.9, lp(noise(2.0), 600) * np.exp(-T(2.0) * 2.0) * 0.5, 0.9)
# 12 / 13: the path opens (the swarm roar leaves: far, quiet), the four run to the tower
put(cut['12'], roar(cut['13'] - cut['12'], 40, 300, 0.4, 12) * np.exp(-T(cut['13'] - cut['12']) * 1.2), 0.5); put(cut['12'] + 0.3, run_steps(cut['14'] - cut['12'] - 0.3, 3.2, 0.5, 7, 4), 0.8); put(cut['13'], np.concatenate([pant(0.5)] * 5), 0.7)
# 14: relief, a first water drop, 15: the sprinklers start (pipe creak + clunk, water builds), 16-18: the water curtain
put(cut['14'] + 0.5, drip(), 0.5); put(cut['14'] + 1.6, drip(), 0.4); put(cut['14'] + 2.0, clunk(0.5), 0.5)
for k, s in enumerate([cut['15'] - 0.05, cut['15'] + 0.35, cut['15'] + 0.7]): put(s, creak(1.0), 0.6, [-0.4, 0, 0.4][k]); put(s + 0.5, clunk(0.4), 0.6)
wd = TL['frames'] / FPS - cut['15']; wat = water(wd, 0.9) * np.concatenate([np.linspace(0, 1, int(1.6 * SR)), np.ones(int(wd * SR) - int(1.6 * SR))])[:int(wd * SR)]; put(cut['15'] + 0.3, wat, 0.55)
put(cut['17'], splat(0.5), 0.7); put(cut['17'] + 0.2, lp(noise(1.3), 700) * np.exp(-T(1.3) * 3) * 0.3, 0.7); put(cut['17'] + 0.4, flaps(1.3, 4, 0.25, 8) * np.linspace(1, 0.1, int(1.3 * SR)), 0.6)
put(cut['18'], run_steps(cut['19'] - cut['18'], 3.4, 0.5, 8, 4), 0.7); put(cut['18'] + 0.9, splat(0.6) * 1.5, 0.9); put(cut['18'] + 1.0, water(1.0, 0.5), 0.6)
# 19: the zombies cross the water and fall one by one (hit times as in shots.tsx FALLERS), bodies hit the ground
for k in range(10):
    th = cut['19'] + 0.45 + 0.34 * k; put(th - 0.4, flaps(0.45, 8, 0.4, 20 + k), 0.7, (k - 4.5) / 6); put(th, splat(0.4), 0.9, (k - 4.5) / 6); put(th + 0.55 + 0.05 * (k % 3), thud(0.45, 66 + 5 * (k % 4), 0.9), 0.9, (k - 4.5) / 6)
# 20: inside, hundreds of people: murmur, soft kids breathing; 21: the heavy door; 22-23: night wind, steps on the roof
put(cut['20a'], murmur(cut['21'] - cut['20a'], 0.5, 4) * np.concatenate([np.linspace(0, 1, int(0.8 * SR)), np.ones(int((cut['21'] - cut['20a']) * SR) - int(0.8 * SR))]), 0.9); put(cut['20b'] - 0.2, kid_breath(cut['21'] - cut['20b'] + 0.5, 0.5, 5), 0.9, -0.2); put(cut['20b'] + 0.3, kid_breath(2.5, 0.35, 6), 0.8, 0.4)
put(cut['21'] + 0.1, creak(1.6), 0.8); put(cut['21'] + 0.25, clunk(0.5), 0.6)
slam = cut['21'] + 78 / 30; put(slam, (sine(46, 2.0) * np.exp(-T(2.0) * 2.4) + 0.6 * sine(92, 2.0) * np.exp(-T(2.0) * 3.4) + lp(noise(2.0), 260) * np.exp(-T(2.0) * 7)), 1.0); put(slam + 0.12, clunk(0.5), 0.8); put(slam + 0.4, clunk(0.35), 0.5)
put(cut['22'], run_steps(2.0, 1.8, 0.35, 9, 1), 0.5); put(cut['22'] + 2.0, pant(1.0) * 0.5, 0.5)
put(cut['22'], wind(cut['24a'] - cut['22'], 0.65, 14), 0.9); put(cut['23'] + 0.5, growl(1.8, 60, 0.35), 0.6, 0.4); put(cut['23'] + 2.2, growl(1.6, 70, 0.3), 0.5, -0.5); put(cut['23'], flaps(cut['24a'] - cut['23'], 5, 0.25, 15), 0.5)
# 24: a flying zombie, a running zombie, an awake zombie, Caio's small smile (night wind, no sting: the picture holds)
put(cut['24a'], flaps(cut['24b'] - cut['24a'], 9, 0.45, 16), 0.8, 0.3); put(cut['24b'], run_steps(cut['24c'] - cut['24b'], 6.0, 0.5, 10, 1) * 0.9, 0.8, -0.3)
put(cut['24c'] + 0.2, growl(1.6, 64, 0.5), 0.8); put(cut['24c'] + 0.9, (fm(1700, 1.2) * np.sin(np.linspace(0, np.pi, int(1.2 * SR))) ** 2) * 0.05, 0.6)
put(cut['24d'], wind(TL['frames'] / FPS - cut['24d'], 0.5, 17) * np.linspace(1, 0.6, int((TL['frames'] / FPS - cut['24d']) * SR)), 0.8)

# ---------------------------------------------------------------- ambience: night city wind + distant growls (low), whole length
amb = np.zeros((N, 2)); d = N / SR
for ch, seed in ((0, 31), (1, 32)): amb[:, ch] += wind(d, 0.35, seed)[:N]
r = np.random.default_rng(5); k = 3.0
while k < d - 3:
    g = growl(1.6 + 1.2 * r.random(), 48 + 30 * r.random(), 0.22 + 0.12 * r.random()); s = int(k * SR); pan = r.uniform(-0.9, 0.9); n = min(len(g), N - s); amb[s:s + n, 0] += g[:n] * np.cos((pan + 1) * np.pi / 4) * 0.55; amb[s:s + n, 1] += g[:n] * np.sin((pan + 1) * np.pi / 4) * 0.55; k += 4.5 + 5 * r.random()
drone = lp(sine(55, d)[:N] + 0.5 * sine(82.5, d)[:N], 200) * 0.06; amb[:, 0] += drone; amb[:, 1] += drone
def norm(x, peak):
    m = np.abs(x).max() or 1; return x / m * peak
def write(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2'); w = wave.open(path, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
sfx = np.tanh(sfx * 0.9); sfx = norm(sfx, 0.89); amb = norm(amb, 0.30)
out = os.path.join(ROOT, 'ZUMBIS_PARTE_10'); write(os.path.join(out, 'sfx.wav'), sfx); write(os.path.join(out, 'ambience.wav'), amb)
print('wrote sfx.wav and ambience.wav,', N, 'samples =', round(N / SR, 3), 's =', FRAMES, 'frames')
