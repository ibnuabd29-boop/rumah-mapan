import { Kerangka, Wordmark } from "@/components/Kerangka";
import { TombolTema } from "@/components/TombolTema";

export function KerangkaMasuk({
  judul,
  children,
  tampilkanTagline = true,
}: {
  judul: string;
  children: React.ReactNode;
  tampilkanTagline?: boolean;
}) {
  return (
    <main
      id="konten-utama"
      className="grid min-h-dvh w-full bg-bg lg:grid-cols-[minmax(18rem,0.9fr)_minmax(30rem,1.1fr)]"
    >
      <aside
        aria-label="Tentang Rumah Mapan"
        className="relative flex min-h-56 flex-col justify-between overflow-hidden bg-brand-panel px-5 py-5 text-on-brand-panel sm:min-h-64 sm:px-8 sm:py-7 lg:sticky lg:top-0 lg:h-dvh lg:min-h-dvh lg:px-12 lg:py-10"
      >
        <header className="flex items-center justify-between gap-4">
          <Wordmark className="text-on-brand-panel" />
          <div className="lg:hidden">
            <TombolTema kontras />
          </div>
        </header>
        <div className="relative z-10 mt-8 max-w-xl lg:my-auto">
          {tampilkanTagline ? (
            <p className="mb-4 font-judul text-xl sm:text-2xl">
              Rumah mempersiapkan masa yang akan datang
            </p>
          ) : null}
          <p className="max-w-md text-sm leading-relaxed sm:text-base">
            Tantangan kecil sehari-hari untuk ayah, ibu, dan anak.
          </p>
        </div>
        <Kerangka
          dibangun={0}
          className="pointer-events-none absolute bottom-6 right-0 hidden h-40 w-auto translate-x-6 text-on-brand-panel opacity-15 lg:block"
        />
      </aside>

      <div className="flex min-h-[calc(100dvh-14rem)] flex-col px-5 py-6 sm:px-8 sm:py-8 lg:min-h-dvh lg:px-12 lg:py-10">
        <header className="hidden justify-end lg:flex">
          <TombolTema />
        </header>
        <section
          aria-labelledby="judul-halaman"
          className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-3 lg:py-6"
        >
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">
            <h1 id="judul-halaman" className="text-2xl font-semibold sm:text-3xl">
              {judul}
            </h1>
            <div className="mt-5 flex flex-col gap-5">{children}</div>
          </div>
        </section>
        <footer className="mx-auto flex w-full max-w-lg flex-wrap items-center gap-x-1 border-t border-line pt-4 text-sm text-muted">
          <span>Aplikasi ini bukan pengganti bantuan profesional.</span>
          <nav aria-label="Informasi layanan">
            <a href="/privasi" className="inline-flex min-h-11 items-center underline">
              Kebijakan privasi
            </a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
