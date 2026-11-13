import type { Metadata } from "next";
import { perluAdmin } from "@/lib/admin";
import { driveSiap } from "@/lib/drive";

export const metadata: Metadata = { title: "Google Drive admin" };

type StatusDrive = { status: "tersambung" | "terputus" | "belum"; folder_id: string | null };

export default async function Halaman({ searchParams }: PageProps<"/admin/drive">) {
  const [sp, { supabase }] = await Promise.all([searchParams, perluAdmin()]);
  const { data, error } = await supabase.rpc("admin_status_drive");
  if (error) {
    return (
      <section aria-labelledby="judul" className="flex flex-col gap-3">
        <h1 id="judul" className="text-2xl font-semibold">Google Drive admin</h1>
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          Status Drive belum bisa dimuat. Pastikan migrasi 0008 sudah dijalankan, lalu muat ulang halaman.
        </p>
      </section>
    );
  }

  const status = (data?.[0] ?? { status: "belum", folder_id: null }) as StatusDrive;
  const konfigurasiSiap = driveSiap();

  return (
    <section aria-labelledby="judul" className="flex flex-col gap-4">
      <h1 id="judul" className="text-2xl font-semibold">Google Drive admin</h1>
      {sp.drive === "ok" ? (
        <p role="status" className="rounded-lg border border-primary px-3 py-2">
          Google Drive admin berhasil dihubungkan.
        </p>
      ) : null}
      {sp.drive === "gagal" ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          Google Drive belum terhubung. Periksa konfigurasi OAuth dan coba lagi.
        </p>
      ) : null}

      <p>
        Status:{" "}
        <strong>
          {status.status === "tersambung" ? "tersambung" : status.status === "terputus" ? "terputus" : "belum terhubung"}
        </strong>
      </p>
      <p className="text-muted">
        Anggota rumah mengunggah foto langsung dari ponsel. Foto yang sudah dikompres masuk ke folder Drive ini;
        mereka tidak perlu menghubungkan akun Google pribadi.
      </p>

      {!konfigurasiSiap ? (
        <p role="alert" className="rounded-lg border border-kayu px-3 py-2">
          Lengkapi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DRIVE_ENC_KEY, dan SUPABASE_SERVICE_ROLE_KEY di environment
          server sebelum menghubungkan Drive.
        </p>
      ) : status.status !== "tersambung" ? (
        <a
          href="/api/drive/admin/hubungkan"
          className="inline-flex min-h-11 items-center justify-center self-start rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary"
        >
          {status.status === "terputus" ? "Hubungkan ulang Drive admin" : "Hubungkan Drive admin"}
        </a>
      ) : status.folder_id ? (
        <a
          href={`https://drive.google.com/drive/folders/${encodeURIComponent(status.folder_id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center self-start font-semibold underline"
        >
          Buka folder foto bukti
        </a>
      ) : null}
    </section>
  );
}
