"use client";

import { useActionState } from "react";
import { tinjauAdmin, type HasilA } from "@/app/actions-admin";
import { Medan, Pesan, Tombol } from "@/components/ui";

const awal: HasilA = {};

export function FormAdminTinjau({ id, status }: { id: string; status: string }) {
  const [hasil, aksi] = useActionState(tinjauAdmin, awal);
  return (
    <form action={aksi} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <Medan
        id={`alasan-${id}`}
        name="alasan"
        label="Alasan (wajib untuk tolak atau tandai)"
        maxLength={300}
      />
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <div className="flex flex-wrap gap-2">
        {status !== "disetujui" ? (
          <Tombol name="status" value="disetujui" teksTunggu="...">
            Setujui
          </Tombol>
        ) : null}
        {status !== "ditolak" ? (
          <Tombol name="status" value="ditolak" variant="sekunder" teksTunggu="...">
            Tolak
          </Tombol>
        ) : null}
        {status !== "ditandai" ? (
          <Tombol name="status" value="ditandai" variant="bahaya" teksTunggu="...">
            Tandai tidak pantas
          </Tombol>
        ) : null}
      </div>
    </form>
  );
}
