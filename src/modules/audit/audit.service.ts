import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { ExportAuditLogDto, VerifyAuditLogDto } from './dto/audit-export.dto';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

export interface CreateAuditLogParams {
  sekolah_id: string;
  actor_id: string;
  actor_type: UserRole;
  action: string;
  resource: string;
  resource_id?: string;
  details?: string;
  ip_address?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Catat aksi ke audit log
   */
  async log(params: CreateAuditLogParams) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          sekolah_id: params.sekolah_id,
          actor_id: params.actor_id,
          actor_type: params.actor_type,
          action: params.action,
          resource: params.resource,
          resource_id: params.resource_id,
          details: params.details,
          ip_address: params.ip_address,
        },
      });
    } catch (error) {
      this.logger.error('Gagal mencatat audit log:', error);
      return null;
    }
  }

  /**
   * Ambil daftar log dengan filter, search, dan pagination
   */
  async getLogs(sekolah_id: string, query: QueryAuditLogDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      sekolah_id,
    };

    if (query.resource && query.resource.trim() !== '' && query.resource !== 'ALL') {
      where.resource = query.resource.trim();
    }

    if (query.action && query.action.trim() !== '' && query.action !== 'ALL') {
      where.action = query.action.trim();
    }

    if (query.actor_type) {
      where.actor_type = query.actor_type;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (query.search && query.search.trim() !== '') {
      const search = query.search.trim();
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
        { ip_address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rawLogs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const enrichedLogs = await this.enrichActorDetails(rawLogs);

    return {
      data: enrichedLogs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Ekspor data log resmi ber-checksum SHA-256 (Anti-Manipulasi)
   */
  async exportLogsWithSignature(
    sekolah_id: string,
    actor: { id: string; role: UserRole; name?: string },
    query: ExportAuditLogDto,
    ip_address?: string,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      sekolah_id,
    };

    if (query.resource && query.resource !== 'ALL') {
      where.resource = query.resource;
    }

    if (query.actor_type) {
      where.actor_type = query.actor_type;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Ambil data sekolah
    const sekolah = await this.prisma.sekolah.findUnique({
      where: { id: sekolah_id },
      select: { id: true, nama: true, npsn: true },
    });

    const rawLogs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const enrichedLogs = await this.enrichActorDetails(rawLogs);

    const exportTimestamp = new Date().toISOString();

    // Data kanonikal yang dihitung hash-nya
    const canonicalDataToSign = JSON.stringify(
      enrichedLogs.map((l) => ({
        id: l.id,
        waktu: l.createdAt,
        aktor_id: l.actor_id,
        aktor_nama: l.actor_name,
        aktor_peran: l.actor_type,
        aksi: l.action,
        modul: l.resource,
        resource_id: l.resource_id,
        keterangan: l.details,
        ip: l.ip_address,
      })),
    );

    // Hitung SHA-256 Hash
    const sha256Checksum = crypto
      .createHash('sha256')
      .update(canonicalDataToSign)
      .digest('hex');

    // Catat bukti ekspor ke database audit log secara otomatis
    await this.log({
      sekolah_id,
      actor_id: actor.id,
      actor_type: actor.role,
      action: 'EXPORT_AUDIT_LOG',
      resource: 'AUDIT',
      details: `Ekspor arsip resmi audit log (${enrichedLogs.length} entri). SHA-256: ${sha256Checksum}`,
      ip_address,
    });

    const archiveManifest = {
      sertifikat_integritas: {
        tipe: 'OFFICIAL_AUDIT_LOG_ARCHIVE',
        algoritma_keamanan: 'SHA-256 (Tamper-Evident Digest)',
        sha256_checksum: sha256Checksum,
        waktu_ekspor: exportTimestamp,
        sekolah: {
          nama: sekolah?.nama || 'Sekolah',
          npsn: sekolah?.npsn || '-',
        },
        diterbitkan_oleh: {
          id: actor.id,
          peran: actor.role,
          nama: actor.name || 'Administrator',
        },
        total_rekaman: enrichedLogs.length,
        filter_diterapkan: {
          rentang_mulai: query.startDate || 'Awal Sistem',
          rentang_selesai: query.endDate || 'Sekarang',
          modul: query.resource || 'Semua',
          peran: query.actor_type || 'Semua',
        },
      },
      data_log: enrichedLogs,
    };

    return archiveManifest;
  }

  /**
   * Verifikasi keaslian berkas arsip audit log
   */
  async verifyLogChecksum(dto: VerifyAuditLogDto) {
    if (!dto.archive_data) {
      return {
        valid: false,
        message: 'Data arsip audit log tidak ditemukan dalam permintaan.',
      };
    }

    try {
      const data = typeof dto.archive_data === 'string' ? JSON.parse(dto.archive_data) : dto.archive_data;

      const cert = data.sertifikat_integritas;
      const logs = data.data_log;

      if (!cert || !Array.isArray(logs)) {
        return {
          valid: false,
          message: 'Format berkas arsip tidak valid atau tidak memiliki Sertifikat Integritas SHA-256.',
        };
      }

      const expectedChecksum = dto.provided_checksum || cert.sha256_checksum;

      // Bentuk kembali data kanonikal persis seperti saat ekspor
      const canonicalDataToVerify = JSON.stringify(
        logs.map((l: any) => ({
          id: l.id,
          waktu: l.createdAt,
          aktor_id: l.actor_id,
          aktor_nama: l.actor_name,
          aktor_peran: l.actor_type,
          aksi: l.action,
          modul: l.resource,
          resource_id: l.resource_id,
          keterangan: l.details,
          ip: l.ip_address,
        })),
      );

      const calculatedChecksum = crypto
        .createHash('sha256')
        .update(canonicalDataToVerify)
        .digest('hex');

      const isMatch = calculatedChecksum.toLowerCase() === expectedChecksum.toLowerCase();

      return {
        valid: isMatch,
        calculated_checksum: calculatedChecksum,
        original_checksum: expectedChecksum,
        total_rekaman: logs.length,
        waktu_ekspor: cert.waktu_ekspor,
        diterbitkan_oleh: cert.diterbitkan_oleh,
        sekolah: cert.sekolah,
        message: isMatch
          ? 'Berkas arsip terverifikasi 100% ASLI & BELUM PERNAH DIMANIPULASI.'
          : 'PERINGATAN KERAS: Berkas arsip TELAH DIMANIPULASI / DIUBAH! Nilai hash digital tidak cocok.',
      };
    } catch (err: any) {
      return {
        valid: false,
        message: `Gagal membaca isi berkas arsip: ${err.message}`,
      };
    }
  }

  /**
   * Helper untuk melengkapi nama asli aktor
   */
  private async enrichActorDetails(rawLogs: any[]) {
    const adminIds = new Set<string>();
    const guruIds = new Set<string>();
    const siswaIds = new Set<string>();

    for (const log of rawLogs) {
      if (log.actor_id && log.actor_id !== 'SYSTEM') {
        if (log.actor_type === UserRole.ADMIN) adminIds.add(log.actor_id);
        else if (log.actor_type === UserRole.GURU) guruIds.add(log.actor_id);
        else if (log.actor_type === UserRole.SISWA) siswaIds.add(log.actor_id);
      }
    }

    const [admins, gurus, siswas] = await Promise.all([
      adminIds.size > 0
        ? this.prisma.admin.findMany({
            where: { id: { in: Array.from(adminIds) } },
            select: { id: true, nama: true, email: true },
          })
        : [],
      guruIds.size > 0
        ? this.prisma.guru.findMany({
            where: { id: { in: Array.from(guruIds) } },
            select: { id: true, nama: true, nip: true, email: true },
          })
        : [],
      siswaIds.size > 0
        ? this.prisma.siswa.findMany({
            where: { id: { in: Array.from(siswaIds) } },
            select: { id: true, nama: true, nisn: true, email: true },
          })
        : [],
    ]);

    const actorMap = new Map<string, { nama: string; identifier?: string }>();
    for (const a of admins) {
      actorMap.set(a.id, { nama: a.nama, identifier: a.email });
    }
    for (const g of gurus) {
      actorMap.set(g.id, { nama: g.nama, identifier: g.nip || g.email });
    }
    for (const s of siswas) {
      actorMap.set(s.id, { nama: s.nama, identifier: s.nisn || s.email });
    }

    return rawLogs.map((log) => {
      const actorInfo = actorMap.get(log.actor_id);
      return {
        ...log,
        actor_name: actorInfo
          ? actorInfo.nama
          : log.actor_id === 'SYSTEM'
          ? 'Sistem Otomatis'
          : log.actor_id,
        actor_identifier: actorInfo ? actorInfo.identifier : undefined,
      };
    });
  }

  /**
   * Ambil daftar resource modul yang tercatat
   */
  async getAvailableResources(sekolah_id: string) {
    const records = await this.prisma.auditLog.findMany({
      where: { sekolah_id },
      distinct: ['resource'],
      select: { resource: true },
    });
    return records.map((r) => r.resource).sort();
  }
}
