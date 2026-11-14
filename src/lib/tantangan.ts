export const KATEGORI = [
  { nilai: "komunikasi", label: "Komunikasi" },
  { nilai: "kebersamaan", label: "Kebersamaan" },
  { nilai: "empati", label: "Empati" },
  { nilai: "kemandirian", label: "Kemandirian" },
  { nilai: "kreativitas", label: "Kreativitas" },
  { nilai: "sepulang_kerja", label: "Sepulang kerja" },
  { nilai: "ke_tempat_kerja", label: "Ke tempat kerja" },
] as const;

export function labelKategori(k: string) {
  return KATEGORI.find((x) => x.nilai === k)?.label ?? k;
}

export const SEGMEN_TANTANGAN = [
  { nilai: "berani", label: "BERANI (10-14 tahun)" },
  { nilai: "beraksi", label: "BERAKSI (15-19 tahun)" },
  { nilai: "berkolaborasi", label: "BERKOLABORASI (20-24 tahun)" },
] as const;

export type SegmenTantangan = (typeof SEGMEN_TANTANGAN)[number]["nilai"];

export function labelSegmen(segmen: string | null) {
  return SEGMEN_TANTANGAN.find((x) => x.nilai === segmen)?.label ?? "Untuk semua usia";
}

export function segmenUsiaAnak(tglLahir: string | null) {
  if (!tglLahir || !/^\d{4}-\d{2}-\d{2}$/.test(tglLahir)) return null;
  const hari = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  if (tglLahir > hari) return null;

  const tahunLahir = Number(tglLahir.slice(0, 4));
  let umur = Number(hari.slice(0, 4)) - tahunLahir;
  if (hari.slice(5) < tglLahir.slice(5)) umur -= 1;

  return SEGMEN_TANTANGAN.find((x) => {
    const [min, max] = x.nilai === "berani" ? [10, 14] : x.nilai === "beraksi" ? [15, 19] : [20, 24];
    return umur >= min && umur <= max;
  })?.nilai ?? null;
}

export const MODE = [
  { nilai: "biasa", label: "Hari biasa", bantu: "Tantangan umum untuk seluruh keluarga." },
  { nilai: "pulang_kerja", label: "Ayah pulang kerja", bantu: "Singkat, 3 sampai 25 menit, ayah boleh tetap santai." },
  { nilai: "hari_kunjungan", label: "Anak ke tempat kerja", bantu: "Untuk hari anak ikut ayah bekerja." },
] as const;

export type Ringkasan = {
  poin: number;
  selesai: number;
  poin_7hari: number;
  selesai_7hari: number;
  hari_aktif_7hari: number;
  komunikasi: number;
  kategori_7hari: Record<string, number> | null;
  menunggu: number;
  hari_beruntun: number;
  beruntun_terbaik: number;
};

export const RINGKASAN_KOSONG: Ringkasan = {
  poin: 0,
  selesai: 0,
  poin_7hari: 0,
  selesai_7hari: 0,
  hari_aktif_7hari: 0,
  komunikasi: 0,
  kategori_7hari: null,
  menunggu: 0,
  hari_beruntun: 0,
  beruntun_terbaik: 0,
};

// Tahap rumah menggantikan "level kehangatan". Ambang poin adalah pilihan rancangan, bukan standar baku.
export const TAHAP = [
  { dibangun: 1 as const, nama: "Pondasi", dari: 0 },
  { dibangun: 2 as const, nama: "Tiang", dari: 50 },
  { dibangun: 3 as const, nama: "Dinding", dari: 150 },
  { dibangun: 4 as const, nama: "Atap", dari: 300 },
];

export function tahapRumah(poin: number) {
  const aktif = [...TAHAP].reverse().find((t) => poin >= t.dari) ?? TAHAP[0];
  const berikut = TAHAP.find((t) => t.dari > poin) ?? null;
  return { aktif, berikut };
}

export type Lencana = { id: string; nama: string; syarat: string; terbuka: boolean };

// Lencana dihitung dari data nyata. Yang terkunci tampil terkunci dengan syaratnya.
export function daftarLencana(r: Ringkasan): Lencana[] {
  return [
    { id: "langkah-pertama", nama: "Langkah pertama", syarat: "Satu tantangan disetujui", terbuka: r.selesai >= 1 },
    { id: "seminggu", nama: "Seminggu beruntun", syarat: "Tujuh hari berturut-turut ada tantangan disetujui", terbuka: r.beruntun_terbaik >= 7 },
    { id: "tim-solid", nama: "Tim solid", syarat: "Sepuluh tantangan disetujui", terbuka: r.selesai >= 10 },
    { id: "pendengar", nama: "Pendengar hebat", syarat: "Lima tantangan komunikasi disetujui", terbuka: r.komunikasi >= 5 },
    { id: "atap", nama: "Atap terpasang", syarat: "300 poin keluarga", terbuka: r.poin >= 300 },
  ];
}

export const STATUS_BUKTI: Record<string, string> = {
  menunggu: "Menunggu penilaian",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  ditandai: "Ditandai admin",
};
