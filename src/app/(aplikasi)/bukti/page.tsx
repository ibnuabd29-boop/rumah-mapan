import type { Metadata } from "next";
import Link from "next/link";
import { hapusBukti } from "@/app/actions-tantangan";
import { FormTinjau } from "@/components/FormTinjau";
import { Tombol } from "@/components/ui";
import { driveSiap, tautanBerkas } from "@/lib/drive";
import { formatTanggal } from "@/lib/data";
import { ambilSesi } from "@/lib/sesi";
import { STATUS_BUKTI } from "@/lib/tantangan";

export const metadata: Metadata = { title: "Galeri bukti" };

const PERAN_ORTU = ["ayah", "ibu", "wali", "kakek_nenek", "ortu_tunggal"];

type Baris = {
  id: string;
  tanggal: string;
  jenis: "foto" | "cerita";
  teks: string | null;
  status: string;
  alasan: string | null;
  pengirim_id: string;
  tantangan: { judul: string; poin: number } | null;
  pengirim: { nama: string } | null;
};

export default async function Halaman() {
  const { supabase, user, rumah } = await ambilSesi();
  if (!rumah) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Galeri bukti</h1>
        <p className="text-muted">
          Buat atau gabung ke rumah di{" "}
          <Link href="/beranda" className="font-semibold underline">
            Beranda
          </Link>{" "}
          untuk melihat bukti.
        </p>
      </section>
    );
  }

  const [{ data, error }, { data: anggota }] = await Promise.all([
    supabase
      .from("bukti")
      .select(
        "id, tanggal, jenis, teks, status, alasan, pengirim_id, tantangan:tantangan_slug (judul, poin), pengirim:pengirim_id (nama)",
      )
      .eq("keluarga_id", rumah.id)
      .order("dibuat_at", { ascending: false })
      .limit(50),
    supabase.from("anggota").select("user_id, peran").eq("keluarga_id", rumah.id),
  ]);
  const peranDari = new Map((anggota ?? []).map((a) => [a.user_id, a.peran]));
  const sayaOrtu = PERAN_ORTU.includes(rumah.peran);
  const pemilik = rumah.pemilik_id === user.id;
  const bisaFoto = driveSiap();
  const baris = (data ?? []) as unknown as Baris[];
  const menunggu = baris.filter((b) => b.status === "menunggu");
  const lain = baris.filter((b) => b.status !== "menunggu");

  const Kartu = ({ b }: { b: Baris }) => {
    const sendiri = b.pengirim_id === user.id;
    const bolehNilai = b.status === "menunggu" && !sendiri && (peranDari.get(b.pengirim_id) !== "anak" || sayaOrtu);
    return (
      <li className="flex flex-col gap-2 py-4">
        <p className="text-sm text-muted">
          {formatTanggal(b.tanggal)}, dari {b.pengirim?.nama ?? "anggota"}
        </p>
        <h3 className="text-base font-semibold">{b.tantangan?.judul}</h3>
        <p className="text-sm font-semibold">
          {STATUS_BUKTI[b.status] ?? b.status}
          {b.status === "disetujui" && b.tantangan ? `, +${b.tantangan.poin} poin` : ""}
        </p>
        {b.jenis === "foto" && bisaFoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tautanBerkas(b.id)}
            alt={`Foto bukti: ${b.tantangan?.judul ?? "tantangan"}`}
            width={480}
            height={360}
            loading="lazy"
            className="h-auto max-h-80 w-full rounded-lg border border-line object-cover"
          />
        ) : null}
        {b.teks ? <p>{b.teks}</p> : null}
        {(b.status === "ditolak" || b.status === "ditandai") && b.alasan ? (
          <p className="text-bahaya">Alasan: {b.alasan}</p>
        ) : null}
        {bolehNilai ? <FormTinjau id={b.id} /> : null}
        {b.status === "menunggu" && sendiri ? (
          <p className="text-sm text-muted">Menunggu anggota lain menilai bukti ini.</p>
        ) : null}
        {sendiri || pemilik ? (
          <form action={hapusBukti}>
            <input type="hidden" name="id" value={b.id} />
            <Tombol variant="bahaya" aria-label={`Hapus bukti ${b.tantangan?.judul ?? ""}`}>
              Hapus bukti
            </Tombol>
            {b.status === "disetujui" ? (
              <p className="pt-1 text-sm text-muted">Menghapus bukti yang disetujui juga menghapus poinnya.</p>
            ) : null}
          </form>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Galeri bukti</h1>
        <p className="text-muted">Bukti terbaru dari {rumah.nama}. Poin dihitung setelah bukti disetujui.</p>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          <strong>Gagal: </strong>Bukti belum bisa dimuat. Muat ulang halaman.
        </p>
      ) : baris.length === 0 ? (
        <p className="text-muted">
          Belum ada bukti. Selesaikan satu tantangan, lalu kirim buktinya dari{" "}
          <Link href="/tantangan" className="font-semibold underline">
            daftar tantangan
          </Link>
          .
        </p>
      ) : (
        <>
          <section aria-labelledby="menunggu" className="flex flex-col gap-2">
            <h2 id="menunggu" className="text-lg font-semibold">
              Menunggu penilaian ({menunggu.length})
            </h2>
            {menunggu.length === 0 ? (
              <p className="text-muted">Tidak ada bukti yang menunggu.</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {menunggu.map((b) => (
                  <Kartu key={b.id} b={b} />
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="riwayat" className="flex flex-col gap-2">
            <h2 id="riwayat" className="text-lg font-semibold">
              Riwayat
            </h2>
            {lain.length === 0 ? (
              <p className="text-muted">Belum ada bukti yang sudah dinilai.</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {lain.map((b) => (
                  <Kartu key={b.id} b={b} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
