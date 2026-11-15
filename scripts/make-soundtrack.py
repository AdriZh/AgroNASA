"""Synthesize the 30-second soundtrack for the Field Shift pitch video and mix it with the narration.

Everything is generated from oscillators and noise — no samples. Usage:
    python scripts/make-soundtrack.py <timing.json> <vo_dir> <out.wav>
vo_dir must contain vo_<key>.wav files (Kokoro TTS output) for each line in timing.json.
"""
import json, sys
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly

SR = 48000
DUR = 30.0
N = int(SR * DUR)
BPM = 96
BEAT = 60 / BPM
rng = np.random.default_rng(42)
t_all = np.arange(N) / SR


def note(n):  # MIDI → Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)


def env_adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    e = np.full(n, s, dtype=float)
    e[:a] = np.linspace(0, 1, a, endpoint=False) if a else e[:a]
    e[a:a + d] = np.linspace(1, s, d, endpoint=False)[: max(0, min(d, n - a))]
    if r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def place(buf, sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:j, 0] += sig[: j - i] * gain * l
    buf[i:j, 1] += sig[: j - i] * gain * r


# ---------- harmony: Am9 – Fmaj7 – C(add9) – G6, one chord per bar ----------
CHORDS = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 67], [48, 55, 60, 62, 64], [55, 59, 62, 64, 67]]
ROOTS = [45, 41, 48, 43]
BAR = 4 * BEAT
music = np.zeros((N, 2))

# pads: detuned triangle-ish saws, filter opens through the piece
pad = np.zeros((N, 2))
nbars = int(np.ceil(DUR / BAR)) + 1
for b in range(nbars):
    start = b * BAR - 0.4
    length = BAR + 1.2
    n = int(length * SR)
    tt = np.arange(n) / SR
    ch = CHORDS[b % 4] if start < 26.0 else [48, 55, 60, 64, 67, 71, 74]  # Cmaj9 bloom for the close
    for k, m in enumerate(ch):
        for det, pan in ((-0.08, -0.6), (0.0, 0.0), (0.08, 0.6)):
            f = note(m) * 2 ** (det / 12)
            ph = rng.uniform(0, 1)
            saw = 2 * ((f * tt + ph) % 1) - 1
            tri = 2 * np.abs(saw) - 1
            sig = (0.55 * tri + 0.45 * saw) * env_adsr(n, 0.6, 0.4, 0.85, 0.9) / len(ch)
            place(pad, sig, max(0, start), 0.16, pan)
cut = 500 + 2600 * np.clip((t_all - 3) / 20, 0, 1) ** 1.4
# time-varying low-pass: blend two static filters by the cutoff curve
lo, hi = lp(pad, 500, 2), lp(pad, 3200, 2)
w = ((cut - 500) / 2600)[:, None]
music += lo * (1 - w) + hi * w

# sub bass on beats from the fusion scene
for b in range(int(DUR / BEAT)):
    st = b * BEAT
    if st < 13.4 or st > 26.0:
        continue
    root = ROOTS[int(st // BAR) % 4]
    n = int(BEAT * SR * 0.95)
    tt = np.arange(n) / SR
    sig = np.sin(2 * np.pi * note(root - 12) * tt) * np.exp(-tt * 3.2)
    place(music, sig, st, 0.32)

# pluck arpeggio (8ths) from the rain scene, ping-pong panned
arp_pat = [0, 2, 4, 2, 1, 3, 4, 3]
for i in range(int(DUR / (BEAT / 2))):
    st = i * BEAT / 2
    if st < 3.3 or st > 26.1:
        continue
    ch = CHORDS[int(st // BAR) % 4]
    m = ch[arp_pat[i % 8] % len(ch)] + 12
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    f = note(m)
    sig = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) + 0.12 * np.sin(6 * np.pi * f * tt)) * np.exp(-tt * 9)
    vel = 0.05 + 0.03 * np.clip((st - 3.3) / 10, 0, 1)
    place(music, sig, st, vel, -0.5 if i % 2 else 0.5)

# kick + hats
for b in range(int(DUR / BEAT)):
    st = b * BEAT
    if 13.55 <= st <= 25.9 and b % 2 == 0:
        n = int(0.35 * SR)
        tt = np.arange(n) / SR
        f = 45 + 75 * np.exp(-tt * 28)
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
        place(music, sig, st, 0.42)
for i in range(int(DUR / (BEAT / 2))):
    st = i * BEAT / 2
    if 20.1 <= st <= 25.9:
        n = int(0.06 * SR)
        sig = hp(rng.standard_normal(n), 7000) * np.exp(-np.arange(n) / SR * 70)
        place(music, sig, st, 0.05 if i % 2 else 0.03, 0.3)

# whooshes at scene cuts, risers into result & close, impact on the logo
def whoosh(at, dur=0.9, gain=0.22):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    sig = bp(noise, 300, 4000) * e
    place(music, sig, at - dur * 0.6, gain, -0.4)
    place(music, sig[::-1] * 0.5, at - dur * 0.6, gain, 0.4)

for cut_at in (3.4, 10.2, 13.55):
    whoosh(cut_at)

def riser(a, b, gain=0.16):
    n = int((b - a) * SR)
    tt = np.arange(n) / SR
    k = tt / tt[-1]
    noise = hp(rng.standard_normal(n), 1500) * k ** 2
    f = 200 + 1400 * k ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * k ** 2 * 0.25
    place(music, noise + tone, a, gain)

riser(18.8, 20.1)
riser(24.9, 26.15, 0.2)
n = int(2.8 * SR)
tt = np.arange(n) / SR
boom = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-tt * 6)) / SR) * np.exp(-tt * 1.6)
place(music, boom, 26.15, 0.5)
place(music, lp(rng.standard_normal(n), 2500) * np.exp(-tt * 3), 26.15, 0.08)
# sparkle on the logo
for k, m in enumerate([84, 88, 91, 95]):
    n = int(1.6 * SR)
    tt = np.arange(n) / SR
    place(music, np.sin(2 * np.pi * note(m) * tt) * np.exp(-tt * 2.5), 26.3 + k * 0.09, 0.05, -0.6 + 0.4 * k)

# reverb: synthetic exponentially decaying noise IR
ir_n = int(2.4 * SR)
ir = rng.standard_normal((ir_n, 2)) * np.exp(-np.arange(ir_n) / SR * 2.6)[:, None]
ir[:, 0], ir[:, 1] = lp(ir[:, 0], 6000), lp(ir[:, 1], 6000)
ir /= np.sqrt((ir ** 2).sum(axis=0))
wet = np.stack([fftconvolve(music[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
music = 0.78 * music + 0.32 * wet

# fade in / out
music *= np.clip(t_all / 0.8, 0, 1)[:, None]
music *= np.clip((DUR - t_all) / 1.6, 0, 1)[:, None]

# ---------- narration ----------
timing = json.load(open(sys.argv[1]))
vo_dir = sys.argv[2]
vo = np.zeros(N)
for line in timing['lines']:
    x, sr = sf.read(f"{vo_dir}/vo_{line['key']}.wav")
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        x = resample_poly(x, SR, sr)
    x = hp(x, 80)
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
    i = int(line['start'] * SR)
    vo[i:i + len(x)] += x[: N - i]
# gentle compression on the voice
env = np.sqrt(lp(vo ** 2, 15, 1).clip(0))
gain = np.where(env > 0.12, (0.12 / (env + 1e-9)) ** 0.35, 1.0)
vo = vo * gain
vo = vo / (np.max(np.abs(vo)) + 1e-9) * 0.85

# sidechain ducking of the music under the voice (−9 dB), smooth attack/release
active = (np.abs(vo) > 0.02).astype(float)
duck = lp(active, 3, 1).clip(0, 1)
duck = np.maximum(duck, lp(active[::-1], 3, 1)[::-1].clip(0, 1))
music *= (1 - 0.64 * duck)[:, None]

mix = music / (np.max(np.abs(music)) + 1e-9) * 0.42 + vo[:, None] * 0.95
peak = np.max(np.abs(mix))
mix = mix / peak * 0.93
sf.write(sys.argv[3], mix.astype(np.float32), SR)
music_only = music / (np.max(np.abs(music)) + 1e-9) * 0.8
sf.write(sys.argv[3].replace('.wav', '-music.wav'), music_only.astype(np.float32), SR)
print('wrote', sys.argv[3], 'peak', round(float(peak), 3), 'rms', round(float(np.sqrt((mix ** 2).mean())), 4))
