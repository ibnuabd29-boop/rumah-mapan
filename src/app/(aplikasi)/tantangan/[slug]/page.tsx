import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormBukti } from "@/components/FormBukti";
import { driveSiap } from "@/lib/drive";
import { hariIniWib } from "@/lib/data";
import { ambilSesi } from "@/lib/sesi";
import { labelKategori, STATUS_BUKTI } from "@/lib/tantangan";

export const metadata: Metadata = { title: "Kirim bukti" };

export default async function Halaman({ params }: PageProps<"/tantangan/[slug]">) {
  const { slug } = await params;
  const { supabase, user, rumah } = await ambilSesi();
  if (!rumah) redirect("/beranda");

  const { data: t } = await supabase
    .from("tantangan")
    .select("slug, kategori, judul, isi, menit, poin, peringatan")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) notFound();

  const [{ data: ada }, { data: drive }] = await Promise.all([
    supabase
      .from("bukti")
      .select("status, alasan")
      .eq("keluarga_id", rumah.id)
      .eq("tantangan_slug", slug)
      .eq("tanggal", hariIniWib())
      .order("dibuat_at", { ascending: false })
      .limit(1),
    supabase.rpc("status_drive", { p_keluarga: rumah.id }),
  ]);
  const terakhir = ada?.[0];
  const aktif = terakhir && terakhir.status !== "ditolak";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/tantangan" className="inline-flex min-h-11 items-center font-semibold underline">
        Kembali ke daftar tantangan
      </Link>

      <section aria-labelledby="judul" className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          {labelKategori(t.kategori)}, {t.menit} menit, +{t.poin} poin
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
        {aktif ? (
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
            slug={slug}
            statusDrive={(drive as "tersambung" | "terputus" | "belum") ?? "belum"}
            pemilik={rumah.pemilik_id === user.id}
            driveSiap={driveSiap()}
          />
        )}
      </section>
    </div>
  );
}
