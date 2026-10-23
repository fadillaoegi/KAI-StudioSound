"""Generate original demo sounds. Standard library only; no external recordings."""
from pathlib import Path
import math
import random
import struct
import wave

RATE = 22050
ROOT = Path(__file__).resolve().parent.parent / 'public' / 'audio'
ROOT.mkdir(parents=True, exist_ok=True)

def midi(note):
    return 440 * 2 ** ((note - 69) / 12)

def render(name, seconds, events=(), ambient=None):
    samples = [0.0] * int(seconds * RATE)
    for start, note, length, strength in events:
        frequency = midi(note)
        for j in range(min(int(length * RATE), len(samples) - int(start * RATE))):
            t = j / RATE
            envelope = min(1, t / .012) * math.exp(-t * 3.7 / length) * min(1, (length - t) / .08)
            bell = math.sin(2 * math.pi * frequency * t) + .28 * math.sin(2 * math.pi * frequency * 2.003 * t) * math.exp(-t * 3) + .12 * math.sin(2 * math.pi * frequency * 3.98 * t) * math.exp(-t * 5)
            samples[int(start * RATE) + j] += bell * envelope * strength
    if ambient:
        rng = random.Random(42)
        low = 0
        for j in range(len(samples)):
            t = j / RATE
            noise = rng.uniform(-1, 1)
            low = low * .975 + noise * .025
            sound = low * .5 + math.sin(2 * math.pi * 57 * t) * .018
            if ambient == 'platform':
                distant = math.sin(2 * math.pi * 392 * t) * .055 + math.sin(2 * math.pi * 494 * t) * .025
                sound += distant * math.exp(-((t - 12) / 2.3) ** 2)
                sound += noise * .014 * (.6 + .4 * math.sin(t * .7))
            else:
                phase = t % .65
                clack = math.exp(-phase * 75) + .65 * math.exp(-max(0, phase - .14) * 85) * (phase > .14)
                sound += noise * clack * .28 + math.sin(2 * math.pi * 83 * t) * .035
            samples[j] += sound * min(1, t / 1.2, (seconds - t) / 1.2)
    peak = max(max(abs(x) for x in samples), .01)
    scale = .7 / peak if ambient is None else min(.65 / peak, 3)
    with wave.open(str(ROOT / f'{name}.wav'), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, value * scale)) * 32767)) for value in samples))

render('station-bell', 9, [(i * .72 + .2, note, 2.1, .22) for i, note in enumerate([76, 72, 74, 67, 67, 74, 76, 72])])
render('arrival-bell', 8, [(i * .65 + .2, note, 2.5, .21) for i, note in enumerate([67, 72, 76, 79, 76, 72])])
melody = [72, 76, 79, 76, 74, 72, 69, 67, 72, 74, 76, 79, 81, 79, 76, 72]
render('departure', 18, [(i * .85 + .2, note, 2.8, .15) for i, note in enumerate(melody)] + [(i * 3.4 + .2, note, 4, .1) for i, chord in enumerate([[48, 55, 60], [45, 52, 57], [53, 60, 65], [55, 62, 67]]) for note in chord])
render('journey', 22, [(i * .95 + .2, note, 3.2, .16) for i, note in enumerate([67, 71, 74, 79, 78, 74, 71, 69, 67, 66, 67, 71, 74, 76, 74, 71, 69, 67, 62, 67])] + [(i * 3.8, note, 4, .08) for i, chord in enumerate([[43, 50, 55], [40, 47, 52], [48, 55, 60], [50, 57, 62], [43, 50, 55]]) for note in chord])
render('platform', 24, ambient='platform')
render('rail', 24, ambient='rail')
print('Generated six original WAV files in public/audio.')
