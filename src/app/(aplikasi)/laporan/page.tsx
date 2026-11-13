import type { Metadata } from "next";
import Link from "next/link";
import { ambilSesi } from "@/lib/sesi";
import { hariIniWib, formatTanggal } from "@/lib/data";
import { SUASANA, type Suasana } from "@/lib/langkah-enam";

export const metadata: Metadata = { title: "Laporan mingguan" };

type Checkin = { user_id: string; tanggal: string; suasana: Suasana };
type Bukti = { tanggal: string; tantangan: { judul: string; kategori: string } | null };

function tanggalMundur(tanggal: string, jumlah: number) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - jumlah);
  return d.toISOString().slice(0, 10);
}

export default async function Halaman() {
  const { supabase, rumah, user } = await ambilSesi();
  if (!rumah) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Laporan mingguan</h1>
        <p className="text-muted">Buat atau gabung ke rumah di <Link href="/beranda" className="underline">Beranda</Link> untuk melihat laporan.</p>
      </section>
    );
  }
  const { data: admin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Status akun belum bisa diperiksa. Coba muat ulang halaman.</p>;
  }
  if (admin) {
    return <p className="text-muted">Akun admin platform tidak dapat melihat laporan pribadi keluarga.</p>;
  }

  const hariIni = hariIniWib();
  const mulai = tanggalMundur(hariIni, 6);
  const [checkinQuery, buktiQuery, anggotaQuery] = await Promise.all([
    supabase.from("checkin_perasaan").select("user_id, tanggal, suasana")
      .eq("keluarga_id", rumah.id).gte("tanggal", mulai).lte("tanggal", hariIni),
    supabase.from("bukti").select("tanggal, tantangan:tantangan_slug (judul, kategori)")
      .eq("keluarga_id", rumah.id).eq("status", "disetujui")
      .gte("tanggal", mulai).lte("tanggal", hariIni),
    supabase.from("anggota").select("user_id, peran, profil:user_id (nama)").eq("keluarga_id", rumah.id),
  ]);
  if (checkinQuery.error || buktiQuery.error || anggotaQuery.error) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Laporan belum bisa dimuat. Muat ulang halaman.</p>;
  }

  const checkin = (checkinQuery.data ?? []) as Checkin[];
  const bukti = (buktiQuery.data ?? []) as unknown as Bukti[];
  const anggota = (anggotaQuery.data ?? []) as unknown as { user_id: string; peran: string; profil: { nama: string } | null }[];
  const nama = new Map(anggota.map((a) => [a.user_id, a.user_id === user.id ? "Anda" : a.profil?.nama ?? "Anggota"]));
  const terlihat = new Set([user.id, ...anggota.filter((a) => a.peran === "anak" && rumah.peran !== "anak").map((a) => a.user_id)]);
  const checkinTerlihat = checkin.filter((x) => terlihat.has(x.user_id));
  const perOrang = new Map<string, Checkin[]>();
  for (const item of checkinTerlihat) {
    const daftar = perOrang.get(item.user_id) ?? [];
    daftar.push(item);
    perOrang.set(item.user_id, daftar);
  }
  const daftarRata = [...perOrang.entries()].map(([id, daftar]) => {
    const total = daftar.reduce((sum, item) => sum + (SUASANA.find((x) => x.nilai === item.suasana)?.skor ?? 0), 0);
    return { id, daftar, rata: total / daftar.length };
  });
  const tantangan = new Map<string, number>();
  for (const item of bukti) {
    if (item.tantangan) tantangan.set(item.tantangan.judul, (tantangan.get(item.tantangan.judul) ?? 0) + 1);
  }
  const teratas = [...tantangan].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Laporan mingguan</h1>
        <p className="text-muted">Check-in dan tantangan yang tercatat selama tujuh hari terakhir.</p>
      </header>

      <section aria-labelledby="suasana-mingguan" className="flex flex-col gap-3">
        <h2 id="suasana-mingguan" className="text-lg font-semibold">Suasana hati</h2>
        {daftarRata.length === 0 ? (
          <p className="text-muted">Belum ada check-in yang dapat Anda lihat minggu ini. Catat suasana di menu Perasaan.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {daftarRata.map(({ id, daftar, rata }) => (
              <li key={id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{nama.get(id) ?? "Anggota"}</span>
                  <span>Rata-rata {rata.toLocaleString("id-ID", { maximumFractionDigits: 1 })} dari 5</span>
                </div>
                <progress aria-label={`Rata-rata suasana ${nama.get(id) ?? "anggota"}`} value={rata} max={5} className="h-4 w-full accent-primary" />
                <span className="text-sm text-muted">{daftar.length} check-in</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">Skala: cemas 1, sedih 2, biasa 3, tenang 4, senang 5. Ini ringkasan pilihan, bukan penilaian kesehatan mental.</p>
      </section>

      <section aria-labelledby="tantangan-mingguan" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="tantangan-mingguan" className="text-lg font-semibold">Tantangan yang sering dikerjakan</h2>
        {teratas.length === 0 ? (
          <p className="text-muted">Belum ada tantangan yang disetujui minggu ini. Poin baru dihitung setelah bukti disetujui.</p>
        ) : (
          <ol className="list-decimal space-y-2 pl-5">
            {teratas.map(([judul, jumlah]) => (
              <li key={judul}>{judul}, {jumlah} kali</li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="aktivitas-mingguan" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="aktivitas-mingguan" className="text-lg font-semibold">Hari dengan check-in</h2>
        {checkinTerlihat.length === 0 ? (
          <p className="text-muted">Belum ada check-in pada periode ini.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {checkinTerlihat.map((item) => (
              <li key={`${item.user_id}-${item.tanggal}`} className="flex justify-between gap-3 py-3">
                <span>{formatTanggal(item.tanggal)}</span>
                <span>{nama.get(item.user_id) ?? "Anggota"}: {SUASANA.find((x) => x.nilai === item.suasana)?.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
