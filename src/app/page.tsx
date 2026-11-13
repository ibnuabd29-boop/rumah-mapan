import { redirect } from "next/navigation";

// Pintu masuk tunggal: proxy mengirim yang belum masuk ke /masuk.
export default function Home() {
  redirect("/beranda");
}
