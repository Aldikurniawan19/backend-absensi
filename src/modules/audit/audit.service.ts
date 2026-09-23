import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
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
      // Logging error tidak boleh membatalkan flow transaksi utama
      this.logger.error('Gagal mencatat audit log:', error);
      return null;
    }
  }

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

    // Batch resolve data aktor (Admin, Guru, Siswa) agar informatif
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

    const logs = rawLogs.map((log) => {
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

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAvailableResources(sekolah_id: string) {
    const records = await this.prisma.auditLog.findMany({
      where: { sekolah_id },
      distinct: ['resource'],
      select: { resource: true },
    });
    return records.map((r) => r.resource).sort();
  }
}
