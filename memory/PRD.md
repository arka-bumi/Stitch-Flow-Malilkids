# PRD - Aplikasi Formulir Input Pekerjaan Penjahit

## Tujuan
Menggantikan Google Spreadsheet manual dengan aplikasi mobile agar penjahit di pabrik pakaian dapat mencatat aktivitas produksi (utama & lain) secara digital, dengan sinkronisasi otomatis ke Google Sheets untuk analisa performa.

## Peran
- **Penjahit**: login Nama + PIN, input aktivitas utama & lain, lihat riwayat pribadi
- **Admin**: login username/password, lihat rekap semua penjahit, filter tanggal/tim, sync manual, konfigurasi Google Sheet

## Fitur Utama
1. **Auth**: JWT-based; register/login penjahit (Nama + PIN 4-6 digit), admin (username/password default: admin/admin123)
2. **Form Aktivitas Utama**: kode produksi, tanggal, jenis produk, motif, aktivitas utama, jumlah batch, jumlah selesai, waktu mulai/selesai — plus opsional Aktivitas Lain berbarengan dalam satu baris (untuk kasus toilet di tengah menjahit)
3. **Form Aktivitas Lain Saja**: baris terpisah untuk aktivitas non-produksi
4. **Master Data**: dropdown Tim, Jenis Produk, Motif, Aktivitas Utama, Aktivitas Lain — dengan opsi "Tambah Opsi Baru"
5. **Dashboard Admin**: statistik total, per-penjahit metrics, filter tanggal & tim, list semua entri
6. **Google Sheets Sync**: service-account based; auto-sync setiap entri baru + tombol manual sync

## Data (MongoDB)
- `users` (penjahit + admin), `entries` (per baris aktivitas), `master_data` (opsi dropdown), `sheet_config` (kredensial Google)

## Kolom Google Sheet (mengikuti template user)
Nama · Kode Produksi · Tanggal · Tim · Jenis Produk · Motif · Aktivitas Utama · Jumlah Per Batch · Jumlah Per Aktivitas · Waktu Mulai · Waktu Selesai · Aktivitas Lain · Waktu Mulai Lain · Waktu Selesai Lain

## Business Enhancement
Auto-computed productivity metrics per penjahit (menit produktif, menit non-produktif, output) — memudahkan penilaian performa & payroll piece-rate.
