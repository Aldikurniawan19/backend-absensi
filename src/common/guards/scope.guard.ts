import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ScopeCheckerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Memeriksa apakah guru berhak atas jadwal pelajaran tertentu
   */
  async checkGuruJadwal(guruId: string, jadwalId: string): Promise<boolean> {
    const jadwal = await this.prisma.jadwalPelajaran.findUnique({
      where: { id: jadwalId },
      select: { guru_id: true },
    });

    return !!jadwal && jadwal.guru_id === guruId;
  }

  /**
   * Memeriksa apakah guru merupakan wali kelas untuk kelas tertentu di tahun ajaran aktif
   */
  async checkWaliKelas(guruId: string, kelasId: string): Promise<boolean> {
    const tahunAktif = await this.prisma.tahunAjaran.findFirst({
      where: { status: 'AKTIF' },
      select: { id: true },
    });

    if (!tahunAktif) return false;

    const penugasan = await this.prisma.penugasanWaliKelas.findFirst({
      where: {
        guru_id: guruId,
        kelas_id: kelasId,
        tahun_ajaran_id: tahunAktif.id,
      },
    });

    return !!penugasan;
  }

  /**
   * Mengambil daftar ID kelas yang diampu sebagai wali kelas oleh guru
   */
  async getWaliKelasIds(guruId: string): Promise<string[]> {
    const tahunAktif = await this.prisma.tahunAjaran.findFirst({
      where: { status: 'AKTIF' },
      select: { id: true },
    });

    if (!tahunAktif) return [];

    const penugasan = await this.prisma.penugasanWaliKelas.findMany({
      where: {
        guru_id: guruId,
        tahun_ajaran_id: tahunAktif.id,
      },
      select: { kelas_id: true },
    });

    return penugasan.map((p) => p.kelas_id);
  }
}
