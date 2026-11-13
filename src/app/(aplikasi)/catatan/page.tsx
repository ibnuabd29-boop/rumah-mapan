import type { Metadata } from "next";
import Link from "next/link";
import { FormBalasanCatatan, FormCatatan } from "@/components/FormLangkahEnam";
import { formatWaktu } from "@/lib/admin";
import { SUASANA } from "@/lib/langkah-enam";
import { ambilSesi } from "@/lib/sesi";

export const metadata: Metadata = { title: "Catatan harian" };

type Catatan = {
  id: string;
  penulis_id: string;
  suasana: string | null;
  isi: string;
  dibagikan: boolean;
  dibuat_at: string;
};
type Balasan = { id: string; catatan_id: string; pengirim_id: string; isi: string; dibuat_at: string };

export default async function Halaman() {
  const { supabase, rumah } = await ambilSesi();
  if (!rumah) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Catatan harian</h1>
        <p className="text-muted">Buat atau gabung ke rumah di <Link href="/beranda" className="underline">Beranda</Link> untuk membuka catatan.</p>
      </section>
    );
  }
  const { data: admin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Status akun belum bisa diperiksa. Coba muat ulang halaman.</p>;
  }
  if (admin) {
    return <p className="text-muted">Akun admin platform tidak dapat membaca atau menulis isi catatan harian.</p>;
  }

  const { data, error } = await supabase
    .from("catatan_harian")
    .select("id, penulis_id, suasana, isi, dibagikan, dibuat_at")
    .eq("keluarga_id", rumah.id)
    .order("dibuat_at", { ascending: false })
    .limit(50);
  if (error) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Catatan belum bisa dimuat. Muat ulang halaman.</p>;
  }
  const catatan = (data ?? []) as Catatan[];
  const ids = catatan.map((c) => c.id);
  const penulisIds = [...new Set(catatan.map((c) => c.penulis_id))];
  const [balasanQuery, penulisQuery] = await Promise.all([
    ids.length
      ? supabase.from("balasan_catatan").select("id, catatan_id, pengirim_id, isi, dibuat_at")
          .in("catatan_id", ids).order("dibuat_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    penulisIds.length
      ? supabase.from("profiles").select("id, nama").in("id", penulisIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (balasanQuery.error || penulisQuery.error) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Balasan catatan belum bisa dimuat. Muat ulang halaman.</p>;
  }
  const balasan = (balasanQuery.data ?? []) as Balasan[];
  const nama = new Map((penulisQuery.data ?? []).map((p) => [p.id, p.nama]));
  const idPengirimBalasan = [...new Set(balasan.map((b) => b.pengirim_id))].filter((id) => !nama.has(id));
  if (idPengirimBalasan.length) {
    const { data: pengirim, error: pengirimError } = await supabase.from("profiles").select("id, nama").in("id", idPengirimBalasan);
    if (pengirimError) {
      return <p role="alert" className="border border-bahaya p-3 text-bahaya">Nama pengirim balasan belum bisa dimuat. Muat ulang halaman.</p>;
    }
    for (const p of pengirim ?? []) nama.set(p.id, p.nama);
  }
  const balasanPerCatatan = new Map<string, Balasan[]>();
  for (const item of balasan) {
    const daftar = balasanPerCatatan.get(item.catatan_id) ?? [];
    daftar.push(item);
    balasanPerCatatan.set(item.catatan_id, daftar);
  }
  const anak = rumah.peran === "anak";

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Catatan harian</h1>
        <p className="text-muted">
          {anak
            ? "Tulis hal yang ingin kamu ingat atau ceritakan. Kamu yang menentukan apakah catatan dibagikan."
            : "Di sini hanya muncul catatan anak yang dibagikan kepada orang tua atau wali."}
        </p>
      </header>

      {anak ? (
        <section aria-labelledby="tulis-catatan" className="flex flex-col gap-3">
          <h2 id="tulis-catatan" className="text-lg font-semibold">Tulis catatan</h2>
          <FormCatatan />
        </section>
      ) : null}

      <section aria-labelledby="riwayat-catatan" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="riwayat-catatan" className="text-lg font-semibold">Catatan terbaru</h2>
        {catatan.length === 0 ? (
          <p className="text-muted">
            {anak
              ? "Belum ada catatan. Catatan pribadi tetap hanya terlihat di akun ini."
              : "Belum ada catatan yang dibagikan. Catatan pribadi tidak terlihat oleh orang tua atau wali."}
          </p>
        ) : (
          <ol className="divide-y divide-line border-y border-line">
            {catatan.map((item) => {
              const labelSuasana = SUASANA.find((s) => s.nilai === item.suasana)?.label;
              return (
                <li key={item.id} className="flex flex-col gap-3 py-4">
                  <header className="flex flex-wrap justify-between gap-2 text-sm text-muted">
                    <span>{formatWaktu(item.dibuat_at)}</span>
                    <span>{labelSuasana ? `Perasaan: ${labelSuasana}. ` : ""}{item.dibagikan ? "Dibagikan" : "Pribadi"}</span>
                  </header>
                  <p className="whitespace-pre-wrap">{item.isi}</p>
                  <section aria-label={`Balasan untuk catatan ${formatWaktu(item.dibuat_at)}`} className="flex flex-col gap-2 rounded-lg bg-bg p-3">
                    {(balasanPerCatatan.get(item.id) ?? []).map((jawab) => (
                      <p key={jawab.id} className="whitespace-pre-wrap">
                        <strong>{nama.get(jawab.pengirim_id) ?? "Anggota"}:</strong> {jawab.isi}
                      </p>
                    ))}
                    <FormBalasanCatatan catatanId={item.id} />
                  </section>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <p className="text-sm text-muted">
        Catatan pribadi hanya dapat dibaca penulisnya. Orang tua atau wali hanya dapat membaca catatan anak yang dibagikan.
        Admin platform tidak dapat membaca isi catatan.
      </p>
    </div>
  );
}
