import type { Metadata } from "next";
import Link from "next/link";
import { hariIniWib } from "@/lib/data";
import { ambilSesi } from "@/lib/sesi";
import { KATEGORI, labelKategori, labelSegmen, segmenUsiaAnak } from "@/lib/tantangan";
import { formatTanggal } from "@/lib/data";

export const metadata: Metadata = { title: "Tantangan" };

export default async function Halaman({ searchParams }: PageProps<"/tantangan">) {
  const sp = await searchParams;
  const kategori = typeof sp.k === "string" && KATEGORI.some((x) => x.nilai === sp.k) ? sp.k : null;
  const anakId = typeof sp.anak === "string" ? sp.anak : null;
  const { supabase, rumah, user, profil } = await ambilSesi();
  const orangTua = Boolean(rumah && ["ayah", "ibu", "wali", "kakek_nenek", "ortu_tunggal"].includes(rumah.peran));
  const { data: anggotaAnak } = rumah && orangTua
    ? await supabase.from("anggota").select("user_id, profil:user_id (nama, tgl_lahir)")
        .eq("keluarga_id", rumah.id).eq("peran", "anak")
    : { data: [] };
  const daftarAnak = (anggotaAnak ?? []).map((a) => ({
    id: a.user_id,
    nama: (a.profil as unknown as { nama: string; tgl_lahir: string | null } | null)?.nama ?? "Anak",
    tglLahir: (a.profil as unknown as { nama: string; tgl_lahir: string | null } | null)?.tgl_lahir ?? null,
  }));
  const anakDipilih = rumah?.peran === "anak"
    ? { id: user.id, tglLahir: profil.tgl_lahir }
    : daftarAnak.find((a) => a.id === anakId);
  const segmen = anakDipilih ? segmenUsiaAnak(anakDipilih.tglLahir) : null;

  let q = supabase.from("tantangan").select("slug, kategori, segmen, judul, isi, menit, poin, dipin, tenggat")
    .eq("aktif", true).order("dipin", { ascending: false }).order("kategori").order("judul");
  if (kategori) q = q.eq("kategori", kategori);
  q = segmen
    ? q.or(`segmen.is.null,segmen.eq.${segmen}`)
    : q.is("segmen", null);
  const [{ data: daftar, error }, { data: hariIni }] = await Promise.all([
    q,
    rumah
      ? supabase
          .from("bukti")
          .select("tantangan_slug, status")
          .eq("keluarga_id", rumah.id)
          .eq("tanggal", hariIniWib())
          .or(anakDipilih ? `anak_id.is.null,anak_id.eq.${anakDipilih.id}` : "anak_id.is.null")
          .in("status", ["menunggu", "disetujui", "ditandai"])
      : Promise.resolve({ data: [] }),
  ]);
  const status = new Map((hariIni ?? []).map((b) => [b.tantangan_slug, b.status]));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Tantangan</h1>
        <p className="text-muted">
          Tantangan selesai setelah ada bukti foto atau cerita dan anggota keluarga lain menyetujuinya.
        </p>
        <Link href="/bukti" className="inline-flex min-h-11 items-center font-semibold underline">
          Lihat galeri bukti
        </Link>
      </section>

      {orangTua && daftarAnak.length > 0 ? (
        <nav aria-label="Pilih anak untuk tantangan" className="flex flex-col gap-2">
          <p className="font-semibold">Tantangan untuk:</p>
          <ul className="flex flex-wrap gap-2">
            {daftarAnak.map((anak) => (
              <li key={anak.id}>
                <Link
                  href={`/tantangan?anak=${anak.id}${kategori ? `&k=${kategori}` : ""}`}
                  aria-current={anakDipilih?.id === anak.id ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 font-semibold ${
                    anakDipilih?.id === anak.id ? "border-primary bg-primary text-on-primary" : "border-field hover:bg-line/50"
                  }`}
                >
                  {anak.nama}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={kategori ? `/tantangan?k=${kategori}` : "/tantangan"}
                aria-current={!anakDipilih ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 font-semibold ${
                  !anakDipilih ? "border-primary bg-primary text-on-primary" : "border-field hover:bg-line/50"
                }`}
              >
                Tantangan umum
              </Link>
            </li>
          </ul>
          {anakDipilih ? (
            <p className="text-sm text-muted">
              {segmen ? `Menampilkan ${labelSegmen(segmen)} dan tantangan umum.` : "Belum masuk rentang segmen umur, jadi hanya tantangan umum yang ditampilkan."}
            </p>
          ) : (
            <p className="text-sm text-muted">Pilih anak untuk melihat tantangan sesuai kelompok umurnya.</p>
          )}
        </nav>
      ) : rumah?.peran === "anak" ? (
        <p className="text-sm text-muted">
          {segmen ? `Menampilkan ${labelSegmen(segmen)} dan tantangan umum.` : "Belum masuk rentang segmen umur, jadi hanya tantangan umum yang ditampilkan."}
        </p>
      ) : null}

      <nav aria-label="Filter kategori">
        <ul className="flex flex-wrap gap-2">
          {[{ nilai: null, label: "Semua" }, ...KATEGORI].map((k) => {
            const aktif = (k.nilai ?? null) === kategori;
            return (
              <li key={k.label}>
                <Link
                  href={
                    k.nilai
                      ? `/tantangan?k=${k.nilai}${anakDipilih && orangTua ? `&anak=${anakDipilih.id}` : rumah?.peran === "anak" ? `&anak=${user.id}` : ""}`
                      : anakDipilih && orangTua
                        ? `/tantangan?anak=${anakDipilih.id}`
                        : rumah?.peran === "anak"
                          ? `/tantangan?anak=${user.id}`
                          : "/tantangan"
                  }
                  aria-current={aktif ? "true" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 font-semibold ${
                    aktif ? "border-primary bg-primary text-on-primary" : "border-field hover:bg-line/50"
                  }`}
                >
                  {k.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {error ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          <strong>Gagal: </strong>Daftar tantangan belum bisa dimuat. Muat ulang halaman.
        </p>
      ) : daftar && daftar.length === 0 ? (
        <p className="text-muted">Tidak ada tantangan di kategori ini.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {daftar?.map((t) => {
            const s = status.get(t.slug);
            return (
              <li key={t.slug} className="flex items-start justify-between gap-3 py-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{t.judul}</h2>
                  {t.dipin ? <p className="text-sm font-semibold text-primary">Dipin admin</p> : null}
                  <p className="text-muted">{t.isi}</p>
                  <p className="text-sm text-muted">
                    {labelKategori(t.kategori)}, {labelSegmen(t.segmen)}, {t.menit} menit, +{t.poin} poin
                  </p>
                  {t.tenggat ? <p className="text-sm text-muted">Tenggat {formatTanggal(t.tenggat)}.</p> : null}
                </div>
                {rumah ? (
                  s ? (
                    <span className="shrink-0 py-2 text-sm font-semibold">
                      {s === "disetujui" ? "Selesai hari ini" : "Menunggu"}
                    </span>
                  ) : (
                    <Link
                      href={`/tantangan/${t.slug}${anakDipilih ? `?anak=${anakDipilih.id}` : ""}`}
                      aria-label={`Kirim bukti untuk ${t.judul}`}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-primary px-4 py-2 font-semibold text-primary hover:bg-primary/10"
                    >
                      Kirim bukti
                    </Link>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {!rumah ? (
        <p className="text-muted">
          Buat atau gabung ke rumah di{" "}
          <Link href="/beranda" className="font-semibold underline">
            Beranda
          </Link>{" "}
          untuk mengirim bukti.
        </p>
      ) : null}
    </div>
  );
}
