export interface EditableAudio {
  channels: Float32Array[];
  sampleRate: number;
  duration: number;
}

export interface AudioPreview { stop(): void }

export interface AudioEditor {
  load(src: string, signal?: AbortSignal): Promise<EditableAudio>;
  preview(audio: EditableAudio, start: number, end: number, onProgress: (time: number) => void, onEnded: () => void): Promise<AudioPreview>;
  exportWav(audio: EditableAudio, start: number, end: number): Blob;
}

export const MAX_EDIT_SECONDS = 600;
export const MAX_EXPORT_BYTES = 25 * 1024 * 1024;

export function trimFrames(audio: EditableAudio, start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > audio.duration + 0.001 || end - start < 0.1) {
    throw new Error('Pilih bagian minimal 0,1 detik. Waktu mulai harus lebih kecil dari waktu selesai dan berada dalam durasi audio.');
  }
  if (!audio.channels.length || audio.sampleRate <= 0) throw new Error('Data audio tidak valid.');
  const first = Math.max(0, Math.round(start * audio.sampleRate));
  const last = Math.min(audio.channels[0].length, Math.round(end * audio.sampleRate));
  if (last <= first) throw new Error('Bagian audio yang dipilih kosong.');
  const channels = Math.min(2, audio.channels.length);
  return { first, last, channels, bytes: 44 + (last - first) * channels * 2 };
}

export function waveformPeaks(audio: EditableAudio, count = 180): number[] {
  const source = audio.channels[0];
  if (!source?.length) return [];
  return Array.from({ length: count }, (_, index) => {
    const first = Math.floor(index * source.length / count);
    const last = Math.floor((index + 1) * source.length / count);
    const step = Math.max(1, Math.floor((last - first) / 512));
    let peak = 0;
    for (let sample = first; sample < last; sample += step) peak = Math.max(peak, Math.abs(source[sample]));
    return Math.min(1, peak);
  });
}
