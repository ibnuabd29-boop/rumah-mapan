import type { Metadata } from "next";
import { aturTantangan, lewatiTantangan } from "@/app/actions-tantangan";
import { FormBuatRumah } from "@/components/FormKeluarga";
import { Kerangka } from "@/components/Kerangka";
import { IkonFitur } from "@/components/IkonFitur";
import { Tombol, TautanTombol } from "@/components/ui";
import { ambilRingkasan, formatTanggal, hariIniWib } from "@/lib/data";
import { ambilSesi } from "@/lib/sesi";
import {
  MODE,
  labelKategori,
  labelSegmen,
  segmenUsiaAnak,
  tahapRumah,
} from "@/lib/tantangan";
import { SUASANA } from "@/lib/langkah-enam";
import { labelPeran } from "@/lib/umum";

export const metadata: Metadata = { title: "Beranda" };

const PERAN_ORTU = ["ayah", "ibu", "wali", "kakek_nenek", "ortu_tunggal"];
const waktuLencana = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

type LencanaPoin = {
  id: string;
  nama: string;
  ikon: "keluarga" | "tantangan" | "perasaan" | "syukur" | "materi";
  poin_minimum: number;
  poin_maksimum: number;
  berlaku_sampai: string | null;
  terbuka: boolean;
};
type LencanaKeluarga = {
  slug: string;
  nama: string;
  ikon: "keluarga" | "tantangan" | "perasaan" | "syukur" | "materi";
  syarat: string;
  terbuka: boolean;
};

function mundurHari(tanggal: string, jumlah: number) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - jumlah);
  return d.toISOString().slice(0, 10);
}

export default async function Halaman() {
  const { supabase, user, rumah } = await ambilSesi();

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
  const peranTargetTantangan = ["ayah", "ibu", "anak"].includes(rumah.peran) ? rumah.peran : null;
  const queryHarian = supabase
    .from("tantangan_harian")
    .select("mode, dilewati, tantangan:tantangan_slug (slug, judul, isi, kategori, menit, poin, peringatan)")
    .eq("keluarga_id", rumah.id)
    .eq("tanggal", hari);
  const harianPromise = rumah.peran === "anak"
    ? queryHarian.eq("anak_id", user.id).maybeSingle()
    : queryHarian.is("anak_id", null).eq("peran_penugasan", rumah.peran).maybeSingle();
  const queryTantanganPin = supabase.from("tantangan")
    .select("slug, judul, isi, tenggat, peran_target")
    .eq("dipin", true).eq("aktif", true).order("judul");
  if (peranTargetTantangan) {
    queryTantanganPin.or(`peran_target.is.null,peran_target.eq.${peranTargetTantangan}`);
  } else {
    queryTantanganPin.is("peran_target", null);
  }
  const [ringkasan, harian, drive, checkinMinggu, daftarAnggota, tantanganPin, lencanaPoin, lencanaKeluarga] = await Promise.all([
    ambilRingkasan(supabase, rumah.id),
    harianPromise,
    supabase.rpc("status_drive_pusat", { p_keluarga: rumah.id }),
    supabase.from("checkin_perasaan").select("suasana")
      .eq("keluarga_id", rumah.id).gte("tanggal", mulaiMinggu).lte("tanggal", hari),
    supabase.from("anggota").select("user_id, peran, profil:user_id (nama, tgl_lahir)")
      .eq("keluarga_id", rumah.id).order("bergabung_at", { ascending: true }),
    queryTantanganPin,
    supabase.rpc("daftar_lencana_keluarga", { p_keluarga: rumah.id }),
    supabase.rpc("daftar_lencana_keluarga_bawaan", { p_keluarga: rumah.id }),
  ]);

  const semuaAnak = (daftarAnggota.data ?? [])
    .filter((a) => a.peran === "anak")
    .map((a) => ({
      id: a.user_id,
      nama: (a.profil as unknown as { nama: string; tgl_lahir: string | null } | null)?.nama ?? "Anak",
      tglLahir: (a.profil as unknown as { nama: string; tgl_lahir: string | null } | null)?.tgl_lahir ?? null,
    }));
  const anakTampil = rumah.peran === "anak"
    ? semuaAnak.filter((anak) => anak.id === user.id)
    : semuaAnak;
  const anakIds = anakTampil.map((anak) => anak.id);
  const [{ data: tugasAnak, error: tugasAnakError }, { data: buktiAnak, error: buktiAnakError }] =
    anakIds.length
      ? await Promise.all([
          supabase.from("tantangan_harian")
            .select("anak_id, mode, dilewati, tantangan:tantangan_slug (slug, judul, isi, kategori, menit, poin, peringatan)")
            .eq("keluarga_id", rumah.id).eq("tanggal", hari).in("anak_id", anakIds),
          supabase.from("bukti")
            .select("anak_id, tantangan_slug, status")
            .eq("keluarga_id", rumah.id).eq("tanggal", hari)
            .in("anak_id", anakIds).in("status", ["menunggu", "disetujui", "ditandai"]),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
  const tugasAnakDari = new Map((tugasAnak ?? []).map((item) => [item.anak_id, item]));
  const buktiAnakDari = new Map((buktiAnak ?? []).map((item) => [`${item.anak_id}:${item.tantangan_slug}`, item.status]));

  const t = harian.data?.tantangan as unknown as
    | { slug: string; judul: string; isi: string; kategori: string; menit: number; poin: number; peringatan: string | null }
    | undefined;
  const queryBuktiHariIni = t
    ? supabase.from("bukti")
        .select("status")
        .eq("keluarga_id", rumah.id)
        .eq("tantangan_slug", t.slug)
        .eq("tanggal", hari)
        .in("status", ["menunggu", "disetujui", "ditandai"])
    : null;
  const { data: buktiHariIni } = queryBuktiHariIni
    ? rumah.peran === "anak"
      ? await queryBuktiHariIni.eq("anak_id", user.id).maybeSingle()
      : await queryBuktiHariIni.is("anak_id", null).maybeSingle()
    : { data: null };

  const tahap = tahapRumah(ringkasan.poin);
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
      {tantanganPin.error ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          Tantangan yang dipin belum bisa dimuat. Muat ulang halaman.
        </p>
      ) : tantanganPin.data?.length ? (
        <section aria-labelledby="tantangan-pin" className="flex flex-col gap-3 border-b border-line pb-5">
          <div>
            <h2 id="tantangan-pin" className="text-lg font-semibold">Tantangan pilihan</h2>
            <p className="text-sm text-muted">Tantangan yang dipin admin tampil di bagian atas beranda.</p>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {tantanganPin.data.map((item) => (
              <li key={item.slug} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold">{item.judul}</h3>
                  {item.tenggat ? (
                    <p className="text-sm text-muted">Tenggat {formatTanggal(item.tenggat)}.</p>
                  ) : null}
                </div>
                <TautanTombol href={`/tantangan/${item.slug}`} variant="sekunder" className="self-start">
                  Buka tantangan
                </TautanTombol>
              </li>
            ))}
          </ul>
        </section>
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

        {((orangTua && (daftarAnggota.error || anakTampil.length > 0))
          || (rumah.peran === "anak" && daftarAnggota.error)) ? (
          <article className="flex flex-col gap-4 rounded-2xl border border-on-aksen/10 bg-aksen p-5 text-on-aksen shadow-sm">
            {!t ? (
              <>
                <h2 className="text-lg font-semibold">{orangTua ? "Tantangan untuk Anda" : "Situasi hari ini"}</h2>
                <p>Pilih situasi agar tantangan hari ini sesuai dengan waktu yang tersedia.</p>
                <ModePilih keluargaId={rumah.id} anakId={rumah.peran === "anak" ? user.id : undefined} />
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{orangTua ? "Tantangan untuk Anda" : "Tantangan hari ini"}</p>
                  <p className="text-sm">
                    {labelKategori(t.kategori)}, {t.menit} menit, +{t.poin} poin
                    {modeAktif && modeAktif.nilai !== "biasa" ? `, ${modeAktif.label.toLowerCase()}` : ""}
                  </p>
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
              </>
            )}
          </article>
        ) : null}

        {daftarAnggota.error ? (
          <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
            {rumah.peran === "anak"
              ? "Daftar anggota keluarga belum bisa dimuat. Bagian tantangan pribadi tetap tersedia di atas."
              : "Daftar anak di rumah belum bisa dimuat. Muat ulang halaman."}
          </p>
        ) : anakTampil.length > 0 ? (
          <section aria-labelledby="tantangan-anak" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="tantangan-anak" className="text-lg font-semibold">Tantangan tiap anak</h2>
              <p className="text-muted">Setiap anak mendapat tantangan sesuai kelompok umurnya. Bukti tetap dinilai anggota keluarga lain.</p>
            </div>
            {tugasAnakError || buktiAnakError ? (
              <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
                Status tantangan anak belum bisa dimuat. Muat ulang halaman.
              </p>
            ) : anakTampil.map((anak) => {
              const harianAnak = tugasAnakDari.get(anak.id);
              const tantangan = harianAnak?.tantangan as unknown as
                | { slug: string; judul: string; isi: string; kategori: string; menit: number; poin: number; peringatan: string | null }
                | undefined;
              const statusBukti = tantangan ? buktiAnakDari.get(`${anak.id}:${tantangan.slug}`) : null;
              const segmen = segmenUsiaAnak(anak.tglLahir);
              return (
                <article key={anak.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold">{anak.nama}</h3>
                    <p className="text-sm text-muted">
                      Kelompok usia: {labelSegmen(segmen)}
                    </p>
                  </div>
                  {!tantangan ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-muted">Pilih situasi agar tantangan hari ini sesuai dengan waktu yang tersedia.</p>
                      <ModePilih keluargaId={rumah.id} anakId={anak.id} />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-muted">
                          {labelKategori(tantangan.kategori)}, {tantangan.menit} menit, +{tantangan.poin} poin
                        </p>
                        <h4 className="text-lg font-semibold">{tantangan.judul}</h4>
                        <p>{tantangan.isi}</p>
                        {tantangan.peringatan ? <p className="font-semibold">{tantangan.peringatan}</p> : null}
                      </div>
                      {harianAnak?.dilewati ? (
                        <p className="font-semibold">Dilewati hari ini.</p>
                      ) : statusBukti === "disetujui" ? (
                        <p className="font-semibold">Selesai dan disetujui. Poin sudah masuk.</p>
                      ) : statusBukti ? (
                        <p className="font-semibold">Bukti terkirim, menunggu penilaian anggota lain.</p>
                      ) : (
                        <TautanTombol
                          href={`/tantangan/${tantangan.slug}?anak=${anak.id}`}
                          variant="sekunder"
                          className="self-start"
                        >
                          Kirim bukti untuk selesai
                        </TautanTombol>
                      )}
                      {orangTua && !statusBukti ? (
                        <div className="flex flex-wrap gap-3">
                          <form action={aturTantangan}>
                            <input type="hidden" name="keluarga_id" value={rumah.id} />
                            <input type="hidden" name="anak_id" value={anak.id} />
                            <input type="hidden" name="mode" value={harianAnak?.mode ?? "biasa"} />
                            <input type="hidden" name="ganti" value="1" />
                            <Tombol variant="sekunder">Ganti tantangan</Tombol>
                          </form>
                          {!harianAnak?.dilewati ? (
                            <form action={lewatiTantangan}>
                              <input type="hidden" name="keluarga_id" value={rumah.id} />
                              <input type="hidden" name="anak_id" value={anak.id} />
                              <Tombol variant="sekunder">Lewati hari ini</Tombol>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                      {orangTua ? (
                        <details className="rounded-lg border border-line p-3">
                          <summary className="min-h-11 py-2 font-semibold">Ubah situasi hari ini</summary>
                          <div className="pt-2">
                            <ModePilih keluargaId={rumah.id} anakId={anak.id} aktif={harianAnak?.mode} />
                          </div>
                        </details>
                      ) : null}
                    </>
                  )}
                </article>
              );
            })}
          </section>
        ) : !t ? (
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
          {lencanaKeluarga.error ? (
            <li role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
              Lencana keluarga belum bisa dimuat. Muat ulang halaman.
            </li>
          ) : ((lencanaKeluarga.data ?? []) as LencanaKeluarga[]).map((l) => (
            <li
              key={l.slug}
              className={`rounded-lg p-3 ${
                l.terbuka ? "border border-primary bg-surface" : "border border-dashed border-field text-muted"
              }`}
            >
              <div className="flex items-center gap-3">
                <IkonFitur nama={l.ikon} className="size-6 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {l.nama}
                    <span className="ml-2 text-sm font-normal">{l.terbuka ? "Terbuka" : "Terkunci"}</span>
                  </p>
                  <p className="text-sm">{l.syarat}</p>
                </div>
              </div>
            </li>
          ))}
          {lencanaPoin.error ? (
            <li role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
              Lencana poin tambahan belum bisa dimuat. Muat ulang halaman.
            </li>
          ) : ((lencanaPoin.data ?? []) as LencanaPoin[]).map((item) => {
            return (
              <li
                key={item.id}
                className={`flex items-center gap-3 rounded-lg p-3 ${
                  item.terbuka ? "border border-primary bg-surface" : "border border-dashed border-field text-muted"
                }`}
              >
                <IkonFitur nama={item.ikon} className="size-6 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {item.nama}
                    <span className="ml-2 text-sm font-normal">{item.terbuka ? "Terbuka" : "Terkunci"}</span>
                  </p>
                  <p className="text-sm">
                    {item.poin_minimum} hingga {item.poin_maksimum} poin keluarga
                  </p>
                  {item.berlaku_sampai ? (
                    <p className="text-sm">
                      Bisa didapat sampai {waktuLencana.format(new Date(item.berlaku_sampai))} WIB.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted">
          Poin keluarga tetap bertambah setelah lencana terbuka dan menjadi total poin untuk event serta reward khusus.
        </p>
      </section>
    </div>
  );
}

function ModePilih({ keluargaId, aktif, anakId }: { keluargaId: string; aktif?: string; anakId?: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {MODE.map((m) => (
        <li key={m.nilai}>
          <form action={aturTantangan}>
            <input type="hidden" name="keluarga_id" value={keluargaId} />
            {anakId ? <input type="hidden" name="anak_id" value={anakId} /> : null}
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
