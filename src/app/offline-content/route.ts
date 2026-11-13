import { KARTU_OBROLAN, MATERI_GENRE } from "@/lib/langkah-enam";

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    materi: MATERI_GENRE,
    obrolan: KARTU_OBROLAN,
  });
}
