const BATAS = 2 * 1024 * 1024;
const UKURAN_SISI = [1600, 1440, 1280, 1120, 960, 800];
const KUALITAS = [0.82, 0.78, 0.74, 0.7, 0.66, 0.6];

/** Mengecilkan foto di perangkat dan mengulang kompresi sampai ukuran unggahan aman. */
export async function kompresFoto(berkas: File): Promise<Blob> {
  const bmp = await createImageBitmap(berkas, { imageOrientation: "from-image" });
  try {
    for (let i = 0; i < UKURAN_SISI.length; i++) {
      const skala = Math.min(1, UKURAN_SISI[i] / Math.max(bmp.width, bmp.height));
      const kanvas = document.createElement("canvas");
      kanvas.width = Math.max(1, Math.round(bmp.width * skala));
      kanvas.height = Math.max(1, Math.round(bmp.height * skala));
      const konteks = kanvas.getContext("2d");
      if (!konteks) throw new Error("Foto tidak bisa diproses.");
      konteks.drawImage(bmp, 0, 0, kanvas.width, kanvas.height);
      const hasil = await new Promise<Blob | null>((ok) =>
        kanvas.toBlob(ok, "image/jpeg", KUALITAS[i]),
      );
      if (!hasil) throw new Error("Foto tidak bisa diproses.");
      if (hasil.size <= BATAS) return hasil;
    }
    throw new Error("Foto masih terlalu besar setelah dikompres.");
  } finally {
    bmp.close();
  }
}
