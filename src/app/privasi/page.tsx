import type { Metadata } from "next";
import { KerangkaMasuk } from "@/components/KerangkaMasuk";

export const metadata: Metadata = { title: "Kebijakan privasi" };

export default function Halaman() {
  return (
    <KerangkaMasuk judul="Kebijakan privasi" tampilkanTagline={false}>
      <p className="rounded-lg border border-kayu px-3 py-2 text-sm">
        <strong>Draf.</strong> Teks ini belum ditinjau ahli hukum. Tinjau terhadap UU Nomor 27 Tahun 2022
        tentang Pelindungan Data Pribadi sebelum aplikasi dipakai umum.
      </p>

      <h2 className="text-lg font-semibold">Data yang kami simpan</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Email, nama panggilan, dan peran Anda di rumah.</li>
        <li>Tanggal lahir anak, untuk menentukan kelompok umur tantangan dan memeriksa persetujuan orang tua.</li>
        <li>Progres tantangan, bukti tantangan (foto atau cerita), check-in perasaan, dan catatan harian anak.</li>
        <li>Cita-cita keluarga, progres materi per akun, apresiasi keluarga, dan balasan catatan.</li>
      </ul>

      <h2 className="text-lg font-semibold">Siapa yang bisa melihat</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Anggota rumah yang sama melihat progres dan bukti rumah itu.</li>
        <li>
          Catatan harian anak yang dibagikan bisa dibaca orang tua di rumah itu. Catatan pribadi hanya
          terbaca anak yang menulisnya.
        </li>
        <li>Orang tua atau wali dapat melihat check-in perasaan anak. Anggota dewasa hanya melihat check-in miliknya sendiri.</li>
        <li>Materi, catatan, cita-cita, dan apresiasi keluarga hanya tersedia untuk anggota rumah yang sama sesuai hak akses masing-masing.</li>
        <li>
          Admin platform bisa melihat bukti, angka progres, tren check-in keluarga, dan tanda perhatian tanpa nilai suasana hati anak.
          Admin hanya melihat jumlah dan tanggal catatan harian, bukan isinya. Setiap akses admin dicatat.
        </li>
      </ul>

      <h2 className="text-lg font-semibold">Hak Anda</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Hapus akun kapan saja dari menu Akun. Pemilik rumah menghapus rumahnya terlebih dulu.</li>
        <li>Cabut sesi di perangkat lain dari menu Akun.</li>
        <li>Anak di bawah 18 tahun hanya bergabung dengan persetujuan orang tua atau wali.</li>
      </ul>

      <h2 className="text-lg font-semibold">Pengaman</h2>
      <p>
        Data dikirim lewat koneksi terenkripsi (HTTPS). Akses data dibatasi di basis data (Row Level
        Security), bukan hanya disembunyikan di tampilan.
      </p>

      <p className="text-sm">
        <a href="/masuk" className="inline-flex min-h-11 items-center font-semibold underline">
          Kembali
        </a>
      </p>
    </KerangkaMasuk>
  );
}
