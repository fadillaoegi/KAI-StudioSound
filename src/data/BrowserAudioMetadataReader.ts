import type { AudioMetadataReader } from '../domain/models';

export class BrowserAudioMetadataReader implements AudioMetadataReader {
  async duration(file: Blob): Promise<number> {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<number>((resolve, reject) => {
        const audio = new Audio();
        const cleanup = () => { audio.onloadedmetadata = null; audio.onerror = null; audio.removeAttribute('src'); audio.load(); };
        const timer = window.setTimeout(() => { cleanup(); reject(new Error('Audio tidak dapat dibaca. Coba file lain.')); }, 10000);
        audio.onloadedmetadata = () => {
          clearTimeout(timer);
          const duration = audio.duration;
          cleanup();
          if (!Number.isFinite(duration) || duration <= 0) reject(new Error('Durasi audio tidak valid. Coba file MP3 atau WAV lain.'));
          else resolve(duration);
        };
        audio.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error('Format audio ini tidak didukung browser.')); };
        audio.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }
}
