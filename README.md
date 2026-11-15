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

1. Jalankan berurutan di SQL Editor (salin **seluruh isi** tiap file, bukan namanya): `supabase/migrations/0001_akun_keluarga.sql`, `0002_tantangan_bukti.sql`, `0003_isi_tantangan.sql`, `0004_admin.sql`, `0005_perasaan_catatan_masa_depan.sql`, `0006_pwa_pengingat.sql`, `0007_konten_admin.sql`, `0008_drive_admin_pusat.sql`, `0009_tantangan_segmen_anak.sql`, `0010_fitur_tantangan_layanan.sql`, `0011_admin_fitur_pengguna.sql`.
2. Admin platform yang menjadi anggota rumah dapat memakai fitur anggota sesuai peran dan hak yang sama. Akses catatan, check-in, dan data keluarga tetap dibatasi ke rumah tersebut; catatan pribadi anak tidak dibagikan.
3. Migrasi `0007_konten_admin.sql` menambahkan pengelolaan tantangan, kartu obrolan, dan pertanyaan diskusi Materi GenRe. Tombol hapus mengarsipkan konten agar progres lama tetap ada. Kategori dan poin tantangan terkunci setelah bukti tercatat.
4. Authentication > Providers > Email: aktifkan **Confirm email** dan set panjang kata sandi minimal 8.
5. Authentication > Providers > Google: isi Client ID dan Secret dari Google Cloud.
6. Authentication > URL Configuration: Site URL = alamat situs, Redirect URLs = `<alamat situs>/auth/callback`.
7. Authentication > Rate Limits: atur batas percobaan masuk dan pengiriman email. Batas percobaan login ditegakkan di sini, bukan di kode aplikasi.
8. Menjadikan seseorang admin platform (hanya lewat SQL, tidak ada jalur dari aplikasi):

```sql
insert into platform_admins (user_id) values ('<uuid dari auth.users>');
```

## Foto bukti ke Google Drive admin

Admin platform menghubungkan satu akun Google dari menu **Admin > Google Drive**. Anggota keluarga memilih foto dari ponsel dan tidak perlu menghubungkan akun Google. Aplikasi mengompres foto di perangkat hingga maksimal 2 MB; database hanya menyimpan ID Drive dan data bukti, bukan isi foto.

Di Google Cloud, aktifkan Google Drive API, siapkan layar persetujuan OAuth, lalu buat OAuth Client ID jenis **Web application**. Tambahkan redirect URI aplikasi `<alamat situs>/api/drive/callback`, misalnya `https://rumah-mapan.vercel.app/api/drive/callback`. Jika memakai client ID yang sama untuk Google sign-in Supabase, tambahkan juga redirect URI Supabase `<URL proyek Supabase>/auth/v1/callback`. Scope Drive yang digunakan aplikasi adalah `drive.file`.

Isi environment server berikut di `.env.local` untuk lokal dan di Vercel untuk produksi:

```
GOOGLE_CLIENT_ID=            # OAuth client (Web)
GOOGLE_CLIENT_SECRET=
DRIVE_ENC_KEY=               # 32 byte acak dalam base64: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
SUPABASE_SERVICE_ROLE_KEY=   # hanya di server, jangan pernah diberi awalan NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL=https://rumah-mapan.vercel.app
```

Setelah deploy dan migrasi selesai, masuk sebagai admin platform dan hubungkan Google Drive di **Admin > Google Drive**. Aplikasi membuat folder `Rumah Mapan - Foto Bukti`; foto baru akan tampil di **Admin > Bukti**. Foto lama yang tersimpan di Drive keluarga tetap dibaca dari koneksi lama.

## PWA dan pengingat tantangan

- Manifest dan service worker membuat aplikasi bisa dipasang. Setelah service worker terpasang, aplikasi menyimpan materi dan pertanyaan aktif dari Supabase untuk dibaca luring. Cache diperbarui saat perangkat kembali daring. Catatan, progres, dan data keluarga tetap memerlukan internet.
- Untuk mengaktifkan push, jalankan migrasi `0006_pwa_pengingat.sql`, lalu buat pasangan kunci dengan `npx web-push generate-vapid-keys`. Isi `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` (alamat surel operator berawalan `mailto:`), `CRON_SECRET` acak, dan `SUPABASE_SERVICE_ROLE_KEY` di environment server. Jangan bagikan kunci privat atau service role.
- Jadwalkan `GET /api/cron/pengingat` setiap menit dengan header `Authorization: Bearer <CRON_SECRET>` untuk mengirim notifikasi pada waktu pilihan tiap perangkat. Endpoint memakai window lima menit dan klaim baris agar panggilan jadwal tidak mengirim notifikasi ganda. Vercel Hobby hanya mengizinkan Cron sekali sehari; jadwal per menit perlu Vercel Pro atau scheduler eksternal.
- Migrasi `0010_fitur_tantangan_layanan.sql` menambahkan sasaran keluarga, pin dan tenggat tantangan, lencana poin kustom, antrean push untuk tantangan baru/pin/tenggat, serta layanan pengguna. Pengingat tenggat dijadwalkan sehari sebelumnya pukul 09.00 WIB. Pengaduan kesehatan mental hanya dapat dibaca pengirim dan akun psikolog yang ditetapkan pada `layanan_konselor`; penetapan akun konselor/psikolog dilakukan melalui service role.
- Pengguna harus mengaktifkan push di Akun agar menerima notifikasi tantangan baru, tenggat, dan pin. Pengiriman mengikuti scheduler yang sama dengan pengingat harian.
- Atur `PENGINGAT_SCHEDULED=true` hanya setelah scheduler aktif. Sampai semua environment dan scheduler tersedia, pengingat push tidak aktif. Pengguna tetap dapat memasang aplikasi dan membaca materi serta kartu obrolan luring.

## Uji

```bash
npm run test:rls                      # SQL dan RLS di Postgres lokal
node tests/e2e-keluarga.mjs           # butuh server lokal + Supabase + Confirm email dimatikan sementara
node tests/e2e-tantangan.mjs
node tests/e2e-admin.mjs              # butuh akun admin tetap pengelola.uji@example.com (peran admin lewat SQL)
node tests/bersihkan.mjs <email> ...  # hapus akun uji yang tertinggal
```
