import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AbsensiStatus, IzinStatus, UserRole } from '@prisma/client';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApproveIzinDto, CreateIzinDto } from './dto/izin.dto';

@Injectable()
export class IzinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async ajukanIzin(
    dto: CreateIzinDto,
    currentUser: JwtPayload,
    fileBuktiPath?: string,
  ) {
    if (currentUser.role !== UserRole.SISWA) {
      throw new ForbiddenException('Hanya siswa yang dapat mengajukan izin/sakit');
    }

    const tanggal = new Date(dto.tanggal);
    tanggal.setHours(0, 0, 0, 0);

    const pengajuan = await this.prisma.pengajuanIzin.create({
      data: {
        siswa_id: currentUser.sub,
        tanggal,
        jenis: dto.jenis,
        keterangan: dto.keterangan,
        file_bukti: fileBuktiPath || null,
        status_approval: IzinStatus.PENDING,
      },
      include: {
        siswa: { select: { id: true, nama: true, nisn: true } },
      },
    });

    await this.auditService.log({
      sekolah_id: currentUser.sekolah_id,
      actor_id: currentUser.sub,
      actor_type: currentUser.role,
      action: 'SUBMIT_LEAVE',
      resource: 'PENGAJUAN_IZIN',
      resource_id: pengajuan.id,
      details: `Mengajukan ${dto.jenis} pada tanggal ${dto.tanggal}`,
    });

    return pengajuan;
  }

  async getIzinListSiswa(siswaId: string, currentUser: JwtPayload) {
    if (currentUser.role === UserRole.SISWA && currentUser.sub !== siswaId) {
      throw new ForbiddenException('Anda tidak berhak melihat permohonan izin siswa lain');
    }

    return this.prisma.pengajuanIzin.findMany({
      where: { siswa_id: siswaId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingIzin(currentUser: JwtPayload) {
    // Jika Wali Kelas: Ambil daftar izin untuk kelas yang dia walikan di tahun ajaran aktif
    if (currentUser.role === UserRole.GURU) {
      const tahunAktif = await this.prisma.tahunAjaran.findFirst({
        where: { sekolah_id: currentUser.sekolah_id, status: 'AKTIF' },
      });

      if (!tahunAktif) return [];

      const waliKelas = await this.prisma.penugasanWaliKelas.findMany({
        where: {
          guru_id: currentUser.sub,
          tahun_ajaran_id: tahunAktif.id,
        },
        select: { kelas_id: true },
      });

      const kelasIds = waliKelas.map((w) => w.kelas_id);

      return this.prisma.pengajuanIzin.findMany({
        where: {
          status_approval: IzinStatus.PENDING,
          siswa: {
            sekolah_id: currentUser.sekolah_id,
            riwayat_kelas: {
              some: {
                kelas_id: { in: kelasIds },
                tahun_ajaran_id: tahunAktif.id,
              },
            },
          },
        },
        include: {
          siswa: {
            include: {
              riwayat_kelas: {
                where: { tahun_ajaran_id: tahunAktif.id },
                include: { kelas: { include: { jurusan: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Jika Admin: Ambil semua izin pending di sekolah
    return this.prisma.pengajuanIzin.findMany({
      where: {
        status_approval: IzinStatus.PENDING,
        siswa: { sekolah_id: currentUser.sekolah_id },
      },
      include: {
        siswa: {
          include: {
            riwayat_kelas: {
              include: { kelas: { include: { jurusan: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveIzin(
    id: string,
    dto: ApproveIzinDto,
    currentUser: JwtPayload,
  ) {
    const pengajuan = await this.prisma.pengajuanIzin.findUnique({
      where: { id },
      include: { siswa: true },
    });

    if (!pengajuan) {
      throw new NotFoundException('Pengajuan izin tidak ditemukan');
    }

    if (pengajuan.status_approval !== IzinStatus.PENDING) {
      throw new BadRequestException('Pengajuan izin ini sudah diproses sebelumnya');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update status pengajuan izin
      const updated = await tx.pengajuanIzin.update({
        where: { id },
        data: {
          status_approval: dto.status,
          disetujui_oleh_id: currentUser.sub,
          alasan_penolakan: dto.alasan_penolakan || null,
        },
      });

      // 2. Jika disetujui: Sinkronisasikan absensi siswa pada tanggal tersebut
      if (dto.status === IzinStatus.DISETUJUI) {
        const startOfDay = new Date(pengajuan.tanggal);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        const targetStatus =
          pengajuan.jenis === 'SAKIT'
            ? AbsensiStatus.SAKIT
            : AbsensiStatus.IZIN;

        // Cari sesi-sesi pada tanggal tersebut yang sudah memiliki record absen siswa
        const relatedAbsensi = await tx.absensi.findMany({
          where: {
            siswa_id: pengajuan.siswa_id,
            sesi: {
              waktu_mulai: { gte: startOfDay, lt: endOfDay },
            },
          },
        });

        if (relatedAbsensi.length > 0) {
          await tx.absensi.updateMany({
            where: { id: { in: relatedAbsensi.map((a) => a.id) } },
            data: {
              status: targetStatus,
              keterangan: `Disinkronkan dari permohonan ${pengajuan.jenis} yang disetujui`,
            },
          });
        }
      }


      await this.auditService.log({
        sekolah_id: currentUser.sekolah_id,
        actor_id: currentUser.sub,
        actor_type: currentUser.role,
        action: dto.status === IzinStatus.DISETUJUI ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
        resource: 'PENGAJUAN_IZIN',
        resource_id: id,
        details: `${dto.status} permohonan ${pengajuan.jenis} untuk ${pengajuan.siswa.nama}`,
      });

      return {
        message: `Pengajuan izin berhasil ${dto.status.toLowerCase()}`,
        data: updated,
      };
    });
  }
}
