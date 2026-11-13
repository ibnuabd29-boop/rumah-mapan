import type { NextRequest } from "next/server";
import { perbaruiSesi } from "@/lib/supabase/sesi";

export function proxy(request: NextRequest) {
  return perbaruiSesi(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline-content|offline.html|api/cron/pengingat|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
