import type { ReactNode } from "react";

export type NamaIkonFitur =
  | "beranda"
  | "tantangan"
  | "perasaan"
  | "menu"
  | "catatan"
  | "masa-depan"
  | "materi"
  | "obrolan"
  | "syukur"
  | "laporan"
  | "bukti"
  | "keluarga"
  | "akun"
  | "poin"
  | "hari"
  | "selesai";

const GAMBAR: Record<NamaIkonFitur, ReactNode> = {
  beranda: (
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10M10 20v-6h4v6" />
    </>
  ),
  tantangan: (
    <>
      <path d="M8 4h12v16H4V8zM8 4v4H4" />
      <path d="m8 13 1.5 1.5L12 12M14 13h3M8 17l1.5 1.5L12 16M14 17h3" />
    </>
  ),
  perasaan: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 10h.01M15.5 10h.01M8.5 14c1 1.4 2.1 2 3.5 2s2.5-.6 3.5-2" />
    </>
  ),
  menu: (
    <>
      <rect x="5" y="5" width="5" height="5" />
      <rect x="14" y="5" width="5" height="5" />
      <rect x="5" y="14" width="5" height="5" />
      <rect x="14" y="14" width="5" height="5" />
    </>
  ),
  catatan: (
    <>
      <path d="M6 3h12v18H6zM4 7v14h12" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  "masa-depan": (
    <>
      <path d="M5 21V4m1 1h12l-3 4 3 4H6" />
      <path d="M10 21v-3h3v-3h3v-3h3" />
    </>
  ),
  materi: (
    <>
      <path d="M3 5.5c3.5-.8 6.5-.3 9 1.5v13c-2.5-1.8-5.5-2.3-9-1.5z" />
      <path d="M21 5.5c-3.5-.8-6.5-.3-9 1.5v13c2.5-1.8 5.5-2.3 9-1.5z" />
    </>
  ),
  obrolan: (
    <>
      <path d="M4 5h16v12H9l-5 4z" />
      <circle cx="8" cy="11" r=".7" />
      <circle cx="12" cy="11" r=".7" />
      <circle cx="16" cy="11" r=".7" />
    </>
  ),
  syukur: (
    <path d="M12 20s-8-4.8-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.2-8 10-8 10z" />
  ),
  laporan: (
    <>
      <path d="M4 20V4M4 20h17" />
      <path d="M8 17v-5h3v5M14 17V8h3v9M20 17v-7h2" />
    </>
  ),
  bukti: (
    <>
      <rect x="3" y="4" width="18" height="16" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m4 17 5-5 3 3 3-4 5 6" />
    </>
  ),
  keluarga: (
    <>
      <circle cx="12" cy="8" r="3" />
      <circle cx="5" cy="10" r="2" />
      <circle cx="19" cy="10" r="2" />
      <path d="M6 20v-2a6 6 0 0 1 12 0v2zM1.5 19v-1a3.5 3.5 0 0 1 4-3.5M22.5 19v-1a3.5 3.5 0 0 0-4-3.5" />
    </>
  ),
  akun: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 21a8 8 0 0 1 16 0z" />
    </>
  ),
  poin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5h-5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4h-5M12 6v12" />
    </>
  ),
  hari: (
    <>
      <rect x="4" y="5" width="16" height="16" />
      <path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2" />
    </>
  ),
  selesai: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7.5 12.5 3 3 6-7" />
    </>
  ),
};

export function IkonFitur({
  nama,
  className = "size-5",
}: {
  nama: NamaIkonFitur;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {GAMBAR[nama]}
    </svg>
  );
}
