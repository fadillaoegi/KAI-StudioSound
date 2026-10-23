import type { Sound, SoundRepository } from '../domain/models';

/** Hostinger/PHP adapter. Audio bytes live in the project's uploads directory. */
export class HttpSoundRepository implements SoundRepository {
  private readonly root: URL;
  private initialized = false;
  private handshake?: Promise<Record<string, unknown>>;
  constructor(private readonly endpoint = new URL(`${import.meta.env.BASE_URL}api/sounds.php`, window.location.href).href) {
    this.root = new URL('../', endpoint);
  }

  private async request(init?: RequestInit): Promise<Record<string, unknown>> {
    let response: Response;
    try { response = await fetch(this.endpoint, { credentials: 'same-origin', cache: 'no-store', ...init }); }
    catch { throw new Error('Server audio belum dapat dihubungi. Periksa koneksi lalu coba lagi.'); }
    let data: Record<string, unknown>;
    try { data = await response.json(); }
    catch { throw new Error('Backend audio belum tersedia. Pastikan file api/sounds.php sudah diunggah dan PHP aktif.'); }
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Penyimpanan audio di server gagal.');
    return data;
  }

  private hydrate(sound: Sound): Sound {
    return { ...sound, src: sound.src ? new URL(sound.src, this.root).href : undefined };
  }

  private initialize(): Promise<Record<string, unknown>> {
    // Finish the first cookie response before sending uploads from this browser.
    if (!this.handshake) this.handshake = this.request()
      .then(result => { this.initialized = true; return result; })
      .catch(error => { this.handshake = undefined; throw error; });
    return this.handshake;
  }

  async list(): Promise<Sound[]> {
    const result = await (this.initialized ? this.request() : this.initialize());
    if (!Array.isArray(result.sounds)) throw new Error('Daftar audio dari server tidak valid.');
    return (result.sounds as Sound[]).map(sound => this.hydrate(sound));
  }

  async save(sound: Sound, file?: Blob): Promise<Sound> {
    await this.initialize();
    let body: BodyInit;
    const headers: Record<string, string> = { 'X-KAISound-Request': '1' };
    if (file) {
      const form = new FormData();
      form.append('sound', JSON.stringify(sound));
      const extensions: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' };
      form.append('file', file, file instanceof File ? file.name : `audio.${extensions[file.type] ?? 'mp3'}`);
      body = form;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ action: 'announcement', sound });
    }
    const result = await this.request({ method: 'POST', headers, body });
    if (!result.sound || typeof result.sound !== 'object') throw new Error('Audio belum berhasil disimpan oleh server.');
    return this.hydrate(result.sound as Sound);
  }

  async remove(id: string): Promise<void> {
    await this.initialize();
    await this.request({ method: 'POST', headers: { 'Content-Type': 'application/json', 'X-KAISound-Request': '1' }, body: JSON.stringify({ action: 'delete', id }) });
  }
}
