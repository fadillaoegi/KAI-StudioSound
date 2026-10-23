import { MAX_EDIT_SECONDS, MAX_EXPORT_BYTES, trimFrames, type AudioEditor, type AudioPreview, type EditableAudio } from '../domain/audioEditing';
import { BrowserAudioMetadataReader } from './BrowserAudioMetadataReader';

export function encodeTrimmedWav(audio: EditableAudio, start: number, end: number): Blob {
  const { first, last, channels, bytes } = trimFrames(audio, start, end);
  if (bytes > MAX_EXPORT_BYTES) throw new Error('Hasil WAV melebihi 25 MB. Pilih potongan yang lebih pendek.');
  const data = new ArrayBuffer(bytes);
  const view = new DataView(data);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, bytes - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, audio.sampleRate, true); view.setUint32(28, audio.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, bytes - 44, true);
  let offset = 44;
  for (let frame = first; frame < last; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = Math.max(-1, Math.min(1, audio.channels[channel][frame]));
      view.setInt16(offset, value < 0 ? value * 32768 : value * 32767, true);
      offset += 2;
    }
  }
  return new Blob([data], { type: 'audio/wav' });
}

export class BrowserAudioEditor implements AudioEditor {
  private buffers = new WeakMap<EditableAudio, AudioBuffer>();

  private context(): AudioContext {
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) throw new Error('Editor audio belum didukung browser ini. Gunakan Chrome, Edge, atau Safari terbaru.');
    return new AudioContextClass();
  }

  async load(src: string, signal?: AbortSignal): Promise<EditableAudio> {
    const response = await fetch(src, { signal, credentials: 'same-origin' });
    if (!response.ok) throw new Error('Audio sumber tidak dapat dibuka. Muat ulang koleksi dan coba lagi.');
    const bytes = await response.arrayBuffer();
    if (signal?.aborted) throw new DOMException('Editor ditutup.', 'AbortError');
    if (bytes.byteLength > MAX_EXPORT_BYTES) throw new Error('File terlalu besar untuk editor. Ukuran sumber maksimal 25 MB.');
    const duration = await new BrowserAudioMetadataReader().duration(new Blob([bytes]));
    if (duration > MAX_EDIT_SECONDS) throw new Error('Editor mendukung sumber hingga 10 menit. Gunakan rekaman yang lebih pendek.');
    if (signal?.aborted) throw new DOMException('Editor ditutup.', 'AbortError');
    const context = this.context();
    try {
      let buffer: AudioBuffer;
      try { buffer = await context.decodeAudioData(bytes); }
      catch { throw new Error('Format audio ini tidak dapat diedit di browser. Coba file MP3 atau WAV lain.'); }
      if (signal?.aborted) throw new DOMException('Editor ditutup.', 'AbortError');
      const audio = { channels: Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, index) => buffer.getChannelData(index)), duration: buffer.duration, sampleRate: buffer.sampleRate };
      this.buffers.set(audio, buffer);
      return audio;
    } finally { await context.close(); }
  }

  async preview(audio: EditableAudio, start: number, end: number, onProgress: (time: number) => void, onEnded: () => void): Promise<AudioPreview> {
    trimFrames(audio, start, end);
    const context = this.context();
    try { await context.resume(); } catch { await context.close(); throw new Error('Pratinjau belum dapat diputar. Coba lagi.'); }
    const source = context.createBufferSource();
    let buffer = this.buffers.get(audio);
    if (!buffer) {
      buffer = context.createBuffer(audio.channels.length, audio.channels[0].length, audio.sampleRate);
      audio.channels.forEach((channel, index) => buffer!.copyToChannel(new Float32Array(channel), index));
    }
    source.buffer = buffer;
    source.connect(context.destination);
    let stopped = false;
    const startedAt = context.currentTime;
    const timer = window.setInterval(() => onProgress(Math.min(end, start + context.currentTime - startedAt)), 50);
    const cleanup = () => { clearInterval(timer); source.disconnect(); void context.close(); };
    source.onended = () => { if (!stopped) { stopped = true; cleanup(); onEnded(); } };
    source.start(0, start, end - start);
    return { stop() { if (stopped) return; stopped = true; source.onended = null; source.stop(); cleanup(); } };
  }

  exportWav = encodeTrimmedWav;
}
