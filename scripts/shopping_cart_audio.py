#!/usr/bin/env python3
"""SHOPPING_CART audio: writes SHOPPING_CART/sfx.wav and ambience.wav (44.1 kHz, 16 bit, stereo), both exactly the length of the video (2055 frames at 30 fps = 68.5 s).
Cue times are in frames of the video (cut frames from src/shop/timeline.json, actions from src/shop/shots.tsx). All sounds are synthesized with numpy (no samples)."""
import json, os, wave
import numpy as np

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'src/shop/timeline.json')))
FPS, FRAMES = TL['fps'], TL['frames']
N = int(round(FRAMES / FPS * SR))
rng = np.random.default_rng(7)
t = lambda d: np.arange(int(d * SR)) / SR
def env(n, a=0.005, r=0.1):
    e = np.ones(n); na, nr = max(1, int(a * SR)), max(1, int(r * SR)); e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def lp(x, fc):  # one-pole low pass
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    for i, v in enumerate(x): s = a * s + (1 - a) * v; y[i] = s
    return y
def hp(x, fc): return x - lp(x, fc)
def noise(d): return rng.standard_normal(int(d * SR))
def sine(f, d): return np.sin(2 * np.pi * f * t(d))

# ---- sounds (each returns a mono float array)
def whoosh(d=0.35):
    n = noise(d); b = lp(n, 1800) * np.sin(np.linspace(0, np.pi, len(n))) ** 2; return 0.5 * b
def rattle(d=0.5, rate=22):  # cart wheel rattle: filtered noise pulses
    n = hp(noise(d), 600); p = (np.sin(2 * np.pi * rate * t(d)) > 0.2).astype(float); p = lp(p, 200); return 0.35 * n * p * env(len(n), 0.02, 0.15)
def coin():
    d = 0.35; x = (sine(1760, d) + 0.6 * sine(2637, d)) * np.exp(-t(d) * 14); return 0.35 * x
def ding():
    d = 0.9; x = (sine(2093, d) + 0.5 * sine(3136, d) + 0.3 * sine(4186, d)) * np.exp(-t(d) * 4.5); return 0.4 * x
def kaching():  # drawer clunk + bell
    d = 0.12; clunk = lp(noise(d), 500) * np.exp(-t(d) * 40) * 1.2; out = np.zeros(int(1.0 * SR)); out[:len(clunk)] += clunk; b = ding(); out[int(0.08 * SR):int(0.08 * SR) + len(b)] += b[:len(out) - int(0.08 * SR)]; return out
def scratch():  # record scratch: noisy sweep, down then up
    d = 0.5; f = np.concatenate([np.linspace(1800, 200, int(d * 0.45 * SR)), np.linspace(200, 2400, int(d * 0.55 * SR))]); ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sign(np.sin(ph)) * 0.4 + 0.25 * hp(noise(d), 1500)[:len(ph)]; return 0.45 * x * env(len(x), 0.005, 0.08)
def step(): d = 0.12; return 0.5 * lp(noise(d), 400) * np.exp(-t(d) * 38)
def boing():
    d = 0.5; f = 330 + 220 * np.sin(2 * np.pi * 7 * t(d)) * np.exp(-t(d) * 6); ph = 2 * np.pi * np.cumsum(f) / SR; return 0.3 * np.sin(ph) * np.exp(-t(d) * 6)
def hammer():
    d = 0.2; return (0.8 * lp(noise(d), 3000) * np.exp(-t(d) * 45) + 0.4 * sine(210, d) * np.exp(-t(d) * 30)) * 0.8
def rustle(d=0.5): n = hp(noise(d), 2500); a = np.abs(np.sin(2 * np.pi * 13 * t(d))) ** 3; return 0.25 * n * a * env(len(n), 0.02, 0.2)
def crowd_rush(d=2.0):
    n = lp(noise(d), 900) * (0.4 + 0.6 * np.linspace(0, 1, int(d * SR))) ; a = np.abs(lp(noise(d), 12)) * 40; return 0.5 * n * (0.5 + a) * env(len(n), 0.3, 0.6)
def laugh(d=1.0):  # fake laugh: pulsed vowel-ish tone
    f = 260 + 40 * np.sin(2 * np.pi * 5 * t(d)); ph = 2 * np.pi * np.cumsum(f) / SR; x = (np.sin(ph) + 0.5 * np.sin(2 * ph)) * (np.sin(2 * np.pi * 6 * t(d)) > 0) ; return 0.18 * lp(x, 1500) * env(len(x), 0.02, 0.2)

fr = lambda f: f / FPS
cues = []  # (time s, sound, gain)
def add(sec, fn, g=1.0): cues.append((sec, fn, g))
cut = {c['id']: c['f'] for c in TL['cuts']}
# whooshes on every hard cut (soft)
for c in TL['cuts'][1:]: add(fr(c['f']) - 0.04, lambda: whoosh(0.3), 0.55)
# shot 1: slow steps and cart rattle, 2: truck, 3: awkward silence-ish
for k in range(0, 201, 19): add(fr(k), step, 0.7)
add(0.2, lambda: rattle(6.0, 10), 0.35)
add(fr(201), lambda: rattle(1.4, 12), 0.3)
add(fr(262), lambda: boing(), 0.5)  # red cheeks
# shot 4 owner points
add(fr(cut['4'] + 22), lambda: ding(), 0.5)
# shot 5 heavy basket: labored steps + a creak
for k in [0, 26, 52, 80, 118, 140, 166, 192, 214, 236]: add(fr(cut['5'] + k), step, 0.75)
add(fr(cut['5'] + 140), lambda: rustle(0.4), 0.5)
add(fr(cut['5'] + 230), lambda: kaching(), 0.35)
# shot 6 hammer on the workshop, wheels, baskets
for k in [18, 22, 26, 32, 36, 40, 60, 64, 68, 72, 78, 82]: add(fr(cut['6'] + k - 4), hammer, 0.8)
add(fr(cut['6'] + 80), lambda: whoosh(0.4), 0.5)
add(fr(cut['6'] + 100), lambda: rustle(0.4), 0.4); add(fr(cut['6'] + 118), lambda: rustle(0.4), 0.4)
# shot 7 shine + boing, then worried
add(fr(cut['7'] + 8), lambda: ding(), 0.45); add(fr(cut['7'] + 22), coin, 0.5); add(fr(cut['7'] + 44), boing, 0.5)
# shot 8: RECORD SCRATCH on "Wait, what?" (28.28 s narration = frame 848)
add(28.22, scratch, 0.9); add(fr(cut['8'] + 12), boing, 0.5)
for k in range(10, 84, 14): add(fr(cut['8'] + k), step, 0.45)
# shot 9 / 10: rocking creak is a boing, flex = boing, head shake whoosh
add(fr(cut['9'] + 16), boing, 0.4); add(fr(cut['10'] + 12), boing, 0.6); add(fr(cut['10'] + 40), lambda: whoosh(0.25), 0.4); add(fr(cut['10'] + 62), lambda: whoosh(0.25), 0.4)
for k in range(8, 64, 14): add(fr(cut['11'] + k), step, 0.4)
# shot 12: cash handed out
for i in range(4): add(fr(cut['12'] + i * 26 + 10), lambda: rustle(0.35), 0.7); add(fr(cut['12'] + i * 26 + 16), coin, 0.45)
# shot 13: actors push carts, fake laugh
add(fr(cut['13']), lambda: rattle(2.3, 14), 0.5)
for k in [4, 20, 40]: add(fr(cut['13'] + k), lambda: laugh(0.9), 0.8)
# shot 14: greeter shows how to push
add(fr(cut['14'] + 10), lambda: rattle(1.6, 12), 0.45); add(fr(cut['14'] + 92), boing, 0.4)
# shot 15: oh this is normal, boing, crowd rush, carts
add(fr(cut['15a'] + 118), boing, 0.6); add(fr(cut['15b']), lambda: crowd_rush(2.9), 0.9); add(fr(cut['15b'] + 10), lambda: rattle(2.4, 18), 0.8)
for k in range(10, 80, 8): add(fr(cut['15b'] + k), step, 0.35)
# shot 16: register + bills + coins explode
add(fr(cut['16'] + 8), kaching, 0.9)
for k in range(10, 40, 4): add(fr(cut['16'] + k), coin, 0.45)
add(fr(cut['16'] + 6), lambda: rustle(0.8), 0.6)
# shot 17 shine, 18 push + wink
add(fr(cut['17'] + 12), ding, 0.4); add(fr(cut['18']), lambda: rattle(4.2, 11), 0.4)
for k in range(0, 130, 18): add(fr(cut['18'] + k), step, 0.45)
add(fr(cut['18'] + 104), lambda: ding(), 0.45)

def render():
    L = np.zeros(N); R = np.zeros(N)
    for sec, fn, g in cues:
        x = fn() * g; i = int(max(0, sec) * SR)
        if i >= N: continue
        pan = rng.uniform(-0.25, 0.25); seg = x[:N - i]; L[i:i + len(seg)] += seg * (1 - pan) * 0.5 * 1.4; R[i:i + len(seg)] += seg * (1 + pan) * 0.5 * 1.4
    return L, R
def ambience():
    d = N / SR; n = noise(d)
    hum = 0.05 * (sine(60, d) + 0.5 * sine(120, d) + 0.3 * sine(180, d)) * (0.9 + 0.1 * sine(0.2, d))  # store fluorescent hum / fridge
    murmur = lp(noise(d), 700) * 0.12 * (0.6 + 0.4 * np.abs(lp(noise(d), 1.5)) * 6)  # soft crowd murmur
    street = lp(noise(d), 300) * 0.05 * (0.5 + 0.5 * np.abs(lp(noise(d), 0.4)) * 8)  # distant street rumble
    air = hp(noise(d), 4000) * 0.01
    # light bustle swells during the rush (shot 15b) and the sales (16-17)
    sw = np.interp(np.arange(N) / SR, [0, fr(cut['15b']) - 0.5, fr(cut['15b']) + 1.5, fr(cut['17']) + 2, d], [1, 1, 1.9, 1.5, 1.2])
    x = (hum + murmur * sw + street + air)
    return x * 1.0, x * 1.0
def save(name, L, R):
    pk = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-9); k = 0.8 / pk if pk > 0.8 else 1.0
    st = (np.stack([L * k, R * k], 1) * 32767).astype('<i2')
    with wave.open(os.path.join(ROOT, 'SHOPPING_CART', name), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
    print(name, len(st) / SR, 's', 'peak', round(float(pk), 3))
L, R = render(); save('sfx.wav', L, R)
a, b = ambience(); b = np.roll(b, 37); save('ambience.wav', a, b)
