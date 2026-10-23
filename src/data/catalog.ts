import type { Sound } from '../domain/models';

export const catalog: Sound[] = [
  { id: 'station-bell', title: 'Bel Stasiun Klasik', subtitle: 'Nada pembuka penuh kenangan', category: 'bel', duration: 9, color: 'orange', src: '/audio/station-bell.wav' },
  { id: 'departure', title: 'Melodi Keberangkatan', subtitle: 'Awal dari sebuah perjalanan', category: 'musik', duration: 18, color: 'blue', src: '/audio/departure.wav' },
  { id: 'platform', title: 'Senja di Peron', subtitle: 'Sejenak menikmati suasana', category: 'ambience', duration: 24, color: 'green', src: '/audio/platform.wav' },
  { id: 'arrival-bell', title: 'Bel Kedatangan', subtitle: 'Sambutan untuk yang kembali', category: 'bel', duration: 8, color: 'purple', src: '/audio/arrival-bell.wav' },
  { id: 'journey', title: 'Cerita Perjalanan', subtitle: 'Melodi untuk teman menunggu', category: 'musik', duration: 22, color: 'sand', src: '/audio/journey.wav' },
  { id: 'rail', title: 'Ritme di Atas Rel', subtitle: 'Irama roda menuju tujuan', category: 'ambience', duration: 24, color: 'rose', src: '/audio/rail.wav' },
  { id: 'boarding', title: 'Panggilan Keberangkatan', subtitle: 'Pengumuman · Suara browser', category: 'pengumuman', duration: 14, color: 'blue', text: 'Perhatian kepada para penumpang. Kereta api tujuan Yogyakarta akan segera diberangkatkan dari jalur tiga. Para penumpang dipersilakan naik ke kereta. Terima kasih.' },
  { id: 'welcome', title: 'Selamat Datang', subtitle: 'Pengumuman · Suara browser', category: 'pengumuman', duration: 11, color: 'green', text: 'Selamat datang di stasiun. Utamakan keselamatan dan pastikan barang bawaan Anda tidak tertinggal. Selamat menikmati perjalanan Anda.' },
];
