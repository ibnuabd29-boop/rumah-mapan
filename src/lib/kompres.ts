/** Mengecilkan foto di perangkat sebelum diunggah: sisi terpanjang 1600 px, JPEG kualitas 0,8. */
export async function kompresFoto(berkas: File): Promise<Blob> {
  const bmp = await createImageBitmap(berkas, { imageOrientation: "from-image" });
  const skala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const kanvas = document.createElement("canvas");
  kanvas.width = Math.round(bmp.width * skala);
  kanvas.height = Math.round(bmp.height * skala);
  kanvas.getContext("2d")!.drawImage(bmp, 0, 0, kanvas.width, kanvas.height);
  bmp.close();
  return new Promise((ok, gagal) =>
    kanvas.toBlob((b) => (b ? ok(b) : gagal(new Error("Foto tidak bisa diproses."))), "image/jpeg", 0.8),
  );
}
