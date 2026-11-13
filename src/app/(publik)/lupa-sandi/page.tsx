import type { Metadata } from "next";
import { KerangkaMasuk } from "@/components/KerangkaMasuk";
import { FormLupaSandi } from "@/components/FormAuth";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function Halaman() {
  return (
    <KerangkaMasuk judul="Buat kata sandi baru" tampilkanTagline={false}>
      <p className="text-muted">Kami kirim tautan ke email akun Anda. Tautan itu berlaku sebentar saja.</p>
      <FormLupaSandi />
      <p className="text-sm">
        <a href="/masuk" className="inline-flex min-h-11 items-center font-semibold underline">
          Kembali ke halaman masuk
        </a>
      </p>
    </KerangkaMasuk>
  );
}
