import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LaporanService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ambil daftar kelas yang diampu oleh guru tertentu
   */
  async getKelasAmpuGuru(guruId: string) {
    const schedules = await this.prisma.jadwalPelajaran.findMany({
      where: { guru_id: guruId },
      include: {
        kelas: {
          include: { jurusan: true },
        },
      },
      orderBy: [
        { kelas: { tingkat: 'asc' } },
        { kelas: { nama_rombel: 'asc' } },
      ],
    });

    // Cari juga kelas dari penugasan wali kelas
    const waliKelasList = await this.prisma.penugasanWaliKelas.findMany({
      where: { guru_id: guruId },
      include: {
        kelas: {
          include: { jurusan: true },
        },
      },
    });

    const kelasMap = new Map<string, any>();
    for (const s of schedules) {
      if (s.kelas && !kelasMap.has(s.kelas_id)) {
        kelasMap.set(s.kelas_id, {
          id: s.kelas.id,
          tingkat: s.kelas.tingkat,
          nama_rombel: s.kelas.nama_rombel,
          jurusan: s.kelas.jurusan,
          nama_lengkap: `${s.kelas.tingkat} ${s.kelas.jurusan.kode} ${s.kelas.nama_rombel}`,
        });
      }
    }

    for (const w of waliKelasList) {
      if (w.kelas && !kelasMap.has(w.kelas_id)) {
        kelasMap.set(w.kelas_id, {
          id: w.kelas.id,
          tingkat: w.kelas.tingkat,
          nama_rombel: w.kelas.nama_rombel,
          jurusan: w.kelas.jurusan,
          nama_lengkap: `${w.kelas.tingkat} ${w.kelas.jurusan.kode} ${w.kelas.nama_rombel}`,
        });
      }
    }

    return Array.from(kelasMap.values()).sort((a, b) =>
      a.nama_lengkap.localeCompare(b.nama_lengkap, undefined, { numeric: true }),
    );
  }


  /**
   * Ambil semua kelas di sekolah untuk Admin
   */
  async getAllKelasForAdmin(sekolahId: string) {
    const list = await this.prisma.kelas.findMany({
      where: { sekolah_id: sekolahId },
      include: { jurusan: true },
      orderBy: [
        { tingkat: 'asc' },
        { jurusan: { nama: 'asc' } },
        { nama_rombel: 'asc' },
      ],
    });

    return list.map((k) => ({
      id: k.id,
      tingkat: k.tingkat,
      nama_rombel: k.nama_rombel,
      jurusan: k.jurusan,
      nama_lengkap: `${k.tingkat} ${k.jurusan.kode} ${k.nama_rombel}`,
    }));
  }

  async getLaporanMapel(mapelId: string, tahunAjaranId?: string) {


    const mapel = await this.prisma.mataPelajaran.findUnique({
      where: { id: mapelId },
    });
    if (!mapel) throw new NotFoundException('Mata pelajaran tidak ditemukan');

    const whereSession: any = {
      jadwal: {
        mapel_id: mapelId,
        ...(tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {}),
      },
    };

    const sessions = await this.prisma.sesiAbsensi.findMany({
      where: whereSession,
      include: {
        absensi: true,
      },
    });

    let totalKehadiran = 0;
    let hadir = 0;
    let terlambat = 0;
    let izin = 0;
    let sakit = 0;
    let alpa = 0;

    for (const s of sessions) {
      for (const a of s.absensi) {
        totalKehadiran++;
        if (a.status === 'HADIR') hadir++;
        else if (a.status === 'TERLAMBAT') terlambat++;
        else if (a.status === 'IZIN') izin++;
        else if (a.status === 'SAKIT') sakit++;
        else if (a.status === 'ALPA') alpa++;
      }
    }

    const persentaseKehadiran =
      totalKehadiran > 0
        ? Number((((hadir + terlambat) / totalKehadiran) * 100).toFixed(2))
        : 0;

    return {
      mapel,
      total_sesi: sessions.length,
      total_record_absensi: totalKehadiran,
      statistik: {
        hadir,
        terlambat,
        izin,
        sakit,
        alpa,
        persentase_kehadiran: persentaseKehadiran,
      },
    };
  }

  async getLaporanKelas(kelasId: string, guruId?: string, tahunAjaranId?: string) {
    if (guruId) {
      const isMengampu = await this.prisma.jadwalPelajaran.findFirst({
        where: { guru_id: guruId, kelas_id: kelasId },
      });
      if (!isMengampu) {
        throw new ForbiddenException('Anda tidak memiliki akses ke laporan kelas ini karena bukan kelas yang Anda ampu');
      }
    }

    const kelas = await this.prisma.kelas.findUnique({
      where: { id: kelasId },
      include: { jurusan: true },
    });
    if (!kelas) throw new NotFoundException('Kelas tidak ditemukan');

    // Ambil siswa di kelas ini
    const students = await this.prisma.riwayatKelasSiswa.findMany({
      where: {
        kelas_id: kelasId,
        ...(tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {}),
      },
      include: {
        siswa: true,
      },
      orderBy: { siswa: { nama: 'asc' } },
    });

    const studentStats = await Promise.all(
      students.map(async (st) => {
        const absensi = await this.prisma.absensi.findMany({
          where: {
            siswa_id: st.siswa_id,
            sesi: {
              jadwal: {
                kelas_id: kelasId,
                ...(tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {}),
              },
            },
          },
        });

        const hadir = absensi.filter((a) => a.status === 'HADIR').length;
        const terlambat = absensi.filter((a) => a.status === 'TERLAMBAT').length;
        const izin = absensi.filter((a) => a.status === 'IZIN').length;
        const sakit = absensi.filter((a) => a.status === 'SAKIT').length;
        const alpa = absensi.filter((a) => a.status === 'ALPA').length;
        const total = absensi.length;
        const rate = total > 0 ? Number((((hadir + terlambat) / total) * 100).toFixed(1)) : 0;

        return {
          siswa: {
            id: st.siswa.id,
            nama: st.siswa.nama,
            nisn: st.siswa.nisn,
          },
          total_pertemuan: total,
          hadir,
          terlambat,
          izin,
          sakit,
          alpa,
          persentase_kehadiran: rate,
        };
      }),
    );

    return {
      kelas: {
        id: kelas.id,
        nama_lengkap: `${kelas.tingkat} ${kelas.jurusan.kode} ${kelas.nama_rombel}`,
      },
      total_siswa: students.length,
      siswa_rekap: studentStats,
    };
  }


  async getDashboardOverview(sekolahId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let targetSekolahId = sekolahId;
    const existingSekolah = targetSekolahId
      ? await this.prisma.sekolah.findUnique({ where: { id: targetSekolahId } })
      : null;

    if (!existingSekolah) {
      const defaultSekolah = await this.prisma.sekolah.findFirst();
      if (defaultSekolah) {
        targetSekolahId = defaultSekolah.id;
      }
    }

    const [
      totalSiswa,
      totalGuru,
      totalKelas,
      totalJurusan,
      totalMapel,
      sesiHariIni,
      absensiHariIni,
      sesiTerbaru,
      sekolah,
    ] = await Promise.all([
      this.prisma.siswa.count({ where: { sekolah_id: targetSekolahId } }),
      this.prisma.guru.count({ where: { sekolah_id: targetSekolahId } }),
      this.prisma.kelas.count({ where: { sekolah_id: targetSekolahId } }),
      this.prisma.jurusan.count({ where: { sekolah_id: targetSekolahId } }),
      this.prisma.mataPelajaran.count({ where: { sekolah_id: targetSekolahId } }),
      this.prisma.sesiAbsensi.count({
        where: {
          jadwal: { kelas: { sekolah_id: targetSekolahId } },
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.absensi.findMany({
        where: {
          sesi: {
            jadwal: { kelas: { sekolah_id: targetSekolahId } },
            createdAt: { gte: today, lt: tomorrow },
          },
        },
      }),
      this.prisma.sesiAbsensi.findMany({
        where: {
          jadwal: { kelas: { sekolah_id: targetSekolahId } },
          createdAt: { gte: today, lt: tomorrow },
        },
        include: {
          jadwal: {
            include: {
              kelas: { include: { jurusan: true } },
              mapel: true,
              guru: { select: { nama: true } },
            },
          },
          absensi: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.sekolah.findUnique({
        where: { id: targetSekolahId },
        select: {
          id: true,
          nama: true,
          npsn: true,
          alamat: true,
          wajib_gps: true,
          radius_meter: true,
        },
      }),
    ]);

    const hadir = absensiHariIni.filter((a) => a.status === 'HADIR').length;
    const terlambat = absensiHariIni.filter((a) => a.status === 'TERLAMBAT').length;
    const izin = absensiHariIni.filter((a) => a.status === 'IZIN').length;
    const sakit = absensiHariIni.filter((a) => a.status === 'SAKIT').length;
    const alpa = absensiHariIni.filter((a) => a.status === 'ALPA').length;

    return {
      ringkasan: {
        total_siswa: totalSiswa,
        total_guru: totalGuru,
        total_kelas: totalKelas,
        total_jurusan: totalJurusan,
        total_mapel: totalMapel,
        total_sesi_hari_ini: sesiHariIni,
      },
      kehadiran_hari_ini: {
        total_scan: absensiHariIni.length,
        hadir,
        terlambat,
        izin,
        sakit,
        alpa,
        persentase:
          absensiHariIni.length > 0
            ? Number((((hadir + terlambat) / absensiHariIni.length) * 100).toFixed(1))
            : 0,
      },
      sesi_terbaru: sesiTerbaru.map((s) => ({
        id: s.id,
        status: s.status,
        durasi_menit: Math.round((new Date(s.waktu_exp).getTime() - new Date(s.waktu_mulai).getTime()) / 60000),
        waktu_mulai: s.waktu_mulai,
        waktu_exp: s.waktu_exp,
        nama_kelas: `${s.jadwal.kelas.tingkat} ${s.jadwal.kelas.jurusan.kode} ${s.jadwal.kelas.nama_rombel}`,
        mapel: s.jadwal.mapel.nama,
        guru: s.jadwal.guru.nama,
        total_hadir: s.absensi.length,
      })),
      sekolah,
    };
  }
}
