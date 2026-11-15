"use client";

import { useActionState } from "react";
import { simpanLencanaKeluargaAdmin } from "@/app/actions-admin";
import { Medan, Pesan, Pilihan, Tombol } from "@/components/ui";
import { waktuWibKeInput } from "@/lib/waktu-wib";

type IkonLencana = "keluarga" | "tantangan" | "perasaan" | "syukur" | "materi";
type JenisSyarat = "tantangan_selesai" | "hari_beruntun" | "komunikasi" | "poin";
type LencanaKeluarga = {
  slug: string;
  nama: string;
  ikon: IkonLencana;
  syarat_jenis: JenisSyarat;
  target: number | null;
  poin_minimum: number | null;
  poin_maksimum: number | null;
  berlaku_sampai: string | null;
  kedaluwarsa: boolean;
  aktif: boolean;
};

const IKON: { nilai: IkonLencana; label: string }[] = [
  { nilai: "keluarga", label: "Keluarga" },
  { nilai: "tantangan", label: "Tantangan" },
  { nilai: "perasaan", label: "Perasaan" },
  { nilai: "syukur", label: "Syukur" },
  { nilai: "materi", label: "Materi" },
];

const KETERANGAN_SYARAT: Record<JenisSyarat, string> = {
  tantangan_selesai: "Jumlah tantangan yang harus disetujui.",
  hari_beruntun: "Jumlah hari berturut-turut dengan tantangan disetujui.",
  komunikasi: "Jumlah tantangan komunikasi yang harus disetujui.",
  poin: "Total poin keluarga yang harus dicapai.",
};

export function FormAdminLencanaKeluarga({ lencana }: { lencana: LencanaKeluarga }) {
  const [hasil, aksi] = useActionState(simpanLencanaKeluargaAdmin, {});
  const berbasisPoin = lencana.syarat_jenis === "poin";

  return (
    <form action={aksi} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={lencana.slug} />
      <Medan
        id={`nama-lencana-keluarga-${lencana.slug}`}
        name="nama"
        label="Nama lencana"
        defaultValue={lencana.nama}
        required
        minLength={3}
        maxLength={60}
      />
      <Pilihan
        id={`ikon-lencana-keluarga-${lencana.slug}`}
        name="ikon"
        label="Ikon"
        defaultValue={lencana.ikon}
      >
        {IKON.map((ikon) => (
          <option key={ikon.nilai} value={ikon.nilai}>{ikon.label}</option>
        ))}
      </Pilihan>
      <p className="text-sm text-muted">{KETERANGAN_SYARAT[lencana.syarat_jenis]}</p>
      {berbasisPoin ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Medan
              id={`poin-minimum-lencana-keluarga-${lencana.slug}`}
              name="poin_minimum"
              label="Poin minimum"
              type="number"
              min={1}
              max={1_000_000}
              defaultValue={lencana.poin_minimum ?? ""}
              required
            />
            <Medan
              id={`poin-maksimum-lencana-keluarga-${lencana.slug}`}
              name="poin_maksimum"
              label="Poin maksimum"
              type="number"
              min={1}
              max={1_000_000}
              defaultValue={lencana.poin_maksimum ?? ""}
              required
            />
          </div>
          <Medan
            id={`berlaku-sampai-lencana-keluarga-${lencana.slug}`}
            name="berlaku_sampai"
            label="Bisa didapat sampai"
            type="datetime-local"
            defaultValue={waktuWibKeInput(lencana.berlaku_sampai)}
            petunjuk="Gunakan waktu WIB. Kosongkan jika tidak ada batas waktu."
          />
        </>
      ) : (
        <>
          <Medan
            id={`target-lencana-keluarga-${lencana.slug}`}
            name="target"
            label="Target syarat"
            type="number"
            min={1}
            max={1_000_000}
            defaultValue={lencana.target ?? ""}
            required
          />
          <input type="hidden" name="poin_minimum" value="" />
          <input type="hidden" name="poin_maksimum" value="" />
          <input type="hidden" name="berlaku_sampai" value="" />
        </>
      )}
      <Pilihan
        id={`status-lencana-keluarga-${lencana.slug}`}
        name="aktif"
        label="Status lencana"
        defaultValue={String(lencana.aktif)}
      >
        <option value="true">Aktif</option>
        <option value="false">Nonaktif</option>
      </Pilihan>
      {lencana.kedaluwarsa ? (
        <p className="text-sm text-muted">Batas waktu sebelumnya sudah lewat. Atur waktu baru untuk mengaktifkan kembali.</p>
      ) : null}
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <div><Tombol>Simpan lencana keluarga</Tombol></div>
    </form>
  );
}
