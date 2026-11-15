import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendNotification, setVapidDetails } from "web-push";
import { endpointPushDiizinkan } from "@/lib/push";

export const runtime = "nodejs";
export const maxDuration = 60;

type Pengingat = {
  id: string;
  user_id: string;
  keluarga_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  zona_waktu: string;
  tanggal_lokal: string;
};

type PengingatEvent = {
  id: string;
  pengingat_id: string;
  keluarga_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  jenis: "tantangan_baru" | "tenggat" | "tantangan_dipin";
  judul: string;
  isi: string;
  url: string;
};

function tokenSah(header: string | null, secret: string) {
  if (!header?.startsWith("Bearer ")) return false;
  const masuk = Buffer.from(header.slice(7));
  const benar = Buffer.from(secret);
  return masuk.length === benar.length && timingSafeEqual(masuk, benar);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Pengingat belum dikonfigurasi." }, { status: 503 });
  if (!tokenSah(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT;
  if (!url || !serviceKey || !publicKey || !privateKey || !contact?.startsWith("mailto:")) {
    return Response.json({ error: "Pengingat belum dikonfigurasi." }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  setVapidDetails(contact, publicKey, privateKey);

  const sekarang = new Date();
  const [harian, event] = await Promise.all([
    supabase.rpc("klaim_pengingat_harian", { p_sekarang: sekarang.toISOString() }),
    supabase.rpc("klaim_pengingat_event_push", { p_sekarang: sekarang.toISOString() }),
  ]);
  if (harian.error || event.error) {
    if (harian.error) console.error("Klaim pengingat harian gagal.", harian.error.code);
    if (event.error) console.error("Klaim pengingat tantangan gagal.", event.error.code);
    return Response.json({ error: "Pengingat belum bisa diproses." }, { status: 500 });
  }

  let terkirim = 0;
  let dihapus = 0;
  let gagal = 0;
  for (const pengingat of (harian.data ?? []) as Pengingat[]) {
    if (!endpointPushDiizinkan(pengingat.endpoint)) {
      const { error: hapusError } = await supabase
        .from("pengingat_push")
        .delete()
        .eq("id", pengingat.id);
      if (hapusError) {
        console.error("Langganan push tidak valid gagal dihapus.", hapusError.code);
        gagal += 1;
      } else {
        dihapus += 1;
      }
      continue;
    }

    try {
      await sendNotification(
        {
          endpoint: pengingat.endpoint,
          keys: { p256dh: pengingat.p256dh, auth: pengingat.auth },
        },
        JSON.stringify({
          title: "Tantangan hari ini",
          body: "Pilih satu kegiatan kecil untuk dilakukan bersama keluarga.",
          url: "/beranda",
        }),
        { TTL: 3600 },
      );
      const { error: simpanError } = await supabase.rpc("selesaikan_pengingat_push", {
        p_id: pengingat.id,
        p_tanggal: pengingat.tanggal_lokal,
        p_terkirim: true,
      });
      if (simpanError) {
        console.error("Status pengingat terkirim gagal disimpan.", simpanError.code);
        gagal += 1;
      } else {
        terkirim += 1;
      }
    } catch (error) {
      const kode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
      if (kode === 404 || kode === 410) {
        const { error: hapusError } = await supabase
          .from("pengingat_push")
          .delete()
          .eq("id", pengingat.id);
        if (hapusError) {
          console.error("Langganan push kedaluwarsa gagal dihapus.", hapusError.code);
          gagal += 1;
        } else {
          dihapus += 1;
        }
      } else {
        const { error: lepasError } = await supabase.rpc("selesaikan_pengingat_push", {
          p_id: pengingat.id,
          p_tanggal: pengingat.tanggal_lokal,
          p_terkirim: false,
        });
        if (lepasError) console.error("Klaim pengingat gagal dilepas.", lepasError.code);
        console.error("Pengiriman push gagal.", kode || "unknown");
        gagal += 1;
      }
    }
  }

  for (const pengingat of (event.data ?? []) as PengingatEvent[]) {
    if (!endpointPushDiizinkan(pengingat.endpoint)) {
      const { error: hapusError } = await supabase
        .from("pengingat_push")
        .delete()
        .eq("id", pengingat.pengingat_id);
      if (hapusError) {
        console.error("Langganan push tidak valid gagal dihapus.", hapusError.code);
        gagal += 1;
      } else {
        dihapus += 1;
      }
      continue;
    }

    try {
      await sendNotification(
        {
          endpoint: pengingat.endpoint,
          keys: { p256dh: pengingat.p256dh, auth: pengingat.auth },
        },
        JSON.stringify({
          title: pengingat.judul,
          body: pengingat.isi,
          url: pengingat.url,
          tag: `tantangan-${pengingat.jenis}-${pengingat.id}`,
        }),
        { TTL: 86400 },
      );
      const { error: simpanError } = await supabase.rpc("selesaikan_pengingat_event_push", {
        p_id: pengingat.id,
        p_terkirim: true,
      });
      if (simpanError) {
        console.error("Status pengingat tantangan terkirim gagal disimpan.", simpanError.code);
        gagal += 1;
      } else {
        terkirim += 1;
      }
    } catch (error) {
      const kode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
      if (kode === 404 || kode === 410) {
        const { error: hapusError } = await supabase
          .from("pengingat_push")
          .delete()
          .eq("id", pengingat.pengingat_id);
        if (hapusError) {
          console.error("Langganan push kedaluwarsa gagal dihapus.", hapusError.code);
          gagal += 1;
        } else {
          dihapus += 1;
        }
      } else {
        const { error: lepasError } = await supabase.rpc("selesaikan_pengingat_event_push", {
          p_id: pengingat.id,
          p_terkirim: false,
        });
        if (lepasError) console.error("Klaim pengingat tantangan gagal dilepas.", lepasError.code);
        console.error("Pengiriman notifikasi tantangan gagal.", kode || "unknown");
        gagal += 1;
      }
    }
  }

  return Response.json({ ok: gagal === 0, terkirim, dihapus, gagal }, { status: gagal ? 207 : 200 });
}
