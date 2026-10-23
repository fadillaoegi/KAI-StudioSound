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
- Unggah audio maksimal 25 MB. Build Hostinger menyimpan file ke folder project `uploads/` melalui PHP. Mode pengembangan lokal memakai IndexedDB.
- Potong rekaman melalui ikon gunting pada kartu audio: gelombang asli, slider serta input waktu mulai/selesai, pratinjau bagian terpilih, dan simpan sebagai file WAV baru. Audio asli dipertahankan. Editor menerima sumber maksimal 10 menit/25 MB, potongan minimal 0,1 detik, dan hasil WAV PCM16 maksimal 25 MB. Suara pengumuman dari teks tidak bisa dipotong sebelum menjadi file rekaman.
- Pengumuman dari teks menggunakan Speech Synthesis browser; bahasa dan suara mengikuti perangkat. Durasi pengumuman merupakan estimasi dan seek tidak tersedia untuk suara sintetis.
- Pintasan Spasi untuk putar/jeda dan `/` untuk pencarian, navigasi keyboard, dialog modal, serta tata letak responsif.
- Navigasi Studio Audio, Playlist Saya, dan Panduan mengikuti halaman aktif; breadcrumb dan judul tab ikut berubah. URL `#library`, `#favorites`, `#uploads`, `#playlists`, dan `#guide` mendukung akses langsung, refresh, serta Back/Forward browser.
- Panduan memiliki halaman tersendiri dengan akses ke koleksi, favorit, unggahan, dan pembuat pengumuman. Kontrol repeat, sebelumnya, stop, dan volume juga tersedia di tampilan HP.

## Arsitektur

```text
src/
  domain/         Model, kontrak repository/engine, pencarian, aturan antrean
  application/    Redux slice dan async commands; repository diinjeksi ke thunk
  data/           Adapter HTTP/PHP, editor Web Audio/WAV, HTML Audio,
                  Speech Synthesis, metadata, IndexedDB,
                  localStorage, dan katalog bawaan
  presentation/   Komponen React, typed hooks, dan stylesheet responsif
  app/            Composition root: store, dependency injection, audio listeners
```

Domain tidak mengimpor React, Redux, atau adapter data. Application bergantung pada kontrak domain. Presentation mengirim actions/commands; composition root menghubungkan adapter browser dengan state. Objek Audio, Blob, dan koneksi IndexedDB tidak disimpan di Redux; hanya metadata, ID, dan URL sementara yang serializable.

Adapter editor diinjeksi melalui React context. Buffer PCM dan pratinjau berada di dialog editor, di luar Redux. Pemotongan menyalin hanya sampel antara waktu mulai/selesai ke WAV stereo/mono PCM16, lalu hasilnya memakai command unggah dan repository yang sama dengan rekaman biasa.

Favorit, playlist, repeat, dan volume memakai localStorage. Build Hostinger memakai `HttpSoundRepository`, yang mengirim file dan metadata ke `api/sounds.php`. File fisik disimpan di `uploads/<id>.mp3` (atau WAV/OGG/M4A), sedangkan metadata disimpan di `uploads/.library.php`. Metadata dilindungi oleh `.htaccess` dan guard PHP. Tidak membutuhkan database.

Koleksi Suara menampilkan audio bersama. Audio Saya menampilkan unggahan dari browser pengunjung saat ini. Hak hapus memakai cookie acak HttpOnly milik browser pengunggah; pengunjung lain dapat mendengarkan tetapi tidak menghapusnya. Jika cookie dihapus atau perangkat diganti, pengelola perlu menghapus file melalui hosting. Rekaman yang sebelumnya hanya tersimpan di IndexedDB perlu diunggah ulang untuk dipindahkan ke server.

Mode pengembangan biasa (`pnpm dev`) serta build statis biasa (`pnpm build`) tetap memakai IndexedDB. Data lokal ini tidak otomatis diunggah saat berpindah ke build Hostinger. Favorit dan playlist tetap per browser pada kedua mode.

## Audio bawaan

Enam file WAV orisinal dibuat secara prosedural memakai Python standard library. Dua item pengumuman memakai suara browser. File bawaan adalah simulasi, bukan rekaman resmi KAI. Regenerasi audio:

```sh
python3 scripts/generate_audio.py
```

## Hostinger: fldevl.biz.id/KAI-sound/

Aplikasi dapat dihosting di shared hosting dengan PHP 8.1+ dan ekstensi Fileinfo. Build khusus memakai base `/KAI-sound/` untuk JavaScript, CSS, ikon, font, audio, dan API. Navigasi memakai hash sehingga tidak membutuhkan konfigurasi rewrite SPA.

```sh
pnpm package:hostinger
```

Hasil: `releases/KAI-sound-hostinger.zip`, berisi `index.html`, `assets/`, `audio/`, `api/sounds.php`, `uploads/.htaccess`, `.user.ini`, dan ikon langsung di dalam ZIP. Build mentah tersedia di `dist-hostinger/`. ZIP tidak menyertakan data unggahan runtime.

1. Di File Manager Hostinger, buka `public_html` untuk domain `fldevl.biz.id`.
2. Unggah `KAI-sound-hostinger.zip` ke `public_html` menggunakan ikon Upload di kanan atas.
3. Klik kanan file ZIP, pilih Extract, dan isi nama folder hasil ekstrak dengan `KAI-sound`.
4. Pastikan lokasi hasil adalah `public_html/KAI-sound/index.html`, `public_html/KAI-sound/assets/`, dan `public_html/KAI-sound/audio/`.
5. Setelah SSL domain aktif, buka `https://fldevl.biz.id/KAI-sound/`. Nama folder memakai huruf besar/kecil yang sama dengan URL.

Untuk memperbarui instalasi lama, ekstrak isi ZIP ke folder project `KAI-sound` yang sama dan timpa file aplikasinya. Pertahankan isi folder `uploads` yang sudah ada. Backend membuat metadata saat unggahan pertama; paket tidak menimpa metadata atau MP3 pengguna.

Folder `uploads` harus bisa ditulis oleh PHP (biasanya permission 755 dengan pemilik akun hosting yang benar). `.user.ini` mengatur `upload_max_filesize=25M` dan `post_max_size=28M`; jika hosting mengabaikannya, atur nilai tersebut lewat konfigurasi PHP hPanel. Batas koleksi default 500 MB dan 1.000 item dapat disesuaikan pada konstanta di `api/sounds.php`. File diperiksa melalui MIME server, nama file diganti dengan ID acak, dan penghapusan memerlukan cookie pengunggah.

Preview build ini di perangkat pengembang:

```sh
pnpm preview:hostinger
```

Buka URL `/KAI-sound/` pada port yang ditampilkan Vite untuk memeriksa tampilan. Preview Vite tidak mengeksekusi PHP; untuk menguji unggahan, gunakan PHP/Apache atau instalasi Hostinger. Hosting tidak membutuhkan proses Node.js yang berjalan di server. Pengunjung akan melihat unggahan baru setelah memuat ulang halaman atau kembali ke tab.

Font DM Sans dan ikon Lucide dibundel lokal; aplikasi tidak membutuhkan CDN untuk tampilan atau audio bawaan. Putar audio harus dimulai melalui interaksi pengguna sesuai kebijakan browser.

## Verifikasi

`pnpm build` menjalankan pengecekan TypeScript strict dan build produksi. `pnpm test` memeriksa aturan pencarian/antrean, repeat, pengelolaan referensi playlist, serta alur penyimpanan audio. Pengujian DOM menggunakan happy-dom tidak menggantikan pemeriksaan visual atau uji suara di browser nyata.

`scripts/test_upload_api.py` menguji API PHP di lingkungan uji terpisah: unggah MP3 ke disk, baca ulang byte audio, koleksi antarbrowser, hak hapus, validasi MIME/ekstensi, batas ukuran, proteksi metadata, pengumuman, serta konsistensi unggahan bersamaan. Skrip ini memerlukan server uji kosong dan fixture MP3; jangan jalankan pada koleksi produksi.
