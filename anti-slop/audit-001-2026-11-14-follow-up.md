# Tindak lanjut Audit antislop 001

Tanggal: 2026-11-14

## Status temuan

1. **HIGH, segmentasi tantangan berdasarkan umur belum tersedia (R-38): selesai.** Tanggal lahir menentukan segmen berdasarkan umur pada tanggal Jakarta saat ini. Tantangan dan bukti ditautkan per anak. Umur di luar 10-24 tetap mendapat tantangan umum.

## Verifikasi

- `npm run test:rls`: lulus, 54/54 tes.
- `npm run lint`: lulus.
- `npx tsc --noEmit`: lulus.
- `npm run build`: lulus.
- `node tests/e2e-tantangan.mjs`: lulus terhadap Supabase test, 18 pemeriksaan PASS, tanpa galat konsol.
- E2E pada lebar 390 px memverifikasi tanggal lahir 2016-05-01 masuk BERANI, menampilkan "Peta kebiasaan belajar", dan tidak menampilkan "Rencana satu minggu".
- E2E juga memverifikasi pemilihan situasi per anak, pengiriman dan penilaian bukti, poin, lencana, serta penghapusan data uji.
- Migrasi 0009 diterapkan pada proyek test oleh pemilik proyek. Akun dan rumah E2E sudah dihapus. Produksi tidak diubah.

Konten tantangan segmen dalam migrasi merupakan draf awal dan perlu ditinjau sebelum digunakan secara luas.
