import type { AudioEngine, AudioEvents, Sound } from '../domain/models';

export class BrowserAudioEngine implements AudioEngine {
  private audio = new Audio();
  private utterance: SpeechSynthesisUtterance | null = null;
  private speechTimer: number | undefined;
  private volume = 0.75;
  private speechTime = 0;
  private speechPaused = false;
  private generation = 0;
  constructor(private events: AudioEvents) {
    this.audio.ontimeupdate = () => events.time(this.audio.currentTime, Number.isFinite(this.audio.duration) ? this.audio.duration : 0);
    this.audio.onended = () => events.ended();
    this.audio.onerror = () => events.error('Audio tidak dapat diputar. Coba pilih audio lain.');
  }
  async play(sound: Sound): Promise<void> {
    this.stop();
    const generation = this.generation;
    if (sound.text) {
      if (!('speechSynthesis' in window)) throw new Error('Suara otomatis tidak didukung. Gunakan unggahan rekaman audio.');
      const utterance = new SpeechSynthesisUtterance(sound.text);
      utterance.lang = 'id-ID'; utterance.rate = 0.9; utterance.volume = this.volume;
      const voice = speechSynthesis.getVoices().find(item => item.lang.startsWith('id'));
      if (voice) utterance.voice = voice;
      this.utterance = utterance;
      utterance.onend = () => { if (generation === this.generation) { clearInterval(this.speechTimer); this.utterance = null; this.events.ended(); } };
      utterance.onerror = event => { if (generation === this.generation && event.error !== 'interrupted' && event.error !== 'canceled') { clearInterval(this.speechTimer); this.events.error('Suara browser belum tersedia. Coba audio rekaman atau bel stasiun.'); } };
      this.speechTimer = window.setInterval(() => { if (!this.speechPaused) { this.speechTime += 0.25; this.events.time(Math.min(this.speechTime, sound.duration), sound.duration); } }, 250);
      speechSynthesis.speak(utterance);
    } else if (sound.src) {
      this.audio.src = sound.src;
      this.audio.volume = this.volume;
      try { await this.audio.play(); } catch (error) { if (generation !== this.generation) return; throw error; }
    } else throw new Error('Sumber audio tidak ditemukan.');
  }
  pause(): void { this.audio.pause(); if (this.utterance) { this.speechPaused = true; speechSynthesis.pause(); } }
  async resume(): Promise<void> { if (this.utterance) { this.speechPaused = false; speechSynthesis.resume(); } else await this.audio.play(); }
  stop(): void {
    this.generation++;
    this.audio.pause();
    this.audio.removeAttribute('src'); this.audio.load();
    if (this.utterance) { this.utterance.onend = null; this.utterance.onerror = null; speechSynthesis.cancel(); this.utterance = null; }
    clearInterval(this.speechTimer); this.speechTime = 0; this.speechPaused = false;
  }
  seek(time: number): void { if (!this.utterance && Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration)); }
  setVolume(volume: number): void { this.volume = volume / 100; this.audio.volume = this.volume; if (this.utterance) this.utterance.volume = this.volume; }
  dispose(): void { this.stop(); this.audio.onended = null; this.audio.ontimeupdate = null; this.audio.onerror = null; }
}
