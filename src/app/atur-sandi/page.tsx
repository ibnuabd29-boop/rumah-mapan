import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KerangkaMasuk } from "@/components/KerangkaMasuk";
import { FormAturSandi } from "@/components/FormAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Atur kata sandi" };

export default async function Halaman() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/masuk?galat=tautan");
  return (
    <KerangkaMasuk judul="Kata sandi baru" tampilkanTagline={false}>
      <FormAturSandi />
    </KerangkaMasuk>
  );
}
