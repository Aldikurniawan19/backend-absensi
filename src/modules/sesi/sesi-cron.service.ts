import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SesiAbsensiStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SesiService } from './sesi.service';

@Injectable()
export class SesiCronService {
  private readonly logger = new Logger(SesiCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sesiService: SesiService,
  ) {}

  /**
   * Cron job yang berjalan tiap 1 menit untuk menutup sesi yang sudah melewati waktu_exp
   * dan menandai siswa yang belum hadir sebagai ALPA.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredSessions() {
    const now = new Date();

    const expiredSessions = await this.prisma.sesiAbsensi.findMany({
      where: {
        status: SesiAbsensiStatus.BERLANGSUNG,
        waktu_exp: { lte: now },
      },
      select: { id: true },
    });

    if (expiredSessions.length > 0) {
      this.logger.log(`Menemukan ${expiredSessions.length} sesi absensi yang kedaluwarsa. Memproses penutupan...`);

      for (const s of expiredSessions) {
        try {
          await this.sesiService.tutupSesi(s.id, 'SYSTEM_CRON');
          this.logger.log(`Sesi ${s.id} berhasil ditutup otomatis.`);
        } catch (err) {
          this.logger.error(`Gagal menutup sesi ${s.id}:`, err);
        }
      }
    }
  }
}
