import Link from "next/link";
import { NavAdmin } from "@/components/NavAdmin";
import { Wordmark } from "@/components/Kerangka";
import { perluAdmin } from "@/lib/admin";

export default async function TataLetakAdmin({ children }: { children: React.ReactNode }) {
  const { supabase } = await perluAdmin();
  await supabase.rpc("catat_aktif");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-2 text-primary">
        <div className="flex items-baseline gap-3">
          <Wordmark />
          <span className="text-sm font-semibold text-ink">Admin platform</span>
        </div>
        <Link href="/beranda" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline">
          Kembali ke aplikasi
        </Link>
      </header>
      <p className="rounded-xl border border-kayu bg-surface px-4 py-3 text-sm text-ink">
        Setiap halaman yang Anda buka di sini tercatat di log audit. Anda dapat melihat bukti, angka progres,
        tren perasaan agregat, tanda perhatian, serta jumlah dan tanggal catatan harian. Isi catatan tidak tersedia.
      </p>
      <NavAdmin />
      <main id="konten-utama" className="flex-1 pb-8">{children}</main>
    </div>
  );
}
