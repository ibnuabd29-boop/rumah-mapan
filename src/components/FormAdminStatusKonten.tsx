"use client";

import { useActionState } from "react";
import { statusPertanyaanAdmin, statusTantanganAdmin, type HasilA } from "@/app/actions-admin";
import { Pesan, Tombol } from "@/components/ui";

const awal: HasilA = {};

export function FormAdminStatusKonten({
  jenis,
  id,
  aktif,
}: {
  jenis: "tantangan" | "pertanyaan";
  id: string;
  aktif: boolean;
}) {
  const action = jenis === "tantangan" ? statusTantanganAdmin : statusPertanyaanAdmin;
  const [hasil, aksi] = useActionState(action, awal);

  return (
    <form action={aksi} className="flex flex-col items-start gap-2">
      <input type="hidden" name={jenis === "tantangan" ? "slug" : "id"} value={id} />
      <input type="hidden" name="aktif" value={aktif ? "false" : "true"} />
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol variant={aktif ? "bahaya" : "sekunder"}>
        {aktif ? "Arsipkan" : "Aktifkan"}
      </Tombol>
    </form>
  );
}
