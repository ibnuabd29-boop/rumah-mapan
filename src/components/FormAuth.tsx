"use client";

import { useActionState } from "react";
import {
  aturSandi,
  daftar,
  lupaSandi,
  masuk,
  masukGoogle,
  tautanMasuk,
  type Hasil,
} from "@/app/actions-auth";
import { Centang, Medan, Pesan, Tombol } from "@/components/ui";

const awal: Hasil = {};

export function FormMasuk({ next }: { next: string }) {
  const [hasil, aksi] = useActionState(masuk, awal);
  const [hasilTautan, aksiTautan] = useActionState(tautanMasuk, awal);
  return (
    <div className="flex flex-col gap-6">
      <form action={aksi} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Medan id="email" label="Email" type="email" autoComplete="email" defaultValue={hasil.nilai?.email} required />
        <Medan
          id="password"
          label="Kata sandi"
          type="password"
          autoComplete="current-password"
          required
        />
        <Pesan galat={hasil.galat} />
        <Tombol teksTunggu="Masuk...">Masuk</Tombol>
      </form>

      <form action={aksiTautan} className="flex flex-col gap-3 border-t border-line pt-5">
        <p className="text-sm text-muted">Lupa kata sandi atau malas mengetik? Minta tautan masuk lewat email.</p>
        <input type="hidden" name="next" value={next} />
        <Medan id="email-tautan" name="email" label="Email untuk tautan masuk" type="email" autoComplete="email" required />
        <Pesan galat={hasilTautan.galat} ok={hasilTautan.ok} />
        <Tombol variant="sekunder" teksTunggu="Mengirim...">
          Kirim tautan masuk
        </Tombol>
      </form>

      <form action={masukGoogle} className="border-t border-line pt-5">
        <input type="hidden" name="next" value={next} />
        <Tombol variant="sekunder" className="w-full" teksTunggu="Membuka Google...">
          Masuk dengan Google
        </Tombol>
      </form>
    </div>
  );
}

export function FormDaftar({ next }: { next: string }) {
  const [hasil, aksi] = useActionState(daftar, awal);
  if (hasil.ok) return <Pesan ok={hasil.ok} />;
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Medan id="nama" label="Nama panggilan" autoComplete="given-name" maxLength={60} defaultValue={hasil.nilai?.nama} required />
      <Medan id="email" label="Email" type="email" autoComplete="email" defaultValue={hasil.nilai?.email} required />
      <Medan
        id="password"
        label="Kata sandi"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        petunjuk="Minimal 8 karakter, campuran huruf besar, huruf kecil, angka, dan simbol."
        required
      />
      <Centang id="setuju" name="setuju" required>
        Saya sudah membaca{" "}
        <a href="/privasi" className="font-semibold underline">
          kebijakan privasi
        </a>
        . Saya paham admin platform bisa melihat bukti tantangan dan angka progres keluarga saya.
        Admin tidak bisa membaca catatan harian anak.
      </Centang>
      <Pesan galat={hasil.galat} />
      <Tombol teksTunggu="Mendaftarkan...">Buat akun</Tombol>
    </form>
  );
}

export function FormLupaSandi() {
  const [hasil, aksi] = useActionState(lupaSandi, awal);
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <Medan id="email" label="Email akun Anda" type="email" autoComplete="email" required />
      <Pesan galat={hasil.galat} ok={hasil.ok} />
      <Tombol teksTunggu="Mengirim...">Kirim tautan</Tombol>
    </form>
  );
}

export function FormAturSandi() {
  const [hasil, aksi] = useActionState(aturSandi, awal);
  return (
    <form action={aksi} className="flex flex-col gap-4">
      <Medan
        id="password"
        label="Kata sandi baru"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        petunjuk="Minimal 8 karakter."
        required
      />
      <Medan id="ulang" label="Ulangi kata sandi baru" type="password" autoComplete="new-password" required />
      <Pesan galat={hasil.galat} />
      <Tombol teksTunggu="Menyimpan...">Simpan kata sandi</Tombol>
    </form>
  );
}
