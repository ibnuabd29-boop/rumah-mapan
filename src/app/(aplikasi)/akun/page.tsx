import type { Metadata } from "next";
import { keluar } from "@/app/actions-auth";
import { FormHapusAkun, FormNama, FormPerangkatLain } from "@/components/FormKeluarga";
import { PengaturanPWA } from "@/components/PengaturanPWA";
import { TombolTema } from "@/components/TombolTema";
import { Tombol } from "@/components/ui";
import { ambilSesi } from "@/lib/sesi";

export const metadata: Metadata = { title: "Akun" };

export default async function Halaman() {
  const { supabase, user, profil } = await ambilSesi();
  const { data: admin } = await supabase.rpc("is_admin");
  const kunciPublik = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
  const pengingatSiap = Boolean(
    kunciPublik &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.CRON_SECRET &&
    process.env.PENGINGAT_SCHEDULED === "true",
  );
  return (
    <div className="flex flex-col gap-8">
      {admin === true ? (
        <section aria-labelledby="admin" className="flex flex-col gap-2 rounded-lg border border-kayu p-3">
          <h2 id="admin" className="text-lg font-semibold">Admin platform</h2>
          <a href="/admin" className="inline-flex min-h-11 items-center self-start font-semibold underline">
            Buka dashboard admin
          </a>
        </section>
      ) : null}
      <section aria-labelledby="akun" className="flex flex-col gap-1">
        <h1 id="akun" className="text-2xl font-semibold">
          Akun
        </h1>
        <p className="text-muted">{user.email}</p>
      </section>

      <section aria-labelledby="nama" className="flex flex-col gap-3">
        <h2 id="nama" className="text-lg font-semibold">
          Nama
        </h2>
        <FormNama nama={profil.nama} />
      </section>

      <section aria-labelledby="tampilan" className="flex flex-col gap-3">
        <h2 id="tampilan" className="text-lg font-semibold">
          Tampilan
        </h2>
        <div>
          <TombolTema />
        </div>
      </section>

      <PengaturanPWA kunciPublik={kunciPublik} pengingatSiap={pengingatSiap} />

      <section aria-labelledby="sesi" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="sesi" className="text-lg font-semibold">
          Sesi masuk
        </h2>
        <form action={keluar}>
          <Tombol variant="sekunder" teksTunggu="Keluar...">
            Keluar dari perangkat ini
          </Tombol>
        </form>
        <p className="text-sm text-muted">
          Kalau ponsel hilang atau Anda lupa keluar di perangkat lain, cabut semua sesi lainnya.
        </p>
        <FormPerangkatLain />
      </section>

      <section aria-labelledby="hapus" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="hapus" className="text-lg font-semibold">
          Hapus akun
        </h2>
        <p className="text-muted">
          Akun dan profil Anda dihapus permanen. Jika Anda pemilik rumah, hapus rumahnya dulu di menu Keluarga.
        </p>
        <FormHapusAkun />
      </section>
    </div>
  );
}
