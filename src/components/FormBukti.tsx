"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState } from "react";
import { kirimCerita, type HasilT } from "@/app/actions-tantangan";
import { daftarAntrean, kirimAntrean, kirimItem, hapusAntrean, simpanAntrean } from "@/lib/antrean";
import { kompresFoto } from "@/lib/kompres";
import { Pesan, Tombol } from "@/components/ui";

const awal: HasilT = {};
const hurufSaja = (t: string) => t.replace(/[^\p{L}]/gu, "").length;

type Props = {
  keluargaId: string;
  anakId: string | null;
  slug: string;
  statusDrive: "tersambung" | "terputus" | "belum" | "galat";
};

export function FormBukti({ keluargaId, anakId, slug, statusDrive }: Props) {
  const [jenis, setJenis] = useState<"cerita" | "foto">("cerita");
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold">Jenis bukti</legend>
        <div className="flex gap-3">
          {(["cerita", "foto"] as const).map((j) => (
            <label
              key={j}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 py-2 font-semibold ${
                jenis === j ? "border-primary bg-primary text-on-primary" : "border-field"
              }`}
            >
              <input
                type="radio"
                name="jenis"
                value={j}
                checked={jenis === j}
                onChange={() => setJenis(j)}
                className="sr-only"
              />
              {j === "cerita" ? "Cerita tertulis" : "Foto"}
            </label>
          ))}
        </div>
      </fieldset>

      {jenis === "cerita" ? (
        <FormCerita keluargaId={keluargaId} anakId={anakId} slug={slug} />
      ) : (
        <FormFoto keluargaId={keluargaId} anakId={anakId} slug={slug} statusDrive={statusDrive} />
      )}
    </div>
  );
}

function FormCerita({ keluargaId, anakId, slug }: { keluargaId: string; anakId: string | null; slug: string }) {
  const [hasil, aksi] = useActionState(kirimCerita, awal);
  const [teks, setTeks] = useState("");
  const huruf = hurufSaja(teks);
  return (
    <form action={aksi} className="flex flex-col gap-3">
      <input type="hidden" name="keluarga_id" value={keluargaId} />
      {anakId ? <input type="hidden" name="anak_id" value={anakId} /> : null}
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="teks" className="font-semibold">
          Ceritakan apa yang kalian lakukan
        </label>
        <textarea
          id="teks"
          name="teks"
          rows={5}
          maxLength={2000}
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          aria-describedby="hitung"
          className="rounded-lg border border-field bg-surface px-3 py-2 text-ink"
        />
        <p id="hitung" className="text-sm text-muted">
          {huruf >= 20 ? `${huruf} huruf. Cukup.` : `${huruf} dari minimal 20 huruf.`}
        </p>
      </div>
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol teksTunggu="Mengirim...">Kirim bukti</Tombol>
    </form>
  );
}

function FormFoto({ keluargaId, anakId, slug, statusDrive }: Props) {
  const router = useRouter();
  const [teks, setTeks] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string>();
  const [ok, setOk] = useState<string>();
  const [antre, setAntre] = useState(0);

  const muat = useCallback(async () => {
    setAntre((await daftarAntrean().catch(() => [])).length);
  }, []);

  const kirimSisa = useCallback(async () => {
    const h = await kirimAntrean().catch(() => null);
    await muat();
    if (h?.terkirim) {
      setOk("Foto yang menunggu sudah terkirim.");
      router.refresh();
    }
    if (h?.ditolak.length) setGalat(h.ditolak[0]);
  }, [muat, router]);

  useEffect(() => {
    // Saat halaman dibuka atau koneksi kembali, kirim foto yang tertahan.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void kirimSisa();
    window.addEventListener("online", kirimSisa);
    return () => window.removeEventListener("online", kirimSisa);
  }, [kirimSisa]);

  if (statusDrive !== "tersambung") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-kayu p-3">
        <p>
          <strong>Foto belum bisa dikirim.</strong>{" "}
          {statusDrive === "galat"
            ? "Status folder Drive admin belum bisa diperiksa. Muat ulang halaman."
            : statusDrive === "terputus"
              ? "Koneksi Google Drive admin terputus. Minta admin platform menghubungkannya kembali."
              : "Admin platform belum menghubungkan folder Google Drive."}{" "}
          Anda tidak perlu menghubungkan akun Google pribadi. Sementara itu, kirim bukti berupa cerita tertulis.
        </p>
      </div>
    );
  }

  async function kirim(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("foto") as HTMLInputElement;
    const berkas = input.files?.[0];
    setGalat(undefined);
    setOk(undefined);
    if (!berkas) return setGalat("Pilih foto dulu.");
    setSibuk(true);
    try {
      const foto = await kompresFoto(berkas);
      const item = { id: crypto.randomUUID(), keluargaId, anakId, slug, teks, foto, dibuat: Date.now() };
      await simpanAntrean(item);
      const r = await kirimItem(item);
      if (r.ok) {
        await hapusAntrean(item.id);
        setOk("Foto terkirim. Poin masuk setelah anggota keluarga lain menyetujuinya.");
        setTeks("");
        input.value = "";
        router.refresh();
      } else if (r.ulang) {
        setOk(r.galat.includes("koneksi") ? r.galat : "Foto disimpan dan akan dicoba kirim lagi otomatis.");
      } else {
        await hapusAntrean(item.id);
        setGalat(r.galat);
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Foto tidak bisa diproses. Coba foto lain.");
    } finally {
      setSibuk(false);
      await muat();
    }
  }

  return (
    <form onSubmit={kirim} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="foto" className="font-semibold">
          Foto
        </label>
        <input
          id="foto"
          name="foto"
          type="file"
          accept="image/*"
          required
          className="min-h-11 rounded-lg border border-field bg-surface px-3 py-2 text-ink"
        />
        <p className="text-sm text-muted">
          Foto dikompres di ponsel sebelum dikirim ke folder Google Drive admin. Anggota keluarga tidak perlu masuk ke Google.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="catatan-foto" className="font-semibold">
          Keterangan (boleh dikosongkan)
        </label>
        <textarea
          id="catatan-foto"
          rows={2}
          maxLength={2000}
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          className="rounded-lg border border-field bg-surface px-3 py-2 text-ink"
        />
      </div>
      <Pesan galat={galat} ok={ok} />
      {antre > 0 ? (
        <p role="status" className="text-sm text-muted">
          {antre} foto menunggu terkirim. Foto dikirim otomatis saat koneksi kembali.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={sibuk}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-60"
      >
        {sibuk ? "Mengirim..." : "Kirim foto"}
      </button>
    </form>
  );
}
