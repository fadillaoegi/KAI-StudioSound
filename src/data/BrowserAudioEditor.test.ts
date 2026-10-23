import { describe, expect, it } from 'vitest';
import { encodeTrimmedWav } from './BrowserAudioEditor';

describe('trimmed audio file encoding', () => {
  it('writes a valid WAV containing only the selected original mono samples', async () => {
    const samples = Float32Array.from({ length: 8000 }, (_, index) => index / 8000);
    const blob = encodeTrimmedWav({ channels: [samples], sampleRate: 8000, duration: 1 }, .25, .75);
    const data = new DataView(await blob.arrayBuffer());
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(8044);
    expect(data.getUint32(0, false)).toBe(0x52494646);
    expect(data.getUint32(8, false)).toBe(0x57415645);
    expect(data.getUint16(22, true)).toBe(1);
    expect(data.getUint32(24, true)).toBe(8000);
    expect(data.getUint32(40, true)).toBe(8000);
    expect(data.getInt16(44, true)).toBe(Math.trunc(samples[2000] * 32767));
    expect(data.getInt16(blob.size - 2, true)).toBe(Math.trunc(samples[5999] * 32767));
    expect(samples.length).toBe(8000);
  });
  it('interleaves stereo samples and clips values to the PCM16 range', async () => {
    const left = new Float32Array(8000).fill(2);
    const right = new Float32Array(8000).fill(-2);
    const blob = encodeTrimmedWav({ channels: [left, right], sampleRate: 8000, duration: 1 }, 0, .5);
    const data = new DataView(await blob.arrayBuffer());
    expect(data.getUint16(22, true)).toBe(2);
    expect(data.getInt16(44, true)).toBe(32767);
    expect(data.getInt16(46, true)).toBe(-32768);
    expect(blob.size).toBe(16044);
  });
  it('rejects an output larger than the server upload limit', () => {
    const samples = new Float32Array(7000000);
    expect(() => encodeTrimmedWav({ channels: [samples, samples], sampleRate: 48000, duration: samples.length / 48000 }, 0, samples.length / 48000)).toThrow('25 MB');
  });
});
