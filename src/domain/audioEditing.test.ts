import { describe, expect, it } from 'vitest';
import { trimFrames, waveformPeaks, type EditableAudio } from './audioEditing';

const audio: EditableAudio = { channels: [new Float32Array(80000)], sampleRate: 8000, duration: 10 };
describe('audio trim selection', () => {
  it('maps seconds to exact sample boundaries and PCM file size', () => {
    expect(trimFrames(audio, 1.25, 3.75)).toEqual({ first: 10000, last: 30000, channels: 1, bytes: 40044 });
  });
  it.each([[-1, 2], [4, 3], [2, 2], [1, 1.05], [0, 11], [NaN, 2], [0, Infinity]])('rejects invalid selection %s to %s', (start, end) => {
    expect(() => trimFrames(audio, start, end)).toThrow();
  });
  it('uses the actual waveform peaks rather than decorative random values', () => {
    const source = { channels: [new Float32Array([0, .1, -.8, .2, 0, 0, 1, -.4])], sampleRate: 8, duration: 1 };
    expect(waveformPeaks(source, 4)).toEqual([expect.closeTo(.1), expect.closeTo(.8), 0, 1]);
  });
});
