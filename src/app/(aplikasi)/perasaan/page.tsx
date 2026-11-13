import type { Metadata } from "next";
import Link from "next/link";
import { FormPerasaan } from "@/components/FormLangkahEnam";
import { LatihanNapas } from "@/components/LatihanNapas";
import { formatTanggal, hariIniWib } from "@/lib/data";
import { BANTUAN_ORANG_TUA, SUASANA, type Suasana } from "@/lib/langkah-enam";
import { ambilSesi } from "@/lib/sesi";

export const metadata: Metadata = { title: "Perasaan" };

type Checkin = { user_id: string; tanggal: string; suasana: Suasana };
type Anggota = { user_id: string; peran: string; profil: { nama: string } | null };

const mundurHari = (tanggal: string, jumlah: number) => {
  const hasil = new Date(`${tanggal}T00:00:00Z`);
  hasil.setUTCDate(hasil.getUTCDate() - jumlah);
  return hasil.toISOString().slice(0, 10);
};

function GrafikPerasaan({ nama, userId, daftar, hariIni }: {
  nama: string;
  userId: string;
  daftar: Checkin[];
  hariIni: string;
}) {
  const hari = Array.from({ length: 7 }, (_, index) => mundurHari(hariIni, 6 - index));
  const pilihan = new Map(daftar.filter((x) => x.user_id === userId).map((x) => [x.tanggal, x.suasana]));
  return (
    <section aria-labelledby={`grafik-${userId}`} className="flex flex-col gap-3">
      <h2 id={`grafik-${userId}`} className="text-lg font-semibold">Tujuh hari, {nama}</h2>
      <ol className="flex flex-col gap-2">
        {hari.map((tanggal) => {
          const suasana = pilihan.get(tanggal);
          const nilai = SUASANA.find((item) => item.nilai === suasana);
          return (
            <li key={tanggal} className="grid grid-cols-[minmax(0,1fr)_2fr_minmax(0,1fr)] items-center gap-2">
              <span className="text-sm">{formatTanggal(tanggal)}</span>
              {nilai ? (
                <progress
                  aria-label={`${nilai.label}, ${formatTanggal(tanggal)}`}
                  value={nilai.skor}
                  max={5}
                  className="h-4 w-full accent-primary"
                />
              ) : (
                <span className="text-sm text-muted">Belum dicatat</span>
              )}
              <span className="text-right text-sm">{nilai?.label ?? " "}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default async function Halaman() {
  const { supabase, user, rumah } = await ambilSesi();
  if (!rumah) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Perasaan</h1>
        <p className="text-muted">Buat atau gabung ke rumah di <Link href="/beranda" className="underline">Beranda</Link> untuk mencatat check-in.</p>
      </section>
    );
  }
  const { data: admin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Status akun belum bisa diperiksa. Coba muat ulang halaman.</p>;
  }
  if (admin) {
    return <p className="text-muted">Akun admin platform tidak dapat melihat check-in pribadi keluarga.</p>;
  }

  const hariIni = hariIniWib();
  const awal = mundurHari(hariIni, 6);
  const [hariIniQuery, anggotaQuery, mingguQuery] = await Promise.all([
    supabase.from("checkin_perasaan").select("user_id, tanggal, suasana")
      .eq("keluarga_id", rumah.id).eq("user_id", user.id).eq("tanggal", hariIni).maybeSingle(),
    supabase.from("anggota").select("user_id, peran, profil:user_id (nama)").eq("keluarga_id", rumah.id),
    supabase.from("checkin_perasaan").select("user_id, tanggal, suasana")
      .eq("keluarga_id", rumah.id).gte("tanggal", awal).lte("tanggal", hariIni)
      .order("tanggal", { ascending: true }),
  ]);
  if (hariIniQuery.error || anggotaQuery.error || mingguQuery.error) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Check-in perasaan belum bisa dimuat. Muat ulang halaman.</p>;
  }

  const anggota = (anggotaQuery.data ?? []) as unknown as Anggota[];
  const anak = anggota.filter((a) => a.peran === "anak");
  const namaAnggota = new Map(anggota.map((a) => [a.user_id, a.profil?.nama ?? "Anggota keluarga"]));
  const mingguan = (mingguQuery.data ?? []) as Checkin[];
  const checkinHariIni = (hariIniQuery.data as Checkin | null)?.suasana;
  const anakTerbaru = await Promise.all(anak.map(async (a) => {
    const hasil = await supabase.from("checkin_perasaan").select("user_id, tanggal, suasana")
      .eq("keluarga_id", rumah.id).eq("user_id", a.user_id)
      .order("tanggal", { ascending: false }).order("dibuat_at", { ascending: false }).limit(3);
    return { userId: a.user_id, error: hasil.error, data: (hasil.data ?? []) as Checkin[] };
  }));
  const gagalAnak = anakTerbaru.some((x) => x.error);
  if (gagalAnak) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Check-in keluarga belum bisa dimuat. Muat ulang halaman.</p>;
  }
  const grafikUntuk = anggota
    .filter((a) => a.user_id === user.id || (rumah.peran !== "anak" && a.peran === "anak"));

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Perasaan</h1>
        <p className="text-muted">Pilih satu suasana hari ini. Check-in membantu keluarga membuka obrolan, bukan menilai siapa pun.</p>
      </header>

      <section aria-labelledby="checkin" className="flex flex-col gap-3">
        <h2 id="checkin" className="text-lg font-semibold">Check-in hari ini</h2>
        <FormPerasaan suasanaHariIni={checkinHariIni} />
      </section>

      {rumah.peran !== "anak" ? anakTerbaru.filter((anakData) => (
        anakData.data.length === 3 && anakData.data.every((x) => x.suasana === "sedih" || x.suasana === "cemas")
      )).map((anakData) => (
        <section key={anakData.userId} aria-labelledby={`dukungan-${anakData.userId}`} className="flex flex-col gap-2 rounded-lg border border-kayu p-4">
          <h2 id={`dukungan-${anakData.userId}`} className="text-lg font-semibold">
            Ajak {namaAnggota.get(anakData.userId)} mengobrol
          </h2>
          <p>Tiga check-in terakhir menunjukkan suasana sedih atau cemas.</p>
          <ul className="list-disc space-y-1 pl-5">
            {[...new Set(anakData.data.map((x) => x.suasana))]
              .filter((suasana) => suasana === "sedih" || suasana === "cemas")
              .map((suasana) => <li key={suasana}>{BANTUAN_ORANG_TUA[suasana]}</li>)}
          </ul>
          <p className="text-sm">
            Rumah Mapan bukan pengganti bantuan profesional. Kemenkes menyediakan Healing119.id untuk
            dukungan awal. Telepon 119 ekstensi 8, atau buka{" "}
            <a href="https://healing119.id" target="_blank" rel="noreferrer" className="font-semibold underline">
              Healing119.id
            </a>
            {" "}untuk pilihan panggilan dan chat.
          </p>
        </section>
      )) : null}

      <LatihanNapas />

      <section aria-labelledby="riwayat-perasaan" className="flex flex-col gap-4 border-t border-line pt-5">
        <h2 id="riwayat-perasaan" className="text-lg font-semibold">Riwayat check-in</h2>
        {mingguan.length === 0 ? (
          <p className="text-muted">Belum ada check-in dalam tujuh hari. Pilih satu suasana di atas untuk memulai.</p>
        ) : null}
        {grafikUntuk.map((a) => (
          <GrafikPerasaan
            key={a.user_id}
            nama={a.user_id === user.id ? "Anda" : namaAnggota.get(a.user_id) ?? "Anak"}
            userId={a.user_id}
            daftar={mingguan}
            hariIni={hariIni}
          />
        ))}
        <p className="text-sm text-muted">Skala ringkas: cemas 1, sedih 2, biasa 3, tenang 4, senang 5. Skor bukan diagnosis.</p>
        <Link href="/laporan" className="inline-flex min-h-11 items-center self-start font-semibold underline">
          Buka laporan mingguan
        </Link>
      </section>
      <p className="text-sm text-muted">
        Orang tua atau wali dapat melihat check-in anak di rumah yang sama. Anggota dewasa hanya melihat check-in miliknya sendiri.
      </p>
    </div>
  );
}
