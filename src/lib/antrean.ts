/** Antrean foto di IndexedDB: foto tetap tersimpan bila koneksi putus dan dikirim ulang saat online. */
export type ItemAntrean = {
  id: string;
  keluargaId: string;
  slug: string;
  teks: string;
  foto: Blob;
  dibuat: number;
};

export type HasilKirim = { ok: true } | { ok: false; galat: string; ulang: boolean };

const DB = "mapan-antrean";
const STORE = "foto";

function buka(): Promise<IDBDatabase> {
  return new Promise((ok, gagal) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => gagal(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await buka();
  return new Promise((ok, gagal) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => ok(r.result);
    r.onerror = () => gagal(r.error);
  });
}

export const daftarAntrean = () => tx<ItemAntrean[]>("readonly", (s) => s.getAll());
export const simpanAntrean = (i: ItemAntrean) => tx("readwrite", (s) => s.put(i));
export const hapusAntrean = (id: string) => tx("readwrite", (s) => s.delete(id));

export async function kirimItem(i: ItemAntrean): Promise<HasilKirim> {
  const f = new FormData();
  f.set("keluarga_id", i.keluargaId);
  f.set("slug", i.slug);
  f.set("teks", i.teks);
  f.set("berkas", new File([i.foto], "foto.jpg", { type: "image/jpeg" }));
  try {
    const r = await fetch("/api/bukti/foto", { method: "POST", body: f });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    return { ok: false, galat: j.galat ?? "Kiriman belum berhasil.", ulang: j.ulang ?? r.status >= 500 };
  } catch {
    return { ok: false, galat: "Tidak ada koneksi. Foto disimpan dan dikirim otomatis saat online.", ulang: true };
  }
}

/** Mengirim semua foto yang menunggu. Yang ditolak aturan (bukan masalah jaringan) dibuang dan dilaporkan. */
export async function kirimAntrean() {
  const hasil = { terkirim: 0, tertunda: 0, ditolak: [] as string[] };
  for (const i of await daftarAntrean()) {
    const r = await kirimItem(i);
    if (r.ok) {
      await hapusAntrean(i.id);
      hasil.terkirim++;
    } else if (r.ulang) hasil.tertunda++;
    else {
      await hapusAntrean(i.id);
      hasil.ditolak.push(r.galat);
    }
  }
  return hasil;
}
