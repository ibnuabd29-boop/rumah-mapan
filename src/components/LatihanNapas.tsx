"use client";

import { useState } from "react";
import { Tombol } from "@/components/ui";

const LANGKAH = [
  "Duduk berdampingan dengan posisi yang nyaman.",
  "Tarik napas perlahan, hanya sejauh yang terasa nyaman.",
  "Hembuskan napas perlahan. Tidak perlu menahan napas.",
  "Berhenti sejenak dan perhatikan keadaan tubuh.",
];

export function LatihanNapas() {
  const [langkah, setLangkah] = useState(0);
  return (
    <section aria-labelledby="napas" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 id="napas" className="text-lg font-semibold">Jeda napas bersama</h2>
      <p aria-live="polite">
        <span className="font-semibold">Langkah {langkah + 1} dari {LANGKAH.length}: </span>
        {LANGKAH[langkah]}
      </p>
      <p className="text-sm text-muted">
        Ikuti dengan nyaman dan berhenti kapan saja bila terasa tidak enak.
      </p>
      <div className="flex flex-wrap gap-3">
        <Tombol
          type="button"
          variant="sekunder"
          disabled={langkah === 0}
          onClick={() => setLangkah((nilai) => Math.max(0, nilai - 1))}
        >
          Sebelumnya
        </Tombol>
        <Tombol
          type="button"
          variant="sekunder"
          onClick={() => setLangkah((nilai) => (nilai + 1) % LANGKAH.length)}
        >
          {langkah === LANGKAH.length - 1 ? "Mulai lagi" : "Lanjut"}
        </Tombol>
      </div>
    </section>
  );
}
