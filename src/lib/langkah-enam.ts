export const SUASANA = [
  { nilai: "senang", label: "Senang", skor: 5 },
  { nilai: "tenang", label: "Tenang", skor: 4 },
  { nilai: "biasa", label: "Biasa saja", skor: 3 },
  { nilai: "sedih", label: "Sedih", skor: 2 },
  { nilai: "cemas", label: "Cemas atau khawatir", skor: 1 },
] as const;

export type Suasana = (typeof SUASANA)[number]["nilai"];

export const BANTUAN_ORANG_TUA: Record<Suasana, string> = {
  senang: "Tanyakan bagian mana yang ingin ia ceritakan lebih dulu.",
  tenang: "Duduk bersama sebentar. Biarkan anak memilih topik obrolannya.",
  biasa: "Tanyakan apakah ia ingin bercerita, ditemani, atau melanjutkan kegiatan.",
  sedih: "Dengarkan tanpa buru-buru menghibur atau mencari siapa yang salah.",
  cemas: "Tanyakan apa yang terasa paling berat. Tawarkan untuk menemani mencari bantuan.",
};

export const USIA = [
  {
    nilai: "balita",
    judul: "Balita, 3-6 tahun",
    isi: [
      ["Ketahanan mental", "Beri nama pada perasaan sederhana dan tawarkan pelukan atau ruang, sesuai pilihan anak."],
      ["Kemandirian", "Ajak memilih di antara dua pilihan sehari-hari dan merapikan barang bersama."],
      ["Keuangan", "Kenalkan fungsi uang saat berbelanja bersama. Anak belum perlu mengelola uang sendiri."],
      ["Minat dan bakat", "Perhatikan permainan yang dipilih anak. Sediakan kesempatan mencoba tanpa membandingkan."],
      ["Karakter", "Contohkan bergiliran, meminta maaf, dan mengucapkan terima kasih dalam kegiatan rumah."],
    ],
  },
  {
    nilai: "sd",
    judul: "Usia SD, 7-12 tahun",
    isi: [
      ["Ketahanan mental", "Tanyakan apa yang terjadi, dengarkan dahulu, lalu bantu anak memilih satu langkah kecil."],
      ["Kemandirian", "Bagi tugas rumah yang jelas dan aman. Tinjau bersama, bukan mengambil alih semuanya."],
      ["Keuangan", "Jika keluarga memberi uang saku, ajak membagi kebutuhan, tabungan, dan pilihan belanja."],
      ["Minat dan bakat", "Beri ruang mencoba kegiatan yang berbeda. Minat anak boleh berubah."],
      ["Karakter", "Bicarakan dampak pilihan pada orang lain dan cara memperbaiki kesalahan."],
    ],
  },
  {
    nilai: "remaja",
    judul: "Remaja, 13-18 tahun",
    isi: [
      ["Ketahanan mental", "Tawarkan waktu bicara tanpa memaksa. Sepakati siapa orang dewasa tepercaya yang bisa dihubungi."],
      ["Kemandirian", "Latih mengambil keputusan dengan membahas pilihan, risiko, dan cara meminta bantuan."],
      ["Keuangan", "Susun anggaran sederhana untuk kebutuhan, tabungan, dan pengeluaran bersama."],
      ["Minat dan bakat", "Hubungkan minat dengan pengalaman, pelajaran, atau pekerjaan yang bisa dijajaki."],
      ["Karakter", "Ajak remaja menetapkan nilai yang ingin ia pegang dan batas yang membuatnya merasa aman."],
    ],
  },
] as const;

export const MATERI_GENRE = [
  {
    slug: "pendewasaan-usia-perkawinan",
    judul: "Pendewasaan usia perkawinan",
    anak: "Kamu boleh punya rencana untuk sekolah, pekerjaan, kesehatan, dan keluarga. Keputusan besar perlu waktu, informasi yang benar, kesiapan, dan bebas dari tekanan.",
    orangTua: "Bicarakan pendidikan, kesehatan, kesiapan tanggung jawab, dan aturan yang berlaku. Jangan menekan anak untuk mengambil keputusan hidup sebelum ia siap.",
    tanya: "Hal apa yang ingin kamu capai sebelum membangun keluarga sendiri?",
  },
  {
    slug: "fungsi-keluarga",
    judul: "Delapan fungsi keluarga",
    anak: "Keluarga membantu anggotanya belajar nilai, hidup bersama, menyayangi, merasa aman, menjaga kesehatan, belajar, mengatur kebutuhan, dan merawat lingkungan.",
    orangTua: "Delapan fungsi keluarga mencakup agama, sosial budaya, cinta kasih, perlindungan, reproduksi, sosialisasi dan pendidikan, ekonomi, serta pembinaan lingkungan. Tunjukkan lewat kebiasaan sehari-hari.",
    tanya: "Kebiasaan rumah apa yang membuatmu merasa disayangi atau aman?",
  },
  {
    slug: "seksualitas",
    judul: "Tubuh, batasan, dan rasa aman",
    anak: "Tubuhmu milikmu. Kamu boleh berkata tidak pada sentuhan yang membuat tidak nyaman, lalu bercerita kepada orang dewasa yang kamu percaya. Kamu tidak perlu menyimpan rahasia yang membuatmu takut.",
    orangTua: "Gunakan bahasa yang jelas dan sesuai usia. Minta izin sebelum menyentuh, hormati penolakan, dan dengarkan dengan tenang bila anak bercerita tentang batas tubuhnya.",
    tanya: "Siapa orang dewasa yang bisa kamu datangi saat merasa tidak aman?",
  },
  {
    slug: "hiv-aids",
    judul: "Mengenal HIV dan AIDS",
    anak: "HIV adalah virus yang menyerang daya tahan tubuh. HIV tidak menular lewat pelukan, duduk bersama, atau berbagi makanan. Perlakukan semua orang dengan hormat.",
    orangTua: "Jelaskan perbedaan HIV dan AIDS dengan bahasa sesuai usia. Untuk pertanyaan tentang tes, pencegahan, atau pengobatan, rujuk anak ke tenaga kesehatan.",
    tanya: "Mengapa kita perlu mencari informasi kesehatan dari tenaga kesehatan?",
  },
  {
    slug: "napza",
    judul: "Mengenal NAPZA",
    anak: "NAPZA adalah narkotika, psikotropika, dan zat adiktif lainnya. Jangan mencoba zat yang tidak kamu kenal. Kamu boleh menolak ajakan dan meminta bantuan orang dewasa tepercaya.",
    orangTua: "Bicarakan tekanan teman sebaya tanpa mengancam. Ajari anak kalimat penolakan dan sepakati cara menghubungi keluarga saat ia perlu dijemput.",
    tanya: "Apa yang bisa kamu katakan bila seseorang mengajak mencoba sesuatu yang tidak kamu kenal?",
  },
  {
    slug: "kecakapan-hidup",
    judul: "Pendidikan keterampilan hidup",
    anak: "Keterampilan hidup membantu kita berkomunikasi, memahami perasaan, memecahkan masalah, dan memilih tindakan dengan pertimbangan.",
    orangTua: "Beri anak kesempatan mencoba, melakukan kesalahan yang aman, dan membicarakan pilihan. Contohkan cara meminta bantuan.",
    tanya: "Masalah kecil apa yang ingin kita pecahkan bersama minggu ini?",
  },
  {
    slug: "gender",
    judul: "Gender dan kesempatan yang setara",
    anak: "Semua anak boleh belajar, bermain, merawat diri, dan punya cita-cita. Pekerjaan rumah dapat dibagi tanpa menganggap satu tugas hanya untuk laki-laki atau perempuan.",
    orangTua: "Periksa kembali pembagian tugas dan harapan di rumah. Dengarkan minat anak tanpa membatasi berdasarkan gender.",
    tanya: "Tugas rumah apa yang bisa kita bagi dengan lebih adil?",
  },
  {
    slug: "advokasi-kie",
    judul: "Advokasi, komunikasi, dan informasi",
    anak: "Saat menerima informasi, cari tahu siapa sumbernya dan kapan dibuat. Tanyakan kepada orang dewasa tepercaya jika isinya membingungkan atau membuat khawatir.",
    orangTua: "Latih anak memeriksa sumber, tanggal, dan bukti sebelum membagikan informasi. Bicarakan cara menyampaikan pendapat dengan aman dan sopan.",
    tanya: "Bagaimana kita memeriksa apakah informasi kesehatan bisa dipercaya?",
  },
] as const;

export const KARTU_OBROLAN = [
  {
    tema: "Hati",
    kartu: [
      "Hal apa yang membuatmu merasa didengarkan?",
      "Kapan kamu ingin ditemani, bukan langsung diberi saran?",
      "Apa satu hal yang belakangan terasa berat?",
      "Bagaimana cara terbaik keluarga meminta maaf kepadamu?",
      "Siapa orang yang membuatmu merasa aman untuk bercerita?",
    ],
  },
  {
    tema: "Mimpi",
    kartu: [
      "Hal apa yang ingin kamu pelajari tahun ini?",
      "Kalau bisa mencoba satu kegiatan baru, apa pilihanmu?",
      "Siapa yang ingin kamu ajak saat mencoba sesuatu yang baru?",
      "Langkah kecil apa yang bisa kita mulai bersama?",
      "Apa yang berubah dari cita-citamu sejak dulu?",
    ],
  },
  {
    tema: "Kenangan",
    kartu: [
      "Momen keluarga mana yang ingin kamu ulang?",
      "Apa makanan rumah yang paling mengingatkanmu pada keluarga?",
      "Kapan terakhir kali kita tertawa bersama?",
      "Cerita siapa di keluarga yang ingin kamu dengar lagi?",
      "Perjalanan mana yang paling kamu ingat, dan mengapa?",
    ],
  },
  {
    tema: "Seru",
    kartu: [
      "Kalau rumah kita punya nama tim, apa namanya?",
      "Permainan apa yang ingin kamu ajarkan ke keluarga?",
      "Siapa paling mungkin lupa menaruh kunci, dan kenapa?",
      "Kalau bisa memasak satu menu bersama, pilih apa?",
      "Tebak kegiatan keluarga yang belum pernah kita coba.",
    ],
  },
] as const;
