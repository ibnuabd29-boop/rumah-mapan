import type { Metadata } from "next";
import Link from "next/link";
import { FormAdminLencana } from "@/components/FormAdminLencana";
import { perluAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Lencana | Admin" };

type Lencana = {
  id: string;
  nama: string;
  ikon: "keluarga" | "tantangan" | "perasaan" | "syukur" | "materi";
  poin_minimum: number;
  poin_maksimum: number;
  berlaku_sampai: string | null;
  kedaluwarsa: boolean;
  aktif: boolean;
};

const waktu = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export default async function HalamanLencanaAdmin() {
  const { supabase } = await perluAdmin();
  const { data, error } = await supabase.rpc("admin_daftar_lencana");
  const lencana = (data ?? []) as Lencana[];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Lencana</h1>
        <p className="text-muted">
          Atur nama, ikon, rentang poin, dan batas waktu untuk lencana keluarga.
        </p>
      </header>

      {error ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-bahaya px-3 py-3 text-bahaya">
          <p>Daftar lencana belum bisa dimuat. Pastikan migrasi lencana sudah dijalankan, lalu muat ulang.</p>
          <Link href="/admin/lencana" className="inline-flex min-h-11 items-center font-semibold underline">
            Muat ulang daftar lencana
          </Link>
        </div>
      ) : (
        <>
          <details className="rounded-lg border border-line p-3">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">Tambah lencana</summary>
            <div className="pt-3"><FormAdminLencana /></div>
          </details>

          {lencana.length === 0 ? (
            <p className="text-muted">Belum ada lencana. Gunakan formulir di atas untuk membuat lencana pertama.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {lencana.map((item) => {
                const status = !item.aktif ? "nonaktif" : item.kedaluwarsa ? "kedaluwarsa" : "aktif";
                return (
                  <li key={item.id} className="py-3">
                    <details>
                      <summary className="min-h-11 cursor-pointer py-2 font-semibold">
                        <span className="break-words">{item.nama}</span>
                        <span className="ml-2 text-sm font-normal">
                          {item.poin_minimum} hingga {item.poin_maksimum} poin, {status}
                        </span>
                      </summary>
                      <div className="flex flex-col gap-2 pt-2">
                        {item.berlaku_sampai ? (
                          <p className="text-sm text-muted">
                            Bisa didapat sampai{" "}
                            <time dateTime={item.berlaku_sampai}>
                              {waktu.format(new Date(item.berlaku_sampai))} WIB
                            </time>.
                          </p>
                        ) : (
                          <p className="text-sm text-muted">Tidak ada batas waktu.</p>
                        )}
                        <FormAdminLencana lencana={item} />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
