import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbSoundRepository, LocalPreferencesRepository } from './repositories';
import type { Sound } from '../domain/models';

const sound: Sound = { id: 'persisted-audio', title: 'Rekaman Peron', subtitle: 'Pribadi', category: 'pengumuman', duration: 5, color: 'purple', uploaded: true };

describe('browser persistence', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  });
  it('recovers preferences across repository instances and tolerates corrupt storage', () => {
    const repository = new LocalPreferencesRepository();
    repository.save({ favorites: ['bell'], volume: 42, repeat: true, playlists: [{ id: 'p', name: 'Sore', soundIds: ['bell'] }] });
    expect(new LocalPreferencesRepository().load()).toMatchObject({ favorites: ['bell'], volume: 42, repeat: true });
    localStorage.setItem('kaisound.preferences.v1', '{invalid');
    expect(repository.load().favorites).toEqual([]);
    localStorage.setItem('kaisound.preferences.v1', JSON.stringify({ volume: 400 }));
    expect(repository.load().volume).toBe(100);
  });
  it('persists uploaded file bytes, recreates a playable URL, and deletes the record', async () => {
    const repository = new IndexedDbSoundRepository();
    const file = new Blob(['audio-bytes'], { type: 'audio/wav' });
    const saved = await repository.save(sound, file);
    expect(saved.src).toMatch(/^blob:/);
    const reopened = new IndexedDbSoundRepository();
    const restored = (await reopened.list()).find(item => item.id === sound.id);
    expect(restored?.title).toBe(sound.title);
    expect(restored?.src).toMatch(/^blob:/);
    expect(restored?.src).not.toBe(saved.src);
    await reopened.remove(sound.id);
    expect(await repository.list()).toEqual([]);
  });
  it('persists text announcements without requiring an audio blob', async () => {
    const repository = new IndexedDbSoundRepository();
    await repository.save({ ...sound, id: 'speech', text: 'Selamat datang di stasiun.' });
    const restored = await new IndexedDbSoundRepository().list();
    expect(restored[0].text).toBe('Selamat datang di stasiun.');
    expect(restored[0].src).toBeUndefined();
    await repository.remove('speech');
  });
});
