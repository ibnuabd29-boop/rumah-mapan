"use client";

import { useActionState, useEffect, useRef } from "react";
import { kirimLayanan, type HasilLayanan } from "@/app/actions-layanan";
import { Pesan, Tombol } from "@/components/ui";

type JenisLayanan = "kritik_saran" | "kesehatan_mental" | "konselor_sebaya";

const awal: HasilLayanan = {};

export function FormLayanan({
  jenis,
  judul,
}: {
  jenis: JenisLayanan;
  judul: string;
}) {
  const [hasil, aksi] = useActionState(kirimLayanan, awal);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (hasil.ok) form.current?.reset();
  }, [hasil]);

  return (
    <form ref={form} action={aksi} className="flex flex-col gap-3">
      <input type="hidden" name="jenis" value={jenis} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`isi-${jenis}`} className="font-semibold">{judul}</label>
        <textarea
          id={`isi-${jenis}`}
          name="isi"
          required
          minLength={10}
          maxLength={5000}
          rows={4}
          className="min-h-28 rounded-lg border border-field bg-surface px-3 py-2 text-ink focus:border-primary"
        />
      </div>
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <div><Tombol>Kirim</Tombol></div>
    </form>
  );
}
