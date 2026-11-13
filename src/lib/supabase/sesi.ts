import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const TERBUKA = ["/masuk", "/daftar", "/lupa-sandi", "/auth", "/privasi"];

export async function perbaruiSesi(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const terbuka = TERBUKA.some((p) => path === p || path.startsWith(`${p}/`));

  if (!data.user && !terbuka) {
    const url = request.nextUrl.clone();
    url.pathname = "/masuk";
    url.search = "";
    if (path !== "/" && path !== "/beranda") url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (data.user && (path === "/masuk" || path === "/daftar")) {
    const url = request.nextUrl.clone();
    url.pathname = "/beranda";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
