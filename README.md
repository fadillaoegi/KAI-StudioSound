# KAIsound

Studio audio suasana stasiun dengan tema putih, biru navy, dan oranye yang terinspirasi KAI. React, TypeScript, Vite, dan Redux Toolkit. Proyek independen, bukan layanan resmi PT KAI.

## Menjalankan

Node.js 22.12+ atau 24 dan pnpm 11.

```sh
pnpm install
pnpm dev
```

```sh
pnpm test
pnpm build
pnpm preview
```

## Fitur

- Koleksi audio, pencarian, kategori, dan favorit.
- Putar, jeda, hentikan, sebelumnya/berikutnya, volume, mute, dan seek untuk rekaman.
- Antrean dengan pengaturan urutan, putar berurutan otomatis, dan repeat antrean.
- Playlist tersimpan di perangkat.
- Unggah audio maksimal 25 MB; metadata dan file disimpan melalui IndexedDB.
- Pengumuman dari teks menggunakan Speech Synthesis browser; bahasa dan suara mengikuti perangkat. Durasi pengumuman merupakan estimasi dan seek tidak tersedia untuk suara sintetis.
- Pintasan Spasi untuk putar/jeda dan `/` untuk pencarian, navigasi keyboard, dialog modal, serta tata letak responsif.
- Navigasi Studio Audio, Playlist Saya, dan Panduan mengikuti halaman aktif; breadcrumb dan judul tab ikut berubah. URL `#library`, `#favorites`, `#uploads`, `#playlists`, dan `#guide` mendukung akses langsung, refresh, serta Back/Forward browser.
- Panduan memiliki halaman tersendiri dengan akses ke koleksi, favorit, unggahan, dan pembuat pengumuman. Kontrol repeat, sebelumnya, stop, dan volume juga tersedia di tampilan HP.

## Arsitektur

```text
src/
  domain/         Model, kontrak repository/engine, pencarian, aturan antrean
  application/    Redux slice dan async commands; repository diinjeksi ke thunk
  data/           Adapter HTML Audio, Speech Synthesis, metadata, IndexedDB,
                  localStorage, dan katalog bawaan
  presentation/   Komponen React, typed hooks, dan stylesheet responsif
  app/            Composition root: store, dependency injection, audio listeners
```

Domain tidak mengimpor React, Redux, atau adapter data. Application bergantung pada kontrak domain. Presentation mengirim actions/commands; composition root menghubungkan adapter browser dengan state. Objek Audio, Blob, dan koneksi IndexedDB tidak disimpan di Redux; hanya metadata, ID, dan URL sementara yang serializable.

Favorit, playlist, repeat, dan volume memakai localStorage. File audio serta teks pengumuman memakai IndexedDB. File tetap di perangkat; tidak ada backend atau unggahan ke server. Data dapat hilang jika penyimpanan situs dihapus. Playlist/favorit tidak tersinkron antarperangkat.

## Audio bawaan

Enam file WAV orisinal dibuat secara prosedural memakai Python standard library. Dua item pengumuman memakai suara browser. File bawaan adalah simulasi, bukan rekaman resmi KAI. Regenerasi audio:

```sh
python3 scripts/generate_audio.py
```

Font DM Sans dan ikon Lucide dibundel lokal; aplikasi tidak membutuhkan CDN untuk tampilan atau audio bawaan. Putar audio harus dimulai melalui interaksi pengguna sesuai kebijakan browser.

## Verifikasi

`pnpm build` menjalankan pengecekan TypeScript strict dan build produksi. `pnpm test` memeriksa aturan pencarian/antrean, repeat, pengelolaan referensi playlist, serta alur penyimpanan audio. Pengujian DOM menggunakan happy-dom tidak menggantikan pemeriksaan visual atau uji suara di browser nyata.
