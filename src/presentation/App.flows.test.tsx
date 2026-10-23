// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, studioReducer } from '../application/studioSlice';
import { catalog } from '../data/catalog';
import type { Sound } from '../domain/models';
import { App } from './App';

function createTestStore() {
  const repository = { list: vi.fn(async () => []), save: vi.fn(async (sound: Sound) => sound), remove: vi.fn(async () => {}) };
  const store = configureStore({ reducer: { studio: studioReducer }, middleware: getDefault => getDefault({ thunk: { extraArgument: { sounds: repository, metadata: { duration: async () => 10 } } } }) });
  store.dispatch(actions.uploadsLoaded(catalog));
  return { store, repository };
}

let host: HTMLDivElement;
let root: Root;
let fixture: ReturnType<typeof createTestStore>;

async function click(selector: string) {
  const element = host.querySelector<HTMLButtonElement>(selector);
  expect(element, selector).not.toBe(null);
  expect(element!.disabled, `${selector} should be enabled`).toBe(false);
  await act(async () => element!.click());
}

async function clickText(selector: string, text: string) {
  const element = [...host.querySelectorAll<HTMLButtonElement>(selector)].find(button => button.textContent?.trim() === text);
  expect(element, `${selector}: ${text}`).not.toBeUndefined();
  await act(async () => element!.click());
}

async function enter(selector: string, value: string) {
  const element = host.querySelector<HTMLInputElement>(selector)!;
  expect(element).not.toBe(null);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function mount(hash = '') {
  window.history.replaceState(null, '', `/${hash}`);
  await act(async () => root.render(<Provider store={fixture.store}><App /></Provider>));
}

beforeEach(() => {
  const crypto = globalThis.crypto;
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('speechSynthesis', {});
  fixture = createTestStore();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
});

describe('complete studio interactions', () => {
  it('updates active header, breadcrumb, content and URL on every primary navigation', async () => {
    await mount();
    for (const [label, hash, heading] of [['Playlist Saya', '#playlists', '#collection-title'], ['Panduan', '#guide', '#guide-title'], ['Studio Audio', '#library', '#collection-title']]) {
      await clickText('.desktop-nav button', label);
      expect(host.querySelectorAll('.desktop-nav .selected')).toHaveLength(1);
      expect(host.querySelector('.desktop-nav .selected')?.textContent).toBe(label);
      expect(host.querySelector('.desktop-nav [aria-current="page"]')?.textContent).toBe(label);
      expect(host.querySelector('.breadcrumb strong')?.textContent).toBe(label);
      expect(host.querySelector(heading)).not.toBe(null);
      expect(window.location.hash).toBe(hash);
      expect(document.title).toContain(label);
    }
    await clickText('.sidebar-link', 'Favorit Saya');
    expect(host.querySelector('.desktop-nav .selected')?.textContent).toBe('Studio Audio');
    expect(host.querySelector('.sidebar-link[aria-current="page"]')?.textContent).toBe('Favorit Saya');
    expect(host.querySelector('.breadcrumb strong')?.textContent).toBe('Favorit Saya');
  });

  it('restores direct URLs and responds to back/forward navigation without resetting audio', async () => {
    await mount('#playlists');
    expect(host.querySelector('.desktop-nav .selected')?.textContent).toBe('Playlist Saya');
    await act(async () => fixture.store.dispatch(actions.playRequested('station-bell')));
    await act(async () => {
      window.history.replaceState(null, '', '/#guide');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(host.querySelector('#guide-title')).not.toBe(null);
    expect(fixture.store.getState().studio.activeId).toBe('station-bell');
    await click('[aria-label="Buka navigasi"]');
    await click('[aria-label="Tutup navigasi"]');
    expect(host.querySelector('.sidebar.mobile-open')).toBe(null);
    await click('[aria-label="Buka navigasi"]');
    await clickText('.sidebar-link', 'Audio Saya');
    expect(host.querySelector('.sidebar.mobile-open')).toBe(null);
    expect(host.querySelector('#collection-title')?.textContent).toContain('Audio Saya');
    await clickText('.help-link', 'Panduan Penggunaan');
    expect(host.querySelector('.help-link[aria-current="page"]')).not.toBe(null);
    expect(host.querySelector('#guide-title')).not.toBe(null);
  });

  it('searches, resets empty results, combines category filters and updates favorites', async () => {
    await mount();
    await enter('[aria-label="Cari audio"]', 'bel');
    expect(host.querySelectorAll('.sound-card')).toHaveLength(2);
    await clickText('.category-tabs button', 'Musik');
    expect(host.querySelectorAll('.sound-card')).toHaveLength(0);
    await clickText('.empty-state button', 'Reset pencarian');
    expect(host.querySelectorAll('.sound-card')).toHaveLength(8);
    await click('[aria-label="Tambah favorit Bel Stasiun Klasik"]');
    await clickText('.sidebar-link', 'Favorit Saya1');
    expect(host.querySelectorAll('.sound-card')).toHaveLength(1);
    await click('[aria-label="Hapus favorit Bel Stasiun Klasik"]');
    expect(host.querySelectorAll('.sound-card')).toHaveLength(0);
  });

  it('reorders and repeats the queue, saves a named playlist, loads it and deletes it', async () => {
    await mount();
    await click('[aria-label="Naikkan Melodi Keberangkatan"]');
    expect(fixture.store.getState().studio.queue[0]).toBe('departure');
    await click('[aria-label="Ulangi antrean"]');
    expect(fixture.store.getState().studio.repeat).toBe(true);
    await clickText('.queue-controls button', 'Putar Semua');
    expect(fixture.store.getState().studio.activeId).toBe('departure');
    await clickText('.queue-controls button', 'Simpan sebagai Playlist');
    await enter('dialog input', 'Sore di Peron');
    await clickText('dialog button', 'Simpan Playlist');
    expect(fixture.store.getState().studio.playlists[0].name).toBe('Sore di Peron');
    expect(host.querySelector('.desktop-nav .selected')?.textContent).toBe('Playlist Saya');
    expect(host.querySelector('.playlist-card h3')?.textContent).toBe('Sore di Peron');
    await clickText('.queue-summary button', 'Bersihkan');
    expect(fixture.store.getState().studio.queue).toHaveLength(0);
    await clickText('.playlist-card button', 'Muat Antrean');
    expect(fixture.store.getState().studio.queue).toHaveLength(3);
    await click('[aria-label="Hapus playlist Sore di Peron"]');
    expect(fixture.store.getState().studio.playlists).toHaveLength(0);
    expect(host.querySelector('.empty-state')).not.toBe(null);
  });

  it('uploads an MP3 without MIME or randomUUID, plays it, queues it, and deletes it', async () => {
    await mount();
    await clickText('.header-actions button', 'Unggah Audio');
    expect(host.querySelector<HTMLDialogElement>('dialog')!.open).toBe(true);
    const input = host.querySelector<HTMLInputElement>('[aria-label="Pilih file audio"]')!;
    expect(input.accept).toContain('.mp3');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['bytes'], 'Pengumuman Solo.mp3')] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(fixture.repository.save).toHaveBeenCalled();
    expect(host.querySelector('#collection-title')?.textContent).toContain('Audio Saya');
    expect(host.querySelector('.sound-card h3')?.textContent).toBe('Pengumuman Solo');
    const uploaded = fixture.store.getState().studio.sounds.find(sound => sound.title === 'Pengumuman Solo')!;
    await click('[aria-label="Putar Pengumuman Solo"]');
    expect(fixture.store.getState().studio.activeId).toBe(uploaded.id);
    expect(fixture.store.getState().studio.status).toBe('playing');
    expect(fixture.store.getState().studio.queue).toContain(uploaded.id);
    await click('[aria-label="Hapus Pengumuman Solo"]');
    await clickText('dialog button', 'Hapus Audio');
    expect(fixture.repository.remove).toHaveBeenCalled();
    expect(host.querySelectorAll('.sound-card')).toHaveLength(0);
  });

  it('creates an announcement from the form, queues it, and clears its references on deletion', async () => {
    await mount();
    await clickText('.sidebar-link', 'Buat Pengumuman');
    await clickText('dialog button', 'Simpan Pengumuman');
    expect(host.querySelector('#collection-title')?.textContent).toContain('Audio Saya');
    const sound = fixture.store.getState().studio.sounds.find(item => item.uploaded)!;
    expect(sound.text).toContain('Yogyakarta');
    await click(`[aria-label="Tambahkan ${sound.title} ke antrean"]`);
    expect(fixture.store.getState().studio.queue).toContain(sound.id);
    await click(`[aria-label="Hapus ${sound.title}"]`);
    await clickText('dialog button', 'Hapus Audio');
    expect(fixture.store.getState().studio.queue).not.toContain(sound.id);
  });
});
