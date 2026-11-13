import { NavBawah } from "@/components/NavBawah";
import { Wordmark } from "@/components/Kerangka";
import { ambilSesi } from "@/lib/sesi";

export default async function TataLetakAplikasi({ children }: { children: React.ReactNode }) {
  const { profil, supabase } = await ambilSesi();
  await supabase.rpc("catat_aktif");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 text-primary shadow-sm sm:px-5 sm:py-4">
        <Wordmark />
        <span className="max-w-[42%] truncate rounded-full bg-bg px-3 py-1.5 text-sm font-medium text-muted">
          {profil.nama}
        </span>
      </header>
      <main id="konten-utama" className="flex-1 px-4 pb-28 pt-5 sm:px-5 sm:pt-8">{children}</main>
      <NavBawah />
    </div>
  );
}
