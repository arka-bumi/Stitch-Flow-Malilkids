# PRD - Aplikasi Formulir Input Pekerjaan Penjahit (v2)

## Tujuan
Digitalisasi pencatatan aktivitas penjahit di pabrik pakaian, memisahkan aktivitas utama (produksi) dan aktivitas lain (non-produksi), dengan validasi coverage shift & sinkronisasi 2 arah ke Google Sheets.

## Peran
- **Penjahit**: login Nama+PIN (dibuat admin), input pekerjaan, edit unsynced, lihat riwayat.
- **Admin**: login username/password, kelola penjahit & admin, konfigurasi & sync Google Sheet, lihat rekap.

## Fitur Utama
### Autentikasi & Manajemen User
- Login Penjahit (Nama + PIN 4-6 digit)
- Login Admin (username + password); default seed admin/admin123
- Admin bisa CRUD penjahit (create, active/inactive, reset PIN, delete)
- Admin bisa CRUD admin lain (create, delete — tidak bisa hapus diri sendiri atau admin terakhir)

### Master Data & Cascading Dropdown
- Master data (Kode Produksi, Jenis Produk, Motif, Size, Tahapan Standar) di-**pull dari Google Sheet** (dua tab: `Kode Produksi` dan `Tahapan Standar`) via tombol Admin "Sync Master"
- Kode Produksi dropdown auto-fill Jenis Produk/Motif/Size
- Tahapan (Aktivitas Utama) dropdown ter-filter berdasarkan Jenis Produk

### Workflow Input Pekerjaan
- Satu tombol utama: "Input Pekerjaan Reguler" (label berubah otomatis jadi "Khusus" kalau mode khusus aktif)
- Tombol "Tambah Inputan Khusus (Pre-Shift)" di atas
- Tombol "Tambah Lembur Malam (Post-Shift)" di bawah
- Tombol "Istirahat" — max 1x/hari, otomatis 1 jam dari end_time terakhir
- Multi-subtasking: 1 Aktivitas Utama bisa punya N Aktivitas Lain (list dinamis)
- Waktu Aktivitas Lain wajib berada dalam range Aktivitas Utama
- Collapsed cards untuk record, tap untuk expand + tombol Edit/Hapus (hanya jika belum sync)

### Validasi
- Overlap waktu antar record → ditolak backend
- Gap antara record berturut-turut → warning non-blocking modal + border kuning di card
- Shift target (Senin-Jumat 08:15-17:15, Sabtu 08:00-15:00) → non-blocking, tampil di Inspection

### Inspection
- Tombol "Selesaikan Input Reguler/Khusus Hari Ini" menampilkan modal audit:
  - Coverage awal shift ✓/✗
  - Coverage akhir shift ✓/✗
  - Tidak ada gap ✓/✗
  - Istirahat 1x sudah ada ✓/✗ (kecuali shift pendek Sabtu)

### Google Sheet Sync
- 2 arah:
  - **IN**: Master data dari tab `Kode Produksi` & `Tahapan Standar`
  - **OUT**: Records auto-append ke sheet utama saat admin klik "Sync Records"
- **Row duplication**: 1 record dengan N Aktivitas Lain → di-export N baris dengan Aktivitas Utama duplikat (sesuai screenshot user)
- Record ter-tandai `is_synced` → penjahit tidak bisa edit lagi
- **Auto-purge**: record ter-sync yang usianya > 12 jam otomatis dihapus dari DB (app tetap ringan)

## Kolom Google Sheet
Nama · Kode Produksi · Tanggal · Tim · Jenis Produk · Motif · Size · Aktivitas Utama · Jumlah Per Batch · Jumlah Per Aktivitas · Waktu Mulai · Waktu Selesai · Aktivitas Lain · Waktu Mulai Lain · Waktu Selesai Lain

## Data (MongoDB)
- `users` (penjahit + admin, dengan flag active)
- `records` (aktivitas per baris, dengan aktivitas_lain_list[], is_synced, synced_at, mode)
- `kode_produksi` (dari GSheet), `tahapan_standar` (dari GSheet)
- `master_data` (aktivitas_lain, tim)
- `sheet_config` (kredensial Google + tab names)
