# Synthesizes the soundtrack: A minor, 120 BPM, drop at 3.0 s, UI taps in key, outro ring-out.
import sys, wave
import numpy as np

SR = 48000
DUR = 21.5
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))

def at(t): return int(t * SR)
def hz(midi): return 440 * 2 ** ((midi - 69) / 12)

def lowpass(x, cutoff):
    spec = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    curve = 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(spec * (curve[:, None] if x.ndim == 2 else curve), n=len(x), axis=0)

def add(sig, t, gain=1.0, pan=0.0):
    i = at(t)
    if i >= N: return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i:i + len(sig), 0] += sig * gain * l * 1.414
    mix[i:i + len(sig), 1] += sig * gain * r * 1.414

def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)

def kick():
    n = at(0.45); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)

def hat(open_=False):
    n = at(0.12 if not open_ else 0.3); x = rng.standard_normal(n)
    x = lowpass(x - lowpass(x, 7000), 11000)
    return x * env(n, 0.001, 0.025 if not open_ else 0.09)

def clap():
    n = at(0.25); x = lowpass(rng.standard_normal(n), 5000)
    x = x - lowpass(x, 900)
    e = sum(env(n, 0.001, 0.012) * (np.arange(n) >= at(k * 0.011)) for k in range(3)) + env(n, 0.002, 0.08)
    return x * e * 0.5

def saw_voice(freq, length, detune=0.12):
    t = np.arange(at(length)) / SR
    out = np.zeros_like(t)
    for d in (-detune, 0, detune):
        ph = (t * freq * 2 ** (d / 12)) % 1
        out += 2 * ph - 1
    return out / 3

def pad(notes, length, cutoff=1400):
    x = sum(saw_voice(hz(m), length) for m in notes) / len(notes)
    x = lowpass(x, cutoff)
    n = len(x); t = np.arange(n) / SR
    e = np.minimum(1, t / 0.25) * np.minimum(1, (length - t) / 0.3)
    return x * e

def pluck(midi, length=0.22):
    n = at(length); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * hz(midi) * t) + 0.35 * np.sin(4 * np.pi * hz(midi) * t)
    return x * env(n, 0.002, 0.09)

def bass(midi, length):
    n = at(length); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * hz(midi) * t) + 0.25 * np.sin(4 * np.pi * hz(midi) * t)
    e = np.minimum(1, t / 0.004) * np.minimum(1, (length - t) / 0.02) * (0.6 + 0.4 * np.exp(-t * 8))
    return x * e

def tap(midi):
    n = at(0.18); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * hz(midi) * t) * env(n, 0.001, 0.035)
    return x + 0.3 * np.sin(2 * np.pi * hz(midi + 12) * t) * env(n, 0.001, 0.015)

# Am – F – C – G, one bar (2 s) each.
CHORDS = [(57, 60, 64), (53, 57, 60), (48, 55, 64), (55, 59, 62)]
ROOTS = [45, 41, 36, 43]
ARP = [[69, 72, 76, 72], [65, 69, 72, 69], [67, 72, 76, 72], [67, 71, 74, 71]]

# Hook: filtered pad that opens up, plus a riser into the drop.
add(pad(CHORDS[0], 3.0, 700), 0, 0.22)
n = at(1.2); t = np.arange(n) / SR
riser = rng.standard_normal(n)
riser = lowpass(riser - lowpass(riser, 800), 4500) * (t / t[-1]) ** 2
add(riser, 1.8, 0.06)
for k in range(4): add(pluck(ARP[0][k] + 12, 0.3), 1.0 + k * 0.25, 0.08, 0.3 * (-1) ** k)

# Groove 3.0 – 18.5
for bar in range(8):
    t0 = 3.0 + bar * 2
    if t0 >= 18.5: break
    c = bar % 4
    add(pad(CHORDS[c], 2.0, 1800), t0, 0.16)
    for b in range(4):
        tb = t0 + b * BEAT
        if tb >= 18.5: break
        add(kick(), tb, 0.55)
        if b in (1, 3): add(clap(), tb, 0.22, 0.05)
        add(hat(), tb + 0.25, 0.09, 0.25)
        add(bass(ROOTS[c], 0.22), tb, 0.26)
        add(bass(ROOTS[c] + (12 if b == 3 else 0), 0.2), tb + 0.25, 0.2)
        for s in range(2):
            add(pluck(ARP[c][(b * 2 + s) % 4], 0.2), tb + s * 0.25, 0.06, -0.35 if s else 0.35)

# Outro: final hit and a ringing Am chord.
add(kick(), 18.5, 0.5)
add(pad((45, 57, 60, 64, 69), 3.0, 2200), 18.5, 0.22)
for k, m in enumerate([69, 72, 76, 81]): add(pluck(m, 0.6), 18.75 + k * 0.12, 0.07, 0.2 * (k - 1.5))

# UI taps, pitched to the key, under the music.
TAPS = [6.2, 7.2, 8.4, 8.9, 9.4, 10.25, 11.45, 12.35, 12.75, 13.8, 14.55, 16.85]
NOTES = [81, 84, 81, 83, 84, 88, 81, 84, 88, 81, 84, 81]
for t0, m in zip(TAPS, NOTES): add(tap(m), t0, 0.13)
# Pill pops in the Timer scene.
for k in range(4): add(tap(76 + [0, 3, 7, 12][k]), 17.25 + k * 0.14, 0.09)

# Gentle mix bus: fade out, soft clip, normalize to −1 dBFS.
fade = np.ones(N); fade[at(20.3):] = np.linspace(1, 0, N - at(20.3)) ** 1.5
mix *= fade[:, None]
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
pcm = (mix * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', DUR)
