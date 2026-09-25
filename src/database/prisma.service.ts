import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.DEBUG_DB === 'true'
          ? ['query', 'info', 'warn', 'error']
          : ['error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.ensureOptimizedIndexes();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Menjamin indeks komposit penting terpasang pada basis data PostgreSQL
   * untuk query berkecepatan tinggi (eliminasi sequential table scans)
   */
  private async ensureOptimizedIndexes() {
    try {
      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_jadwal_kelas_ta" ON "jadwal_pelajaran"("kelas_id", "tahun_ajaran_id");
        CREATE INDEX IF NOT EXISTS "idx_jadwal_guru_ta" ON "jadwal_pelajaran"("guru_id", "tahun_ajaran_id");
        CREATE INDEX IF NOT EXISTS "idx_sesi_absensi_created_at" ON "sesi_absensi"("createdAt");
        CREATE INDEX IF NOT EXISTS "idx_sesi_absensi_jadwal_created_at" ON "sesi_absensi"("jadwal_id", "createdAt");
        CREATE INDEX IF NOT EXISTS "idx_absensi_siswa_created_at" ON "absensi"("siswa_id", "createdAt");
        CREATE INDEX IF NOT EXISTS "idx_absensi_sesi_id" ON "absensi"("sesi_id");
        CREATE INDEX IF NOT EXISTS "idx_pengajuan_izin_status_tgl" ON "pengajuan_izin"("status_approval", "tanggal");
        CREATE INDEX IF NOT EXISTS "idx_nilai_siswa_kelas_ta" ON "nilai_siswa"("kelas_id", "tahun_ajaran_id");
        CREATE INDEX IF NOT EXISTS "idx_nilai_siswa_siswa_ta" ON "nilai_siswa"("siswa_id", "tahun_ajaran_id");
        CREATE INDEX IF NOT EXISTS "idx_catatan_capaian_mapel_ta" ON "catatan_capaian"("mapel_id", "tahun_ajaran_id");
        CREATE INDEX IF NOT EXISTS "idx_catatan_capaian_siswa_ta" ON "catatan_capaian"("siswa_id", "tahun_ajaran_id");
        CREATE INDEX IF NOT EXISTS "idx_ekskul_siswa_ta" ON "ekstrakurikuler_siswa"("tahun_ajaran_id");
        CREATE INDEX IF NOT EXISTS "idx_ekskul_siswa_siswa_ta" ON "ekstrakurikuler_siswa"("siswa_id", "tahun_ajaran_id");
      `);
    } catch (err) {
      this.logger.warn('Pemeriksaan indeks otomatis selesai / menggunakan schema eksisting:', err);
    }
  }
}

