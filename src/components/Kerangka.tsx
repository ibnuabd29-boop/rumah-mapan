/** Motif Mapan: kerangka rumah (atap, tiang, balok). Tiang yang terisi menandai bagian yang sudah dibangun. */
export function Kerangka({
  dibangun = 4,
  className = "",
}: {
  dibangun?: 0 | 1 | 2 | 3 | 4;
  className?: string;
}) {
  const tebal = (n: number) => (dibangun >= n ? 3 : 1.5);
  return (
    <svg
      viewBox="0 0 120 80"
      width="120"
      height="80"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
    >
      <line x1="10" y1="72" x2="110" y2="72" strokeWidth={tebal(1)} />
      <line x1="24" y1="72" x2="24" y2="34" strokeWidth={tebal(2)} />
      <line x1="96" y1="72" x2="96" y2="34" strokeWidth={tebal(2)} />
      <line x1="24" y1="34" x2="96" y2="34" strokeWidth={tebal(3)} />
      <line x1="60" y1="72" x2="60" y2="34" strokeWidth={tebal(3)} />
      <polyline points="14,34 60,8 106,34" strokeWidth={tebal(4)} />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-judul text-xl font-semibold tracking-tight ${className}`}
    >
      <Kerangka dibangun={4} className="h-7 w-10 shrink-0" />
      <span>Rumah Mapan</span>
    </span>
  );
}
