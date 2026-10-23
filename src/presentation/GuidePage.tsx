import { ArrowRight, Headphones, Heart, Keyboard, Library, ListMusic, Mic2, Play, Upload } from 'lucide-react';
import type { View } from '../domain/models';
import { serverStorage } from './storage';

interface GuidePageProps {
  onNavigate: (view: View) => void;
  onUpload: () => void;
  onAnnouncement: () => void;
}

export function GuidePage({ onNavigate, onUpload, onAnnouncement }: GuidePageProps) {
  return <section className="guide-page" aria-labelledby="guide-title">
    <div className="section-heading"><div>
      <span className="eyebrow">KENALI RUANG DENGARMU</span>
      <h1 id="guide-title">Panduan Penggunaan<span className="heading-dot">.</span></h1>
      <p>Semua yang kamu perlukan untuk merangkai suasana stasiun sendiri.</p>
    </div><Headphones size={30} /></div>
    <div className="guide-intro"><span><Play size={24} /></span><div><h2>Mulai dari suara yang kamu suka.</h2><p>Pilih audio, atur urutannya, lalu nikmati perjalanan. Pemutar tetap berjalan saat kamu berpindah halaman.</p></div><button className="button primary" onClick={() => onNavigate('library')}>Buka Studio <ArrowRight size={16} /></button></div>
    <div className="guide-grid">
      <article><Library size={23} /><span>01 · JELAJAHI</span><h2>Temukan dan putar audio</h2><p>Gunakan pencarian atau kategori Bel Stasiun, Musik, Suasana, dan Pengumuman. Klik tombol putar untuk mendengarkan. Klik lagi untuk jeda, lalu lanjutkan dari posisi yang sama. Ikon gunting membuka editor: pilih waktu mulai/selesai, dengarkan pratinjau, lalu simpan potongan sebagai WAV baru di Audio Saya. File asli tetap tersedia.</p><button onClick={() => onNavigate('library')}>Jelajahi koleksi <ArrowRight size={14} /></button></article>
      <article><ListMusic size={23} /><span>02 · RANGKAI</span><h2>Susun antrean dan playlist</h2><p>Klik + pada kartu audio. Gunakan panah naik dan turun untuk mengatur urutan, lalu pilih Putar Semua. Aktifkan ulangi antrean bila diperlukan dan simpan rangkaianmu sebagai playlist.</p><button onClick={() => onNavigate('playlists')}>Lihat playlist saya <ArrowRight size={14} /></button></article>
      <article><Heart size={23} /><span>03 · SIMPAN</span><h2>Kumpulkan suara favorit</h2><p>Klik ikon hati untuk menyimpan audio ke Favorit Saya. Klik hati yang sudah terisi untuk menghapusnya dari favorit. Pilihanmu akan tersimpan di browser perangkat ini.</p><button onClick={() => onNavigate('favorites')}>Buka favorit saya <ArrowRight size={14} /></button></article>
      <article><Upload size={23} /><span>04 · TAMBAHKAN</span><h2>Unggah rekaman pribadi</h2><p>Pilih atau tarik file MP3, WAV, OGG, atau M4A maksimal 25 MB. {serverStorage ? 'File disimpan di server, tersedia di Audio Saya, dan dapat didengarkan pengunjung lain melalui Koleksi Suara. Hanya browser pengunggah yang dapat menghapusnya.' : 'Setelah tersimpan, rekaman tersedia di Audio Saya dan bisa diputar, ditambahkan ke antrean, atau dihapus.'}</p><button onClick={onUpload}>Unggah audio <ArrowRight size={14} /></button></article>
      <article><Mic2 size={23} /><span>05 · KREASIKAN</span><h2>Buat pengumuman dari teks</h2><p>Tulis judul dan isi pengumuman, lalu simpan. Pengumuman masuk ke Audio Saya. Suara dan Bahasa Indonesia mengikuti dukungan perangkat; unggah rekaman untuk hasil yang konsisten.</p><button onClick={onAnnouncement}>Buat pengumuman <ArrowRight size={14} /></button></article>
      <article><Keyboard size={23} /><span>06 · KENDALIKAN</span><h2>Atur pemutaran dengan mudah</h2><p>Gunakan pemutar bawah untuk jeda, lanjutkan, pindah audio, hentikan, atau atur volume. Geser posisi putar untuk rekaman. Pengumuman dari teks memakai estimasi durasi dan tidak mendukung seek.</p><div className="keyboard-help"><kbd>Spasi</kbd> Putar / jeda <kbd>/</kbd> Cari audio</div></article>
    </div>
    <div className="guide-storage"><Headphones size={20} /><div><h2>Tentang koleksi dan penyimpanan</h2><p>Audio bawaan adalah simulasi orisinal. {serverStorage ? 'Rekaman dan pengumuman tersimpan di server serta dapat didengarkan oleh pengunjung lain. Favorit dan playlist tersimpan di browser masing-masing. Hak hapus mengikuti cookie browser pengunggah.' : 'Rekaman, pengumuman, favorit, dan playlist tersimpan di browser perangkat ini. Data belum tersinkron antarperangkat dan dapat hilang jika data situs dihapus.'} KAIsound merupakan proyek independen yang terinspirasi suasana KAI.</p></div></div>
  </section>;
}
