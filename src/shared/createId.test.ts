import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId } from './createId';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('local record identifiers', () => {
  it('uses native UUIDs when supported', () => {
    const randomUUID = vi.fn(() => 'native-uuid');
    vi.stubGlobal('crypto', { randomUUID });
    expect(createId()).toBe('native-uuid');
    expect(randomUUID).toHaveBeenCalledOnce();
  });
  it('creates UUIDs on HTTP origins where only getRandomValues is available', () => {
    vi.stubGlobal('crypto', { getRandomValues: (array: Uint8Array) => array.fill(0xab) });
    expect(createId()).toBe('abababab-abab-4bab-abab-abababababab');
  });
  it('keeps identifiers unique when crypto is unavailable and the clock has not advanced', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.spyOn(Math, 'random').mockReturnValue(.5);
    const ids = Array.from({ length: 100 }, () => createId());
    expect(new Set(ids).size).toBe(100);
    expect(ids.every(id => id.startsWith('local-'))).toBe(true);
  });
});
