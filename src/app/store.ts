import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { BrowserAudioEngine } from '../data/BrowserAudioEngine';
import { BrowserAudioMetadataReader } from '../data/BrowserAudioMetadataReader';
import { IndexedDbSoundRepository, LocalPreferencesRepository } from '../data/repositories';
import { actions, studioReducer } from '../application/studioSlice';
import { catalog } from '../data/catalog';

const preferences = new LocalPreferencesRepository();
const soundRepository = new IndexedDbSoundRepository();
const listener = createListenerMiddleware();
export const store = configureStore({
  reducer: { studio: studioReducer },
  middleware: getDefault => getDefault({ thunk: { extraArgument: { sounds: soundRepository, metadata: new BrowserAudioMetadataReader() } } }).prepend(listener.middleware),
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

const engine = new BrowserAudioEngine({
  time: (time, duration) => store.dispatch(actions.timeUpdated({ time, duration })),
  ended: () => store.dispatch(actions.nextRequested()),
  error: message => store.dispatch(actions.playbackFailed(message)),
});
const startListening = listener.startListening.withTypes<RootState, AppDispatch>();
startListening({
  predicate: (_action, current, previous) => current.studio.activeId !== previous.studio.activeId || current.studio.status !== previous.studio.status || current.studio.playbackRevision !== previous.studio.playbackRevision,
  effect: async (_action, api) => {
    const state = api.getState().studio;
    const previous = api.getOriginalState().studio;
    try {
      if (!state.activeId || state.status === 'idle') { engine.stop(); return; }
      if (state.status === 'paused') { engine.pause(); return; }
      if (state.activeId !== previous.activeId || state.playbackRevision !== previous.playbackRevision) {
        const sound = state.sounds.find(item => item.id === state.activeId);
        if (sound) await engine.play(sound);
      } else await engine.resume();
    } catch { if (api.getState().studio.activeId === state.activeId) api.dispatch(actions.playbackFailed('Pemutaran belum berhasil. Tekan putar untuk mencoba lagi.')); }
  },
});
startListening({ actionCreator: actions.seekRequested, effect: action => { engine.seek(action.payload); } });
startListening({ actionCreator: actions.volumeChanged, effect: action => { engine.setVolume(action.payload); } });
startListening({
  matcher: isAnyOf(actions.favoriteToggled, actions.volumeChanged, actions.repeatToggled, actions.playlistSaved, actions.playlistDeleted, actions.soundDeleted),
  effect: (_action, api) => {
    const { favorites, volume, repeat, playlists } = api.getState().studio;
    try { preferences.save({ favorites, volume, repeat, playlists }); } catch { api.dispatch(actions.noticeShown('Pengaturan tidak dapat disimpan. Periksa penyimpanan browser.')); }
  },
});
store.dispatch(actions.preferencesLoaded(preferences.load()));
engine.setVolume(store.getState().studio.volume);
store.dispatch(actions.uploadsLoaded(catalog));
void soundRepository.list().then(sounds => store.dispatch(actions.uploadsLoaded([...catalog, ...sounds]))).catch(error => store.dispatch(actions.noticeShown(error instanceof Error ? error.message : 'Koleksi pribadi gagal dimuat.')));
if (import.meta.hot) import.meta.hot.dispose(() => engine.dispose());
