import type { Metadata } from "next";
import { KerangkaMasuk } from "@/components/KerangkaMasuk";
import { FormTerimaUndangan } from "@/components/FormKeluarga";
import { TautanTombol } from "@/components/ui";
import { ambilSesi } from "@/lib/sesi";
import { labelPeran, sha256Hex } from "@/lib/umum";

export const metadata: Metadata = { title: "Undangan" };

export default async function Halaman({ params }: PageProps<"/undangan/[token]">) {
  const { token } = await params;
  const { supabase } = await ambilSesi();

  const sahBentuk = /^[0-9a-f]{64}$/.test(token);
  const { data } = sahBentuk
    ? await supabase.rpc("lihat_undangan", { p_token_hash: await sha256Hex(token) })
    : { data: null };
  const u = data?.[0];

  if (!u || !u.berlaku) {
    return (
      <KerangkaMasuk judul="Undangan tidak bisa dipakai" tampilkanTagline={false}>
        <p className="text-muted">
          {u
            ? "Undangan ini sudah dipakai atau kedaluwarsa."
            : "Tautan ini tidak dikenali."}{" "}
          Minta pemilik rumah membuat tautan baru. Setiap tautan hanya berlaku 7 hari dan satu kali pakai.
        </p>
        <TautanTombol href="/beranda" variant="sekunder" className="self-start">
          Ke beranda
        </TautanTombol>
      </KerangkaMasuk>
    );
  }

  return (
    <KerangkaMasuk judul={`Bergabung ke ${u.nama_keluarga}`} tampilkanTagline={false}>
      <p className="text-muted">
        Anda diundang sebagai <strong className="text-ink">{labelPeran(u.peran).toLowerCase()}</strong>.
        {u.peran === "anak"
          ? " Orang tua Anda sudah menyetujui. Isi tanggal lahir untuk melanjutkan."
          : ""}
      </p>
      <FormTerimaUndangan token={token} anak={u.peran === "anak"} />
    </KerangkaMasuk>
  );
}
