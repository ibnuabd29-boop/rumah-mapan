"use client";

import { useEffect, useState } from "react";

type Tema = "terang" | "gelap";

export function TombolTema({ kontras = false }: { kontras?: boolean } = {}) {
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    const aktif =
      (document.documentElement.dataset.theme as Tema | undefined) ??
      (matchMedia("(prefers-color-scheme: dark)").matches ? "gelap" : "terang");
    // Sinkron dengan atribut yang sudah dipasang skrip awal.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(aktif);
  }, []);

  function ganti() {
    const baru: Tema = tema === "gelap" ? "terang" : "gelap";
    document.documentElement.dataset.theme = baru;
    document.cookie = `tema=${baru}; path=/; max-age=31536000; samesite=lax`;
    setTema(baru);
  }

  const tujuan = tema === "gelap" ? "terang" : "gelap";
  const label = tema === null ? "Ubah tema" : `Gunakan tema ${tujuan}`;
  const teks = tema === null ? "Ubah tema" : `Tema ${tujuan}`;

  return (
    <button
      type="button"
      onClick={ganti}
      aria-pressed={tema === "gelap"}
      aria-label={label}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 font-semibold transition-colors ${
        kontras
          ? "border-on-brand-panel text-on-brand-panel hover:bg-on-brand-panel/10 active:bg-on-brand-panel/20"
          : "border-field hover:bg-line/50 active:bg-line"
      }`}
    >
      {teks}
    </button>
  );
}
