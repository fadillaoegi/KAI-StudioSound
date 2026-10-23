// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { expect, it, vi } from 'vitest';
import { AudioTrimDialog } from './AudioTrimDialog';
import { actions, studioReducer } from '../application/studioSlice';
import { encodeTrimmedWav } from '../data/BrowserAudioEditor';
import type { Sound } from '../domain/models';

it('previews a selection, rejects invalid ranges, and saves an actual trimmed file without replacing the original', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const original: Sound = { id: 'source', title: 'Bel Asli', subtitle: 'Original', category: 'bel', duration: 4, color: 'orange', src: '/audio/source.mp3' };
  const audio = { channels: [new Float32Array(32000).fill(.25)], sampleRate: 8000, duration: 4 };
  const stop = vi.fn();
  const editor = { load: vi.fn(async () => audio), preview: vi.fn(async () => ({ stop })), exportWav: encodeTrimmedWav };
  const save = vi.fn(async (sound: Sound, _file?: Blob) => sound);
  const store = configureStore({ reducer: { studio: studioReducer }, middleware: getDefault => getDefault({ thunk: { extraArgument: {
    sounds: { list: async () => [], save, remove: async () => {} },
    metadata: { duration: async (file: Blob) => { const data = new DataView(await file.arrayBuffer()); return data.getUint32(40, true) / data.getUint32(28, true); } },
  } } }) });
  store.dispatch(actions.uploadsLoaded([original]));
  const onSaved = vi.fn();
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const edit = async (label: string, value: string) => {
    const input = host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
  };
  const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(element => element.textContent === text)!;
  try {
    await act(async () => root.render(<Provider store={store}><AudioTrimDialog sound={original} editor={editor} onClose={() => {}} onSaved={onSaved} /></Provider>));
    expect(host.querySelector<HTMLDialogElement>('dialog')?.open).toBe(true);
    await edit('Mulai potongan dalam detik', '3');
    await edit('Selesai potongan dalam detik', '1');
    expect(button('Simpan Potongan Baru').disabled).toBe(true);
    await edit('Mulai potongan dalam detik', '1');
    await edit('Selesai potongan dalam detik', '2.5');
    await act(async () => button('Pratinjau Potongan').click());
    expect(editor.preview).toHaveBeenCalledWith(audio, 1, 2.5, expect.any(Function), expect.any(Function));
    await edit('Nama audio hasil potongan', 'Bel Singkat');
    await act(async () => { button('Simpan Potongan Baru').click(); await new Promise(resolve => setTimeout(resolve, 40)); });
    expect(stop).toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bel Singkat', duration: 1.5 }), expect.any(File));
    expect(store.getState().studio.sounds).toHaveLength(2);
    expect(store.getState().studio.sounds[0]).toEqual(original);
    expect(onSaved).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
