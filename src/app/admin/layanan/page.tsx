import type { Metadata } from "next";
import { perluAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Kritik dan saran | Admin" };

const waktu = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

type Saran = { id: string; pengirim: string; isi: string; dibuat_at: string };

export default async function Halaman() {
  const { supabase } = await perluAdmin();
  const { data, error } = await supabase.rpc("admin_daftar_layanan_saran");
  const saran = (data ?? []) as Saran[];

  return (
    <section aria-labelledby="judul" className="flex flex-col gap-4">
      <header>
        <h1 id="judul" className="text-2xl font-semibold">Kritik dan saran</h1>
        <p className="text-muted">Pesan yang dikirim melalui layanan keluarga.</p>
      </header>
      {error ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          Daftar masukan belum bisa dimuat. Muat ulang halaman.
        </p>
      ) : saran.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {saran.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 py-4">
              <p className="text-sm text-muted">
                {item.pengirim}, {waktu.format(new Date(item.dibuat_at))}
              </p>
              <p className="whitespace-pre-wrap break-words">{item.isi}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Belum ada kritik atau saran.</p>
      )}
    </section>
  );
}
