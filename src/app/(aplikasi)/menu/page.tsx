import type { Metadata } from "next";
import Link from "next/link";
import { IkonFitur } from "@/components/IkonFitur";

export const metadata: Metadata = { title: "Menu rumah" };

const BAGIAN = [
  {
    judul: "Ruang bersama",
    tautan: [
      ["/catatan", "Catatan harian", "Ruang anak menulis dan berbagi catatan.", "catatan", "hijau"],
      ["/masa-depan", "Masa depan", "Panduan sesuai usia dan papan cita-cita keluarga.", "masa-depan", "kayu"],
      ["/materi", "Materi keluarga", "Bacaan GenRe untuk dibahas bersama.", "materi", "hijau"],
      ["/obrolan", "Kartu obrolan", "Pertanyaan untuk membuka percakapan.", "obrolan", "hijau"],
      ["/syukur", "Syukur", "Apresiasi antaranggota keluarga.", "syukur", "genteng"],
      ["/laporan", "Laporan mingguan", "Lihat check-in dan tantangan tujuh hari.", "laporan", "kayu"],
    ],
  },
  {
    judul: "Atur rumah",
    tautan: [
      ["/bukti", "Galeri bukti", "Tinjau dan lihat bukti tantangan.", "bukti", "hijau"],
      ["/keluarga", "Keluarga", "Anggota, undangan, dan pengaturan rumah.", "keluarga", "hijau"],
      ["/akun", "Akun", "Nama, tema, sesi, dan penghapusan akun.", "akun", "kayu"],
    ],
  },
  {
    judul: "Dukungan",
    tautan: [
      ["/layanan", "Layanan keluarga", "Kritik dan saran, dukungan kesehatan mental, serta konselor sebaya.", "obrolan", "kayu"],
    ],
  },
] as const;

const WARNA_IKON = {
  hijau: "bg-primary/10 text-primary",
  kayu: "bg-kayu/10 text-kayu",
  genteng: "bg-aksen text-on-aksen",
} as const;

export default function Halaman() {
  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">Rumah Mapan</p>
        <h1 className="text-3xl font-semibold">Ruang keluarga</h1>
        <p className="text-muted">Pilih ruang yang ingin dibuka bersama keluarga.</p>
      </section>
      {BAGIAN.map((bagian) => (
        <section key={bagian.judul} aria-labelledby={bagian.judul.replaceAll(" ", "-")} className="flex flex-col gap-3">
          <h2 id={bagian.judul.replaceAll(" ", "-")} className="text-lg font-semibold">{bagian.judul}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {bagian.tautan.map(([href, judul, keterangan, ikon, warna]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex min-h-20 items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-primary hover:bg-primary/5 active:bg-primary/10"
                >
                  <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${WARNA_IKON[warna]}`}>
                    <IkonFitur nama={ikon} className="size-6" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-semibold text-ink">{judul}</span>
                    <span className="text-sm leading-snug text-muted">{keterangan}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
