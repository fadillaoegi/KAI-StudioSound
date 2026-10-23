import type { Preferences, PreferencesRepository, Sound, SoundRepository } from '../domain/models';

const defaults: Preferences = { favorites: [], volume: 75, repeat: false, playlists: [] };
export class LocalPreferencesRepository implements PreferencesRepository {
  load(): Preferences {
    try {
      const saved = JSON.parse(localStorage.getItem('kaisound.preferences.v1') ?? '{}');
      return { favorites: Array.isArray(saved.favorites) ? saved.favorites.filter((id: unknown) => typeof id === 'string') : [], volume: typeof saved.volume === 'number' ? Math.max(0, Math.min(100, saved.volume)) : 75, repeat: saved.repeat === true, playlists: Array.isArray(saved.playlists) ? saved.playlists.filter((p: Preferences['playlists'][number]) => typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.soundIds)) : [] };
    } catch { return defaults; }
  }
  save(preferences: Preferences): void { localStorage.setItem('kaisound.preferences.v1', JSON.stringify(preferences)); }
}

interface StoredSound { sound: Sound; file?: Blob }
export class IndexedDbSoundRepository implements SoundRepository {
  private urls = new Map<string, string>();
  private db(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('kaisound-audio', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('sounds', { keyPath: 'sound.id' }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Penyimpanan audio tidak tersedia di browser ini.'));
    });
  }
  private hydrate(row: StoredSound): Sound {
    if (!row.file) return row.sound;
    const previous = this.urls.get(row.sound.id);
    if (previous) URL.revokeObjectURL(previous);
    const src = URL.createObjectURL(row.file);
    this.urls.set(row.sound.id, src);
    return { ...row.sound, src };
  }
  async list(): Promise<Sound[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sounds', 'readonly');
      const request = tx.objectStore('sounds').getAll();
      request.onsuccess = () => resolve((request.result as StoredSound[]).map(row => this.hydrate(row)));
      request.onerror = () => reject(new Error('Koleksi pribadi tidak dapat dibaca.'));
      tx.oncomplete = () => db.close();
    });
  }
  async save(sound: Sound, file?: Blob): Promise<Sound> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sounds', 'readwrite');
      tx.objectStore('sounds').put({ sound, file } satisfies StoredSound);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(new Error('Audio gagal disimpan. Penyimpanan perangkat mungkin penuh.')); };
      tx.onabort = () => { db.close(); reject(new Error('Penyimpanan audio dibatalkan.')); };
    });
    return this.hydrate({ sound, file });
  }
  async remove(id: string): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sounds', 'readwrite');
      tx.objectStore('sounds').delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(new Error('Audio gagal dihapus.')); };
    });
    const url = this.urls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(id);
  }
}
