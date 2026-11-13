import type { Metadata } from "next";
import { KerangkaMasuk } from "@/components/KerangkaMasuk";
import { FormDaftar } from "@/components/FormAuth";
import { jalurAman } from "@/lib/umum";

export const metadata: Metadata = { title: "Daftar" };

export default async function Halaman({ searchParams }: PageProps<"/daftar">) {
  const sp = await searchParams;
  const next = jalurAman(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  return (
    <KerangkaMasuk judul="Buat akun" tampilkanTagline={false}>
      <p className="text-muted">
        Satu akun untuk satu orang. Peran ayah, ibu, atau anak ditentukan saat Anda membuat rumah atau
        menerima undangan, bukan di sini.
      </p>
      <FormDaftar next={next} />
      <p className="text-sm">
        Sudah punya akun?{" "}
        <a href="/masuk" className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold underline">
          Masuk
        </a>
      </p>
    </KerangkaMasuk>
  );
}
