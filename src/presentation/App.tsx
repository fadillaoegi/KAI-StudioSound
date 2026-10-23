import { useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, AudioLines, Check, ChevronRight, CircleHelp, Headphones, Heart, Info, Library, ListMusic, LoaderCircle, Menu, Mic2, Music2, Play, Plus, Search, ShieldCheck, TrainFront, Trash2, Upload, X } from 'lucide-react';
import { actions } from '../application/studioSlice';
import { useAppDispatch, useAppSelector, useStudioNavigation } from './hooks';
import { createAnnouncement, deleteAudio, importAudio } from '../application/libraryCommands';
import { filterSounds } from '../domain/useCases';
import type { Category, Sound, View } from '../domain/models';
import { categoryLabels, SoundCard, Waveform } from './components';
import { QueuePanel } from './QueuePanel';
import { Player } from './Player';
import { GuidePage } from './GuidePage';
import { primaryView, viewLabels } from './navigation';
import { createId } from '../shared/createId';
import { serverStorage, storageDescription } from './storage';
import { AudioEditorContext } from './AudioEditorContext';
import { AudioTrimDialog } from './AudioTrimDialog';

type Modal = 'upload' | 'announcement' | 'playlist' | 'help' | 'delete' | null;
const navItems: { id: View; label: string; icon: typeof Library }[] = [{ id: 'library', label: 'Koleksi Suara', icon: Library }, { id: 'favorites', label: 'Favorit Saya', icon: Heart }, { id: 'uploads', label: 'Audio Saya', icon: Upload }, { id: 'playlists', label: 'Playlist Saya', icon: ListMusic }];
const titles: Record<View, [string, string]> = { library: ['Koleksi Suara', 'Temukan suara yang membuatmu ingin kembali bepergian.'], favorites: ['Favorit Saya', 'Semua suara yang kamu suka, dalam satu tempat.'], uploads: ['Audio Saya', 'Rekaman dan pengumuman untuk suasana versimu.'], playlists: ['Playlist Saya', 'Simpan rangkaian suara untuk perjalanan berikutnya.'], guide: ['Panduan', 'Kenali ruang dengarmu.'] };

export function App() {
  const dispatch = useAppDispatch();
  const navigate = useStudioNavigation();
  const audioEditor = useContext(AudioEditorContext);
  const [editingSound, setEditingSound] = useState<Sound | null>(null);
  const state = useAppSelector(root => root.studio);
  const [modal, setModal] = useState<Modal>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Sound | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [announcementName, setAnnouncementName] = useState('Pengumuman Keberangkatan');
  const [announcementText, setAnnouncementText] = useState('Perhatian kepada para penumpang. Kereta api tujuan Yogyakarta akan segera diberangkatkan dari jalur tiga. Para penumpang dipersilakan naik ke kereta. Terima kasih.');
  const [dragging, setDragging] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const queueSounds = state.queue.map(id => state.sounds.find(sound => sound.id === id)).filter((sound): sound is Sound => Boolean(sound));
  const baseSounds = state.view === 'favorites' ? state.sounds.filter(sound => state.favorites.includes(sound.id)) : state.view === 'uploads' ? state.sounds.filter(sound => sound.uploaded && sound.canDelete !== false) : state.sounds;
  const sounds = filterSounds(baseSounds, state.search, state.category);

  useEffect(() => {
    if (!state.notice) return;
    const timer = window.setTimeout(() => dispatch(actions.noticeShown(null)), 4200);
    return () => clearTimeout(timer);
  }, [state.notice, dispatch]);
  useEffect(() => {
    if (modal && !modalRef.current?.open) modalRef.current?.showModal();
    if (!modal && modalRef.current?.open) modalRef.current.close();
  }, [modal]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || modalRef.current?.open || document.querySelector('dialog[open]')) return;
      if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); dispatch(actions.playbackToggled()); }
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);
  const changeView = (view: View) => { navigate(view); setMobileMenu(false); };
  const activeNavigation = primaryView(state.view);
  const openModal = (value: Modal) => { setUploadError(''); setModal(value); };
  const uploadFile = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true); setUploadError('');
    try { await dispatch(importAudio(file)).unwrap(); changeView('uploads'); setModal(null); }
    catch (error) { setUploadError(error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Audio gagal diunggah.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const saveAnnouncement = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setUploadError('');
    try {
      if (!('speechSynthesis' in window)) throw new Error('Suara otomatis belum tersedia di browser ini. Tambahkan rekaman melalui Unggah Audio.');
      await dispatch(createAnnouncement({ title: announcementName, text: announcementText })).unwrap(); changeView('uploads'); setModal(null);
    } catch (error) { setUploadError(error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Pengumuman gagal disimpan.'); }
    finally { setBusy(false); }
  };
  const deleteSound = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try { await dispatch(deleteAudio(pendingDelete.id)).unwrap(); setModal(null); dispatch(actions.noticeShown('Audio berhasil dihapus')); }
    catch { setUploadError('Audio gagal dihapus. Coba lagi.'); }
    finally { setBusy(false); }
  };
  const savePlaylist = (event: FormEvent) => { event.preventDefault(); if (!state.queue.length) return; dispatch(actions.playlistSaved({ id: createId(), name: playlistName.trim(), soundIds: [...state.queue] })); setPlaylistName(''); setModal(null); changeView('playlists'); };

  return <div className="app-shell">
    <div className="utility-bar"><div><TrainFront size={13} /><span>Setiap suara, sebuah cerita perjalanan.</span></div><button onClick={() => openModal('help')}>Tentang KAIsound <ArrowUpRight size={12} /></button></div>
    <header className="main-header">
      <button className="brand" onClick={() => changeView('library')} aria-label="KAIsound beranda"><span className="brand-mark">K<span>A</span>I<i /></span><span className="brand-divider" /><span className="brand-sound">sound<span>STATION AUDIO EXPERIENCE</span></span></button>
      <nav className="desktop-nav" aria-label="Navigasi utama">
        {(['library', 'playlists', 'guide'] as const).map(view => <button key={view} className={activeNavigation === view ? 'selected' : ''} aria-current={activeNavigation === view ? 'page' : undefined} onClick={() => changeView(view)}>{viewLabels[view]}</button>)}
      </nav>
      <div className="header-actions"><span className="local-badge"><span /> {serverStorage ? 'Studio Bersama' : 'Studio Pribadi'}</span><button className="button primary header-upload" onClick={() => openModal('upload')}><Upload size={16} /> Unggah Audio</button><button className="icon-button menu-toggle" aria-label="Buka navigasi" aria-expanded={mobileMenu} aria-controls="studio-navigation" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button></div>
    </header>

    <div className="workspace">
      {mobileMenu && <button className="sidebar-backdrop" aria-label="Tutup navigasi" onClick={() => setMobileMenu(false)} />}
      <aside id="studio-navigation" className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <div className="sidebar-label">RUANG AUDIO</div>
        <nav aria-label="Koleksi audio">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => changeView(id)} className={`sidebar-link ${state.view === id ? 'active' : ''}`} aria-current={state.view === id ? 'page' : undefined}><Icon size={19} /><span>{label}</span>{id === 'favorites' && state.favorites.length > 0 ? <span className="nav-count">{state.favorites.length}</span> : id === 'library' ? <ChevronRight size={15} /> : null}</button>)}</nav>
        <div className="sidebar-separator" />
        <div className="sidebar-label">KREASIKAN SUASANAMU</div>
        <button className="sidebar-link" onClick={() => openModal('announcement')}><Mic2 size={19} /><span>Buat Pengumuman</span><Plus size={15} /></button>
        <div className="sidebar-note"><div className="note-icon"><Headphones size={23} /></div><h3>Perjalanan dimulai<br />dari sebuah suara.</h3><p>Pakai headphone untuk pengalaman yang lebih berkesan.</p><span className="note-line" /></div>
        <button className={`help-link ${state.view === 'guide' ? 'active' : ''}`} aria-current={state.view === 'guide' ? 'page' : undefined} onClick={() => changeView('guide')}><CircleHelp size={17} /> Panduan Penggunaan <ArrowUpRight size={13} /></button>
        <div className="sidebar-footer"><span className="mini-brand">KAIsound</span><span>Ruang dengar para pencinta perjalanan.</span><small>Proyek independen · v1.0</small></div>
      </aside>

      <main className="main-content">
        <nav className="breadcrumb" aria-label="Lokasi halaman"><button onClick={() => changeView('library')}>Beranda</button><ChevronRight size={12} /><strong aria-current="page">{viewLabels[state.view]}</strong></nav>
        {state.view === 'library' && <><section className="hero" aria-labelledby="hero-title"><div className="hero-grain" /><div className="hero-copy"><div className="hero-kicker"><span /> SELAMAT DATANG DI KAISOUND</div><h1 id="hero-title">Suasana stasiun,<br /><span>di ujung jarimu.</span></h1><p>Dari bel yang familiar hingga melodi penuh kenangan.<br className="desktop-break" /> Hadirkan cerita perjalananmu, kapan saja.</p><button className="button hero-button" onClick={() => dispatch(actions.playRequested('station-bell'))}><Play size={16} fill="currentColor" /> Mulai Dengarkan <ArrowRight size={16} /></button><div className="hero-footnote"><Headphones size={13} /> Dibuat untuk menemani setiap perjalanan</div></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-train"><TrainFront strokeWidth={1.2} /><span className="train-stripe" /></div><div className="hero-audio-card"><span className="audio-card-icon"><AudioLines size={19} /></span><div><strong>Suara yang membawa pulang</strong><span>Kenangan di setiap nadanya</span></div><span className="audio-card-dot" /></div><div className="hero-route"><span>BERANGKAT</span><i /><TrainFront size={17} /><i /><span>KENANGAN</span></div></div></section>
        <div className="feature-strip"><span><AudioLines size={16} /><strong>8 suara pilihan</strong> untuk menemani harimu</span><span className="strip-divider" /><span><ShieldCheck size={16} /> {serverStorage ? 'Koleksi bersama tersimpan di server' : 'Koleksi pribadi tersimpan di perangkat'}</span><span className="strip-end">Dengarkan. Rasakan. Kenang.</span></div></>}

        {state.view === 'guide' ? <GuidePage onNavigate={changeView} onUpload={() => openModal('upload')} onAnnouncement={() => openModal('announcement')} /> : <><div className="studio-layout"><section className="library-section" aria-labelledby="collection-title"><div className="section-heading"><div><span className="eyebrow">RUANG DENGAR PILIHANMU</span><h2 id="collection-title">{titles[state.view][0]}<span className="heading-dot">.</span></h2><p>{titles[state.view][1]}</p></div><div className="collection-actions">{state.view === 'uploads' && <button className="button primary" onClick={() => openModal('upload')}><Upload size={15} /> Tambah MP3</button>}<button className="icon-button collection-help" aria-label="Informasi koleksi suara" onClick={() => openModal('help')}><Info size={19} /></button></div></div>
          {state.view !== 'playlists' && <><div className="search-field"><Search size={18} /><input ref={searchRef} value={state.search} onChange={event => dispatch(actions.searchChanged(event.target.value))} placeholder="Cari bel, musik, atau suasana favoritmu..." aria-label="Cari audio" />{state.search ? <button className="icon-button" aria-label="Hapus pencarian" onClick={() => dispatch(actions.searchChanged(''))}><X size={16} /></button> : <kbd>/</kbd>}</div><div className="category-tabs" role="group" aria-label="Kategori suara">{([{ id: 'all', label: 'Semua Suara' }, ...Object.entries(categoryLabels).map(([id, label]) => ({ id, label }))]).map(category => <button key={category.id} className={state.category === category.id ? 'active' : ''} onClick={() => dispatch(actions.categoryChanged(category.id as Category | 'all'))}>{category.label}</button>)}</div><div className="results-label"><span>{sounds.length} audio tersedia</span><span><span className="little-dot" /> {state.category === 'all' ? 'Dikurasi untukmu' : categoryLabels[state.category]}</span></div></>}
          {state.view === 'playlists' ? <div className="playlist-grid">{state.playlists.map(playlist => <article className="playlist-card" key={playlist.id}><div className="playlist-art"><ListMusic size={30} /><Waveform compact /></div><h3>{playlist.name}</h3><p>{playlist.soundIds.length} audio dalam perjalanan ini</p><div><button className="button secondary" onClick={() => dispatch(actions.playlistLoaded(playlist.id))}><ListMusic size={15} /> Muat Antrean</button><button className="icon-button" aria-label={`Hapus playlist ${playlist.name}`} onClick={() => dispatch(actions.playlistDeleted(playlist.id))}><Trash2 size={17} /></button></div></article>)}{!state.playlists.length && <EmptyState icon="playlist" title="Perjalananmu belum dirangkai" description="Tambahkan suara ke antrean, lalu simpan sebagai playlist untuk diputar kapan saja." action="Jelajahi koleksi" onAction={() => changeView('library')} />}</div> : sounds.length ? <div className="sound-grid">{sounds.map(sound => <SoundCard key={sound.id} sound={sound} onEdit={item => { if (!audioEditor) { dispatch(actions.noticeShown('Editor audio belum tersedia. Muat ulang aplikasi.')); return; } if (state.status === 'playing') dispatch(actions.playbackToggled()); setEditingSound(item); }} onDelete={item => { setPendingDelete(item); openModal('delete'); }} />)}</div> : <EmptyState icon={state.view === 'favorites' ? 'heart' : 'audio'} title={state.search ? 'Suara belum ditemukan' : state.view === 'favorites' ? 'Simpan suara yang kamu suka' : state.view === 'uploads' ? 'Beri sentuhan suaramu sendiri' : 'Belum ada audio di kategori ini'} description={state.search ? 'Coba kata kunci lain atau pilih kategori Semua Suara.' : state.view === 'favorites' ? 'Ketuk ikon hati pada audio untuk mengumpulkannya di sini.' : 'Unggah rekaman pengumuman, musik, atau suara favorit dari perangkatmu.'} action={state.search ? 'Reset pencarian' : state.view === 'uploads' ? 'Unggah Audio' : 'Jelajahi koleksi'} onAction={() => { if (state.search) { dispatch(actions.searchChanged('')); dispatch(actions.categoryChanged('all')); } else if (state.view === 'uploads') openModal('upload'); else changeView('library'); }} />}
          <div className="library-bottom-note"><Info size={14} /><p>Audio bawaan adalah simulasi orisinal. Tambahkan rekamanmu untuk suasana yang lebih personal.</p></div>
        </section>

        <QueuePanel onAddFromCollection={() => { changeView('library'); requestAnimationFrame(() => searchRef.current?.focus()); }} onSavePlaylist={() => openModal('playlist')} />
        </div>
        <section className="create-banner"><span className="create-banner-icon"><Mic2 size={25} /></span><div><span>SUARAMU, CERITAMU</span><h3>Jadi pengisi suara perjalananmu sendiri.</h3><p>Buat pengumuman stasiun atau tambahkan rekaman pribadimu.</p></div><button className="button secondary" onClick={() => openModal('announcement')}>Buat Pengumuman <ArrowUpRight size={16} /></button></section>
        </>}
        <footer className="page-footer"><span>© {new Date().getFullYear()} KAIsound. Dibuat untuk pencinta perjalanan.</span><span><span className="little-dot" /> Proyek independen, terinspirasi suasana KAI</span></footer>
      </main>
    </div>

    <Player />
    {editingSound && audioEditor && <AudioTrimDialog key={editingSound.id} sound={editingSound} editor={audioEditor} onClose={() => setEditingSound(null)} onSaved={() => { setEditingSound(null); changeView('uploads'); }} />}

    {state.notice && <div className="toast" role="status"><Check size={17} /><span>{state.notice}</span><button aria-label="Tutup notifikasi" className="icon-button" onClick={() => dispatch(actions.noticeShown(null))}><X size={16} /></button></div>}
    <dialog ref={modalRef} className="modal" aria-label={modal === 'upload' ? 'Unggah audio' : modal === 'announcement' ? 'Buat pengumuman' : modal === 'playlist' ? 'Simpan playlist' : modal === 'delete' ? 'Hapus audio' : 'Tentang KAIsound'} onCancel={event => { if (busy) event.preventDefault(); else setModal(null); }} onClick={event => { if (event.target === event.currentTarget && !busy) setModal(null); }}><div className="modal-top"><span className="modal-icon">{modal === 'upload' ? <Upload /> : modal === 'playlist' ? <ListMusic /> : modal === 'announcement' ? <Mic2 /> : modal === 'delete' ? <Trash2 /> : <Headphones />}</span><button className="icon-button" aria-label="Tutup dialog" disabled={busy} onClick={() => setModal(null)}><X size={21} /></button></div>
      {modal === 'upload' && <><h2>Tambahkan file MP3-mu.</h2><p>Unggah musik, bel, atau rekaman pengumuman. Audio akan masuk ke Audio Saya dan bisa langsung diputar atau ditambahkan ke antrean.</p><button className={`dropzone ${dragging ? 'dragging' : ''}`} disabled={busy} onClick={() => fileRef.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void uploadFile(event.dataTransfer.files[0]); }}>{busy ? <LoaderCircle className="spin" size={32} /> : <Upload size={32} />}<strong>{busy ? 'Menyimpan audio...' : 'Pilih atau tarik file MP3 ke sini'}</strong><span>MP3, WAV, OGG, M4A · Maksimal 25 MB</span></button><input className="visually-hidden" ref={fileRef} type="file" accept=".mp3,.wav,.ogg,.m4a,audio/*" aria-label="Pilih file audio" onChange={event => void uploadFile(event.target.files?.[0])} /><div className="modal-note"><ShieldCheck size={17} /> {storageDescription}</div></>}
      {modal === 'announcement' && <form onSubmit={event => void saveAnnouncement(event)}><h2>Suara untuk perjalananmu.</h2><p>Tulis pengumuman dan dengarkan melalui suara Bahasa Indonesia yang tersedia di browsermu.</p><label className="form-label">Judul pengumuman<input required maxLength={70} value={announcementName} onChange={event => setAnnouncementName(event.target.value)} /></label><label className="form-label">Teks pengumuman<textarea required minLength={10} maxLength={1200} rows={6} value={announcementText} onChange={event => setAnnouncementText(event.target.value)} /></label><div className="text-counter">{announcementText.length}/1.200 karakter</div><p className="form-hint">Kualitas dan bahasa suara mengikuti dukungan perangkat. Untuk suara yang konsisten, unggah rekaman audio.</p><button className="button primary modal-submit" disabled={busy || !announcementName.trim() || announcementText.trim().length < 10}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Simpan Pengumuman</button></form>}
      {modal === 'playlist' && <form onSubmit={savePlaylist}><h2>Simpan cerita perjalananmu.</h2><p>{queueSounds.length} audio dalam antrean akan disimpan sebagai satu playlist di perangkat ini.</p><label className="form-label">Nama playlist<input autoFocus required maxLength={60} placeholder="Misalnya: Sore di Stasiun Tugu" value={playlistName} onChange={event => setPlaylistName(event.target.value)} /></label><button disabled={!playlistName.trim() || !queueSounds.length} className="button primary modal-submit"><Plus size={16} /> Simpan Playlist</button></form>}
      {modal === 'delete' && <><h2>Hapus audio ini?</h2><p>“{pendingDelete?.title}” akan dihapus {serverStorage ? 'dari server dan koleksi bersama' : 'dari koleksi di perangkat ini'}.</p><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setModal(null)}>Batal</button><button className="button danger" disabled={busy} onClick={() => void deleteSound()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />} Hapus Audio</button></div></>}
      {modal === 'help' && <><h2>Selamat datang di ruang dengar.</h2><p>KAIsound menghadirkan suasana perjalanan melalui suara. Mulai dengan tiga langkah sederhana.</p><ol className="help-steps"><li><span>01</span><div><strong>Temukan suara favoritmu</strong><p>Pilih kategori, gunakan pencarian, dan tekan putar pada kartu audio.</p></div></li><li><span>02</span><div><strong>Rangkai suasana di antrean</strong><p>Ketuk +, atur urutan dengan panah, lalu pilih Putar Semua.</p></div></li><li><span>03</span><div><strong>Buat lebih personal</strong><p>Unggah audio atau buat pengumuman. Simpan antreanmu sebagai playlist.</p></div></li></ol><div className="keyboard-help"><kbd>Spasi</kbd> Putar / jeda <kbd>/</kbd> Cari audio</div><div className="about-note">KAIsound adalah proyek independen yang terinspirasi suasana stasiun KAI. Audio bawaan berupa simulasi orisinal, bukan rekaman resmi. {serverStorage ? 'Audio unggahan disimpan di server dan dapat didengarkan pengunjung lain. Favorit serta playlist tersimpan di browser. Hapus audio hanya tersedia dari browser pengunggah.' : 'Koleksi pribadimu tersimpan di browser dan dapat hilang jika data situs dihapus.'}</div><button className="button primary modal-submit" onClick={() => setModal(null)}>Mulai Menjelajah <ArrowRight size={16} /></button></>}
      {uploadError && <div className="form-error" role="alert">{uploadError}</div>}
    </dialog>
  </div>;
}

function EmptyState({ icon, title, description, action, onAction }: { icon: 'playlist' | 'heart' | 'audio'; title: string; description: string; action: string; onAction: () => void }) {
  const Icon = icon === 'playlist' ? ListMusic : icon === 'heart' ? Heart : Music2;
  return <div className="empty-state"><span><Icon size={30} /></span><h3>{title}</h3><p>{description}</p><button className="button secondary" onClick={onAction}>{action} <ArrowRight size={15} /></button></div>;
}
