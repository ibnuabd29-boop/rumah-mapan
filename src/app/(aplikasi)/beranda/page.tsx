import type { Metadata } from "next";
import { aturTantangan, lewatiTantangan } from "@/app/actions-tantangan";
import { FormBuatRumah } from "@/components/FormKeluarga";
import { Kerangka } from "@/components/Kerangka";
import { IkonFitur } from "@/components/IkonFitur";
import { Tombol, TautanTombol } from "@/components/ui";
import { ambilRingkasan, hariIniWib } from "@/lib/data";
import { ambilSesi } from "@/lib/sesi";
import { MODE, daftarLencana, labelKategori, tahapRumah } from "@/lib/tantangan";
import { SUASANA } from "@/lib/langkah-enam";
import { labelPeran } from "@/lib/umum";

export const metadata: Metadata = { title: "Beranda" };

const PERAN_ORTU = ["ayah", "ibu", "wali", "kakek_nenek", "ortu_tunggal"];

function mundurHari(tanggal: string, jumlah: number) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - jumlah);
  return d.toISOString().slice(0, 10);
}

export default async function Halaman() {
  const { supabase, rumah } = await ambilSesi();

  if (!rumah) {
    return (
      <div className="flex flex-col gap-6">
        <section aria-labelledby="buat" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <Kerangka dibangun={0} className="h-16 w-24 text-primary" />
          <div className="flex flex-col gap-2">
            <h1 id="buat" className="text-2xl font-semibold sm:text-3xl">
              Mulai dari satu rumah
            </h1>
            <p className="text-muted">
              Rumah adalah ruang bersama untuk ayah, ibu, dan anak. Pemilik rumah mengundang anggota
              lewat tautan sekali pakai.
            </p>
          </div>
          <FormBuatRumah />
        </section>
        <section aria-labelledby="diundang" className="flex flex-col gap-2 border-t border-line pt-6">
          <h2 id="diundang" className="font-judul text-xl font-semibold">
            Sudah diundang?
          </h2>
          <p className="text-muted">
            Buka tautan undangan yang dikirim pemilik rumah. Tautan itu membawa Anda langsung bergabung,
            tidak perlu membuat rumah baru.
          </p>
        </section>
      </div>
    );
  }

  const hari = hariIniWib();
  const mulaiMinggu = mundurHari(hari, 6);
  const orangTua = PERAN_ORTU.includes(rumah.peran);
  const [ringkasan, harian, drive, checkinMinggu] = await Promise.all([
    ambilRingkasan(supabase, rumah.id),
    supabase
      .from("tantangan_harian")
      .select("mode, dilewati, tantangan:tantangan_slug (slug, judul, isi, kategori, menit, poin, peringatan)")
      .eq("keluarga_id", rumah.id)
      .eq("tanggal", hari)
      .maybeSingle(),
    supabase.rpc("status_drive_pusat", { p_keluarga: rumah.id }),
    supabase.from("checkin_perasaan").select("suasana")
      .eq("keluarga_id", rumah.id).gte("tanggal", mulaiMinggu).lte("tanggal", hari),
  ]);

  const t = harian.data?.tantangan as unknown as
    | { slug: string; judul: string; isi: string; kategori: string; menit: number; poin: number; peringatan: string | null }
    | undefined;
  const { data: buktiHariIni } = t
    ? await supabase
        .from("bukti")
        .select("status")
        .eq("keluarga_id", rumah.id)
        .eq("tantangan_slug", t.slug)
        .eq("tanggal", hari)
        .in("status", ["menunggu", "disetujui", "ditandai"])
        .maybeSingle()
    : { data: null };

  const tahap = tahapRumah(ringkasan.poin);
  const lencana = daftarLencana(ringkasan);
  const kategoriTop = Object.entries(ringkasan.kategori_7hari ?? {}).sort((a, b) => b[1] - a[1])[0];
  const modeAktif = MODE.find((m) => m.nilai === harian.data?.mode);
  const pilihanMinggu = checkinMinggu.data ?? [];
  const skorMinggu = pilihanMinggu.reduce(
    (jumlah, item) => jumlah + (SUASANA.find((s) => s.nilai === item.suasana)?.skor ?? 0),
    0,
  );
  const rataSuasana = pilihanMinggu.length ? (skorMinggu / pilihanMinggu.length).toLocaleString("id-ID", { maximumFractionDigits: 1 }) : null;

  return (
    <div className="flex flex-col gap-8">
      {drive.error ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          Status folder foto admin belum bisa diperiksa. Coba muat ulang halaman.
        </p>
      ) : drive.data === "terputus" ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          Google Drive admin terputus. Foto bukti belum bisa dikirim sampai admin platform menghubungkannya kembali.
        </p>
      ) : drive.data === "belum" ? (
        <p role="note" className="rounded-lg border border-kayu px-3 py-2">
          Foto bukti baru tersedia setelah admin platform menghubungkan folder Google Drive.
        </p>
      ) : null}

      <section aria-labelledby="hari-ini" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <IkonFitur nama="keluarga" className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted">Ruang keluarga</p>
              <h1 id="hari-ini" className="truncate text-xl font-semibold">
                {rumah.nama}
              </h1>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-kayu/10 px-3 py-1.5 text-sm font-semibold text-kayu">
            {labelPeran(rumah.peran)}
          </span>
        </div>

        {!t ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-aksen text-on-aksen">
                <IkonFitur nama="tantangan" className="size-6" />
              </span>
              <h2 className="text-lg font-semibold">Situasi hari ini</h2>
            </div>
            <p className="text-muted">Pilih satu supaya tantangan hari ini cocok dengan waktu yang ada.</p>
            <ModePilih keluargaId={rumah.id} />
          </div>
        ) : (
          <article className="flex flex-col gap-4 rounded-2xl border border-on-aksen/10 bg-aksen p-5 text-on-aksen shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-on-aksen/10">
                <IkonFitur nama="tantangan" className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">Tantangan hari ini</p>
                <p className="text-sm">
                  {labelKategori(t.kategori)}, {t.menit} menit, +{t.poin} poin
                  {modeAktif && modeAktif.nilai !== "biasa" ? `, ${modeAktif.label.toLowerCase()}` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">{t.judul}</h2>
              <p>{t.isi}</p>
              {t.peringatan ? <p className="font-semibold">{t.peringatan}</p> : null}
            </div>

            {harian.data?.dilewati ? (
              <p className="font-semibold">Dilewati hari ini.</p>
            ) : buktiHariIni?.status === "disetujui" ? (
              <p className="font-semibold">Selesai dan disetujui. Poin sudah masuk.</p>
            ) : buktiHariIni ? (
              <p className="font-semibold">Bukti terkirim, menunggu penilaian anggota lain.</p>
            ) : (
              <TautanTombol href={`/tantangan/${t.slug}`} variant="gelapPadaAksen" className="self-start">
                Kirim bukti untuk selesai
              </TautanTombol>
            )}

            {orangTua && !buktiHariIni ? (
              <div className="flex flex-wrap gap-3">
                <form action={aturTantangan}>
                  <input type="hidden" name="keluarga_id" value={rumah.id} />
                  <input type="hidden" name="mode" value={harian.data?.mode ?? "biasa"} />
                  <input type="hidden" name="ganti" value="1" />
                  <Tombol variant="padaAksen">Ganti tantangan</Tombol>
                </form>
                {!harian.data?.dilewati ? (
                  <form action={lewatiTantangan}>
                    <input type="hidden" name="keluarga_id" value={rumah.id} />
                    <Tombol variant="padaAksen">Lewati hari ini</Tombol>
                  </form>
                ) : null}
              </div>
            ) : null}
          </article>
        )}

        {t && orangTua && !buktiHariIni ? (
          <details className="rounded-lg border border-line p-3">
            <summary className="min-h-11 py-2 font-semibold">Ubah situasi hari ini</summary>
            <div className="pt-2">
              <ModePilih keluargaId={rumah.id} aktif={harian.data?.mode} />
            </div>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="angka" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 id="angka" className="text-lg font-semibold">Perjalanan keluarga</h2>
        <div className="flex items-center gap-4 text-primary">
          <Kerangka dibangun={tahap.aktif.dibangun} className="h-16 w-auto shrink-0" />
          <div className="flex min-w-0 flex-col gap-1 text-ink">
            <p className="text-sm text-muted">Tahap rumah</p>
            <p className="font-semibold">{tahap.aktif.nama}</p>
            <p className="text-sm text-muted">
              {tahap.berikut
                ? `${tahap.berikut.dari - ringkasan.poin} poin lagi untuk tahap ${tahap.berikut.nama.toLowerCase()}.`
                : "Semua tahap sudah terpasang."}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {([
            { label: "Poin keluarga", nilai: ringkasan.poin, ikon: "poin" },
            { label: "Hari beruntun", nilai: ringkasan.hari_beruntun, ikon: "hari" },
            { label: "Tantangan selesai", nilai: ringkasan.selesai, ikon: "selesai" },
          ] as const).map(({ label, nilai, ikon }) => (
            <div key={label} className="flex flex-col gap-1 rounded-xl bg-bg p-2.5 sm:p-3">
              <dt className="flex min-h-10 flex-col items-center justify-center gap-1 text-xs text-muted">
                <IkonFitur nama={ikon} className="size-4" />
                <span>{label}</span>
              </dt>
              <dd className="text-2xl font-semibold text-primary" style={{ fontFamily: "var(--font-judul-asli), Georgia, serif" }}>
                {nilai}
              </dd>
            </div>
          ))}
        </dl>
        {ringkasan.menunggu > 0 ? (
          <a href="/bukti" className="inline-flex min-h-11 items-center font-semibold underline">
            {ringkasan.menunggu} bukti menunggu penilaian
          </a>
        ) : null}
      </section>

      <section aria-labelledby="tujuh" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-kayu/10 text-kayu">
            <IkonFitur nama="laporan" className="size-5" />
          </span>
          <h2 id="tujuh" className="text-lg font-semibold">Tujuh hari terakhir</h2>
        </div>
        {ringkasan.selesai_7hari === 0 ? (
          <p className="text-muted">
            Belum ada tantangan yang disetujui minggu ini. Ringkasan muncul setelah bukti pertama disetujui.
          </p>
        ) : (
          <p>
            Aktif {ringkasan.hari_aktif_7hari} dari 7 hari, {ringkasan.selesai_7hari} tantangan,{" "}
            {ringkasan.poin_7hari} poin.
            {kategoriTop ? ` Kategori terbanyak: ${labelKategori(kategoriTop[0]).toLowerCase()}.` : ""}
          </p>
        )}
        {checkinMinggu.error ? (
          <p role="alert" className="text-sm text-bahaya">Ringkasan check-in belum bisa dimuat.</p>
        ) : rataSuasana ? (
          <p className="text-sm">
            Rata-rata check-in yang dapat Anda lihat: <strong>{rataSuasana} dari 5</strong> dari {pilihanMinggu.length} catatan suasana.
          </p>
        ) : (
          <p className="text-sm text-muted">Belum ada check-in perasaan minggu ini.</p>
        )}
        <p className="text-sm text-muted">Skala ringkas, bukan penilaian kesehatan mental.</p>
        <TautanTombol href="/laporan" variant="sekunder" className="self-start">
          Lihat laporan mingguan
        </TautanTombol>
      </section>

      <section aria-labelledby="lencana" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="lencana" className="text-lg font-semibold">
          Lencana keluarga
        </h2>
        <ul className="flex flex-col gap-2">
          {lencana.map((l) => (
            <li
              key={l.id}
              className={`rounded-lg p-3 ${
                l.terbuka ? "border border-primary bg-surface" : "border border-dashed border-field text-muted"
              }`}
            >
              <p className="font-semibold">
                {l.nama}
                <span className="ml-2 text-sm font-normal">{l.terbuka ? "Terbuka" : "Terkunci"}</span>
              </p>
              <p className="text-sm">{l.syarat}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ModePilih({ keluargaId, aktif }: { keluargaId: string; aktif?: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {MODE.map((m) => (
        <li key={m.nilai}>
          <form action={aturTantangan}>
            <input type="hidden" name="keluarga_id" value={keluargaId} />
            <input type="hidden" name="mode" value={m.nilai} />
            <button
              type="submit"
              aria-pressed={aktif === m.nilai}
              className={`flex min-h-11 w-full flex-col items-start rounded-lg border px-4 py-2 text-left ${
                aktif === m.nilai ? "border-primary bg-primary text-on-primary" : "border-field hover:bg-line/50"
              }`}
            >
              <span className="font-semibold">{m.label}</span>
              <span className="text-sm">{m.bantu}</span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
