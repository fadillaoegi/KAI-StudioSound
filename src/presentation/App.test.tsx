// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { expect, it, vi } from 'vitest';

vi.mock('../data/repositories', async importOriginal => {
  const actual = await importOriginal<typeof import('../data/repositories')>();
  return { ...actual, IndexedDbSoundRepository: class { async list() { return []; } async save(sound: unknown) { return sound; } async remove() {} } };
});

class TestAudio {
  static instances: TestAudio[] = [];
  currentTime = 0;
  duration = 9;
  volume = .75;
  src = '';
  paused = true;
  ontimeupdate: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { TestAudio.instances.push(this); }
  async play() { this.paused = false; }
  pause() { this.paused = true; }
  load() {}
  removeAttribute() { this.src = ''; }
}

it('connects user controls, Redux, the audio adapter, filtering, and guide navigation', async () => {
  vi.stubGlobal('Audio', TestAudio);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  const { store } = await import('../app/store');
  const { App } = await import('./App');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const click = async (selector: string) => {
    const button = host.querySelector<HTMLButtonElement>(selector);
    expect(button, selector).not.toBe(null);
    await act(async () => button!.click());
  };
  try {
    await act(async () => root.render(<Provider store={store}><App /></Provider>));
    expect(host.querySelector('h1')?.textContent).toContain('Suasana stasiun');
    expect(host.querySelectorAll('.sound-card')).toHaveLength(8);
    await click('[aria-label="Putar Bel Stasiun Klasik"]');
    expect(store.getState().studio.activeId).toBe('station-bell');
    const audio = TestAudio.instances[0];
    expect(audio.paused).toBe(false);
    expect(audio.src).toBe('/audio/station-bell.wav');
    await act(async () => { audio.currentTime = 3; audio.ontimeupdate?.(); });
    expect(host.querySelector('.progress-row')?.textContent).toContain('00:03');
    await click('[aria-label="Jeda pemutaran"]');
    expect(store.getState().studio.status).toBe('paused');
    expect(audio.paused).toBe(true);
    const revision = store.getState().studio.playbackRevision;
    await click('[aria-label="Putar Bel Stasiun Klasik"]');
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBe(3);
    expect(store.getState().studio.playbackRevision).toBe(revision);
    await act(async () => { audio.onended?.(); });
    expect(store.getState().studio.activeId).toBe('departure');
    expect(audio.src).toBe('/audio/departure.wav');
    await click('[aria-label="Tambah favorit Bel Stasiun Klasik"]');
    expect(JSON.parse(localStorage.getItem('kaisound.preferences.v1')!).favorites).toContain('station-bell');
    const musicCategory = [...host.querySelectorAll<HTMLButtonElement>('.category-tabs button')].find(button => button.textContent === 'Musik')!;
    await act(async () => musicCategory.click());
    expect(host.querySelectorAll('.sound-card')).toHaveLength(2);
    const favoritesNav = [...host.querySelectorAll<HTMLButtonElement>('.sidebar-link')].find(button => button.textContent?.includes('Favorit Saya'))!;
    await act(async () => favoritesNav.click());
    expect(host.querySelectorAll('.sound-card')).toHaveLength(1);
    expect(host.querySelector('#collection-title')?.textContent).toContain('Favorit Saya');
    await click('[aria-label="Buka navigasi"]');
    expect(host.querySelector('.sidebar')?.classList.contains('mobile-open')).toBe(true);
    const help = [...host.querySelectorAll<HTMLButtonElement>('.desktop-nav button')].find(button => button.textContent === 'Panduan')!;
    await act(async () => help.click());
    expect(host.querySelector('#guide-title')?.textContent).toContain('Panduan Penggunaan');
    expect(host.querySelector('.desktop-nav .selected')?.textContent).toBe('Panduan');
    expect(host.querySelector('.desktop-nav [aria-current="page"]')?.textContent).toBe('Panduan');
    expect(host.querySelector('.breadcrumb strong')?.textContent).toBe('Panduan');
    expect(host.querySelector('.sidebar')?.classList.contains('mobile-open')).toBe(false);
    expect(window.location.hash).toBe('#guide');
    expect(store.getState().studio.status).toBe('playing');
    await click('[aria-label="Hentikan pemutaran"]');
    expect(audio.paused).toBe(true);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
