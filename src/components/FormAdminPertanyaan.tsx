"use client";

import { useActionState, useEffect, useRef } from "react";
import { simpanPertanyaanAdmin, type HasilA } from "@/app/actions-admin";
import { Pesan, Pilihan, Tombol } from "@/components/ui";

type Jenis = "obrolan" | "materi_genre";
type Kelompok = { jenis: Jenis; slug: string; nama: string };
type Pertanyaan = { id: string; jenis: Jenis; kelompok: string; teks: string };

const awal: HasilA = {};

export function FormAdminPertanyaan({
  jenis,
  kelompok,
  pertanyaan,
}: {
  jenis: Jenis;
  kelompok: Kelompok[];
  pertanyaan?: Pertanyaan;
}) {
  const [hasil, aksi] = useActionState(simpanPertanyaanAdmin, awal);
  const form = useRef<HTMLFormElement>(null);
  const id = pertanyaan?.id ?? `baru-${jenis}`;

  useEffect(() => {
    if (hasil.ok && !pertanyaan) form.current?.reset();
  }, [hasil, pertanyaan]);

  return (
    <form ref={form} action={aksi} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={pertanyaan?.id ?? ""} />
      <input type="hidden" name="jenis" value={jenis} />
      <Pilihan
        id={`kelompok-${id}`}
        name="kelompok"
        label={jenis === "obrolan" ? "Tema obrolan" : "Topik materi"}
        defaultValue={pertanyaan?.kelompok ?? kelompok[0]?.slug}
        required
      >
        {kelompok.map((item) => (
          <option key={item.slug} value={item.slug}>{item.nama}</option>
        ))}
      </Pilihan>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`teks-${id}`} className="font-semibold">Pertanyaan</label>
        <textarea
          id={`teks-${id}`}
          name="teks"
          defaultValue={pertanyaan?.teks}
          required
          minLength={5}
          maxLength={500}
          rows={2}
          className="min-h-20 rounded-lg border border-field bg-surface px-3 py-2 text-ink focus:border-primary"
        />
      </div>
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <div>
        <Tombol>{pertanyaan ? "Simpan perubahan" : "Tambah pertanyaan"}</Tombol>
      </div>
    </form>
  );
}
