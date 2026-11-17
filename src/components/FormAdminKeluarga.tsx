"use client";

import { useActionState, useState } from "react";
import { hapusDataKeluargaAdmin, hapusKeluargaAdmin, type HasilA } from "@/app/actions-admin";
import { Medan, Pesan, Tombol } from "@/components/ui";

const awal: HasilA = {};

export function FormAdminHapusDataKeluarga({
  keluargaId,
  namaKeluarga,
}: {
  keluargaId: string;
  namaKeluarga: string;
}) {
  const [buka, setBuka] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState("");
  const [hasil, aksi, pending] = useActionState(hapusDataKeluargaAdmin, awal);

  const cocok = konfirmasi.trim().toLowerCase() === "hapus data";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-ink">Hapus data riwayat & progres keluarga</h3>
        <p className="text-sm text-muted">
          Menghapus seluruh riwayat bukti tantangan, check-in perasaan, catatan harian, cita-cita, apresiasi, dan lencana perolehan keluarga <strong>{namaKeluarga}</strong>.
          Rumah dan akun anggota tetap utuh, poin dan progres akan kembali ke awal.
        </p>
      </div>

      {!buka ? (
        <div>
          <button
            type="button"
            onClick={() => setBuka(true)}
            className="inline-flex min-h-11 items-center rounded-lg border border-bahaya px-4 py-2 font-semibold text-bahaya hover:bg-bahaya/10 active:bg-bahaya/20"
          >
            Bersihkan data progres keluarga ini
          </button>
        </div>
      ) : (
        <form action={aksi} className="flex flex-col gap-3 rounded-lg border border-bahaya/40 bg-bahaya/5 p-4">
          <input type="hidden" name="id" value={keluargaId} />
          <p className="text-sm font-medium text-bahaya">
            Perhatian: Tindakan ini akan menghapus semua riwayat tantangan dan progres yang sudah dicapai. Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex flex-col gap-1.5">
            <Medan
              id={`konfirmasi-data-${keluargaId}`}
              label="Ketik HAPUS DATA untuk mengonfirmasi:"
              value={konfirmasi}
              onChange={(e) => setKonfirmasi(e.target.value)}
              placeholder="HAPUS DATA"
              autoComplete="off"
              required
            />
          </div>
          <Pesan galat={hasil.galat} ok={hasil.ok} />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Tombol
              variant="bahaya"
              disabled={!cocok || pending}
              teksTunggu="Menghapus data..."
            >
              Ya, hapus data progres
            </Tombol>
            <button
              type="button"
              onClick={() => {
                setBuka(false);
                setKonfirmasi("");
              }}
              className="inline-flex min-h-11 items-center rounded-lg border border-field px-4 py-2 font-semibold hover:bg-line/50"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function FormAdminHapusKeluarga({
  keluargaId,
  namaKeluarga,
}: {
  keluargaId: string;
  namaKeluarga: string;
}) {
  const [buka, setBuka] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState("");
  const [hasil, aksi, pending] = useActionState(hapusKeluargaAdmin, awal);

  const cocok = konfirmasi.trim().toLowerCase() === namaKeluarga.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-bahaya/30 bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-bahaya">Hapus keluarga secara permanen</h3>
        <p className="text-sm text-muted">
          Menghapus rumah <strong>{namaKeluarga}</strong> beserta seluruh anggotanya dari rumah ini, bukti, riwayat, dan data keluarga secara permanen.
          Akun pengguna yang terdaftar tetap ada, namun tidak lagi tergabung dalam rumah ini.
        </p>
      </div>

      {!buka ? (
        <div>
          <button
            type="button"
            onClick={() => setBuka(true)}
            className="inline-flex min-h-11 items-center rounded-lg bg-bahaya px-4 py-2 font-semibold text-white hover:opacity-90 active:opacity-80"
          >
            Hapus keluarga ini permanen
          </button>
        </div>
      ) : (
        <form action={aksi} className="flex flex-col gap-3 rounded-lg border border-bahaya bg-bahaya/10 p-4">
          <input type="hidden" name="id" value={keluargaId} />
          <p className="text-sm font-semibold text-bahaya">
            Peringatan: Keluarga ini akan dihapus permanen dari basis data. Semua anggota akan terlepas dari rumah ini.
          </p>
          <div className="flex flex-col gap-1.5">
            <Medan
              id={`konfirmasi-keluarga-${keluargaId}`}
              label={`Ketik nama keluarga "${namaKeluarga}" untuk konfirmasi:`}
              value={konfirmasi}
              onChange={(e) => setKonfirmasi(e.target.value)}
              placeholder={namaKeluarga}
              autoComplete="off"
              required
            />
          </div>
          <Pesan galat={hasil.galat} ok={hasil.ok} />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Tombol
              variant="bahaya"
              disabled={!cocok || pending}
              teksTunggu="Menghapus keluarga..."
              className="bg-bahaya text-white hover:opacity-90"
            >
              Hapus keluarga sekarang
            </Tombol>
            <button
              type="button"
              onClick={() => {
                setBuka(false);
                setKonfirmasi("");
              }}
              className="inline-flex min-h-11 items-center rounded-lg border border-field px-4 py-2 font-semibold hover:bg-line/50"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
