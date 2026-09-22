import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { AbsensiStatus, AbsensiSumber, SesiAbsensiStatus, UserRole } from '@prisma/client';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSesiDto, UpdateSesiDto } from './dto/sesi.dto';
import { SesiGateway } from './sesi.gateway';

@Injectable()
export class SesiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sesiGateway: SesiGateway,
    private readonly auditService: AuditService,
  ) {}

  async createSesi(dto: CreateSesiDto, currentUser: JwtPayload) {
    const jadwal = await this.prisma.jadwalPelajaran.findUnique({
      where: { id: dto.jadwal_id },
      include: {
        kelas: { include: { jurusan: true } },
        mapel: true,
        guru: true,
      },
    });

    if (!jadwal) {
      throw new NotFoundException('Jadwal pelajaran tidak ditemukan');
    }

    // Scope check: Guru hanya boleh membuka sesi jadwalnya sendiri
    if (currentUser.role === UserRole.GURU && jadwal.guru_id !== currentUser.sub) {
      throw new ForbiddenException('Anda tidak berhak membuka sesi untuk jadwal guru lain');
    }

    // Generate token QR acak dan unik
    const tokenQr = crypto.randomBytes(32).toString('hex');

    const waktuMulai = new Date();
    const durasiMenit = dto.durasi_menit || 10;
    const waktuExp = new Date(waktuMulai.getTime() + durasiMenit * 60 * 1000);

    const sesi = await this.prisma.sesiAbsensi.create({
      data: {
        jadwal_id: dto.jadwal_id,
        token_qr: tokenQr,
        waktu_mulai: waktuMulai,
        waktu_exp: waktuExp,
        status: SesiAbsensiStatus.BERLANGSUNG,
      },
      include: {
        jadwal: {
          include: {
            kelas: { include: { jurusan: true } },
            mapel: true,
            guru: { select: { id: true, nama: true } },
          },
        },
      },
    });

    // Generate gambar QR Code (Data URL base64)
    const qrDataUrl = await QRCode.toDataURL(tokenQr, {
      width: 400,
      margin: 2,
      color: {
        dark: '#111111',
        light: '#FFFFFF',
      },
    });

    await this.auditService.log({
      sekolah_id: currentUser.sekolah_id,
      actor_id: currentUser.sub,
      actor_type: currentUser.role,
      action: 'START_SESSION',
      resource: 'SESI_ABSENSI',
      resource_id: sesi.id,
      details: `Membuka sesi absensi ${jadwal.mapel.nama} kelas ${jadwal.kelas.tingkat} ${jadwal.kelas.jurusan.kode} ${jadwal.kelas.nama_rombel} (durasi: ${durasiMenit} menit)`,
    });

    return {
      sesi,
      token_qr: tokenQr,
      qr_image: qrDataUrl,
    };
  }

  async getSesiById(id: string) {
    const sesi = await this.prisma.sesiAbsensi.findUnique({
      where: { id },
      include: {
        jadwal: {
          include: {
            kelas: { include: { jurusan: true } },
            mapel: true,
            guru: { select: { id: true, nama: true } },
          },
        },
        absensi: {
          include: {
            siswa: {
              select: { id: true, nama: true, nisn: true },
            },
          },
          orderBy: { waktu_scan: 'asc' },
        },
      },
    });

    if (!sesi) throw new NotFoundException('Sesi absensi tidak ditemukan');

    // Ambil seluruh siswa terdaftar di kelas ini pada tahun ajaran terkait
    const enrolledStudents = await this.prisma.riwayatKelasSiswa.findMany({
      where: {
        kelas_id: sesi.jadwal.kelas_id,
        tahun_ajaran_id: sesi.jadwal.tahun_ajaran_id,
      },
      include: {
        siswa: {
          select: { id: true, nama: true, nisn: true },
        },
      },
      orderBy: { siswa: { nama: 'asc' } },
    });

    // Map absensi berdasarkan siswa_id untuk lookup cepat
    const absensiMap = new Map(
      sesi.absensi.map((a) => [a.siswa_id, a]),
    );

    // Gabungkan: setiap siswa terdaftar + status absensi mereka (jika ada)
    const siswa_terdaftar = enrolledStudents.map((e) => ({
      siswa_id: e.siswa.id,
      siswa: e.siswa,
      absensi: absensiMap.get(e.siswa.id) || null,
    }));

    return {
      ...sesi,
      siswa_terdaftar,
    };
  }

  async updateSesi(id: string, dto: UpdateSesiDto, currentUser: JwtPayload) {
    const sesi = await this.prisma.sesiAbsensi.findUnique({
      where: { id },
      include: { jadwal: true },
    });

    if (!sesi) throw new NotFoundException('Sesi tidak ditemukan');

    if (currentUser.role === UserRole.GURU && sesi.jadwal.guru_id !== currentUser.sub) {
      throw new ForbiddenException('Anda tidak berhak mengubah sesi ini');
    }

    if (dto.status === SesiAbsensiStatus.SELESAI) {
      return this.tutupSesi(id, currentUser.sub);
    }

    const data: any = {};
    if (dto.tambah_menit) {
      data.waktu_exp = new Date(
        new Date(sesi.waktu_exp).getTime() + dto.tambah_menit * 60 * 1000,
      );
    }
    if (dto.status) {
      data.status = dto.status;
    }

    const updated = await this.prisma.sesiAbsensi.update({
      where: { id },
      data,
    });

    return updated;
  }

  /**
   * Menutup sesi absensi dan otomatis menandai siswa yang belum absen sebagai ALPA
   */
  async tutupSesi(sesiId: string, actorId?: string) {
    const sesi = await this.prisma.sesiAbsensi.findUnique({
      where: { id: sesiId },
      include: {
        jadwal: {
          include: {
            kelas: true,
            tahun_ajaran: true,
          },
        },
        absensi: true,
      },
    });

    if (!sesi) throw new NotFoundException('Sesi absensi tidak ditemukan');
    if (sesi.status === SesiAbsensiStatus.SELESAI) {
      return { message: 'Sesi sudah selesai', sesi };
    }

    // Ambil seluruh siswa terdaftar di kelas ini pada tahun ajaran aktif
    const enrolledStudents = await this.prisma.riwayatKelasSiswa.findMany({
      where: {
        kelas_id: sesi.jadwal.kelas_id,
        tahun_ajaran_id: sesi.jadwal.tahun_ajaran_id,
      },
      select: { siswa_id: true },
    });

    // Cari siapa saja yang sudah absen
    const attendedStudentIds = new Set(sesi.absensi.map((a) => a.siswa_id));

    // Siswa yang belum absen
    const absentStudents = enrolledStudents.filter(
      (s) => !attendedStudentIds.has(s.siswa_id),
    );

    const today = new Date(sesi.waktu_mulai);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Ambil semua pengajuan izin yang disetujui untuk siswa yang belum absen (batch query)
    const absentStudentIds = absentStudents.map((s) => s.siswa_id);
    const approvedIzinList = absentStudentIds.length > 0
      ? await this.prisma.pengajuanIzin.findMany({
          where: {
            siswa_id: { in: absentStudentIds },
            tanggal: { gte: today, lt: tomorrow },
            status_approval: 'DISETUJUI',
          },
        })
      : [];

    // Map siswa_id ke data izin untuk lookup cepat
    const izinBySiswaId = new Map(
      approvedIzinList.map((izin) => [izin.siswa_id, izin]),
    );

    // Siapkan data absensi untuk batch insert
    const absensiData = absentStudents.map((student) => {
      const approvedIzin = izinBySiswaId.get(student.siswa_id);
      const statusAbsen = approvedIzin
        ? approvedIzin.jenis === 'SAKIT'
          ? AbsensiStatus.SAKIT
          : AbsensiStatus.IZIN
        : AbsensiStatus.ALPA;

      return {
        sesi_id: sesiId,
        siswa_id: student.siswa_id,
        status: statusAbsen,
        sumber: AbsensiSumber.MANUAL,
        keterangan: approvedIzin
          ? 'Otomatis dari pengajuan izin yang disetujui'
          : 'Tidak hadir saat sesi ditutup',
      };
    });

    // Transaksi ringan: hanya update status + batch insert absensi
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedSesi = await tx.sesiAbsensi.update({
        where: { id: sesiId },
        data: {
          status: SesiAbsensiStatus.SELESAI,
          updatedAt: new Date(),
        },
      });

      if (absensiData.length > 0) {
        await tx.absensi.createMany({ data: absensiData });
      }

      return {
        message: 'Sesi berhasil ditutup',
        sesi: updatedSesi,
        auto_alpa_count: absentStudents.length,
      };
    });

    // Siarkan event sesi selesai lewat WebSocket (di luar transaksi)
    this.sesiGateway.emitSesiSelesai(sesiId, {
      sesi_id: sesiId,
      status: 'SELESAI',
      total_alpa: absentStudents.length,
    });

    return result;
  }

  async getSesiStatus(sesiId: string) {
    const sesi = await this.prisma.sesiAbsensi.findUnique({
      where: { id: sesiId },
      include: {
        jadwal: {
          include: {
            kelas: { include: { jurusan: true } },
            mapel: true,
            guru: { select: { nama: true } },
          },
        },
        absensi: {
          include: {
            siswa: {
              select: { id: true, nama: true, nisn: true },
            },
          },
          orderBy: { waktu_scan: 'desc' },
        },
      },
    });

    if (!sesi) throw new NotFoundException('Sesi absensi tidak ditemukan');

    // Ambil total siswa terdaftar
    const totalSiswa = await this.prisma.riwayatKelasSiswa.count({
      where: {
        kelas_id: sesi.jadwal.kelas_id,
        tahun_ajaran_id: sesi.jadwal.tahun_ajaran_id,
      },
    });

    const hadirCount = sesi.absensi.filter((a) => a.status === 'HADIR').length;
    const terlambatCount = sesi.absensi.filter((a) => a.status === 'TERLAMBAT').length;
    const izinCount = sesi.absensi.filter((a) => a.status === 'IZIN').length;
    const sakitCount = sesi.absensi.filter((a) => a.status === 'SAKIT').length;
    const alpaCount = sesi.absensi.filter((a) => a.status === 'ALPA').length;

    const isExpired = new Date() > new Date(sesi.waktu_exp);

    return {
      sesi: {
        id: sesi.id,
        jadwal: sesi.jadwal,
        status: sesi.status,
        waktu_mulai: sesi.waktu_mulai,
        waktu_exp: sesi.waktu_exp,
        is_expired: isExpired,
        token_qr: sesi.token_qr,
      },
      statistik: {
        total_siswa: totalSiswa,
        hadir: hadirCount,
        terlambat: terlambatCount,
        izin: izinCount,
        sakit: sakitCount,
        alpa: alpaCount,
        sudah_absen: hadirCount + terlambatCount + izinCount + sakitCount + alpaCount,
        belum_absen: Math.max(0, totalSiswa - (hadirCount + terlambatCount + izinCount + sakitCount + alpaCount)),
      },
      daftar_absensi: sesi.absensi,
    };
  }
}
