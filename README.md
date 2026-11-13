# Rumah Mapan

Rumah mempersiapkan masa yang akan datang.

Next.js (App Router) + TypeScript + Tailwind + Supabase. Status: langkah 7 (PWA). Google OAuth/Drive dan jadwal push produksi perlu dikonfigurasi.

## Menjalankan

```bash
cp .env.example .env.local   # isi URL dan kunci anon dari proyek Supabase
npm install
npm run dev
npm run test:rls             # uji migrasi dan RLS di Postgres lokal (pglite), tanpa Supabase
```

## Menyiapkan Supabase

1. Jalankan berurutan di SQL Editor (salin **seluruh isi** tiap file, bukan namanya): `supabase/migrations/0001_akun_keluarga.sql`, `0002_tantangan_bukti.sql`, `0003_isi_tantangan.sql`, `0004_admin.sql`, `0005_perasaan_catatan_masa_depan.sql`, `0006_pwa_pengingat.sql`, `0007_konten_admin.sql`.
2. Migrasi `0007_konten_admin.sql` menambahkan pengelolaan tantangan, kartu obrolan, dan pertanyaan diskusi Materi GenRe. Tombol hapus mengarsipkan konten agar progres lama tetap ada. Kategori dan poin tantangan terkunci setelah bukti tercatat.
3. Authentication > Providers > Email: aktifkan **Confirm email** dan set panjang kata sandi minimal 8.
4. Authentication > Providers > Google: isi Client ID dan Secret dari Google Cloud.
5. Authentication > URL Configuration: Site URL = alamat situs, Redirect URLs = `<alamat situs>/auth/callback`.
6. Authentication > Rate Limits: atur batas percobaan masuk dan pengiriman email. Batas percobaan login ditegakkan di sini, bukan di kode aplikasi.
7. Menjadikan seseorang admin platform (hanya lewat SQL, tidak ada jalur dari aplikasi):

```sql
insert into platform_admins (user_id) values ('<uuid dari auth.users>');
```

## Foto bukti ke Google Drive (opsional sampai dikonfigurasi)

Tanpa variabel di bawah, bukti tetap bisa dikirim sebagai cerita tertulis dan tombol Drive memberi tahu bahwa penghubung belum dikonfigurasi.

```
GOOGLE_CLIENT_ID=            # OAuth client (Web). Redirect URI: <alamat situs>/api/drive/callback
GOOGLE_CLIENT_SECRET=
DRIVE_ENC_KEY=               # 32 byte acak dalam base64: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
SUPABASE_SERVICE_ROLE_KEY=   # hanya di server, jangan pernah diberi awalan NEXT_PUBLIC_
```

Scope yang dipakai hanya `drive.file`. Aktifkan Google Drive API di Google Cloud dan tambahkan scope itu di layar persetujuan OAuth.

## PWA dan pengingat tantangan

- Manifest dan service worker membuat aplikasi bisa dipasang. Setelah service worker terpasang, aplikasi menyimpan materi dan pertanyaan aktif dari Supabase untuk dibaca luring. Cache diperbarui saat perangkat kembali daring. Catatan, progres, dan data keluarga tetap memerlukan internet.
- Untuk mengaktifkan push, jalankan migrasi `0006_pwa_pengingat.sql`, lalu buat pasangan kunci dengan `npx web-push generate-vapid-keys`. Isi `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` (alamat surel operator berawalan `mailto:`), `CRON_SECRET` acak, dan `SUPABASE_SERVICE_ROLE_KEY` di environment server. Jangan bagikan kunci privat atau service role.
- Jadwalkan `GET /api/cron/pengingat` setiap menit dengan header `Authorization: Bearer <CRON_SECRET>` untuk mengirim notifikasi pada waktu pilihan tiap perangkat. Endpoint memakai window lima menit dan klaim baris agar panggilan jadwal tidak mengirim notifikasi ganda. Vercel Hobby hanya mengizinkan Cron sekali sehari; jadwal per menit perlu Vercel Pro atau scheduler eksternal.
- Atur `PENGINGAT_SCHEDULED=true` hanya setelah scheduler aktif. Sampai semua environment dan scheduler tersedia, pengingat push tidak aktif. Pengguna tetap dapat memasang aplikasi dan membaca materi serta kartu obrolan luring.

## Uji

```bash
npm run test:rls                      # SQL dan RLS di Postgres lokal
node tests/e2e-keluarga.mjs           # butuh server lokal + Supabase + Confirm email dimatikan sementara
node tests/e2e-tantangan.mjs
node tests/e2e-admin.mjs              # butuh akun admin tetap pengelola.uji@example.com (peran admin lewat SQL)
node tests/bersihkan.mjs <email> ...  # hapus akun uji yang tertinggal
```
