import { describe, expect, it } from 'vitest';
import { filterSounds, formatTime, nextSoundId } from './useCases';
import { catalog } from '../data/catalog';

describe('audio selection', () => {
  it('combines case insensitive search and category selection', () => {
    expect(filterSounds(catalog, ' BEL ', 'bel').map(sound => sound.id)).toEqual(['station-bell', 'arrival-bell']);
    expect(filterSounds(catalog, 'bel', 'musik')).toEqual([]);
    expect(filterSounds(catalog, 'perjalanan', 'all').map(sound => sound.id)).toContain('journey');
  });
  it('advances the queue, stops at the end, and wraps only with repeat enabled', () => {
    const queue = ['bell', 'announcement', 'music'];
    expect(nextSoundId(queue, null, false)).toBe('bell');
    expect(nextSoundId(queue, 'bell', false)).toBe('announcement');
    expect(nextSoundId(queue, 'music', false)).toBe(null);
    expect(nextSoundId(queue, 'music', true)).toBe('bell');
    expect(nextSoundId([], null, true)).toBe(null);
  });
  it('formats durations including minutes and clamps negative time', () => {
    expect(formatTime(125.9)).toBe('02:05');
    expect(formatTime(-4)).toBe('00:00');
  });
});
