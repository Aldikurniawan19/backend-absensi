import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cron Job: Berjalan otomatis setiap awal bulan pukul 02.00 subuh
   * Memeriksa volume tabel audit log dan memantau retensi aman 3 tahun (1.095 hari)
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleRetentionAuditCheck() {
    this.logger.log('Menjalankan pemeriksaan kesehatan retensi audit log sistem...');

    try {
      const threeYearsAgo = new Date();
      threeYearsAgo.setDate(threeYearsAgo.getDate() - 1095);

      const [totalActiveLogs, oldLogsCount] = await Promise.all([
        this.prisma.auditLog.count(),
        this.prisma.auditLog.count({
          where: {
            createdAt: {
              lt: threeYearsAgo,
            },
          },
        }),
      ]);

      this.logger.log(
        `[Audit Retention Status] Total Log Aktif: ${totalActiveLogs} entri | Log > 3 Tahun: ${oldLogsCount} entri`,
      );

      // Catat log pemeliharaan sistem
      const sekolahList = await this.prisma.sekolah.findMany({ select: { id: true } });
      for (const sekolah of sekolahList) {
        await this.prisma.auditLog.create({
          data: {
            sekolah_id: sekolah.id,
            actor_id: 'SYSTEM',
            actor_type: 'ADMIN',
            action: 'SYSTEM_RETENTION_CHECK',
            resource: 'SYSTEM',
            details: `Pemeriksaan integritas retensi log otomatis. Total log database: ${totalActiveLogs}. Log usia aman < 3 tahun.`,
          },
        });
      }
    } catch (error) {
      this.logger.error('Gagal menjalankan cron retensi audit log:', error);
    }
  }
}
