import { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle, Play, RotateCcw, Save, Scissors, Square, X } from 'lucide-react';
import type { Sound } from '../domain/models';
import { MAX_EDIT_SECONDS, MAX_EXPORT_BYTES, trimFrames, waveformPeaks, type AudioEditor, type AudioPreview, type EditableAudio } from '../domain/audioEditing';
import { importAudio } from '../application/libraryCommands';
import { useAppDispatch } from './hooks';
import { serverStorage } from './storage';

const timeLabel = (seconds: number) => {
  const ticks = Math.round(seconds * 100);
  return `${Math.floor(ticks / 6000).toString().padStart(2, '0')}:${Math.floor(ticks / 100 % 60).toString().padStart(2, '0')}.${(ticks % 100).toString().padStart(2, '0')}`;
};
const errorMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Audio belum berhasil diproses. Coba lagi.';

export function AudioTrimDialog({ sound, editor, onClose, onSaved }: { sound: Sound; editor: AudioEditor; onClose: () => void; onSaved: () => void }) {
  const dispatch = useAppDispatch();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<AudioPreview | null>(null);
  const previewGeneration = useRef(0);
  const [audio, setAudio] = useState<EditableAudio | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [title, setTitle] = useState(`${sound.title.slice(0, 108)} (potongan)`);
  const [previewing, setPreviewing] = useState(false);
  const [previewTime, setPreviewTime] = useState<number | null>(null);

  const stopPreview = () => {
    previewGeneration.current++;
    previewRef.current?.stop(); previewRef.current = null;
    setPreviewing(false); setPreviewTime(null);
  };

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let closed = false;
    setLoading(true);
    if (!sound.src || sound.duration > MAX_EDIT_SECONDS) {
      setError(!sound.src ? 'Pengumuman teks tidak bisa dipotong. Gunakan file audio MP3 atau WAV.' : 'Editor mendukung sumber hingga 10 menit. Gunakan rekaman yang lebih pendek.');
      setLoading(false);
    } else {
      void editor.load(sound.src, controller.signal).then(decoded => {
        if (closed) return;
        if (decoded.duration > MAX_EDIT_SECONDS) throw new Error('Editor mendukung sumber hingga 10 menit. Gunakan rekaman yang lebih pendek.');
        setAudio(decoded); setStart(0); setEnd(decoded.duration);
      }).catch(reason => { if (!closed) setError(errorMessage(reason)); }).finally(() => { if (!closed) setLoading(false); });
    }
    return () => { closed = true; controller.abort(); previewGeneration.current++; previewRef.current?.stop(); previewRef.current = null; };
  }, [editor, sound.src, sound.duration]);

  const peaks = useMemo(() => audio ? waveformPeaks(audio) : [], [audio]);
  let selectionError = '';
  let outputBytes = 0;
  if (audio) {
    try { outputBytes = trimFrames(audio, start, end).bytes; }
    catch (reason) { selectionError = errorMessage(reason); }
  }
  const outputTooLarge = outputBytes > MAX_EXPORT_BYTES;
  const duration = audio?.duration ?? 0;
  const left = duration ? Math.max(0, Math.min(100, start / duration * 100)) : 0;
  const right = duration ? Math.max(0, Math.min(100, end / duration * 100)) : 100;
  const updateStart = (value: number) => { stopPreview(); setError(''); setStart(value); };
  const updateEnd = (value: number) => { stopPreview(); setError(''); setEnd(value); };

  const preview = async () => {
    if (previewing) { stopPreview(); return; }
    if (!audio || selectionError) return;
    setError(''); setPreviewing(true); setPreviewTime(start);
    const generation = ++previewGeneration.current;
    try {
      const handle = await editor.preview(audio, start, end,
        time => { if (generation === previewGeneration.current) setPreviewTime(time); },
        () => { if (generation === previewGeneration.current) { previewRef.current = null; setPreviewing(false); setPreviewTime(null); } });
      if (generation !== previewGeneration.current) handle.stop();
      else previewRef.current = handle;
    } catch (reason) { if (generation === previewGeneration.current) { setError(errorMessage(reason)); setPreviewing(false); setPreviewTime(null); } }
  };

  const save = async () => {
    if (!audio || selectionError || outputTooLarge || !title.trim() || saving) return;
    stopPreview(); setSaving(true); setError('');
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const blob = editor.exportWav(audio, start, end);
      const file = new File([blob], `${title.trim().replace(/[\\/:*?"<>|]/g, '-')}.wav`, { type: 'audio/wav' });
      await dispatch(importAudio(file)).unwrap();
      onSaved();
    } catch (reason) { setError(errorMessage(reason)); setSaving(false); }
  };

  return <dialog ref={dialogRef} className="modal audio-trim-modal" aria-labelledby="audio-trim-title" onCancel={event => { if (saving) event.preventDefault(); else onClose(); }} onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <div className="modal-top"><span className="modal-icon"><Scissors /></span><button className="icon-button" aria-label="Tutup editor audio" disabled={saving} onClick={onClose}><X size={21} /></button></div>
    <span className="eyebrow">EDITOR AUDIO</span><h2 id="audio-trim-title">Ambil bagian terbaiknya.</h2>
    <p className="trim-source">{sound.title}</p><p>Pilih bagian yang ingin disimpan. Dengarkan pratinjau sebelum membuat audio baru.</p>
    {loading && <div className="trim-loading" role="status"><LoaderCircle className="spin" size={27} /><span>Membaca gelombang audio...</span></div>}
    {audio && <>
      <div className="trim-waveform-wrap"><svg viewBox="0 0 1000 160" preserveAspectRatio="none" role="img" aria-label="Gelombang audio dan bagian yang dipilih" className="trim-waveform">
        <rect x="0" y="0" width="1000" height="160" rx="8" fill="#f2f4fa" />
        {peaks.map((peak, index) => <rect key={index} x={index * 1000 / peaks.length} y={80 - Math.max(3, peak * 124) / 2} width="3.2" height={Math.max(3, peak * 124)} rx="1.6" fill={index / peaks.length * 100 >= left && index / peaks.length * 100 <= right ? '#ee6d25' : '#bdc6d9'} />)}
        <rect x={left * 10} y="1" width={Math.max(0, (right - left) * 10)} height="158" fill="#ee6d2510" stroke="#ee6d25" strokeWidth="2" />
        {previewTime !== null && <line x1={previewTime / duration * 1000} x2={previewTime / duration * 1000} y1="0" y2="160" stroke="#293b77" strokeWidth="3" />}
      </svg><div className="trim-time-axis"><span>00:00.00</span><span>{timeLabel(duration)}</span></div></div>
      <div className="trim-range-controls"><label>Geser awal potongan<input aria-label="Geser awal potongan" type="range" min="0" max={duration} step="0.01" value={Math.min(duration, Math.max(0, start))} disabled={saving} onChange={event => updateStart(Math.min(Number(event.target.value), end - 0.1))} /></label><label>Geser akhir potongan<input aria-label="Geser akhir potongan" type="range" min="0" max={duration} step="0.01" value={Math.min(duration, Math.max(0, end))} disabled={saving} onChange={event => updateEnd(Math.max(Number(event.target.value), start + 0.1))} /></label></div>
      <div className="trim-fields"><label className="form-label">Mulai (detik)<input aria-label="Mulai potongan dalam detik" type="number" min="0" max={duration} step="0.01" value={Number(start.toFixed(3))} disabled={saving} onChange={event => updateStart(Number(event.target.value))} /></label><label className="form-label">Selesai (detik)<input aria-label="Selesai potongan dalam detik" type="number" min="0" max={duration} step="0.01" value={Number(end.toFixed(3))} disabled={saving} onChange={event => updateEnd(Number(event.target.value))} /></label><div className="trim-duration"><span>Durasi hasil</span><strong>{timeLabel(Math.max(0, end - start))}</strong></div></div>
      <div className="trim-preview-controls"><button className="button secondary" disabled={Boolean(selectionError) || saving} onClick={() => void preview()}>{previewing ? <Square size={14} /> : <Play size={15} />}{previewing ? 'Hentikan Pratinjau' : 'Pratinjau Potongan'}</button><button className="trim-reset" disabled={saving} onClick={() => { stopPreview(); setStart(0); setEnd(duration); setError(''); }}><RotateCcw size={14} /> Reset seleksi</button></div>
      <label className="form-label">Nama audio hasil<input aria-label="Nama audio hasil potongan" maxLength={120} value={title} disabled={saving} onChange={event => setTitle(event.target.value)} /></label>
      <div className="trim-output-note"><strong>WAV · 16-bit{outputBytes ? ` · ${(outputBytes / 1024 / 1024).toFixed(2)} MB` : ''}</strong><span>Hasil dipotong menjadi file WAV baru{serverStorage ? ' dan disimpan ke folder uploads di server' : ' di Audio Saya'}. Audio asli tetap tersedia. Maksimal hasil 25 MB.</span></div>
      {selectionError && <div className="form-error" role="alert">{selectionError}</div>}
      {outputTooLarge && <div className="form-error" role="alert">Hasil WAV melebihi 25 MB. Pilih potongan yang lebih pendek.</div>}
      <button className="button primary modal-submit" disabled={saving || Boolean(selectionError) || outputTooLarge || !title.trim()} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{saving ? 'Menyimpan potongan...' : 'Simpan Potongan Baru'}</button>
    </>}
    {error && <div className="form-error" role="alert">{error}</div>}
  </dialog>;
}
