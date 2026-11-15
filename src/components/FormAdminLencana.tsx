"use client";

import { useActionState, useEffect, useRef } from "react";
import { simpanLencanaAdmin, type HasilA } from "@/app/actions-admin";
import { Medan, Pesan, Pilihan, Tombol } from "@/components/ui";

type IkonLencana = "keluarga" | "tantangan" | "perasaan" | "syukur" | "materi";
type Lencana = { id: string; nama: string; ikon: IkonLencana; target_poin: number; aktif: boolean };

const IKON: { nilai: IkonLencana; label: string }[] = [
  { nilai: "keluarga", label: "Keluarga" },
  { nilai: "tantangan", label: "Tantangan" },
  { nilai: "perasaan", label: "Perasaan" },
  { nilai: "syukur", label: "Syukur" },
  { nilai: "materi", label: "Materi" },
];

const awal: HasilA = {};

export function FormAdminLencana({ lencana }: { lencana?: Lencana }) {
  const [hasil, aksi] = useActionState(simpanLencanaAdmin, awal);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (hasil.ok && !lencana) form.current?.reset();
  }, [hasil, lencana]);

  return (
    <form ref={form} action={aksi} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={lencana?.id ?? ""} />
      <Medan
        id={`nama-lencana-${lencana?.id ?? "baru"}`}
        name="nama"
        label="Nama lencana"
        defaultValue={lencana?.nama}
        required
        minLength={3}
        maxLength={60}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Pilihan
          id={`ikon-lencana-${lencana?.id ?? "baru"}`}
          name="ikon"
          label="Ikon"
          defaultValue={lencana?.ikon ?? IKON[0].nilai}
        >
          {IKON.map((ikon) => (
            <option key={ikon.nilai} value={ikon.nilai}>{ikon.label}</option>
          ))}
        </Pilihan>
        <Medan
          id={`target-lencana-${lencana?.id ?? "baru"}`}
          name="target_poin"
          label="Target poin"
          type="number"
          min={1}
          max={1_000_000}
          defaultValue={lencana?.target_poin ?? 50}
          required
        />
      </div>
      {lencana ? (
        <Pilihan
          id={`status-lencana-${lencana.id}`}
          name="aktif"
          label="Tampilan"
          defaultValue={String(lencana.aktif)}
        >
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </Pilihan>
      ) : (
        <input type="hidden" name="aktif" value="true" />
      )}
      <p className="text-sm text-muted">Ikon dipilih dari simbol fitur Rumah Mapan.</p>
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <div>
        <Tombol>{lencana ? "Simpan lencana" : "Tambah lencana poin"}</Tombol>
      </div>
    </form>
  );
}
