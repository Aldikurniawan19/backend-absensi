import {
  PrismaClient,
  TahunAjaranStatus,
  UserRole,
  AbsensiStatus,
  AbsensiSumber,
  IzinJenis,
  IzinStatus,
  SesiAbsensiStatus,
  KomponenNilai,
  StatusRaport,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function seed10Mipa2() {
  console.log('================================================================');
  console.log('  SEEDER LENGKAP & VARIASI UNTUK KELAS 10 MIPA 2 (OPTIMAL & CEPAT)');
  console.log('================================================================');

  const defaultPassword = await argon2.hash('password123');

  // 1. Dapatkan atau Buat Sekolah
  console.log('1. Mempersiapkan Sekolah...');
  let sekolah = await prisma.sekolah.findFirst();
  if (!sekolah) {
    sekolah = await prisma.sekolah.create({
      data: {
        nama: 'SMA Negeri 1 Nusantara',
        npsn: '10203040',
        alamat: 'Jl. Merdeka Belajar No. 45, Jakarta Pusat',
        wajib_gps: false,
        lat_sekolah: -6.1685,
        lng_sekolah: 106.837,
        radius_meter: 150,
        maks_sesi_aktif_siswa: 1,
      },
    });
  }

  // 2. Dapatkan atau Buat Tahun Ajaran Aktif
  console.log('2. Mempersiapkan Tahun Ajaran Aktif (2024/2025 Ganjil)...');
  let tahunAktif = await prisma.tahunAjaran.findFirst({
    where: { sekolah_id: sekolah.id, status: TahunAjaranStatus.AKTIF },
  });
  if (!tahunAktif) {
    tahunAktif = await prisma.tahunAjaran.create({
      data: {
        sekolah_id: sekolah.id,
        nama: '2024/2025',
        semester: 'Ganjil',
        tanggal_mulai: new Date('2024-07-15'),
        tanggal_selesai: new Date('2024-12-20'),
        status: TahunAjaranStatus.AKTIF,
      },
    });
  }

  // 3. Konfigurasi Penilaian Kurikulum Merdeka
  console.log('3. Mempersiapkan Konfigurasi Penilaian Kurikulum Merdeka...');
  await prisma.konfigurasiPenilaian.upsert({
    where: {
      sekolah_id_tahun_ajaran_id: {
        sekolah_id: sekolah.id,
        tahun_ajaran_id: tahunAktif.id,
      },
    },
    update: {
      bobot_formatif: 40,
      bobot_sts: 30,
      bobot_sas: 30,
      batas_bb: 40,
      batas_mb: 65,
      batas_bsh: 85,
    },
    create: {
      sekolah_id: sekolah.id,
      tahun_ajaran_id: tahunAktif.id,
      bobot_formatif: 40,
      bobot_sts: 30,
      bobot_sas: 30,
      batas_bb: 40,
      batas_mb: 65,
      batas_bsh: 85,
    },
  });

  // 4. Jurusan MIPA
  console.log('4. Mempersiapkan Jurusan MIPA...');
  const jurusanMipa = await prisma.jurusan.upsert({
    where: {
      sekolah_id_kode: {
        sekolah_id: sekolah.id,
        kode: 'MIPA',
      },
    },
    update: {
      nama: 'Matematika dan Ilmu Pengetahuan Alam',
    },
    create: {
      sekolah_id: sekolah.id,
      nama: 'Matematika dan Ilmu Pengetahuan Alam',
      kode: 'MIPA',
    },
  });

  // 5. Kelas 10 MIPA 2
  console.log('5. Mempersiapkan Kelas 10 MIPA 2...');
  const kelas10Mipa2 = await prisma.kelas.upsert({
    where: {
      sekolah_id_tingkat_jurusan_id_nama_rombel: {
        sekolah_id: sekolah.id,
        tingkat: 10,
        jurusan_id: jurusanMipa.id,
        nama_rombel: '2',
      },
    },
    update: {},
    create: {
      sekolah_id: sekolah.id,
      jurusan_id: jurusanMipa.id,
      tingkat: 10,
      nama_rombel: '2',
    },
  });

  // 6. Guru-Guru & Wali Kelas 10 MIPA 2
  console.log('6. Mempersiapkan Guru Pengampu & Wali Kelas 10 MIPA 2...');
  const guruListRaw = [
    {
      nama: 'Siti Rahmawati, S.Pd.',
      nip: '198002022005012002',
      email: 'siti.rahmawati@guru.sch.id',
      hp: '081298765002',
      mapel: 'Fisika',
      isWali: true,
    },
    {
      nama: 'Drs. Ahmad Fauzi, M.Pd.',
      nip: '197501012000031001',
      email: 'ahmad.fauzi@guru.sch.id',
      hp: '081298765001',
      mapel: 'Matematika Wajib',
      isWali: false,
    },
    {
      nama: 'Dr. Irwan Setiawan, M.Si.',
      nip: '198106202009021004',
      email: 'irwan.setiawan@guru.sch.id',
      hp: '081298765006',
      mapel: 'Kimia',
      isWali: false,
    },
    {
      nama: 'Aditya Pratama, S.Si., M.Sc.',
      nip: '199002202018021001',
      email: 'aditya.pratama@guru.sch.id',
      hp: '081298765014',
      mapel: 'Biologi',
      isWali: false,
    },
    {
      nama: 'Dra. Nurul Hidayah, M.Pd.',
      nip: '197604122002122001',
      email: 'nurul.hidayah@guru.sch.id',
      hp: '081298765004',
      mapel: 'Bahasa Indonesia',
      isWali: false,
    },
    {
      nama: 'Bambang Sujatmiko, M.Pd.',
      nip: '197805182006041002',
      email: 'bambang.sujatmiko@guru.sch.id',
      hp: '081298765005',
      mapel: 'Bahasa Inggris',
      isWali: false,
    },
    {
      nama: 'Muhammad Zulkarnain, S.Pd.I.',
      nip: '198309142011011006',
      email: 'm.zulkarnain@guru.sch.id',
      hp: '081298765009',
      mapel: 'Pendidikan Agama Islam',
      isWali: false,
    },
    {
      nama: 'Joko Widodo, S.Pd., M.H.',
      nip: '198012052007011007',
      email: 'joko.widodo@guru.sch.id',
      hp: '081298765012',
      mapel: 'Pendidikan Pancasila & Kewarganegaraan',
      isWali: false,
    },
    {
      nama: 'Eko Prasetyo, S.Pd.',
      nip: '198610192014021001',
      email: 'eko.prasetyo@guru.sch.id',
      hp: '081298765010',
      mapel: 'Pendidikan Jasmani & Olahraga',
      isWali: false,
    },
    {
      nama: 'Agus Priyanto, S.Sos., M.Pd.',
      nip: '197908302005021005',
      email: 'agus.priyanto@guru.sch.id',
      hp: '081298765008',
      mapel: 'Sejarah Indonesia',
      isWali: false,
    },
    {
      nama: 'Dewi Lestari, S.Sn.',
      nip: '198811222015032002',
      email: 'dewi.lestari@guru.sch.id',
      hp: '081298765011',
      mapel: 'Seni Budaya',
      isWali: false,
    },
    {
      nama: 'Maya Safitri, S.Kom., M.T.',
      nip: '198901162016012004',
      email: 'maya.safitri@guru.sch.id',
      hp: '081298765013',
      mapel: 'Informatika',
      isWali: false,
    },
  ];

  const guruMap: Record<string, any> = {};
  let waliKelasGuru: any = null;

  for (const g of guruListRaw) {
    const guru = await prisma.guru.upsert({
      where: { email: g.email },
      update: {
        nama: g.nama,
        nip: g.nip,
        no_hp: g.hp,
      },
      create: {
        sekolah_id: sekolah.id,
        nama: g.nama,
        nip: g.nip,
        email: g.email,
        password: defaultPassword,
        no_hp: g.hp,
      },
    });

    guruMap[g.mapel] = guru;
    if (g.isWali) {
      waliKelasGuru = guru;
    }
  }

  // Tetapkan Siti Rahmawati sebagai Wali Kelas 10 MIPA 2
  await prisma.penugasanWaliKelas.upsert({
    where: {
      kelas_id_tahun_ajaran_id: {
        kelas_id: kelas10Mipa2.id,
        tahun_ajaran_id: tahunAktif.id,
      },
    },
    update: {
      guru_id: waliKelasGuru.id,
    },
    create: {
      guru_id: waliKelasGuru.id,
      kelas_id: kelas10Mipa2.id,
      tahun_ajaran_id: tahunAktif.id,
    },
  });

  // 7. Mata Pelajaran untuk Kelas 10 MIPA 2
  console.log('7. Mempersiapkan 12 Mata Pelajaran 10 MIPA 2...');
  const mapelDefs = [
    { nama: 'Matematika Wajib', kode: 'MTK-W', guru: guruMap['Matematika Wajib'] },
    { nama: 'Fisika', kode: 'FIS', guru: guruMap['Fisika'] },
    { nama: 'Kimia', kode: 'KIM', guru: guruMap['Kimia'] },
    { nama: 'Biologi', kode: 'BIO', guru: guruMap['Biologi'] },
    { nama: 'Bahasa Indonesia', kode: 'BIND', guru: guruMap['Bahasa Indonesia'] },
    { nama: 'Bahasa Inggris', kode: 'BING', guru: guruMap['Bahasa Inggris'] },
    { nama: 'Pendidikan Agama Islam', kode: 'PAI', guru: guruMap['Pendidikan Agama Islam'] },
    { nama: 'Pendidikan Pancasila & Kewarganegaraan', kode: 'PPKN', guru: guruMap['Pendidikan Pancasila & Kewarganegaraan'] },
    { nama: 'Pendidikan Jasmani & Olahraga', kode: 'PJOK', guru: guruMap['Pendidikan Jasmani & Olahraga'] },
    { nama: 'Sejarah Indonesia', kode: 'SEJ-I', guru: guruMap['Sejarah Indonesia'] },
    { nama: 'Seni Budaya', kode: 'SNB', guru: guruMap['Seni Budaya'] },
    { nama: 'Informatika', kode: 'INF', guru: guruMap['Informatika'] },
  ];

  const mapelList: any[] = [];
  for (const m of mapelDefs) {
    const mapel = await prisma.mataPelajaran.upsert({
      where: {
        sekolah_id_kode: {
          sekolah_id: sekolah.id,
          kode: m.kode,
        },
      },
      update: { nama: m.nama },
      create: {
        sekolah_id: sekolah.id,
        nama: m.nama,
        kode: m.kode,
      },
    });

    await prisma.guruMapel.upsert({
      where: {
        guru_id_mapel_id: {
          guru_id: m.guru.id,
          mapel_id: mapel.id,
        },
      },
      update: {},
      create: {
        guru_id: m.guru.id,
        mapel_id: mapel.id,
      },
    });

    mapelList.push({ ...mapel, guru: m.guru });
  }

  // 8. Jadwal Pelajaran 10 MIPA 2 (Senin s/d Jumat)
  console.log('8. Menyusun Jadwal Pelajaran Mingguan 10 MIPA 2...');
  await prisma.jadwalPelajaran.deleteMany({
    where: {
      kelas_id: kelas10Mipa2.id,
      tahun_ajaran_id: tahunAktif.id,
    },
  });

  const jadwalDefs = [
    // Senin (1)
    { hari: 1, jam_mulai: '07:30', jam_selesai: '09:00', mapelKode: 'PAI' },
    { hari: 1, jam_mulai: '09:15', jam_selesai: '10:45', mapelKode: 'MTK-W' },
    { hari: 1, jam_mulai: '11:00', jam_selesai: '12:30', mapelKode: 'BIND' },
    // Selasa (2)
    { hari: 2, jam_mulai: '07:30', jam_selesai: '09:00', mapelKode: 'FIS' },
    { hari: 2, jam_mulai: '09:15', jam_selesai: '10:45', mapelKode: 'KIM' },
    { hari: 2, jam_mulai: '11:00', jam_selesai: '12:30', mapelKode: 'BING' },
    // Rabu (3)
    { hari: 3, jam_mulai: '07:30', jam_selesai: '09:00', mapelKode: 'BIO' },
    { hari: 3, jam_mulai: '09:15', jam_selesai: '10:45', mapelKode: 'INF' },
    { hari: 3, jam_mulai: '11:00', jam_selesai: '12:30', mapelKode: 'PPKN' },
    // Kamis (4)
    { hari: 4, jam_mulai: '07:30', jam_selesai: '09:00', mapelKode: 'PJOK' },
    { hari: 4, jam_mulai: '09:15', jam_selesai: '10:45', mapelKode: 'SEJ-I' },
    { hari: 4, jam_mulai: '11:00', jam_selesai: '12:30', mapelKode: 'FIS' },
    // Jumat (5)
    { hari: 5, jam_mulai: '07:30', jam_selesai: '08:45', mapelKode: 'SNB' },
    { hari: 5, jam_mulai: '09:00', jam_selesai: '10:15', mapelKode: 'MTK-W' },
  ];

  const jadwalCreateEntries = [];
  for (const j of jadwalDefs) {
    const targetMapel = mapelList.find((m) => m.kode === j.mapelKode);
    if (targetMapel) {
      jadwalCreateEntries.push({
        kelas_id: kelas10Mipa2.id,
        guru_id: targetMapel.guru.id,
        mapel_id: targetMapel.id,
        tahun_ajaran_id: tahunAktif.id,
        hari: j.hari,
        jam_mulai: j.jam_mulai,
        jam_selesai: j.jam_selesai,
      });
    }
  }

  await prisma.jadwalPelajaran.createMany({
    data: jadwalCreateEntries,
  });

  const createdJadwals = await prisma.jadwalPelajaran.findMany({
    where: {
      kelas_id: kelas10Mipa2.id,
      tahun_ajaran_id: tahunAktif.id,
    },
    include: { mapel: true, guru: true },
  });

  // 9. Data 30 Siswa Lengkap & Beragam untuk Kelas 10 MIPA 2
  console.log('9. Mempersiapkan 30 Siswa 10 MIPA 2 dengan profil lengkap...');
  const siswaDataRaw = [
    { nama: 'Adinda Putri Maharani', nisn: '0051202001', email: 'adinda.maharani@siswa.sch.id', tipe: 'SB', hp: '0812345001' },
    { nama: 'Aditya Pratama Nugraha', nisn: '0051202002', email: 'aditya.nugraha@siswa.sch.id', tipe: 'BSH', hp: '0812345002' },
    { nama: 'Ahmad Fauzan Al-Ghifari', nisn: '0051202003', email: 'fauzan.ghifari@siswa.sch.id', tipe: 'SB', hp: '0812345003' },
    { nama: 'Amanda Salsa Bella', nisn: '0051202004', email: 'amanda.salsa@siswa.sch.id', tipe: 'BSH', hp: '0812345004' },
    { nama: 'Anisa Rahmawati', nisn: '0051202005', email: 'anisa.rahma@siswa.sch.id', tipe: 'MB', hp: '0812345005' },
    { nama: 'Bagas Arya Wijaya', nisn: '0051202006', email: 'bagas.arya@siswa.sch.id', tipe: 'BSH', hp: '0812345006' },
    { nama: 'Bayu Setiawan', nisn: '0051202007', email: 'bayu.setiawan@siswa.sch.id', tipe: 'MB', hp: '0812345007' },
    { nama: 'Bunga Citra Lestari', nisn: '0051202008', email: 'bunga.citra@siswa.sch.id', tipe: 'SB', hp: '0812345008' },
    { nama: 'Cantika Dwi Putri', nisn: '0051202009', email: 'cantika.dwi@siswa.sch.id', tipe: 'BSH', hp: '0812345009' },
    { nama: 'Daniel Christian', nisn: '0051202010', email: 'daniel.christian@siswa.sch.id', tipe: 'SB', hp: '0812345010' },
    { nama: 'Dewi Sartika', nisn: '0051202011', email: 'dewi.sartika@siswa.sch.id', tipe: 'BSH', hp: '0812345011' },
    { nama: 'Dimas Anggara', nisn: '0051202012', email: 'dimas.anggara@siswa.sch.id', tipe: 'BB', hp: '0812345012' },
    { nama: 'Fajar Ramadhan', nisn: '0051202013', email: 'fajar.ramadhan@siswa.sch.id', tipe: 'BSH', hp: '0812345013' },
    { nama: 'Farhan Maulana', nisn: '0051202014', email: 'farhan.maulana@siswa.sch.id', tipe: 'SB', hp: '0812345014' },
    { nama: 'Fitri Handayani', nisn: '0051202015', email: 'fitri.handayani@siswa.sch.id', tipe: 'BSH', hp: '0812345015' },
    { nama: 'Galang Perkasa', nisn: '0051202016', email: 'galang.perkasa@siswa.sch.id', tipe: 'MB', hp: '0812345016' },
    { nama: 'Grace Natalie', nisn: '0051202017', email: 'grace.natalie@siswa.sch.id', tipe: 'SB', hp: '0812345017' },
    { nama: 'Hendra Saputra', nisn: '0051202018', email: 'hendra.saputra@siswa.sch.id', tipe: 'BSH', hp: '0812345018' },
    { nama: 'Indah Permatasari', nisn: '0051202019', email: 'indah.permata@siswa.sch.id', tipe: 'BSH', hp: '0812345019' },
    { nama: 'Joshua Pratama', nisn: '0051202020', email: 'joshua.pratama@siswa.sch.id', tipe: 'SB', hp: '0812345020' },
    { nama: 'Kevin Sanjaya', nisn: '0051202021', email: 'kevin.sanjaya@siswa.sch.id', tipe: 'BSH', hp: '0812345021' },
    { nama: 'Larasati Kusuma', nisn: '0051202022', email: 'larasati.kusuma@siswa.sch.id', tipe: 'SB', hp: '0812345022' },
    { nama: 'Muhammad Rizky', nisn: '0051202023', email: 'm.rizky10m2@siswa.sch.id', tipe: 'BSH', hp: '0812345023' },
    { nama: 'Nabila Syakieb', nisn: '0051202024', email: 'nabila.syakieb@siswa.sch.id', tipe: 'SB', hp: '0812345024' },
    { nama: 'Nurul Izzati', nisn: '0051202025', email: 'nurul.izzati@siswa.sch.id', tipe: 'BSH', hp: '0812345025' },
    { nama: 'Putri Ayu Andira', nisn: '0051202026', email: 'putri.ayu@siswa.sch.id', tipe: 'MB', hp: '0812345026' },
    { nama: 'Raditya Dika Pratama', nisn: '0051202027', email: 'raditya.dika@siswa.sch.id', tipe: 'BSH', hp: '0812345027' },
    { nama: 'Rian Hidayat', nisn: '0051202028', email: 'rian.hidayat@siswa.sch.id', tipe: 'BB', hp: '0812345028' },
    { nama: 'Sarah Azhari', nisn: '0051202029', email: 'sarah.azhari@siswa.sch.id', tipe: 'BSH', hp: '0812345029' },
    { nama: 'Zaidan Al-Farisi', nisn: '0051202030', email: 'zaidan.alfarisi@siswa.sch.id', tipe: 'SB', hp: '0812345030' },
  ];

  const siswaList: any[] = [];
  for (const s of siswaDataRaw) {
    const siswa = await prisma.siswa.upsert({
      where: { nisn: s.nisn },
      update: {
        nama: s.nama,
        email: s.email,
        no_hp_ortu: s.hp,
      },
      create: {
        sekolah_id: sekolah.id,
        nama: s.nama,
        nisn: s.nisn,
        email: s.email,
        password: defaultPassword,
        no_hp_ortu: s.hp,
      },
    });

    await prisma.riwayatKelasSiswa.upsert({
      where: {
        siswa_id_tahun_ajaran_id: {
          siswa_id: siswa.id,
          tahun_ajaran_id: tahunAktif.id,
        },
      },
      update: {
        kelas_id: kelas10Mipa2.id,
      },
      create: {
        siswa_id: siswa.id,
        kelas_id: kelas10Mipa2.id,
        tahun_ajaran_id: tahunAktif.id,
      },
    });

    siswaList.push({ ...siswa, tipe: s.tipe });
  }

  // 10. Master Ekstrakurikuler & Keanggotaan Siswa
  console.log('10. Mempersiapkan Master Ekstrakurikuler & Keanggotaan Siswa...');
  const ekskulNames = [
    'Pramuka (Wajib)',
    'Palang Merah Remaja (PMR)',
    'Paskibra',
    'Karya Ilmiah Remaja (KIR)',
    'Robotik & Coding Club',
    'English Club',
    'Bola Basket',
    'Futsal',
    'Seni Musik & Paduan Suara',
  ];

  const ekskulList: any[] = [];
  for (const en of ekskulNames) {
    const ekskul = await prisma.ekstrakurikuler.upsert({
      where: {
        sekolah_id_nama: {
          sekolah_id: sekolah.id,
          nama: en,
        },
      },
      update: {},
      create: {
        sekolah_id: sekolah.id,
        nama: en,
      },
    });
    ekskulList.push(ekskul);
  }

  // Hapus ekskul lama kelas ini
  await prisma.ekstrakurikulerSiswa.deleteMany({
    where: {
      siswa_id: { in: siswaList.map((s) => s.id) },
      tahun_ajaran_id: tahunAktif.id,
    },
  });

  const ekskulNotes = [
    'Sangat aktif berpartisipasi dalam setiap kegiatan rutin dan menunjukkan jiwa kepemimpinan.',
    'Menunjukkan dedikasi dan keterampilan yang sangat baik dalam latihan maupun lomba.',
    'Aktif mengikuti latihan berkala dan memiliki kerja sama tim yang baik.',
    'Cukup aktif dan menunjukkan minat belajar yang baik dalam pengembangan bakat.',
  ];

  const ekskulSiswaEntries = [];
  for (let idx = 0; idx < siswaList.length; idx++) {
    const st = siswaList[idx];
    const eWajib = ekskulList[0]; // Pramuka
    const ePilihan = ekskulList[1 + (idx % (ekskulList.length - 1))];

    const predikatWajib = st.tipe === 'SB' ? 'Sangat Baik' : 'Baik';
    const predikatPilihan = st.tipe === 'SB' ? 'Sangat Baik' : st.tipe === 'BSH' ? 'Baik' : 'Cukup';

    ekskulSiswaEntries.push({
      siswa_id: st.id,
      ekstrakurikuler_id: eWajib.id,
      tahun_ajaran_id: tahunAktif.id,
      predikat: predikatWajib,
      keterangan: ekskulNotes[0],
    });

    ekskulSiswaEntries.push({
      siswa_id: st.id,
      ekstrakurikuler_id: ePilihan.id,
      tahun_ajaran_id: tahunAktif.id,
      predikat: predikatPilihan,
      keterangan: ekskulNotes[idx % ekskulNotes.length],
    });
  }

  await prisma.ekstrakurikulerSiswa.createMany({
    data: ekskulSiswaEntries,
  });

  // 11. Input Nilai Kurikulum Merdeka (Formatif, STS, SAS) untuk Semua Mapel dalam Sekali Batch
  console.log('11. Memasukkan Nilai Formatif, STS, SAS & Catatan Capaian Kompetensi (Batch Insert)...');
  await prisma.nilaiSiswa.deleteMany({
    where: {
      kelas_id: kelas10Mipa2.id,
      tahun_ajaran_id: tahunAktif.id,
    },
  });

  await prisma.catatanCapaian.deleteMany({
    where: {
      tahun_ajaran_id: tahunAktif.id,
      siswa_id: { in: siswaList.map((s) => s.id) },
    },
  });

  const getBaseScore = (tipe: string, varianceSeed: number) => {
    let base = 80;
    if (tipe === 'SB') base = 90;
    else if (tipe === 'BSH') base = 80;
    else if (tipe === 'MB') base = 68;
    else if (tipe === 'BB') base = 48;

    const jitter = ((varianceSeed * 7 + 13) % 15) - 6; // -6 s/d +8
    return Math.min(99, Math.max(35, base + jitter));
  };

  const catatanCapaianMap: Record<string, { sb: string; bsh: string; mb: string; bb: string }> = {
    'MTK-W': {
      sb: 'Menunjukkan penguasaan sangat tinggi dalam menyelesaikan persamaan eksponensial, logaritma, dan penerapan sistem pertidaksamaan linier.',
      bsh: 'Mampu memahami konsep dasar eksponensial dan menyelesaikan soal-soal sistem persamaan dengan prosedur yang tepat.',
      mb: 'Mulai memahami konsep dasar aljabar namun memerlukan ketelitian lebih dalam perhitungan operasi bilangan berpangkat.',
      bb: 'Perlu bimbingan intensif dalam memahami konsep aljabar dasar dan operasi pecahan matematika.',
    },
    'FIS': {
      sb: 'Sangat mahir dalam menganalisis fenomena vektor, kinematika gerak lurus, serta aktif memimpin praktikum pengukuran laboratorium.',
      bsh: 'Mampu menerapkan rumus gerak lurus beraturan dan menyelesaikan permasalahan dinamika dengan baik.',
      mb: 'Mulai memahami konsep gerak dan vektor, namun perlu bimbingan dalam analisis grafik kecepatan dan waktu.',
      bb: 'Perlu pendampingan khusus dalam memahami satuan pengukuran fisika dan konversi rumus dasar gerak.',
    },
    'KIM': {
      sb: 'Sangat unggul dalam memahami struktur atom, tabel periodik unsur, dan konfigurasi elektron dengan pembuktian analitis.',
      bsh: 'Memahami kaidah oktet, ikatan kimia ionik dan kovalen dengan baik dan sistematis.',
      mb: 'Mulai mampu menuliskan konfigurasi elektron sederhana namun perlu latihan lebih dalam membedakan ikatan kimia.',
      bb: 'Perlu bimbingan dalam membaca tabel periodik dan memahami lambang unsur kimia dasar.',
    },
    'BIO': {
      sb: 'Menunjukkan pemahaman mendalam tentang keanekaragaman hayati, sel tumbuhan dan hewan, serta analisis ekosistem.',
      bsh: 'Mampu menjelaskan tingkatan organisasi kehidupan dan interaksi antarmakhluk hidup dengan jelas.',
      mb: 'Mulai memahami struktur sel namun perlu penguatan dalam klasifikasi makhluk hidup lima kingdom.',
      bb: 'Perlu bantuan dalam menghafal dan mengidentifikasi bagian-bagian mikroskopis sel.',
    },
    'BIND': {
      sb: 'Sangat terampil dalam menyusun teks laporan hasil observasi (LHO) dan berargumen secara logis dalam teks eksposisi.',
      bsh: 'Mampu menulis teks eksposisi dan mengidentifikasi struktur teks kebahasaan dengan baik.',
      mb: 'Mulai mampu menulis paragraf yang terstruktur namun perlu memperhatikan kaidah ejaan PUEBI.',
      bb: 'Perlu bimbingan dalam menyusun kalimat efektif dan memperbanyak kosakata baku bahasa Indonesia.',
    },
    'BING': {
      sb: 'Demonstrates exceptional speaking and writing skills, fluent in descriptive texts and conversational grammar.',
      bsh: 'Good comprehension in reading narrative texts and able to express opinions in English adequately.',
      mb: 'Showing progress in basic vocabulary and sentence structure, requires more speaking practice.',
      bb: 'Needs intensive guidance in basic English tenses and vocabulary building.',
    },
  };

  const defaultCatatan = {
    sb: 'Menunjukkan pemahaman dan keterampilan yang sangat tinggi dalam penguasaan seluruh materi pembelajaran.',
    bsh: 'Mampu menguasai kompetensi dasar materi pembelajaran dengan baik dan konsisten.',
    mb: 'Mulai menunjukkan penguasaan materi pembelajaran namun memerlukan dorongan latihan mandiri.',
    bb: 'Perlu bimbingan dan pendampingan khusus dalam mencapai kriteria ketercapaian tujuan pembelajaran.',
  };

  const allNilaiEntries: any[] = [];
  const allCatatanEntries: any[] = [];

  for (let sIdx = 0; sIdx < siswaList.length; sIdx++) {
    const st = siswaList[sIdx];

    for (let mIdx = 0; mIdx < mapelList.length; mIdx++) {
      const mp = mapelList[mIdx];
      const vSeed = sIdx + mIdx * 3;

      const f1 = getBaseScore(st.tipe, vSeed);
      const f2 = getBaseScore(st.tipe, vSeed + 1);
      const f3 = getBaseScore(st.tipe, vSeed + 2);
      const sts = getBaseScore(st.tipe, vSeed + 3);
      const sas = getBaseScore(st.tipe, vSeed + 4);

      allNilaiEntries.push(
        {
          siswa_id: st.id,
          mapel_id: mp.id,
          kelas_id: kelas10Mipa2.id,
          tahun_ajaran_id: tahunAktif.id,
          guru_id: mp.guru.id,
          komponen: KomponenNilai.FORMATIF,
          judul: 'Tugas 1: Pemahaman Konsep',
          nilai: f1,
        },
        {
          siswa_id: st.id,
          mapel_id: mp.id,
          kelas_id: kelas10Mipa2.id,
          tahun_ajaran_id: tahunAktif.id,
          guru_id: mp.guru.id,
          komponen: KomponenNilai.FORMATIF,
          judul: 'Tugas 2: Praktikum & Analisis',
          nilai: f2,
        },
        {
          siswa_id: st.id,
          mapel_id: mp.id,
          kelas_id: kelas10Mipa2.id,
          tahun_ajaran_id: tahunAktif.id,
          guru_id: mp.guru.id,
          komponen: KomponenNilai.FORMATIF,
          judul: 'Ulangan Harian Bab 1',
          nilai: f3,
        },
        {
          siswa_id: st.id,
          mapel_id: mp.id,
          kelas_id: kelas10Mipa2.id,
          tahun_ajaran_id: tahunAktif.id,
          guru_id: mp.guru.id,
          komponen: KomponenNilai.STS,
          judul: 'Sumatif Tengah Semester (STS)',
          nilai: sts,
        },
        {
          siswa_id: st.id,
          mapel_id: mp.id,
          kelas_id: kelas10Mipa2.id,
          tahun_ajaran_id: tahunAktif.id,
          guru_id: mp.guru.id,
          komponen: KomponenNilai.SAS,
          judul: 'Sumatif Akhir Semester (SAS)',
          nilai: sas,
        },
      );

      const deskripsiPack = catatanCapaianMap[mp.kode] || defaultCatatan;
      let narasi = deskripsiPack.bsh;
      if (st.tipe === 'SB') narasi = deskripsiPack.sb;
      else if (st.tipe === 'MB') narasi = deskripsiPack.mb;
      else if (st.tipe === 'BB') narasi = deskripsiPack.bb;

      allCatatanEntries.push({
        siswa_id: st.id,
        mapel_id: mp.id,
        tahun_ajaran_id: tahunAktif.id,
        guru_id: mp.guru.id,
        deskripsi: narasi,
      });
    }
  }

  console.log(`   Menyimpan ${allNilaiEntries.length} data nilai siswa...`);
  await prisma.nilaiSiswa.createMany({ data: allNilaiEntries });

  console.log(`   Menyimpan ${allCatatanEntries.length} catatan capaian kompetensi...`);
  await prisma.catatanCapaian.createMany({ data: allCatatanEntries });

  // 12. Data Raport Siswa 10 MIPA 2 (Final, Draft, dan Siap Cetak)
  console.log('12. Mempersiapkan Dokumen Raport Kurikulum Merdeka 10 MIPA 2...');
  await prisma.raport.deleteMany({
    where: {
      kelas_id: kelas10Mipa2.id,
      tahun_ajaran_id: tahunAktif.id,
    },
  });

  const catatanWaliPresets = [
    'Ananda menunjukkan prestasi akademik yang sangat memuaskan, berakhlak mulia, dan memiliki jiwa kepemimpinan yang teladan. Pertahankan semangat belajar yang luar biasa ini di semester berikutnya!',
    'Prestasi akademik yang sangat baik diimbangi dengan keaktifan positif dalam kegiatan ekstrakurikuler sekolah. Teruslah berinovasi dan raih cita-citamu!',
    'Ananda memiliki potensi besar dan daya serap materi yang baik. Tingkatkan lagi ketekunan dan konsistensi belajar mandiri agar prestasimu semakin optimal.',
    'Ananda memiliki kepribadian yang ramah dan disukai teman-teman sekelas. Terus tingkatkan fokus belajar serta keaktifan bertanya di kelas.',
    'Perlu meningkatkan disiplin kehadiran dan ketepatan waktu dalam mengumpulkan tugas. Kami yakin ananda mampu berkembang lebih baik lagi dengan bimbingan dan tekad yang kuat.',
    'Tingkatkan konsentrasi dan keaktifan saat pembelajaran berlangsung. Jangan ragu berdiskusi dengan guru pengampu jika menemukan materi yang menantang.',
  ];

  const raportEntries = [];
  for (let idx = 0; idx < siswaList.length; idx++) {
    const st = siswaList[idx];
    let status: StatusRaport = StatusRaport.DRAFT;
    let tglTerbit: Date | null = null;
    let catatanWali: string | null = null;

    if (idx < 18) {
      // 18 Siswa FINAL
      status = StatusRaport.FINAL;
      tglTerbit = new Date('2024-12-20');
      catatanWali = catatanWaliPresets[idx % catatanWaliPresets.length];
    } else if (idx < 27) {
      // 9 Siswa DRAFT dengan catatan terisi
      status = StatusRaport.DRAFT;
      catatanWali = catatanWaliPresets[idx % catatanWaliPresets.length];
    } else {
      // 3 Siswa DRAFT kosong (untuk testing input wali kelas)
      status = StatusRaport.DRAFT;
      catatanWali = null;
    }

    raportEntries.push({
      siswa_id: st.id,
      kelas_id: kelas10Mipa2.id,
      tahun_ajaran_id: tahunAktif.id,
      wali_kelas_id: waliKelasGuru.id,
      catatan_wali_kelas: catatanWali,
      status,
      tanggal_terbit: tglTerbit,
    });
  }

  await prisma.raport.createMany({
    data: raportEntries,
  });

  // 13. Sesi Absensi & Riwayat Kehadiran (Hari Ini & Pekan Lalu)
  console.log('13. Membuat Sesi Absensi Berlangsung & Riwayat Presensi Realistis...');
  const now = new Date();

  if (createdJadwals.length > 0) {
    const jFisika = createdJadwals.find((j) => j.mapel?.kode === 'FIS') || createdJadwals[0];
    const jMtk = createdJadwals.find((j) => j.mapel?.kode === 'MTK-W') || createdJadwals[1];

    // Hapus sesi absensi lama jadwal ini
    await prisma.sesiAbsensi.deleteMany({
      where: {
        jadwal_id: { in: [jFisika.id, jMtk ? jMtk.id : ''] },
      },
    });

    // Sesi 1: Fisika (Sedang Berlangsung)
    const sesiAktif = await prisma.sesiAbsensi.create({
      data: {
        jadwal_id: jFisika.id,
        token_qr: `QR-10MIPA2-FIS-${Date.now()}`,
        waktu_mulai: new Date(now.getTime() - 15 * 60 * 1000),
        waktu_exp: new Date(now.getTime() + 45 * 60 * 1000),
        status: SesiAbsensiStatus.BERLANGSUNG,
      },
    });

    const absensiEntries = [];
    for (let i = 0; i < siswaList.length; i++) {
      const s = siswaList[i];
      let stat: AbsensiStatus = AbsensiStatus.HADIR;
      let wScan: Date | null = new Date(sesiAktif.waktu_mulai.getTime() + (i * 45 + 15) * 1000);
      let ket: string | null = null;
      let sum: AbsensiSumber = AbsensiSumber.SCAN_QR;

      if (i === 24 || i === 25) {
        stat = AbsensiStatus.TERLAMBAT;
        wScan = new Date(sesiAktif.waktu_mulai.getTime() + 18 * 60 * 1000);
      } else if (i === 26) {
        stat = AbsensiStatus.IZIN;
        wScan = null;
        sum = AbsensiSumber.MANUAL;
        ket = 'Izin mengikuti lomba sains nasional';
      } else if (i === 27) {
        stat = AbsensiStatus.SAKIT;
        wScan = null;
        sum = AbsensiSumber.MANUAL;
        ket = 'Sakit flu dan demam tinggi';
      } else if (i >= 28) {
        stat = AbsensiStatus.ALPA;
        wScan = null;
        sum = AbsensiSumber.MANUAL;
      }

      absensiEntries.push({
        sesi_id: sesiAktif.id,
        siswa_id: s.id,
        status: stat,
        waktu_scan: wScan,
        sumber: sum,
        keterangan: ket,
        lokasi_lat: -6.1685,
        lokasi_lng: 106.837,
      });
    }

    // Sesi 2: Matematika (Sudah Selesai)
    if (jMtk) {
      const sesiSelesai = await prisma.sesiAbsensi.create({
        data: {
          jadwal_id: jMtk.id,
          token_qr: `QR-10MIPA2-MTK-${Date.now() - 3600000}`,
          waktu_mulai: new Date(now.getTime() - 180 * 60 * 1000),
          waktu_exp: new Date(now.getTime() - 90 * 60 * 1000),
          status: SesiAbsensiStatus.SELESAI,
        },
      });

      for (let i = 0; i < siswaList.length; i++) {
        const s = siswaList[i];
        let stat: AbsensiStatus = AbsensiStatus.HADIR;
        let wScan: Date | null = new Date(sesiSelesai.waktu_mulai.getTime() + (i * 30 + 10) * 1000);
        let ket: string | null = null;
        let sum: AbsensiSumber = AbsensiSumber.SCAN_QR;

        if (i === 28) {
          stat = AbsensiStatus.SAKIT;
          wScan = null;
          sum = AbsensiSumber.MANUAL;
          ket = 'Surat izin dokter terlampir';
        } else if (i === 29) {
          stat = AbsensiStatus.IZIN;
          wScan = null;
          sum = AbsensiSumber.MANUAL;
          ket = 'Keperluan keluarga mendesak';
        }

        absensiEntries.push({
          sesi_id: sesiSelesai.id,
          siswa_id: s.id,
          status: stat,
          waktu_scan: wScan,
          sumber: sum,
          keterangan: ket,
          lokasi_lat: -6.1685,
          lokasi_lng: 106.837,
        });
      }
    }

    await prisma.absensi.createMany({
      data: absensiEntries,
    });
  }

  // 14. Pengajuan Izin Siswa 10 MIPA 2 (Pending, Disetujui, Ditolak)
  console.log('14. Membuat Pengajuan Izin Siswa 10 MIPA 2 (Pending, Disetujui, Ditolak)...');
  await prisma.pengajuanIzin.deleteMany({
    where: {
      siswa_id: { in: siswaList.map((s) => s.id) },
    },
  });

  const izinData = [
    {
      siswaIdx: 26,
      jenis: IzinJenis.IZIN,
      keterangan: 'Permohonan izin dispensasi mengikuti Olimpiade Sains Nasional (OSN) Tingkat Kota.',
      status: IzinStatus.PENDING,
    },
    {
      siswaIdx: 27,
      jenis: IzinJenis.SAKIT,
      keterangan: 'Surat keterangan sakit demam berdarah dari RS Hermina, disarankan istirahat 3 hari.',
      status: IzinStatus.PENDING,
    },
    {
      siswaIdx: 4,
      jenis: IzinJenis.IZIN,
      keterangan: 'Izin menghadiri pernikahan saudara kandung di Bandung.',
      status: IzinStatus.DISETUJUI,
    },
    {
      siswaIdx: 11,
      jenis: IzinJenis.SAKIT,
      keterangan: 'Sakit flu dan batuk ringan, istirahat di rumah.',
      status: IzinStatus.DISETUJUI,
    },
    {
      siswaIdx: 28,
      jenis: IzinJenis.IZIN,
      keterangan: 'Izin bangun kesiangan karena kegiatan pribadi.',
      status: IzinStatus.DITOLAK,
      alasan: 'Alasan tidak memenuhi kriteria izin resmi sekolah.',
    },
  ];

  const izinEntries = izinData.map((iz) => {
    const s = siswaList[iz.siswaIdx];
    return {
      siswa_id: s.id,
      tanggal: now,
      jenis: iz.jenis,
      keterangan: iz.keterangan,
      status_approval: iz.status,
      disetujui_oleh_id: iz.status !== IzinStatus.PENDING ? waliKelasGuru.id : null,
      alasan_penolakan: iz.alasan || null,
    };
  });

  await prisma.pengajuanIzin.createMany({
    data: izinEntries,
  });

  console.log('================================================================');
  console.log('  SEEDER KELAS 10 MIPA 2 BERHASIL DISELESAIKAN DENGAN SUKSES!  ');
  console.log('================================================================');
  console.log('Ringkasan Data 10 MIPA 2:');
  console.log(`- Kelas: 10 MIPA 2 (ID: ${kelas10Mipa2.id})`);
  console.log(`- Wali Kelas: ${waliKelasGuru.nama} (${waliKelasGuru.email})`);
  console.log(`- Total Siswa: 30 Siswa terdaftar dengan variasi prestasi (SB, BSH, MB, BB)`);
  console.log(`- Total Mapel: 12 Mata Pelajaran lengkap dengan Guru Pengampu & Jadwal KBM`);
  console.log(`- Total Data Nilai: ${allNilaiEntries.length} baris nilai (Formatif 1,2,3, STS, SAS)`);
  console.log(`- Total Catatan Capaian: ${allCatatanEntries.length} baris capaian kompetensi`);
  console.log(`- Ekstrakurikuler: Pramuka Wajib + Pilihan (PMR, Basket, Futsal, Robotik, KIR, dsb)`);
  console.log(`- Status Raport: 18 Final (Terkunci), 9 Draft (Catatan terisi), 3 Draft (Siap diisi)`);
  console.log(`- Presensi: Sesi berlangsung, sesi selesai, hadir tepat, terlambat, izin, sakit, alpa`);
  console.log(`- Pengajuan Izin: 2 Pending (siap ditinjau wali kelas), 2 Disetujui, 1 Ditolak`);
  console.log('----------------------------------------------------------------');
  console.log('Akun Login untuk Menguji (Password: password123):');
  console.log(`- Wali Kelas 10 MIPA 2 : ${waliKelasGuru.email} / NIP: ${waliKelasGuru.nip}`);
  console.log(`- Siswa 10 MIPA 2 (Top) : ${siswaList[0].email} / NISN: ${siswaList[0].nisn}`);
  console.log('================================================================');
}

seed10Mipa2()
  .catch((e) => {
    console.error('Terjadi error saat menjalankan seeder 10 MIPA 2:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
