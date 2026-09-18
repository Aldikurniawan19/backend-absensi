import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

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

  async getLogs(
    sekolah_id: string,
    page: number = 1,
    limit: number = 20,
    resource?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { sekolah_id };
    if (resource) {
      where.resource = resource;
    }

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
