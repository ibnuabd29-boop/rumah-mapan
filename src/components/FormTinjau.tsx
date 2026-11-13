"use client";

import { useActionState } from "react";
import { tinjauBukti, type HasilT } from "@/app/actions-tantangan";
import { Medan, Pesan, Tombol } from "@/components/ui";

const awal: HasilT = {};

export function FormTinjau({ id }: { id: string }) {
  const [hasil, aksi] = useActionState(tinjauBukti, awal);
  return (
    <form action={aksi} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <Medan
        id={`alasan-${id}`}
        name="alasan"
        label="Alasan jika ditolak"
        petunjuk="Wajib diisi hanya saat menolak."
        maxLength={300}
      />
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <div className="flex flex-wrap gap-3">
        <Tombol name="status" value="disetujui" teksTunggu="Memproses...">
          Setujui
        </Tombol>
        <Tombol name="status" value="ditolak" variant="bahaya" teksTunggu="Memproses...">
          Tolak
        </Tombol>
      </div>
    </form>
  );
}
