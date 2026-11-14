const GALAT: Record<string, string> = {
  bukan_anggota: "Anda bukan anggota rumah ini.",
  khusus_orang_tua: "Hanya orang tua atau wali yang bisa melakukan ini.",
  sudah_ada_bukti: "Tantangan hari ini sudah punya bukti, jadi tidak bisa diganti lagi.",
  cerita_terlalu_pendek: "Ceritanya minimal 20 huruf. Ceritakan apa yang kalian lakukan dan rasakan.",
  bukti_kembar: "Bukti yang sama persis sudah pernah dipakai. Kirim bukti yang baru untuk tantangan ini.",
  sudah_dikirim_hari_ini: "Tantangan ini sudah punya bukti hari ini. Tunggu penilaian atau hapus bukti lama dulu.",
  tidak_boleh_menilai_sendiri: "Bukti buatan sendiri dinilai anggota lain.",
  sudah_dinilai: "Bukti ini sudah dinilai.",
  alasan_wajib: "Tulis alasan penolakan, minimal 3 huruf, supaya pengirim tahu apa yang perlu diperbaiki.",
  tidak_berhak: "Hanya pengirim atau pemilik rumah yang bisa menghapus bukti.",
  bukti_tidak_ada: "Bukti tidak ditemukan.",
  tantangan_diarsipkan: "Tantangan ini sudah diarsipkan dan tidak menerima bukti baru.",
  tantangan_tidak_tersedia: "Belum ada tantangan aktif untuk situasi ini. Hubungi admin platform.",
  anak_wajib: "Pilih profil anak untuk mengirim bukti tantangan ini.",
  anak_tidak_ada: "Profil anak tidak ditemukan di rumah ini.",
  segmen_tidak_sesuai: "Tantangan ini tidak sesuai dengan kelompok umur anak.",
};

export function galatTantangan(pesan: string) {
  const k = Object.keys(GALAT).find((x) => pesan.includes(x));
  return k ? GALAT[k] : "Permintaan belum berhasil. Coba lagi sebentar lagi.";
}
