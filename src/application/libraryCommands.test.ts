import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnnouncement, deleteAudio, importAudio } from './libraryCommands';
import { actions, studioReducer } from './studioSlice';
import type { Sound } from '../domain/models';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const sounds = { list: vi.fn(), save: vi.fn(async (sound: Sound, _file?: Blob) => sound), remove: vi.fn(async () => undefined) };
  const metadata = { duration: vi.fn(async (_file: Blob) => 12) };
  const store = configureStore({ reducer: { studio: studioReducer }, middleware: getDefault => getDefault({ thunk: { extraArgument: { sounds, metadata } } }) });
  return { store, sounds, metadata };
}

describe('audio library commands', () => {
  it.each(['audio/mpeg', '', 'application/octet-stream'])('imports MP3 with MIME %j when randomUUID is unavailable', async type => {
    const crypto = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const { store, sounds, metadata } = setup();
    const file = new File(['mp3-data'], 'Bel Stasiun.MP3', { type });
    const sound = await store.dispatch(importAudio(file)).unwrap();
    expect(sound.title).toBe('Bel Stasiun');
    expect(sound.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    expect(metadata.duration.mock.calls[0][0].type).toBe('audio/mpeg');
    expect(sounds.save.mock.calls[0][1]?.type).toBe('audio/mpeg');
    expect(store.getState().studio.sounds).toContainEqual(sound);
  });
  it('rejects non-audio files before reading metadata or writing storage', async () => {
    const { store, sounds, metadata } = setup();
    await expect(store.dispatch(importAudio(new File(['text'], 'notes.txt', { type: 'text/plain' }))).unwrap()).rejects.toHaveProperty('message', 'Pilih file audio MP3, WAV, OGG, atau M4A.');
    expect(metadata.duration).not.toHaveBeenCalled();
    expect(sounds.save).not.toHaveBeenCalled();
  });
  it('does not add a sound to the visible collection when durable storage fails', async () => {
    const { store, sounds } = setup();
    sounds.save.mockRejectedValueOnce(new Error('Storage full'));
    await expect(store.dispatch(importAudio(new File(['audio'], 'Peron.wav', { type: 'audio/wav' }))).unwrap()).rejects.toHaveProperty('message', 'Storage full');
    expect(store.getState().studio.sounds).toHaveLength(0);
  });
  it('imports file metadata through the injected reader and adds the persisted sound', async () => {
    const { store, sounds, metadata } = setup();
    const file = new File(['audio'], 'Peron.wav', { type: 'audio/wav' });
    await store.dispatch(importAudio(file)).unwrap();
    expect(metadata.duration).toHaveBeenCalledWith(file);
    expect(sounds.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Peron', duration: 12, uploaded: true }), file);
    expect(store.getState().studio.sounds[0].title).toBe('Peron');
  });
  it('saves announcements and removes all collection references when deleting', async () => {
    const { store, sounds } = setup();
    const sound = await store.dispatch(createAnnouncement({ title: 'Berangkat', text: 'Kereta tujuan Solo akan segera berangkat.' })).unwrap();
    store.dispatch(actions.favoriteToggled(sound.id));
    store.dispatch(actions.queued(sound.id));
    await store.dispatch(deleteAudio(sound.id)).unwrap();
    expect(sounds.remove).toHaveBeenCalledWith(sound.id);
    expect(store.getState().studio.sounds).toHaveLength(0);
    expect(store.getState().studio.queue).not.toContain(sound.id);
    expect(store.getState().studio.favorites).not.toContain(sound.id);
  });
  it('keeps another sound playing when an unrelated recording is deleted', async () => {
    const { store } = setup();
    const playing = await store.dispatch(createAnnouncement({ title: 'Playing', text: 'Pengumuman kereta yang sedang diputar.' })).unwrap();
    const other = await store.dispatch(createAnnouncement({ title: 'Other', text: 'Pengumuman kereta yang akan dihapus.' })).unwrap();
    store.dispatch(actions.playRequested(playing.id));
    await store.dispatch(deleteAudio(other.id)).unwrap();
    expect(store.getState().studio.activeId).toBe(playing.id);
    expect(store.getState().studio.status).toBe('playing');
  });
});
