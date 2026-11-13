import type { Metadata } from "next";
import { KerangkaMasuk } from "@/components/KerangkaMasuk";
import { FormMasuk } from "@/components/FormAuth";
import { jalurAman } from "@/lib/umum";

export const metadata: Metadata = { title: "Masuk" };

export default async function Halaman({ searchParams }: PageProps<"/masuk">) {
  const sp = await searchParams;
  const next = jalurAman(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  const galatGoogle = sp.galat === "google";
  const galatSesi = sp.galat === "tautan";
  return (
    <KerangkaMasuk judul="Masuk ke rumah Anda">
      {galatGoogle ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-sm text-bahaya">
          <strong>Gagal: </strong>Masuk dengan Google belum berhasil. Coba lagi atau pakai email.
        </p>
      ) : null}
      {galatSesi ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-sm text-bahaya">
          <strong>Gagal: </strong>Tautan sudah kedaluwarsa atau sudah dipakai. Minta tautan baru.
        </p>
      ) : null}
      <FormMasuk next={next} />
      <p className="text-sm">
        Belum punya akun?{" "}
        <a
          href={`/daftar${next !== "/beranda" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold underline"
        >
          Daftar
        </a>
        . Lupa kata sandi?{" "}
        <a href="/lupa-sandi" className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold underline">
          Buat yang baru
        </a>
        .
      </p>
    </KerangkaMasuk>
  );
}
