"use client";

export default function Galat({ retry }: { error: Error; retry: () => void }) {
  return (
    <section role="alert" className="flex flex-col items-start gap-3">
      <h1 className="text-xl font-semibold">Halaman ini belum bisa dibuka</h1>
      <p className="text-muted">
        Data rumah Anda tidak berhasil dimuat. Biasanya karena koneksi putus. Data Anda tidak hilang.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary"
      >
        Muat ulang
      </button>
    </section>
  );
}
