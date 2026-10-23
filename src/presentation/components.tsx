import { Bell, Music2, AudioLines, Mic2, Play, Pause, Heart, Plus, Scissors, Trash2 } from 'lucide-react';
import type { Category, Sound } from '../domain/models';
import { formatTime } from '../domain/useCases';
import { actions } from '../application/studioSlice';
import { useAppDispatch, useAppSelector } from './hooks';

export const categoryLabels: Record<Category, string> = { bel: 'Bel Stasiun', musik: 'Musik', ambience: 'Suasana', pengumuman: 'Pengumuman' };
export function SoundIcon({ category, size = 22 }: { category: Category; size?: number }) {
  const Icon = { bel: Bell, musik: Music2, ambience: AudioLines, pengumuman: Mic2 }[category];
  return <Icon size={size} strokeWidth={1.7} />;
}
export function Waveform({ playing = false, compact = false }: { playing?: boolean; compact?: boolean }) {
  return <div className={`waveform ${playing ? 'is-playing' : ''} ${compact ? 'compact' : ''}`} aria-hidden="true">{Array.from({ length: compact ? 22 : 62 }, (_, i) => <i key={i} style={{ height: `${12 + Math.abs(Math.sin(i * 1.73) * Math.cos(i * 0.42)) * 88}%`, animationDelay: `${i * 0.043}s` }} />)}</div>;
}
export function SoundCard({ sound, onDelete, onEdit }: { sound: Sound; onDelete: (sound: Sound) => void; onEdit: (sound: Sound) => void }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector(state => state.studio.activeId === sound.id ? state.studio.status : 'idle');
  const active = status === 'playing';
  const favorite = useAppSelector(state => state.studio.favorites.includes(sound.id));
  const togglePlay = () => dispatch(status !== 'idle' ? actions.playbackToggled() : actions.playRequested(sound.id));
  return <article className={`sound-card ${active ? 'card-active' : ''}`}>
    <div className={`sound-art tone-${sound.color}`}>
      <div className="art-grid" /><span className="art-icon"><SoundIcon category={sound.category} size={34} /></span>
      <Waveform playing={active} compact />
      <span className="audio-type">{sound.uploaded ? (sound.canDelete === false ? 'KOLEKSI BERSAMA' : 'AUDIO SAYA') : sound.text ? 'SUARA OTOMATIS' : 'KAISOUND ORIGINAL'}</span>
      <button className={`favorite-button ${favorite ? 'favorited' : ''}`} onClick={() => dispatch(actions.favoriteToggled(sound.id))} aria-label={`${favorite ? 'Hapus' : 'Tambah'} favorit ${sound.title}`} aria-pressed={favorite}><Heart size={17} fill={favorite ? 'currentColor' : 'none'} /></button>
      <button className="card-play" onClick={togglePlay} aria-label={`${active ? 'Jeda' : 'Putar'} ${sound.title}`}>{active ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
    </div>
    <div className="sound-info"><div className="sound-meta"><span>{categoryLabels[sound.category]}</span><span>{sound.text ? '± ' : ''}{formatTime(sound.duration)}</span></div><h3><button onClick={togglePlay}>{sound.title}</button></h3><p>{sound.subtitle}</p><div className="sound-card-footer"><span className={active ? 'playing-label' : ''}>{active ? <><AudioLines size={13} /> Sedang diputar</> : <><span className="little-dot" /> {sound.text ? 'Bahasa Indonesia' : 'Siap diputar'}</>}</span><div>{sound.src && !sound.text && <button className="icon-button edit-audio-button" aria-label={`Potong ${sound.title}`} title="Potong audio" onClick={() => onEdit(sound)}><Scissors size={15} /></button>}{sound.uploaded && sound.canDelete !== false && <button className="icon-button" aria-label={`Hapus ${sound.title}`} onClick={() => onDelete(sound)}><Trash2 size={15} /></button>}<button className="icon-button add-queue" aria-label={`Tambahkan ${sound.title} ke antrean`} onClick={() => dispatch(actions.queued(sound.id))}><Plus size={19} /></button></div></div></div>
  </article>;
}
