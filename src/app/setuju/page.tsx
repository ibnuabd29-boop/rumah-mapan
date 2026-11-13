import type { Metadata } from "next";
import { setujuPrivasi } from "@/app/actions-keluarga";
import { KerangkaMasuk } from "@/components/KerangkaMasuk";
import { Tombol } from "@/components/ui";
import { ambilSesi } from "@/lib/sesi";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Persetujuan privasi" };

export default async function Halaman() {
  const { profil } = await ambilSesi({ perluSetuju: false });
  if (profil.privasi_disetujui_at) redirect("/beranda");
  return (
    <KerangkaMasuk judul="Sebelum mulai" tampilkanTagline={false}>
      <ul className="list-disc space-y-2 pl-5">
        <li>Admin platform bisa melihat bukti tantangan dan angka progres keluarga Anda.</li>
        <li>Admin bisa melihat tren check-in keluarga dan tanda perhatian tanpa nilai suasana hati anak.</li>
        <li>Admin hanya melihat jumlah dan tanggal catatan harian. Admin tidak bisa membaca isinya, termasuk catatan yang dibagikan.</li>
        <li>Orang tua atau wali dapat melihat check-in dan catatan anak yang dibagikan di rumah yang sama.</li>
        <li>
          Data Anda tidak ditampilkan ke akun di luar keluarga. Rincian lengkap ada di{" "}
          <a href="/privasi" className="font-semibold underline">
            kebijakan privasi
          </a>
          .
        </li>
      </ul>
      <form action={setujuPrivasi}>
        <Tombol teksTunggu="Menyimpan...">Saya paham, lanjutkan</Tombol>
      </form>
    </KerangkaMasuk>
  );
}
