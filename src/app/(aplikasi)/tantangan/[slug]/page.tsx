import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormBukti } from "@/components/FormBukti";
import { driveSiap } from "@/lib/drive";
import { hariIniWib } from "@/lib/data";
import { ambilSesi } from "@/lib/sesi";
import { labelKategori, labelSegmen, segmenUsiaAnak, STATUS_BUKTI } from "@/lib/tantangan";

export const metadata: Metadata = { title: "Kirim bukti" };

export default async function Halaman({ params, searchParams }: PageProps<"/tantangan/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { supabase, rumah, user, profil } = await ambilSesi();
  if (!rumah) redirect("/beranda");

  const { data: t } = await supabase
    .from("tantangan")
    .select("slug, kategori, segmen, judul, isi, menit, poin, peringatan, aktif, peran_target")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) notFound();

  const anakId = rumah.peran === "anak" ? user.id : typeof sp.anak === "string" ? sp.anak : null;
  const peranPengirim = anakId
    ? "anak"
    : ["ayah", "ibu"].includes(rumah.peran)
      ? rumah.peran
      : null;
  if (t.peran_target && t.peran_target !== peranPengirim) notFound();
  const { data: anggotaAnak } = anakId && rumah.peran !== "anak"
    ? await supabase.from("anggota").select("user_id, peran, profil:user_id (tgl_lahir)")
        .eq("keluarga_id", rumah.id).eq("user_id", anakId).eq("peran", "anak").maybeSingle()
    : { data: null };
  if (anakId && rumah.peran !== "anak" && !anggotaAnak) notFound();
  const tglLahir = rumah.peran === "anak"
    ? profil.tgl_lahir
    : (anggotaAnak?.profil as unknown as { tgl_lahir: string | null } | null)?.tgl_lahir ?? null;
  const segmen = segmenUsiaAnak(tglLahir);
  if (t.segmen && (!anakId || t.segmen !== segmen)) notFound();

  const queryBukti = supabase
    .from("bukti")
    .select("status, alasan")
    .eq("keluarga_id", rumah.id)
    .eq("tantangan_slug", slug)
    .eq("tanggal", hariIniWib())
    .order("dibuat_at", { ascending: false })
    .limit(1);
  if (anakId) queryBukti.eq("anak_id", anakId);
  else queryBukti.is("anak_id", null);

  const queryTugas = t.aktif
    ? Promise.resolve({ data: null, error: null })
    : (anakId
        ? supabase.from("tantangan_harian").select("tantangan_slug")
            .eq("keluarga_id", rumah.id).eq("tanggal", hariIniWib())
            .eq("tantangan_slug", slug).eq("anak_id", anakId).maybeSingle()
        : supabase.from("tantangan_harian").select("tantangan_slug")
            .eq("keluarga_id", rumah.id).eq("tanggal", hariIniWib())
            .eq("tantangan_slug", slug).is("anak_id", null)
            .eq("peran_penugasan", rumah.peran).maybeSingle());
  const [{ data: ada }, { data: drive, error: driveError }, { data: tugasHariIni, error: tugasError }] = await Promise.all([
    queryBukti,
    supabase.rpc("status_drive_pusat", { p_keluarga: rumah.id }),
    queryTugas,
  ]);
  if (tugasError) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Status tantangan belum bisa diperiksa. Muat ulang halaman.</p>;
  }
  const bolehKirim = t.aktif || Boolean(tugasHariIni);
  const terakhir = ada?.[0];
  const aktif = terakhir && terakhir.status !== "ditolak";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={anakId ? `/tantangan?anak=${anakId}` : "/tantangan"}
        className="inline-flex min-h-11 items-center font-semibold underline"
      >
        Kembali ke daftar tantangan
      </Link>

      <section aria-labelledby="judul" className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          {labelKategori(t.kategori)}, {labelSegmen(t.segmen)}, {t.menit} menit, +{t.poin} poin
        </p>
        <h1 id="judul" className="text-2xl font-semibold">
          {t.judul}
        </h1>
        <p>{t.isi}</p>
        {t.peringatan ? (
          <p role="note" className="rounded-lg border border-kayu px-3 py-2 font-semibold">
            {t.peringatan}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="bukti" className="flex flex-col gap-4 border-t border-line pt-6">
        <h2 id="bukti" className="text-lg font-semibold">
          Bukti
        </h2>
        {terakhir?.status === "ditolak" ? (
          <p role="status" className="rounded-lg border border-bahaya px-3 py-2">
            <strong>Bukti sebelumnya ditolak.</strong> {terakhir.alasan ? `Alasan: ${terakhir.alasan}` : ""} Kirim bukti baru di bawah.
          </p>
        ) : null}
        {!bolehKirim ? (
          <p role="note" className="rounded-lg border border-kayu px-3 py-2">
            Tantangan ini sudah diarsipkan dan tidak menerima bukti baru.
          </p>
        ) : aktif ? (
          <p role="status" className="rounded-lg border border-primary px-3 py-2">
            {terakhir.status === "menunggu" ? (
              <>
                <strong>Bukti terkirim.</strong> Poin masuk setelah anggota keluarga lain menyetujuinya.
              </>
            ) : (
              <>
                Hari ini tantangan ini sudah punya bukti: <strong>{STATUS_BUKTI[terakhir.status]}</strong>.
              </>
            )}{" "}
            Lihat di{" "}
            <Link href="/bukti" className="font-semibold underline">
              galeri bukti
            </Link>
            .
          </p>
        ) : (
          <FormBukti
            keluargaId={rumah.id}
            anakId={anakId}
            slug={slug}
            statusDrive={
              driveError
                ? "galat"
                : !driveSiap()
                  ? "belum"
                  : ((drive as "tersambung" | "terputus" | "belum") ?? "belum")
            }
          />
        )}
      </section>
    </div>
  );
}
