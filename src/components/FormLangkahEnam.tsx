"use client";

import { useActionState } from "react";
import {
  balasCatatan,
  buatCatatan,
  buatCitaCita,
  kirimApresiasi,
  simpanPerasaan,
  tandaiMateriSelesai,
  tambahLangkahCitaCita,
  tandaiLangkahCitaCita,
  type HasilLangkahEnam,
} from "@/app/actions-langkah-enam";
import { Centang, Medan, Pesan, Pilihan, Tombol } from "@/components/ui";
import { SUASANA, type Suasana } from "@/lib/langkah-enam";

const awal: HasilLangkahEnam = {};

export function FormPerasaan({ suasanaHariIni }: { suasanaHariIni?: Suasana }) {
  const [hasil, aksi] = useActionState(simpanPerasaan, awal);
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold">Bagaimana suasana Anda hari ini?</legend>
        {SUASANA.map((item) => (
          <label key={item.nilai} className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 py-2 hover:bg-line/30">
            <input
              type="radio"
              name="suasana"
              value={item.nilai}
              defaultChecked={suasanaHariIni === item.nilai}
              required
              className="size-5 accent-[var(--primary)]"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol teksTunggu="Menyimpan...">Simpan suasana hari ini</Tombol>
    </form>
  );
}

export function FormCatatan() {
  const [hasil, aksi] = useActionState(buatCatatan, awal);
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <Pilihan id="catatan-perasaan" name="suasana" label="Perasaan yang ingin dicatat (opsional)" defaultValue="">
        <option value="">Tidak memilih</option>
        {SUASANA.map((item) => <option key={item.nilai} value={item.nilai}>{item.label}</option>)}
      </Pilihan>
      <label htmlFor="catatan-isi" className="font-semibold">Catatan hari ini</label>
      <textarea
        id="catatan-isi"
        name="isi"
        required
        maxLength={3000}
        rows={5}
        className="rounded-lg border border-field bg-surface px-3 py-2 text-ink"
        aria-describedby="catatan-bantuan"
      />
      <p id="catatan-bantuan" className="text-sm text-muted">
        Bagikan hanya hal yang ingin kamu ceritakan.
      </p>
      <Centang id="catatan-dibagikan" name="dibagikan" defaultChecked>
        Bagikan ke orang tua atau wali. Jika tidak dicentang, catatan hanya dapat dibaca oleh akunmu.
      </Centang>
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol teksTunggu="Menyimpan...">Simpan catatan</Tombol>
    </form>
  );
}

export function FormBalasanCatatan({ catatanId }: { catatanId: string }) {
  const [hasil, aksi] = useActionState(balasCatatan, awal);
  const id = `balasan-${catatanId}`;
  return (
    <form action={aksi} className="flex flex-col gap-3 border-t border-line pt-3">
      <input type="hidden" name="catatan_id" value={catatanId} />
      <label htmlFor={id} className="font-semibold">Balas catatan</label>
      <textarea
        id={id}
        name="isi"
        maxLength={1000}
        rows={2}
        required
        className="rounded-lg border border-field bg-surface px-3 py-2 text-ink"
      />
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol variant="sekunder" teksTunggu="Mengirim...">Kirim balasan</Tombol>
    </form>
  );
}

export function FormCitaCita() {
  const [hasil, aksi] = useActionState(buatCitaCita, awal);
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <Medan id="cita-judul" label="Cita-cita keluarga" maxLength={100} required />
      <label htmlFor="cita-alasan" className="font-semibold">Mengapa ini penting?</label>
      <textarea
        id="cita-alasan"
        name="alasan"
        maxLength={500}
        rows={2}
        required
        className="rounded-lg border border-field bg-surface px-3 py-2 text-ink"
      />
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol teksTunggu="Menyimpan...">Tambah ke papan cita-cita</Tombol>
    </form>
  );
}

export function FormLangkahCitaCita({ citaId }: { citaId: string }) {
  const [hasil, aksi] = useActionState(tambahLangkahCitaCita, awal);
  const id = `langkah-kecil-${citaId}`;
  return (
    <form action={aksi} className="flex flex-col gap-3">
      <input type="hidden" name="cita_cita_id" value={citaId} />
      <Medan id={id} label="Langkah kecil berikutnya" maxLength={240} required />
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol variant="sekunder" teksTunggu="Menambahkan...">Tambah langkah</Tombol>
    </form>
  );
}

export function FormTandaiLangkah({ id, selesai }: { id: string; selesai: boolean }) {
  const [hasil, aksi] = useActionState(tandaiLangkahCitaCita, awal);
  return (
    <form action={aksi} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="selesai" value={selesai ? "tidak" : "ya"} />
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol variant="sekunder" aria-label={selesai ? "Batalkan tanda langkah selesai" : "Tandai langkah selesai"}>
        {selesai ? "Batalkan" : "Tandai selesai"}
      </Tombol>
    </form>
  );
}

export function FormTandaiMateri({ slug, sudahDibaca }: { slug: string; sudahDibaca: boolean }) {
  const [hasil, aksi] = useActionState(tandaiMateriSelesai, awal);
  return (
    <form action={aksi} className="flex flex-col items-start gap-2">
      <input type="hidden" name="materi_slug" value={slug} />
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol variant="sekunder" disabled={sudahDibaca} teksTunggu="Menyimpan...">
        {sudahDibaca ? "Sudah dibaca" : "Tandai sudah dibaca"}
      </Tombol>
    </form>
  );
}

export function FormApresiasi({ anggota }: { anggota: { id: string; nama: string }[] }) {
  const [hasil, aksi] = useActionState(kirimApresiasi, awal);
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <Pilihan id="apresiasi-penerima" label="Untuk anggota (opsional)" defaultValue="">
        <option value="">Untuk seluruh keluarga</option>
        {anggota.map((orang) => (
          <option key={orang.id} value={orang.id}>{orang.nama}</option>
        ))}
      </Pilihan>
      <label htmlFor="apresiasi-isi" className="font-semibold">Hal yang ingin kamu hargai</label>
      <textarea
        id="apresiasi-isi"
        name="isi"
        maxLength={300}
        rows={3}
        required
        className="rounded-lg border border-field bg-surface px-3 py-2 text-ink"
      />
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol teksTunggu="Mengirim...">Kirim apresiasi</Tombol>
    </form>
  );
}
