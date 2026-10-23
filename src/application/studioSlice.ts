import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Category, Playlist, Preferences, Sound, View } from '../domain/models';
import { nextSoundId } from '../domain/useCases';

export interface StudioState extends Preferences {
  sounds: Sound[]; view: View; category: Category | 'all'; search: string;
  queue: string[]; activeId: string | null; status: 'idle' | 'playing' | 'paused';
  currentTime: number; duration: number; playbackRevision: number;
  notice: string | null; hydrated: boolean;
}
const initialState: StudioState = {
  sounds: [], view: 'library', category: 'all', search: '', favorites: [], volume: 75, repeat: false, playlists: [],
  queue: ['station-bell', 'departure', 'platform'], activeId: null, status: 'idle', currentTime: 0, duration: 0, playbackRevision: 0, notice: null, hydrated: false,
};
const studioSlice = createSlice({
  name: 'studio', initialState,
  reducers: {
    preferencesLoaded(state, action: PayloadAction<Preferences>) { Object.assign(state, action.payload); },
    uploadsLoaded(state, action: PayloadAction<Sound[]>) { state.sounds = action.payload; state.hydrated = true; },
    viewChanged(state, action: PayloadAction<View>) { state.view = action.payload; state.search = ''; state.category = 'all'; },
    searchChanged(state, action: PayloadAction<string>) { state.search = action.payload; },
    categoryChanged(state, action: PayloadAction<Category | 'all'>) { state.category = action.payload; },
    favoriteToggled(state, action: PayloadAction<string>) { const id = action.payload; state.favorites = state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites, id]; },
    volumeChanged(state, action: PayloadAction<number>) { state.volume = Math.max(0, Math.min(100, action.payload)); },
    repeatToggled(state) { state.repeat = !state.repeat; },
    playRequested(state, action: PayloadAction<string>) {
      if (!state.sounds.some(sound => sound.id === action.payload)) return;
      if (!state.queue.includes(action.payload)) state.queue.push(action.payload);
      state.activeId = action.payload; state.status = 'playing'; state.currentTime = 0;
      state.duration = state.sounds.find(sound => sound.id === action.payload)?.duration ?? 0; state.playbackRevision++;
    },
    playbackToggled(state) {
      if (state.activeId) state.status = state.status === 'playing' ? 'paused' : 'playing';
      else if (state.queue.length) { state.activeId = state.queue[0]; state.status = 'playing'; state.playbackRevision++; state.duration = state.sounds.find(sound => sound.id === state.activeId)?.duration ?? 0; }
    },
    stopped(state) { state.status = 'idle'; state.activeId = null; state.currentTime = 0; state.duration = 0; },
    timeUpdated(state, action: PayloadAction<{ time: number; duration: number }>) { if (state.activeId) { state.currentTime = action.payload.time; if (action.payload.duration) state.duration = action.payload.duration; } },
    seekRequested(state, action: PayloadAction<number>) { state.currentTime = action.payload; },
    nextRequested(state) {
      const id = nextSoundId(state.queue, state.activeId, state.repeat);
      state.activeId = id; state.currentTime = 0; state.status = id ? 'playing' : 'idle'; state.duration = state.sounds.find(sound => sound.id === id)?.duration ?? 0; state.playbackRevision++;
    },
    previousRequested(state) {
      const index = state.activeId ? state.queue.indexOf(state.activeId) : 0;
      state.activeId = state.queue[Math.max(0, index - 1)] ?? null; state.status = state.activeId ? 'playing' : 'idle'; state.currentTime = 0; state.playbackRevision++;
    },
    queued(state, action: PayloadAction<string>) { if (!state.queue.includes(action.payload)) { state.queue.push(action.payload); state.notice = 'Audio ditambahkan ke antrean'; } else state.notice = 'Audio sudah ada di antrean'; },
    queueRemoved(state, action: PayloadAction<string>) { state.queue = state.queue.filter(id => id !== action.payload); if (state.activeId === action.payload) { state.activeId = null; state.status = 'idle'; state.currentTime = 0; } },
    queueCleared(state) { state.queue = []; state.activeId = null; state.status = 'idle'; state.currentTime = 0; },
    queueMoved(state, action: PayloadAction<{ id: string; direction: -1 | 1 }>) {
      const index = state.queue.indexOf(action.payload.id); const target = index + action.payload.direction;
      if (index >= 0 && target >= 0 && target < state.queue.length) [state.queue[index], state.queue[target]] = [state.queue[target], state.queue[index]];
    },
    playlistSaved(state, action: PayloadAction<Playlist>) { state.playlists.push(action.payload); state.notice = 'Playlist berhasil disimpan'; },
    playlistDeleted(state, action: PayloadAction<string>) { state.playlists = state.playlists.filter(item => item.id !== action.payload); },
    playlistLoaded(state, action: PayloadAction<string>) { const p = state.playlists.find(item => item.id === action.payload); if (p) { state.queue = p.soundIds.filter(id => state.sounds.some(sound => sound.id === id)); state.activeId = null; state.status = 'idle'; state.currentTime = 0; state.notice = `Playlist “${p.name}” dimuat`; } },
    soundAdded(state, action: PayloadAction<Sound>) { state.sounds.push(action.payload); state.notice = 'Audio berhasil ditambahkan ke koleksi pribadi'; },
    soundDeleted(state, action: PayloadAction<string>) {
      state.sounds = state.sounds.filter(sound => sound.id !== action.payload); state.queue = state.queue.filter(id => id !== action.payload); state.favorites = state.favorites.filter(id => id !== action.payload);
      state.playlists.forEach(playlist => { playlist.soundIds = playlist.soundIds.filter(id => id !== action.payload); });
      if (state.activeId === action.payload) { state.activeId = null; state.status = 'idle'; state.currentTime = 0; }
    },
    noticeShown(state, action: PayloadAction<string | null>) { state.notice = action.payload; },
    playbackFailed(state, action: PayloadAction<string>) { state.status = 'idle'; state.activeId = null; state.notice = action.payload; },
  },
});
export const actions = studioSlice.actions;
export const studioReducer = studioSlice.reducer;
