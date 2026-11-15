import type { Metadata } from "next";
import Link from "next/link";
import { FormApresiasi } from "@/components/FormLangkahEnam";
import { formatWaktu } from "@/lib/admin";
import { ambilSesi } from "@/lib/sesi";

export const metadata: Metadata = { title: "Syukur" };

type Apresiasi = { id: string; pengirim_id: string; penerima_id: string | null; isi: string; dibuat_at: string };

export default async function Halaman() {
  const { supabase, rumah } = await ambilSesi();
  if (!rumah) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Syukur</h1>
        <p className="text-muted">Buat atau gabung ke rumah di <Link href="/beranda" className="underline">Beranda</Link> untuk mengirim apresiasi.</p>
      </section>
    );
  }
  const [anggotaQuery, apresiasiQuery] = await Promise.all([
    supabase.from("anggota").select("user_id, profil:user_id (nama)").eq("keluarga_id", rumah.id),
    supabase.from("apresiasi").select("id, pengirim_id, penerima_id, isi, dibuat_at")
      .eq("keluarga_id", rumah.id).order("dibuat_at", { ascending: false }).limit(50),
  ]);
  if (anggotaQuery.error || apresiasiQuery.error) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Apresiasi keluarga belum bisa dimuat. Muat ulang halaman.</p>;
  }
  const anggota = (anggotaQuery.data ?? []) as unknown as { user_id: string; profil: { nama: string } | null }[];
  const apresiasi = (apresiasiQuery.data ?? []) as Apresiasi[];
  const nama = new Map(anggota.map((a) => [a.user_id, a.profil?.nama ?? "Anggota"]));
  const pilihanAnggota = anggota.map((a) => ({ id: a.user_id, nama: nama.get(a.user_id) ?? "Anggota" }));

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Syukur</h1>
        <p className="text-muted">Sampaikan hal kecil yang kamu hargai dari keluarga hari ini.</p>
      </header>
      <FormApresiasi anggota={pilihanAnggota} />
      <section aria-labelledby="apresiasi-terkirim" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="apresiasi-terkirim" className="text-lg font-semibold">Apresiasi keluarga</h2>
        {apresiasi.length === 0 ? (
          <p className="text-muted">Belum ada apresiasi. Tulis satu hal yang sungguh kamu hargai.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {apresiasi.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 py-4">
                <p className="text-sm text-muted">
                  {nama.get(item.pengirim_id) ?? "Anggota"} untuk {item.penerima_id ? nama.get(item.penerima_id) ?? "anggota keluarga" : "keluarga"}
                  {" · "}{formatWaktu(item.dibuat_at)}
                </p>
                <p className="whitespace-pre-wrap">{item.isi}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
