import type { Metadata } from "next";
import Link from "next/link";
import {
  FormCitaCita,
  FormLangkahCitaCita,
  FormTandaiLangkah,
} from "@/components/FormLangkahEnam";
import { ambilSesi } from "@/lib/sesi";
import { USIA } from "@/lib/langkah-enam";

export const metadata: Metadata = { title: "Masa depan" };

type Cita = { id: string; pembuat_id: string; judul: string; alasan: string; dibuat_at: string };
type Langkah = { id: string; cita_cita_id: string; isi: string; selesai_at: string | null };

export default async function Halaman() {
  const { supabase, rumah } = await ambilSesi();
  if (!rumah) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Masa depan</h1>
        <p className="text-muted">Buat atau gabung ke rumah di <Link href="/beranda" className="underline">Beranda</Link> untuk menyimpan cita-cita keluarga.</p>
      </section>
    );
  }
  const { data: citaQuery, error } = await supabase.from("cita_cita")
    .select("id, pembuat_id, judul, alasan, dibuat_at")
    .eq("keluarga_id", rumah.id)
    .order("dibuat_at", { ascending: false });
  if (error) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Papan cita-cita belum bisa dimuat. Muat ulang halaman.</p>;
  }
  const cita = (citaQuery ?? []) as Cita[];
  const { data: langkahQuery, error: langkahError } = cita.length
    ? await supabase.from("langkah_cita_cita").select("id, cita_cita_id, isi, selesai_at")
        .eq("keluarga_id", rumah.id)
        .in("cita_cita_id", cita.map((x) => x.id))
        .order("dibuat_at", { ascending: true })
    : { data: [], error: null };
  if (langkahError) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Langkah cita-cita belum bisa dimuat. Muat ulang halaman.</p>;
  }
  const langkah = (langkahQuery ?? []) as Langkah[];
  const langkahPerCita = new Map<string, Langkah[]>();
  for (const item of langkah) {
    const daftar = langkahPerCita.get(item.cita_cita_id) ?? [];
    daftar.push(item);
    langkahPerCita.set(item.cita_cita_id, daftar);
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Masa depan</h1>
        <p className="text-muted">Pilih satu langkah kecil yang bisa mulai dilakukan keluarga hari ini.</p>
        <p className="text-sm text-muted">Saran obrolan keluarga, bukan asesmen atau pengganti bantuan profesional.</p>
      </header>

      <section aria-labelledby="panduan-usia" className="flex flex-col gap-3">
        <h2 id="panduan-usia" className="text-lg font-semibold">Bahan obrolan sesuai usia</h2>
        {USIA.map((kelompok) => (
          <details key={kelompok.nilai} className="rounded-lg border border-line bg-surface px-3">
            <summary className="flex min-h-12 cursor-pointer items-center font-semibold">{kelompok.judul}</summary>
            <dl className="flex flex-col gap-3 pb-3">
              {kelompok.isi.map(([topik, saran]) => (
                <div key={topik}>
                  <dt className="font-semibold">{topik}</dt>
                  <dd>{saran}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </section>

      <section aria-labelledby="cita-keluarga" className="flex flex-col gap-4 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h2 id="cita-keluarga" className="text-lg font-semibold">Papan cita-cita keluarga</h2>
          <p className="text-muted">Tuliskan harapan dan pecah menjadi langkah yang bisa dicoba bersama.</p>
        </div>
        <FormCitaCita />
        {cita.length === 0 ? (
          <p className="text-muted">Belum ada cita-cita di papan. Tambahkan satu harapan keluarga untuk memulai.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {cita.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 py-4">
                <div>
                  <h3 className="font-semibold">{item.judul}</h3>
                  <p>{item.alasan}</p>
                </div>
                <ul className="flex flex-col gap-2">
                  {(langkahPerCita.get(item.id) ?? []).map((tugas) => (
                    <li key={tugas.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
                      <p className={tugas.selesai_at ? "line-through" : ""}>{tugas.isi}</p>
                      <FormTandaiLangkah id={tugas.id} selesai={Boolean(tugas.selesai_at)} />
                    </li>
                  ))}
                </ul>
                <FormLangkahCitaCita citaId={item.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
