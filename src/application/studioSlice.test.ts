import { describe, expect, it } from 'vitest';
import { actions, studioReducer } from './studioSlice';
import { catalog } from '../data/catalog';

const initial = () => studioReducer(undefined, actions.uploadsLoaded(catalog));
describe('studio queue behavior', () => {
  it('restarts an active sound explicitly and advances automatically in queue order', () => {
    let state = studioReducer(initial(), actions.playRequested('station-bell'));
    const revision = state.playbackRevision;
    state = studioReducer(state, actions.playRequested('station-bell'));
    expect(state.playbackRevision).toBe(revision + 1);
    state = studioReducer(state, actions.nextRequested());
    expect(state.activeId).toBe('departure');
    state = studioReducer(state, actions.nextRequested());
    state = studioReducer(state, actions.nextRequested());
    expect(state.status).toBe('idle');
    expect(state.activeId).toBe(null);
  });
  it('repeats a single item queue and changes revision to replay the same sound', () => {
    let state = studioReducer(initial(), actions.queueCleared());
    state = studioReducer(state, actions.playRequested('station-bell'));
    state = studioReducer(state, actions.repeatToggled());
    const revision = state.playbackRevision;
    state = studioReducer(state, actions.nextRequested());
    expect(state.activeId).toBe('station-bell');
    expect(state.status).toBe('playing');
    expect(state.playbackRevision).toBe(revision + 1);
  });
  it('does not add duplicates and keeps reordering within queue boundaries', () => {
    let state = studioReducer(initial(), actions.queued('station-bell'));
    expect(state.queue.length).toBe(3);
    state = studioReducer(state, actions.queueMoved({ id: 'station-bell', direction: -1 }));
    expect(state.queue[0]).toBe('station-bell');
    state = studioReducer(state, actions.queueMoved({ id: 'station-bell', direction: 1 }));
    expect(state.queue).toEqual(['departure', 'station-bell', 'platform']);
  });
  it('removing an uploaded sound also clears references and stops active playback', () => {
    let state = initial();
    state = studioReducer(state, actions.soundAdded({ ...catalog[0], id: 'custom', uploaded: true }));
    state = studioReducer(state, actions.favoriteToggled('custom'));
    state = studioReducer(state, actions.playlistSaved({ id: 'p', name: 'Test', soundIds: ['custom', 'departure'] }));
    state = studioReducer(state, actions.playRequested('custom'));
    state = studioReducer(state, actions.soundDeleted('custom'));
    expect(state.sounds.some(sound => sound.id === 'custom')).toBe(false);
    expect(state.favorites).not.toContain('custom');
    expect(state.queue).not.toContain('custom');
    expect(state.playlists[0].soundIds).toEqual(['departure']);
    expect(state.activeId).toBe(null);
  });
  it('loading a playlist skips unavailable audio and stops the previous queue', () => {
    let state = studioReducer(initial(), actions.playRequested('station-bell'));
    state = studioReducer(state, actions.playlistSaved({ id: 'p', name: 'Evening', soundIds: ['missing', 'departure'] }));
    state = studioReducer(state, actions.playlistLoaded('p'));
    expect(state.queue).toEqual(['departure']);
    expect(state.status).toBe('idle');
  });
});
