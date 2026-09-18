import {
  PrismaClient,
  TahunAjaranStatus,
  UserRole,
  AbsensiStatus,
  AbsensiSumber,
  IzinJenis,
  IzinStatus,
  SesiAbsensiStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('Memulai proses seeding basis data sistem absensi sekolah...');
  console.log('================================================================');

  const defaultPassword = await argon2.hash('password123');

  // 0. Bersihkan Data Lama (Cascading Clean)
  console.log('1. Membersihkan data lama...');
  await prisma.absensi.deleteMany({});
  await prisma.sesiAbsensi.deleteMany({});
  await prisma.pengajuanIzin.deleteMany({});
  await prisma.sesiLogin.deleteMany({});
  await prisma.jadwalPelajaran.deleteMany({});
  await prisma.penugasanWaliKelas.deleteMany({});
  await prisma.riwayatKelasSiswa.deleteMany({});
  await prisma.guruMapel.deleteMany({});
  await prisma.mataPelajaran.deleteMany({});
  await prisma.siswa.deleteMany({});
  await prisma.guru.deleteMany({});
  await prisma.admin.deleteMany({});
  await prisma.kelas.deleteMany({});
  await prisma.jurusan.deleteMany({});
  await prisma.tahunAjaran.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.sekolah.deleteMany({});

  // 1. Buat Sekolah
  console.log('2. Membuat data Sekolah...');
  const sekolah = await prisma.sekolah.create({
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

  // 2. Buat Admin Sekolah
  console.log('3. Membuat akun Admin Sekolah...');
  const admin = await prisma.admin.create({
    data: {
      sekolah_id: sekolah.id,
      nama: 'Admin Utama Tata Usaha',
      email: 'admin@sekolah.sch.id',
      password: defaultPassword,
    },
  });

  // 3. Buat Tahun Ajaran
  console.log('4. Membuat Tahun Ajaran (Aktif & Draft)...');
  const tahunAktif = await prisma.tahunAjaran.create({
    data: {
      sekolah_id: sekolah.id,
      nama: '2024/2025',
      semester: 'Ganjil',
      tanggal_mulai: new Date('2024-07-15'),
      tanggal_selesai: new Date('2024-12-20'),
      status: TahunAjaranStatus.AKTIF,
    },
  });

  const tahunDraft = await prisma.tahunAjaran.create({
    data: {
      sekolah_id: sekolah.id,
      nama: '2024/2025',
      semester: 'Genap',
      tanggal_mulai: new Date('2025-01-06'),
      tanggal_selesai: new Date('2025-06-20'),
      status: TahunAjaranStatus.DRAFT,
    },
  });

  // 4. Buat 3 Jurusan
  console.log('5. Membuat 3 Jurusan (MIPA, IPS, RPL)...');
  const jurusanData = [
    { nama: 'Matematika dan Ilmu Pengetahuan Alam', kode: 'MIPA' },
    { nama: 'Ilmu Pengetahuan Sosial', kode: 'IPS' },
    { nama: 'Rekayasa Perangkat Lunak', kode: 'RPL' },
  ];

  const jurusans: Record<string, any> = {};
  for (const j of jurusanData) {
    const created = await prisma.jurusan.create({
      data: {
        sekolah_id: sekolah.id,
        nama: j.nama,
        kode: j.kode,
      },
    });
    jurusans[j.kode] = created;
  }

  // 5. Buat Kelas: 3 Tingkat (10, 11, 12) x 3 Jurusan x 3 Kelas = 27 Kelas
  console.log('6. Membuat 27 Kelas (Tingkat 10, 11, 12 per Jurusan 1, 2, 3)...');
  const tingkats = [10, 11, 12];
  const rombels = ['1', '2', '3'];
  const allKelas: any[] = [];

  for (const tingkat of tingkats) {
    for (const kodeJurusan of ['MIPA', 'IPS', 'RPL']) {
      for (const rombel of rombels) {
        const createdKelas = await prisma.kelas.create({
          data: {
            sekolah_id: sekolah.id,
            jurusan_id: jurusans[kodeJurusan].id,
            tingkat,
            nama_rombel: rombel,
          },
          include: { jurusan: true },
        });
        allKelas.push(createdKelas);
      }
    }
  }
  console.log(`   Berhasil membuat ${allKelas.length} rombel kelas.`);

  // 6. Buat 18 Guru
  console.log('7. Membuat 18 Tenaga Pengajar (Guru)...');
  const guruRawData = [
    { nama: 'Drs. Ahmad Fauzi, M.Pd.', nip: '197501012000031001', email: 'ahmad.fauzi@guru.sch.id', hp: '081298765001' },
    { nama: 'Siti Rahmawati, S.Pd.', nip: '198002022005012002', email: 'siti.rahmawati@guru.sch.id', hp: '081298765002' },
    { nama: 'Hendra Gunawan, S.Pd., M.Kom.', nip: '198203152008011003', email: 'hendra.gunawan@guru.sch.id', hp: '081298765003' },
    { nama: 'Dra. Nurul Hidayah, M.Pd.', nip: '197604122002122001', email: 'nurul.hidayah@guru.sch.id', hp: '081298765004' },
    { nama: 'Bambang Sujatmiko, M.Pd.', nip: '197805182006041002', email: 'bambang.sujatmiko@guru.sch.id', hp: '081298765005' },
    { nama: 'Dr. Irwan Setiawan, M.Si.', nip: '198106202009021004', email: 'irwan.setiawan@guru.sch.id', hp: '081298765006' },
    { nama: 'Ratna Kartika, S.Pd.', nip: '198407252010012003', email: 'ratna.kartika@guru.sch.id', hp: '081298765007' },
    { nama: 'Agus Priyanto, S.Sos., M.Pd.', nip: '197908302005021005', email: 'agus.priyanto@guru.sch.id', hp: '081298765008' },
    { nama: 'Muhammad Zulkarnain, S.Pd.I.', nip: '198309142011011006', email: 'm.zulkarnain@guru.sch.id', hp: '081298765009' },
    { nama: 'Eko Prasetyo, S.Pd.', nip: '198610192014021001', email: 'eko.prasetyo@guru.sch.id', hp: '081298765010' },
    { nama: 'Dewi Lestari, S.Sn.', nip: '198811222015032002', email: 'dewi.lestari@guru.sch.id', hp: '081298765011' },
    { nama: 'Joko Widodo, S.Pd., M.H.', nip: '198012052007011007', email: 'joko.widodo@guru.sch.id', hp: '081298765012' },
    { nama: 'Maya Safitri, S.Kom., M.T.', nip: '198901162016012004', email: 'maya.safitri@guru.sch.id', hp: '081298765013' },
    { nama: 'Aditya Pratama, S.Si., M.Sc.', nip: '199002202018021001', email: 'aditya.pratama@guru.sch.id', hp: '081298765014' },
    { nama: 'Rina Marlina, S.Pd.', nip: '198503282012032005', email: 'rina.marlina@guru.sch.id', hp: '081298765015' },
    { nama: 'Farhan Ramadhan, S.Pd.', nip: '199104082019031002', email: 'farhan.ramadhan@guru.sch.id', hp: '081298765016' },
    { nama: 'Sri Wahyuni, S.Pd.', nip: '198705152013022006', email: 'sri.wahyuni@guru.sch.id', hp: '081298765017' },
    { nama: 'Teguh Santoso, S.Kom.', nip: '199206242020011003', email: 'teguh.santoso@guru.sch.id', hp: '081298765018' },
  ];

  const createdGurus: any[] = [];
  for (const g of guruRawData) {
    const createdGuru = await prisma.guru.create({
      data: {
        sekolah_id: sekolah.id,
        nama: g.nama,
        nip: g.nip,
        email: g.email,
        password: defaultPassword,
        no_hp: g.hp,
      },
    });
    createdGurus.push(createdGuru);
  }

  // 7. Buat Penugasan Wali Kelas (Membagikan 27 kelas ke 18 Guru)
  console.log('8. Menetapkan penugasan Wali Kelas untuk 27 rombel...');
  for (let i = 0; i < allKelas.length; i++) {
    const assignedGuru = createdGurus[i % createdGurus.length];
    await prisma.penugasanWaliKelas.create({
      data: {
        guru_id: assignedGuru.id,
        kelas_id: allKelas[i].id,
        tahun_ajaran_id: tahunAktif.id,
      },
    });
  }

  // 8. Buat Mata Pelajaran Lengkap
  console.log('9. Membuat Mata Pelajaran Umum, Peminatan, dan Kejuruan...');
  const mapelData = [
    // Umum
    { nama: 'Matematika Wajib', kode: 'MTK-W', guruIndices: [0, 13] },
    { nama: 'Bahasa Indonesia', kode: 'BIND', guruIndices: [3, 15] },
    { nama: 'Bahasa Inggris', kode: 'BING', guruIndices: [4, 15] },
    { nama: 'Pendidikan Agama Islam', kode: 'PAI', guruIndices: [8] },
    { nama: 'Pendidikan Pancasila & Kewarganegaraan', kode: 'PPKN', guruIndices: [11] },
    { nama: 'Pendidikan Jasmani & Olahraga', kode: 'PJOK', guruIndices: [9] },
    { nama: 'Sejarah Indonesia', kode: 'SEJ-I', guruIndices: [7] },
    { nama: 'Seni Budaya', kode: 'SNB', guruIndices: [10] },

    // Peminatan MIPA
    { nama: 'Matematika Peminatan', kode: 'MTK-P', guruIndices: [0] },
    { nama: 'Fisika', kode: 'FIS', guruIndices: [1, 13] },
    { nama: 'Kimia', kode: 'KIM', guruIndices: [1, 5] },
    { nama: 'Biologi', kode: 'BIO', guruIndices: [5, 16] },

    // Peminatan IPS
    { nama: 'Ekonomi', kode: 'EKO', guruIndices: [6, 14] },
    { nama: 'Geografi', kode: 'GEO', guruIndices: [6, 14] },
    { nama: 'Sosiologi', kode: 'SOS', guruIndices: [7] },
    { nama: 'Sejarah Peminatan', kode: 'SEJ-P', guruIndices: [7] },

    // Kejuruan RPL
    { nama: 'Pemrograman Web & Perangkat Bergerak', kode: 'PWPB', guruIndices: [2, 12] },
    { nama: 'Basis Data', kode: 'BASDAT', guruIndices: [2, 12] },
    { nama: 'Pemrograman Berorientasi Objek', kode: 'PBO', guruIndices: [2, 17] },
    { nama: 'Pemodelan Perangkat Lunak', kode: 'PPL', guruIndices: [2, 17] },
  ];

  const createdMapels: any[] = [];
  for (const m of mapelData) {
    const mapel = await prisma.mataPelajaran.create({
      data: {
        sekolah_id: sekolah.id,
        nama: m.nama,
        kode: m.kode,
      },
    });
    createdMapels.push({ ...mapel, guruIndices: m.guruIndices });

    // Hubungkan GuruMapel
    for (const gIdx of m.guruIndices) {
      await prisma.guruMapel.create({
        data: {
          guru_id: createdGurus[gIdx].id,
          mapel_id: mapel.id,
        },
      });
    }
  }

  // 9. Buat 10 Siswa per Kelas = 270 Siswa
  console.log('10. Membuat 270 Siswa (10 Siswa per Kelas)...');
  const firstNames = [
    'Muhammad', 'Ahmad', 'Budi', 'Dimas', 'Fajar', 'Bagus', 'Rizky', 'Aditya', 'Bayu', 'Eko',
    'Siti', 'Nur', 'Dewi', 'Putri', 'Amanda', 'Citra', 'Nabila', 'Ani', 'Rina', 'Indah',
    'Kevin', 'Daniel', 'Michael', 'Grace', 'Joshua', 'Sarah', 'Jessica', 'David', 'Jonathan', 'Clara'
  ];
  const lastNames = [
    'Santoso', 'Pratama', 'Saputra', 'Ramadhan', 'Lestari', 'Kurniawan', 'Hidayat', 'Wahyuni', 'Setiawan', 'Nugroho',
    'Putra', 'Putri', 'Wijaya', 'Siregar', 'Kusuma', 'Zahra', 'Maulana', 'Anggraini', 'Utami', 'Firmansyah'
  ];

  const allSiswa: any[] = [];
  let siswaCount = 0;

  for (let kIdx = 0; kIdx < allKelas.length; kIdx++) {
    const kelas = allKelas[kIdx];
    const kelasSiswa: any[] = [];

    for (let sIdx = 1; sIdx <= 10; sIdx++) {
      siswaCount++;
      const fn = firstNames[(kIdx * 10 + sIdx) % firstNames.length];
      const ln = lastNames[(kIdx * 3 + sIdx * 7) % lastNames.length];
      const namaSiswa = `${fn} ${ln}`;
      const nisnPad = String(siswaCount).padStart(4, '0');
      const nisn = `00512${nisnPad}`;
      const email = `siswa.${kelas.tingkat}${kelas.jurusan.kode.toLowerCase()}${kelas.nama_rombel}.${sIdx}@siswa.sch.id`;

      // Akun utama Budi Santoso untuk testing khusus
      const finalNama = (kIdx === 0 && sIdx === 1) ? 'Budi Santoso' : namaSiswa;
      const finalNisn = (kIdx === 0 && sIdx === 1) ? '0051234567' : nisn;
      const finalEmail = (kIdx === 0 && sIdx === 1) ? 'budi@siswa.sch.id' : email;

      const siswa = await prisma.siswa.create({
        data: {
          sekolah_id: sekolah.id,
          nama: finalNama,
          nisn: finalNisn,
          email: finalEmail,
          password: defaultPassword,
          no_hp_ortu: `08131234${String(siswaCount).padStart(4, '0')}`,
        },
      });

      // Daftarkan ke riwayat kelas tahun ajaran aktif
      await prisma.riwayatKelasSiswa.create({
        data: {
          siswa_id: siswa.id,
          kelas_id: kelas.id,
          tahun_ajaran_id: tahunAktif.id,
        },
      });

      kelasSiswa.push(siswa);
      allSiswa.push(siswa);
    }
  }
  console.log(`    Berhasil mendaftarkan ${allSiswa.length} siswa ke 27 kelas.`);

  // 10. Buat Jadwal Pelajaran Bebas Bentrok untuk Seluruh 27 Kelas (Senin s/d Sabtu)
  console.log('11. Menyusun Jadwal Pelajaran Bebas Bentrok (Senin s/d Sabtu = 6 Hari)...');

  // Waktu slot standar
  const timeSlots = [
    { slot: 1, jam_mulai: '07:30', jam_selesai: '09:00' },
    { slot: 2, jam_mulai: '09:15', jam_selesai: '10:45' },
    { slot: 3, jam_mulai: '11:00', jam_selesai: '12:30' },
  ];

  // Mapel mapping per jurusan
  const mapelByJurusan: Record<string, string[]> = {
    MIPA: ['MTK-W', 'BIND', 'BING', 'PAI', 'PPKN', 'PJOK', 'SEJ-I', 'SNB', 'MTK-P', 'FIS', 'KIM', 'BIO'],
    IPS: ['MTK-W', 'BIND', 'BING', 'PAI', 'PPKN', 'PJOK', 'SEJ-I', 'SNB', 'EKO', 'GEO', 'SOS', 'SEJ-P'],
    RPL: ['MTK-W', 'BIND', 'BING', 'PAI', 'PPKN', 'PJOK', 'SEJ-I', 'SNB', 'PWPB', 'BASDAT', 'PBO', 'PPL'],
  };

  const mapelMap = new Map<string, any>();
  for (const m of createdMapels) {
    mapelMap.set(m.kode, m);
  }

  const jadwalEntries: any[] = [];

  // Looping 6 Hari (1 = Senin, ..., 6 = Sabtu)
  for (let hari = 1; hari <= 6; hari++) {
    // Untuk hari Jumat (5) dan Sabtu (6), sesuaikan slot
    const dailySlots = (hari === 5)
      ? [
          { slot: 1, jam_mulai: '07:30', jam_selesai: '08:45' },
          { slot: 2, jam_mulai: '09:00', jam_selesai: '10:15' },
        ]
      : (hari === 6)
      ? [
          { slot: 1, jam_mulai: '07:30', jam_selesai: '09:00' },
          { slot: 2, jam_mulai: '09:15', jam_selesai: '10:45' },
        ]
      : timeSlots;

    for (let slotIdx = 0; slotIdx < dailySlots.length; slotIdx++) {
      const slot = dailySlots[slotIdx];

      // Track guru yang sudah mengajar di slot ini agar bebas bentrok 100%
      const usedGuruInSlot = new Set<string>();

      for (let kIdx = 0; kIdx < allKelas.length; kIdx++) {
        const kelas = allKelas[kIdx];
        const jurusanKode = kelas.jurusan.kode;
        const availableCodes = mapelByJurusan[jurusanKode];

        // Tentukan mapel berdasarkan pola rotasi hari, slot, dan kelas
        const mapelCodeIndex = (hari * 3 + slot.slot + kIdx) % availableCodes.length;
        const chosenCode = availableCodes[mapelCodeIndex];
        const chosenMapel = mapelMap.get(chosenCode);

        // Pilih guru yang mengampu mapel ini dan belum terpakai di slot ini
        let assignedGuruId: string | null = null;
        for (const gIdx of chosenMapel.guruIndices) {
          const guru = createdGurus[gIdx];
          if (!usedGuruInSlot.has(guru.id)) {
            assignedGuruId = guru.id;
            usedGuruInSlot.add(guru.id);
            break;
          }
        }

        // Jika semua guru pengampu mapel tersebut sedang dipakai di slot ini, cari guru cadangan yang bebas
        if (!assignedGuruId) {
          for (let gIdx = 0; gIdx < createdGurus.length; gIdx++) {
            const fallbackGuru = createdGurus[(kIdx + gIdx) % createdGurus.length];
            if (!usedGuruInSlot.has(fallbackGuru.id)) {
              assignedGuruId = fallbackGuru.id;
              usedGuruInSlot.add(fallbackGuru.id);
              break;
            }
          }
        }

        if (assignedGuruId) {
          jadwalEntries.push({
            kelas_id: kelas.id,
            guru_id: assignedGuruId,
            mapel_id: chosenMapel.id,
            tahun_ajaran_id: tahunAktif.id,
            hari,
            jam_mulai: slot.jam_mulai,
            jam_selesai: slot.jam_selesai,
          });
        }
      }
    }
  }

  console.log(`    Menyimpan ${jadwalEntries.length} baris jadwal pelajaran...`);
  await prisma.jadwalPelajaran.createMany({
    data: jadwalEntries,
  });
  console.log(`    Berhasil membuat ${jadwalEntries.length} jadwal pelajaran bebas bentrok.`);

  // 11. Buat Sampel Sesi Absensi & Riwayat Kehadiran Realistis untuk Hari Ini
  console.log('12. Membuat Sesi Absensi Aktif & Rekap Kehadiran Sampel Hari Ini...');
  const currentJsDay = new Date().getDay();
  const currentSystemDay = currentJsDay === 0 ? 7 : currentJsDay;
  const targetHariForSample = currentSystemDay > 6 ? 1 : currentSystemDay;

  // Ambil beberapa jadwal hari ini untuk dibuatkan sesi
  const todaySchedules = await prisma.jadwalPelajaran.findMany({
    where: {
      tahun_ajaran_id: tahunAktif.id,
      hari: targetHariForSample,
    },
    include: {
      kelas: true,
      mapel: true,
      guru: true,
    },
    take: 6,
  });

  const now = new Date();
  for (let idx = 0; idx < todaySchedules.length; idx++) {
    const j = todaySchedules[idx];
    const isFirstSession = idx === 0;

    const waktuMulai = new Date(now.getTime() - (idx * 30 + 10) * 60 * 1000);
    const waktuExp = isFirstSession
      ? new Date(now.getTime() + 50 * 60 * 1000) // Sesi aktif berjalan
      : new Date(now.getTime() - (idx * 30 - 20) * 60 * 1000); // Sesi selesai

    const sesi = await prisma.sesiAbsensi.create({
      data: {
        jadwal_id: j.id,
        token_qr: `QR-SESSION-${j.id.slice(0, 8)}-${Date.now()}-${idx}`,
        waktu_mulai: waktuMulai,
        waktu_exp: waktuExp,
        status: isFirstSession ? SesiAbsensiStatus.BERLANGSUNG : SesiAbsensiStatus.SELESAI,
      },
    });

    // Ambil siswa kelas ini
    const studentsInClass = await prisma.riwayatKelasSiswa.findMany({
      where: { kelas_id: j.kelas_id, tahun_ajaran_id: tahunAktif.id },
      include: { siswa: true },
    });

    // Buat data scan kehadiran
    for (let sIdx = 0; sIdx < studentsInClass.length; sIdx++) {
      const st = studentsInClass[sIdx];
      let status: AbsensiStatus = AbsensiStatus.HADIR;
      let waktuScan: Date | null = new Date(waktuMulai.getTime() + (sIdx * 60 + 30) * 1000);
      let sumber: AbsensiSumber = AbsensiSumber.SCAN_QR;
      let keterangan: string | null = null;

      if (sIdx === 7) {
        status = AbsensiStatus.TERLAMBAT;
        waktuScan = new Date(waktuMulai.getTime() + 15 * 60 * 1000);
      } else if (sIdx === 8) {
        status = AbsensiStatus.IZIN;
        waktuScan = null;
        sumber = AbsensiSumber.MANUAL;
        keterangan = 'Izin keperluan keluarga mendesak';
      } else if (sIdx === 9) {
        status = isFirstSession ? AbsensiStatus.ALPA : AbsensiStatus.SAKIT;
        waktuScan = null;
        sumber = AbsensiSumber.MANUAL;
        keterangan = isFirstSession ? null : 'Surat keterangan sakit dari dokter';
      }

      await prisma.absensi.create({
        data: {
          sesi_id: sesi.id,
          siswa_id: st.siswa_id,
          status,
          waktu_scan: waktuScan,
          sumber,
          keterangan,
          lokasi_lat: -6.1685,
          lokasi_lng: 106.837,
        },
      });
    }
  }

  // 12. Buat Contoh Pengajuan Izin Siswa Menunggu Persetujuan
  console.log('13. Membuat sampel pengajuan izin siswa yang berstatus PENDING...');
  const sampleIzinStudents = allSiswa.slice(1, 4);
  const izinReasons = [
    'Surat permohonan izin mewakili sekolah dalam Lomba Cerdas Cermat Tingkat Provinsi',
    'Izin menghadiri acara pernikahan keluarga kandung di luar kota',
    'Surat keterangan istirahat dari dokter Rumah Sakit Umum Daerah karena demam berdarah',
  ];

  for (let i = 0; i < sampleIzinStudents.length; i++) {
    await prisma.pengajuanIzin.create({
      data: {
        siswa_id: sampleIzinStudents[i].id,
        tanggal: now,
        jenis: i === 2 ? IzinJenis.SAKIT : IzinJenis.IZIN,
        keterangan: izinReasons[i],
        status_approval: IzinStatus.PENDING,
      },
    });
  }

  console.log('================================================================');
  console.log('SEEDING BERHASIL DISELESAIKAN DENGAN SUKSES!');
  console.log('================================================================');
  console.log('Ringkasan Data yang Dihasilkan:');
  console.log(`- 1 Sekolah: ${sekolah.nama} (${sekolah.npsn})`);
  console.log(`- 2 Tahun Ajaran: 2024/2025 Ganjil (Aktif) & 2024/2025 Genap (Draft)`);
  console.log(`- 3 Jurusan: MIPA, IPS, RPL`);
  console.log(`- 27 Kelas: 10, 11, 12 (masing-masing 3 kelas per jurusan)`);
  console.log(`- 270 Siswa: 10 siswa per kelas terdaftar di rombel masing-masing`);
  console.log(`- 18 Guru: Lengkap dengan NIP, email, kompetensi mapel, & penugasan wali kelas`);
  console.log(`- 20 Mata Pelajaran: Umum, Peminatan MIPA, Peminatan IPS, & Kejuruan RPL`);
  console.log(`- ${jadwalEntries.length} Baris Jadwal Pelajaran: Bebas bentrok untuk Senin s/d Sabtu`);
  console.log(`- Sesi Absensi & Izin Sampel: Aktif dan siap ditampilkan di Dashboard`);
  console.log('----------------------------------------------------------------');
  console.log('Akun Login Default (Password semua akun: password123):');
  console.log('1. Admin: admin@sekolah.sch.id');
  console.log('2. Guru (Wali Kelas 10 MIPA 1): ahmad.fauzi@guru.sch.id (NIP: 197501012000031001)');
  console.log('3. Guru: siti.rahmawati@guru.sch.id (NIP: 198002022005012002)');
  console.log('4. Guru RPL: hendra.gunawan@guru.sch.id (NIP: 198203152008011003)');
  console.log('5. Siswa (10 MIPA 1): budi@siswa.sch.id (NISN: 0051234567)');
  console.log('================================================================');
}

main()
  .catch((e) => {
    console.error('Terjadi kesalahan saat proses seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
