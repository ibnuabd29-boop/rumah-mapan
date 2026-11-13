import { MATERI_GENRE } from "@/lib/langkah-enam";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Kelompok = { jenis: string; slug: string; nama: string };
type Pertanyaan = { jenis: string; kelompok: string; teks: string };

export async function GET() {
  const supabase = await supabaseServer();
  const [kelompokQuery, pertanyaanQuery] = await Promise.all([
    supabase.from("kelompok_pertanyaan").select("jenis, slug, nama"),
    supabase.from("pertanyaan_konten").select("jenis, kelompok, teks").eq("aktif", true).order("dibuat_at"),
  ]);
  if (kelompokQuery.error || pertanyaanQuery.error) {
    return Response.json({ error: "Konten offline belum bisa dimuat." }, { status: 503 });
  }

  const kelompok = (kelompokQuery.data ?? []) as Kelompok[];
  const pertanyaan = (pertanyaanQuery.data ?? []) as Pertanyaan[];
  const materi = MATERI_GENRE.map((item) => {
    const daftar = pertanyaan
      .filter((q) => q.jenis === "materi_genre" && q.kelompok === item.slug)
      .map((q) => q.teks);
    return { ...item, tanya: daftar[0] ?? null, pertanyaan: daftar };
  });
  const obrolan = kelompok
    .filter((item) => item.jenis === "obrolan")
    .map((item) => ({
      tema: item.nama,
      kartu: pertanyaan
        .filter((q) => q.jenis === "obrolan" && q.kelompok === item.slug)
        .map((q) => q.teks),
    }));

  return Response.json({ materi, obrolan });
}
