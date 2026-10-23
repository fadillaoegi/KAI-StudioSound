import { createAsyncThunk } from '@reduxjs/toolkit';
import type { LibraryDependencies, Sound } from '../domain/models';
import { actions } from './studioSlice';
import type { StudioState } from './studioSlice';
import { createId } from '../shared/createId';

const command = createAsyncThunk.withTypes<{ extra: LibraryDependencies; state: { studio: StudioState } }>();
const mimeByExtension: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4' };

export const importAudio = command<Sound, File>('library/importAudio', async (file, api) => {
  const hasAudioExtension = /\.(mp3|wav|ogg|m4a)$/i.test(file.name);
  const unknownMime = !file.type || file.type === 'application/octet-stream';
  if (!file.type.startsWith('audio/') && !(unknownMime && hasAudioExtension)) throw new Error('Pilih file audio MP3, WAV, OGG, atau M4A.');
  if (!file.size) throw new Error('File audio kosong. Pilih file MP3 yang berisi rekaman.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Ukuran audio maksimal 25 MB.');
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const audioFile = unknownMime && hasAudioExtension
    ? new File([file], file.name, { type: mimeByExtension[extension], lastModified: file.lastModified })
    : file;
  const duration = await api.extra.metadata.duration(audioFile);
  const sound = await api.extra.sounds.save({
    id: createId(), title: file.name.replace(/\.[^.]+$/, ''),
    subtitle: 'Koleksi pribadi · Tersimpan di perangkat', category: 'pengumuman',
    duration, color: 'purple', uploaded: true,
  }, audioFile);
  api.dispatch(actions.soundAdded(sound));
  return sound;
});

export const createAnnouncement = command<Sound, { title: string; text: string }>('library/createAnnouncement', async ({ title, text }, api) => {
  if (!title.trim() || text.trim().length < 10) throw new Error('Isi judul dan teks pengumuman minimal 10 karakter.');
  const sound = await api.extra.sounds.save({
    id: createId(), title: title.trim(), text: text.trim(),
    subtitle: 'Pengumuman pribadi · Suara browser',
    duration: Math.ceil(text.trim().split(/\s+/).length / 2.1),
    category: 'pengumuman', color: 'purple', uploaded: true,
  });
  api.dispatch(actions.soundAdded(sound));
  return sound;
});

export const deleteAudio = command<void, string>('library/deleteAudio', async (id, api) => {
  // Stop before revoking an active uploaded object's URL.
  if (api.getState().studio.activeId === id) api.dispatch(actions.stopped());
  await api.extra.sounds.remove(id);
  api.dispatch(actions.soundDeleted(id));
});
