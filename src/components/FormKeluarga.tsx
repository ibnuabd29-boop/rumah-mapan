"use client";

import { useActionState, useRef, useState } from "react";
import {
  buatKeluarga,
  buatUndangan,
  hapusAkun,
  hapusKeluarga,
  terimaUndangan,
  ubahNama,
  type HasilK,
} from "@/app/actions-keluarga";
import { keluarDariPerangkatLain, type Hasil } from "@/app/actions-auth";
import { Centang, Medan, Pesan, Pilihan, Tombol } from "@/components/ui";
import { PERAN } from "@/lib/umum";

const awal: HasilK = {};
const perannyaDewasa = PERAN.filter((p) => p.nilai !== "anak");

export function FormBuatRumah() {
  const [hasil, aksi] = useActionState(buatKeluarga, awal);
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <Medan id="nama" label="Nama rumah" placeholder="Contoh: Keluarga Santoso" maxLength={60} required />
      <Pilihan id="peran" label="Peran Anda di rumah ini" defaultValue="" required>
        <option value="" disabled>
          Pilih peran
        </option>
        {perannyaDewasa.map((p) => (
          <option key={p.nilai} value={p.nilai}>
            {p.label}
          </option>
        ))}
      </Pilihan>
      <Pesan galat={hasil.galat} />
      <Tombol teksTunggu="Membuat rumah...">Buat rumah</Tombol>
    </form>
  );
}

export function FormUndangan({ keluargaId }: { keluargaId: string }) {
  const [hasil, aksi] = useActionState(buatUndangan, awal);
  const [peran, setPeran] = useState("");
  const [tersalin, setTersalin] = useState<"ya" | "tidak" | null>(null);
  const kolom = useRef<HTMLInputElement>(null);

  async function salin() {
    if (!hasil.tautan) return;
    try {
      await navigator.clipboard.writeText(hasil.tautan);
      setTersalin("ya");
    } catch {
      kolom.current?.select();
      setTersalin("tidak");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={aksi} className="flex flex-col gap-4">
        <input type="hidden" name="keluarga_id" value={keluargaId} />
        <Pilihan
          id="peran-undangan"
          name="peran"
          label="Peran yang diundang"
          value={peran}
          onChange={(e) => setPeran(e.target.value)}
          required
        >
          <option value="" disabled>
            Pilih peran
          </option>
          {PERAN.map((p) => (
            <option key={p.nilai} value={p.nilai}>
              {p.label}
            </option>
          ))}
        </Pilihan>
        {peran === "anak" ? (
          <Centang id="persetujuan" name="persetujuan" required>
            Saya orang tua atau wali anak ini dan menyetujui anak saya memakai Rumah Mapan. Anak di
            bawah 18 tahun hanya bisa bergabung dengan persetujuan ini.
          </Centang>
        ) : null}
        <Pesan galat={hasil.galat} />
        <Tombol teksTunggu="Membuat tautan...">Buat tautan undangan</Tombol>
      </form>

      {hasil.tautan ? (
        <div className="flex flex-col gap-3 rounded-lg border border-primary p-3">
          <Pesan ok={hasil.ok} />
          <Medan
            id="tautan-undangan"
            label="Tautan undangan"
            readOnly
            value={hasil.tautan}
            ref={kolom}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Tombol type="button" variant="sekunder" onClick={salin}>
            Salin tautan
          </Tombol>
          <p role="status" className="text-sm text-muted">
            {tersalin === "ya" ? "Tautan sudah disalin." : null}
            {tersalin === "tidak" ? "Salin otomatis gagal. Tautan sudah terpilih, tekan Ctrl+C." : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function FormHapusKeluarga({ keluargaId, nama }: { keluargaId: string; nama: string }) {
  const [hasil, aksi] = useActionState(hapusKeluarga, awal);
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <input type="hidden" name="keluarga_id" value={keluargaId} />
      <input type="hidden" name="nama" value={nama} />
      <Medan
        id="konfirmasi-rumah"
        name="konfirmasi"
        label={`Ketik "${nama}" untuk mengonfirmasi`}
        autoComplete="off"
        required
      />
      <Pesan galat={hasil.galat} />
      <Tombol variant="bahaya" teksTunggu="Menghapus...">
        Hapus rumah dan seluruh datanya
      </Tombol>
    </form>
  );
}

export function FormTerimaUndangan({ token, anak }: { token: string; anak: boolean }) {
  const [hasil, aksi] = useActionState(terimaUndangan, awal);
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {anak ? (
        <Medan
          id="tgl_lahir"
          label="Tanggal lahir"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          required
        />
      ) : (
        <input type="hidden" name="tgl_lahir" value="" />
      )}
      <Pesan galat={hasil.galat} />
      <Tombol teksTunggu="Bergabung...">Gabung ke rumah ini</Tombol>
    </form>
  );
}

export function FormNama({ nama }: { nama: string }) {
  const [hasil, aksi] = useActionState(ubahNama, awal);
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <Medan id="nama" label="Nama panggilan" defaultValue={nama} maxLength={60} required />
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol variant="sekunder" teksTunggu="Menyimpan...">
        Simpan nama
      </Tombol>
    </form>
  );
}

export function FormPerangkatLain() {
  const [hasil, aksi] = useActionState(keluarDariPerangkatLain, {} as Hasil);
  return (
    <form action={aksi} className="flex flex-col gap-3">
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol variant="sekunder" teksTunggu="Memproses...">
        Keluarkan semua perangkat lain
      </Tombol>
    </form>
  );
}

export function FormHapusAkun() {
  const [hasil, aksi] = useActionState(hapusAkun, awal);
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <Medan
        id="konfirmasi-akun"
        name="konfirmasi"
        label="Ketik HAPUS untuk mengonfirmasi"
        autoComplete="off"
        required
      />
      <Pesan galat={hasil.galat} />
      <Tombol variant="bahaya" teksTunggu="Menghapus...">
        Hapus akun saya selamanya
      </Tombol>
    </form>
  );
}
