"use client";

import { useActionState, useEffect, useRef } from "react";
import { simpanTantanganAdmin, type HasilA } from "@/app/actions-admin";
import { Medan, Pesan, Pilihan, Tombol } from "@/components/ui";
import { KATEGORI, SEGMEN_TANTANGAN } from "@/lib/tantangan";

type Tantangan = {
  slug: string;
  kategori: string;
  segmen: string | null;
  judul: string;
  isi: string;
  menit: number;
  poin: number;
  peringatan: string | null;
  poin_terkunci: boolean;
  kategori_terkunci: boolean;
  segmen_terkunci: boolean;
};

const awal: HasilA = {};

export function FormAdminTantangan({ tantangan }: { tantangan?: Tantangan }) {
  const [hasil, aksi] = useActionState(simpanTantanganAdmin, awal);
  const form = useRef<HTMLFormElement>(null);
  const id = tantangan?.slug ?? "baru";

  useEffect(() => {
    if (hasil.ok && !tantangan) form.current?.reset();
  }, [hasil, tantangan]);

  return (
    <form ref={form} action={aksi} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={tantangan?.slug ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Medan
          id={`judul-${id}`}
          name="judul"
          label="Judul tantangan"
          defaultValue={tantangan?.judul}
          required
          minLength={3}
          maxLength={100}
        />
        {tantangan?.kategori_terkunci ? (
          <div className="flex flex-col gap-1.5">
            <Pilihan
              id={`kategori-${id}`}
              name="kategori_tampilan"
              label="Kategori"
              defaultValue={tantangan.kategori}
              disabled
            >
              {KATEGORI.map((kategori) => (
                <option key={kategori.nilai} value={kategori.nilai}>{kategori.label}</option>
              ))}
            </Pilihan>
            <input type="hidden" name="kategori" value={tantangan.kategori} />
            <p className="text-sm text-muted">Kategori dikunci karena bukti tantangan ini sudah tercatat.</p>
          </div>
        ) : (
          <Pilihan
            id={`kategori-${id}`}
            name="kategori"
            label="Kategori"
            defaultValue={tantangan?.kategori ?? KATEGORI[0].nilai}
          >
            {KATEGORI.map((kategori) => (
              <option key={kategori.nilai} value={kategori.nilai}>{kategori.label}</option>
            ))}
          </Pilihan>
        )}
      </div>
      {tantangan?.segmen_terkunci ? (
        <div className="flex flex-col gap-1.5">
          <Pilihan
            id={`segmen-${id}`}
            name="segmen_tampilan"
            label="Segmen umur"
            value={tantangan.segmen ?? ""}
            disabled
          >
            <option value="">Untuk semua usia</option>
            {SEGMEN_TANTANGAN.map((segmen) => (
              <option key={segmen.nilai} value={segmen.nilai}>{segmen.label}</option>
            ))}
          </Pilihan>
          <input type="hidden" name="segmen" value={tantangan.segmen ?? ""} />
          <p className="text-sm text-muted">Segmen umur dikunci karena bukti tantangan ini sudah tercatat.</p>
        </div>
      ) : (
        <Pilihan
          id={`segmen-${id}`}
          name="segmen"
          label="Segmen umur"
          defaultValue={tantangan?.segmen ?? ""}
        >
          <option value="">Untuk semua usia</option>
          {SEGMEN_TANTANGAN.map((segmen) => (
            <option key={segmen.nilai} value={segmen.nilai}>{segmen.label}</option>
          ))}
        </Pilihan>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`isi-${id}`} className="font-semibold">Instruksi atau pertanyaan</label>
        <textarea
          id={`isi-${id}`}
          name="isi"
          defaultValue={tantangan?.isi}
          required
          minLength={5}
          maxLength={2000}
          rows={3}
          className="min-h-24 rounded-lg border border-field bg-surface px-3 py-2 text-ink focus:border-primary"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Medan
          id={`menit-${id}`}
          name="menit"
          label="Durasi (menit)"
          type="number"
          min={3}
          max={120}
          defaultValue={tantangan?.menit ?? 10}
          required
        />
        {tantangan?.poin_terkunci ? (
          <div className="flex flex-col gap-1.5">
            <Medan
              id={`poin-${id}`}
              name="poin_tampilan"
              label="Poin"
              type="number"
              value={tantangan.poin}
              disabled
              aria-describedby={`poin-bantuan-${id}`}
            />
            <input type="hidden" name="poin" value={tantangan.poin} />
            <p id={`poin-bantuan-${id}`} className="text-sm text-muted">
              Poin dikunci karena bukti tantangan ini sudah tercatat.
            </p>
          </div>
        ) : (
          <Medan
            id={`poin-${id}`}
            name="poin"
            label="Poin"
            type="number"
            min={5}
            max={30}
            defaultValue={tantangan?.poin ?? 10}
            required
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`peringatan-${id}`} className="font-semibold">Peringatan keselamatan (opsional)</label>
        <textarea
          id={`peringatan-${id}`}
          name="peringatan"
          defaultValue={tantangan?.peringatan ?? ""}
          maxLength={500}
          rows={2}
          className="min-h-20 rounded-lg border border-field bg-surface px-3 py-2 text-ink focus:border-primary"
        />
      </div>
      {!tantangan ? (
        <p className="text-sm text-muted">ID dibuat dari judul. Tantangan yang sudah dibuat mempertahankan ID agar tautan dan riwayat tetap berlaku.</p>
      ) : null}
      {tantangan?.poin_terkunci ? (
        <p className="text-sm text-muted">Kategori dan poin tidak dapat diubah setelah bukti tercatat agar ringkasan progres tetap sesuai.</p>
      ) : null}
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <div>
        <Tombol>{tantangan ? "Simpan perubahan" : "Tambah tantangan"}</Tombol>
      </div>
    </form>
  );
}
