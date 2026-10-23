import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpSoundRepository } from './HttpSoundRepository';
import { catalog } from './catalog';

afterEach(() => vi.unstubAllGlobals());
const endpoint = 'https://example.test/KAI-sound/api/sounds.php';
const uploaded = { ...catalog[0], id: 'server-id', uploaded: true, canDelete: true, src: 'uploads/server-id.mp3' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

describe('server audio repository', () => {
  it('lists shared recordings with playable URLs and server ownership permissions', async () => {
    const fetcher = vi.fn(async () => json({ sounds: [{ ...uploaded, canDelete: false }] }));
    vi.stubGlobal('fetch', fetcher);
    const sounds = await new HttpSoundRepository(endpoint).list();
    expect(sounds[0].src).toBe('https://example.test/KAI-sound/uploads/server-id.mp3');
    expect(sounds[0].canDelete).toBe(false);
  });
  it('sends MP3 bytes as multipart data and accepts the server-generated record ID', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => json({ sound: uploaded }, 201))
      .mockResolvedValueOnce(json({ sounds: [] }));
    vi.stubGlobal('fetch', fetcher);
    const file = new File(['mp3'], 'Bel.mp3', { type: 'audio/mpeg' });
    const saved = await new HttpSoundRepository(endpoint).save({ ...catalog[0], uploaded: true }, file);
    const init = fetcher.mock.calls[1][1]!;
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    const form = init.body as FormData;
    expect((form.get('file') as File).name).toBe('Bel.mp3');
    expect((form.get('file') as File).size).toBe(file.size);
    expect(saved.id).toBe('server-id');
    expect(saved.src).toContain('/KAI-sound/uploads/');
  });
  it('surfaces server upload errors instead of pretending the file was saved locally', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Folder uploads belum bisa ditulis oleh PHP.' }, 503)));
    await expect(new HttpSoundRepository(endpoint).save(catalog[0], new Blob(['mp3'], { type: 'audio/mpeg' }))).rejects.toThrow('Folder uploads belum bisa ditulis oleh PHP.');
  });
  it('reports unavailable PHP and enforces server rejection for another owner', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>404</html>', { status: 404 })));
    await expect(new HttpSoundRepository(endpoint).list()).rejects.toThrow('Backend audio belum tersedia');
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Audio hanya bisa dihapus dari browser pengunggahnya.' }, 403)));
    await expect(new HttpSoundRepository(endpoint).remove('server-id')).rejects.toThrow('browser pengunggahnya');
  });
});
