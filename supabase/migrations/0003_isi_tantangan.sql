-- Isi tantangan awal. Teks ditulis sendiri dan perlu ditinjau psikolog anak sebelum dipakai luas.
-- Tantangan "Ke Tempat Kerja" selalu membawa peringatan izin tempat kerja dan keselamatan anak.

insert into public.tantangan (slug, kategori, judul, isi, menit, poin, peringatan) values
-- Komunikasi
('tiga-pujian', 'komunikasi', 'Sesi tiga pujian', 'Setiap anggota memuji dua anggota lain dengan hal spesifik yang mereka lakukan hari ini.', 10, 10, null),
('tiga-puluh-menit-tanpa-gawai', 'komunikasi', 'Tiga puluh menit tanpa gawai', 'Simpan semua gawai di satu keranjang. Ngobrol atau bermain bersama selama 30 menit penuh.', 30, 15, null),
('surat-dari-hati', 'komunikasi', 'Surat dari hati', 'Tulis surat pendek tentang hal yang kamu syukuri dari satu anggota keluarga, lalu bacakan.', 15, 10, null),
('dengar-tanpa-menyela', 'komunikasi', 'Dengar tanpa menyela', 'Anak bercerita 5 menit tentang harinya. Orang tua hanya mendengar, lalu merangkum ulang.', 10, 15, null),
('satu-hal-yang-bikin-takut', 'komunikasi', 'Satu hal yang bikin takut', 'Setiap orang menyebut satu hal kecil yang membuatnya takut atau cemas minggu ini. Yang lain bertanya, tidak menasihati.', 15, 15, null),
('kabar-teman-anak', 'komunikasi', 'Kabar teman anak', 'Orang tua bertanya tentang satu teman anak: namanya, apa yang mereka suka main, dan apa yang anak suka darinya.', 10, 10, null),
-- Kebersamaan
('masak-bersama', 'kebersamaan', 'Masak bersama', 'Pilih satu menu sederhana. Ayah, ibu, dan anak punya tugas masing-masing.', 45, 20, null),
('jalan-sore-keluarga', 'kebersamaan', 'Jalan sore keluarga', 'Jalan kaki 20 menit di sekitar rumah. Tiap orang menunjuk satu hal yang baru ia perhatikan.', 20, 15, null),
('makan-malam-tanpa-layar', 'kebersamaan', 'Makan malam tanpa layar', 'Makan malam bersama tanpa televisi dan ponsel. Setiap orang menceritakan satu kejadian hari ini.', 30, 15, null),
('main-papan', 'kebersamaan', 'Main papan atau kartu', 'Pilih satu permainan yang bisa dimainkan semua umur. Yang kalah memilih permainan berikutnya.', 30, 15, null),
('rapikan-satu-sudut', 'kebersamaan', 'Rapikan satu sudut rumah', 'Pilih satu sudut yang berantakan, bagi tugas, dan selesaikan dalam 15 menit.', 15, 10, null),
-- Empati
('tebak-perasaan', 'empati', 'Tebak perasaan', 'Satu orang menceritakan kejadian tanpa menyebut perasaannya. Yang lain menebak, lalu ia mengoreksi.', 10, 10, null),
('apa-yang-bisa-kubantu', 'empati', 'Apa yang bisa kubantu', 'Tanyakan ke tiap anggota keluarga: "Apa yang bisa kubantu hari ini?" Lalu kerjakan satu permintaan.', 15, 10, null),
('bantu-tetangga', 'empati', 'Bantu tetangga', 'Tawarkan bantuan kecil ke satu tetangga: membawakan belanjaan, menyapu depan rumah, atau mengantar makanan.', 20, 15, null),
('maaf-dan-peluk', 'empati', 'Minta maaf dengan jelas', 'Ingat satu kejadian minggu ini yang melukai orang lain di rumah. Sebut apa yang terjadi, minta maaf, lalu tanya apa yang ia butuhkan.', 10, 15, null),
('sudut-pandang-lain', 'empati', 'Sudut pandang lain', 'Pilih satu perselisihan kecil di rumah. Tiap orang menceritakannya dari sisi orang yang berselisih dengannya.', 15, 15, null),
-- Kemandirian
('anak-siapkan-tas', 'kemandirian', 'Anak siapkan tas sendiri', 'Anak menyiapkan tas dan perlengkapan besok tanpa disuruh. Orang tua hanya mengecek jika diminta.', 10, 10, null),
('uang-saku-tiga-bagian', 'kemandirian', 'Uang saku tiga bagian', 'Anak membagi uang saku mingguan menjadi tabung, belanja, dan berbagi, lalu menuliskannya.', 15, 15, null),
('anak-sarapan-sendiri', 'kemandirian', 'Anak siapkan sarapan', 'Anak menyiapkan sarapan sederhana untuk dirinya, misalnya roti atau telur rebus, dengan pengawasan orang tua.', 20, 15, null),
('piket-rumah', 'kemandirian', 'Piket rumah', 'Buat jadwal piket seminggu. Tiap anggota memilih satu tugas tetap dan mengerjakannya hari ini.', 20, 10, null),
('jadwal-belajar-sendiri', 'kemandirian', 'Jadwal belajar buatan anak', 'Anak menyusun jadwal belajar dan bermain untuk besok. Orang tua boleh memberi satu saran saja.', 15, 15, null),
-- Kreativitas
('gambar-rumah-impian', 'kreativitas', 'Gambar rumah impian', 'Tiap orang menggambar rumah impiannya dalam 10 menit, lalu menjelaskan satu ruangan favorit.', 20, 10, null),
('cerita-bersambung', 'kreativitas', 'Cerita bersambung', 'Satu orang memulai cerita satu kalimat. Bergiliran menambahkan satu kalimat sampai 12 kalimat.', 15, 10, null),
('barang-bekas-jadi-mainan', 'kreativitas', 'Barang bekas jadi mainan', 'Buat satu mainan dari kardus, botol, atau kain bekas di rumah. Beri nama dan aturan mainnya.', 40, 20, null),
('lagu-keluarga', 'kreativitas', 'Lagu keluarga', 'Ganti syair satu lagu yang semua orang tahu dengan cerita tentang keluarga kalian.', 20, 15, null),
('foto-tiga-hal-indah', 'kreativitas', 'Tiga foto hal indah', 'Tiap orang memotret tiga hal indah di sekitar rumah, lalu saling menceritakan kenapa memilihnya.', 20, 10, null),
-- Sepulang kerja
('istirahat-dua-puluh-menit', 'sepulang_kerja', 'Istirahat dulu, lalu ngobrol lima menit', 'Ayah istirahat 20 menit tanpa diajak bicara. Setelah itu ayah dan anak ngobrol 5 menit tentang apa pun.', 25, 10, null),
('sambutan-di-pintu', 'sepulang_kerja', 'Sambutan lima menit di pintu', 'Anak menyambut ayah di pintu dan bercerita satu hal yang terjadi hari ini. Ayah mendengar sebelum melepas sepatu.', 5, 10, null),
('mawar-dan-duri', 'sepulang_kerja', 'Mawar dan duri saat makan malam', 'Tiap orang menyebut satu hal menyenangkan (mawar) dan satu hal sulit (duri) dari harinya.', 15, 15, null),
('pijat-bahu-bercerita', 'sepulang_kerja', 'Pijat bahu sambil bercerita', 'Anak memijat bahu ayah selama 5 menit sambil bercerita tentang sekolah atau teman.', 10, 10, null),
('tebak-hari-kerja-ayah', 'sepulang_kerja', 'Tebak hari kerja ayah', 'Anak menebak hari kerja ayah dengan pertanyaan yang dijawab ya atau tidak, maksimal 10 pertanyaan.', 10, 10, null),
('duduk-berdampingan', 'sepulang_kerja', 'Duduk berdampingan', 'Ayah duduk di samping anak yang menggambar atau mengerjakan PR. Ayah tidak mengoreksi, cukup menemani.', 20, 10, null),
('dongeng-pengantar-tidur', 'sepulang_kerja', 'Dongeng pengantar tidur', 'Ayah membacakan atau mengarang dongeng pendek sebelum anak tidur.', 10, 15, null),
('pelukan-dan-satu-syukur', 'sepulang_kerja', 'Pelukan dan satu syukur', 'Sebelum tidur, ayah dan anak berpelukan dan masing-masing menyebut satu hal yang disyukuri hari ini.', 3, 10, null),
-- Ke tempat kerja
('aturan-aman-sebelum-masuk', 'ke_tempat_kerja', 'Aturan aman sebelum masuk', 'Kerjakan ini pertama kali. Ayah menjelaskan area yang boleh dan tidak boleh dimasuki anak, siapa yang dihubungi bila terpisah, dan apa yang tidak boleh disentuh.', 10, 15, 'Pastikan tempat kerja mengizinkan anak berkunjung dan ayah mendampingi anak sepanjang waktu. Ikuti aturan keselamatan di sana.'),
('wawancara-profesi', 'ke_tempat_kerja', 'Wawancara profesi', 'Anak mewawancarai ayah: apa tugas sehari-hari, apa bagian paling sulit, dan apa yang ayah pelajari dulu untuk bisa bekerja di sini.', 20, 15, 'Pastikan tempat kerja mengizinkan anak berkunjung dan ayah mendampingi anak sepanjang waktu. Ikuti aturan keselamatan di sana.'),
('asisten-ayah-sehari', 'ke_tempat_kerja', 'Asisten ayah sehari', 'Anak membantu satu tugas ringan dan aman (memilah, menata, mencatat), lalu melaporkan hasilnya kepada ayah.', 45, 20, 'Pastikan tempat kerja mengizinkan anak berkunjung dan ayah mendampingi anak sepanjang waktu. Ikuti aturan keselamatan di sana.'),
('peta-tempat-kerja', 'ke_tempat_kerja', 'Peta tempat kerja', 'Gambar denah sederhana atau foto tiga area yang boleh difoto. Ayah menjelaskan fungsi tiap area.', 20, 15, 'Pastikan tempat kerja mengizinkan anak berkunjung dan ayah mendampingi anak sepanjang waktu. Ikuti aturan keselamatan di sana.'),
('kenalan-rekan-ayah', 'ke_tempat_kerja', 'Kenalan dengan rekan ayah', 'Anak berkenalan dengan satu rekan kerja ayah dan bertanya bagaimana ia memilih pekerjaannya.', 15, 15, 'Pastikan tempat kerja mengizinkan anak berkunjung dan ayah mendampingi anak sepanjang waktu. Ikuti aturan keselamatan di sana.'),
('jurnal-rasa-ingin-tahu', 'ke_tempat_kerja', 'Jurnal rasa ingin tahu', 'Catat tiga hal baru yang dilihat dan satu pertanyaan "bagaimana ini bekerja?". Bahas di perjalanan pulang.', 20, 15, 'Pastikan tempat kerja mengizinkan anak berkunjung dan ayah mendampingi anak sepanjang waktu. Ikuti aturan keselamatan di sana.'),
('makan-siang-berdua', 'ke_tempat_kerja', 'Makan siang berdua', 'Makan siang bersama ayah sambil membahas keterampilan yang dibutuhkan dalam pekerjaan ayah dan mimpi anak.', 40, 15, 'Pastikan tempat kerja mengizinkan anak berkunjung dan ayah mendampingi anak sepanjang waktu. Ikuti aturan keselamatan di sana.')
on conflict (slug) do nothing;
