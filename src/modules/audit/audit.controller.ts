import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from './audit.service';
import { ExportAuditLogDto, VerifyAuditLogDto } from './dto/audit-export.dto';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@ApiTags('Audit Log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ambil daftar log aktivitas sistem (Khusus Admin - Read-Only)' })
  async getLogs(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryAuditLogDto,
  ) {
    return await this.auditService.getLogs(user.sekolah_id, query);
  }

  @Get('resources')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ambil daftar modul resource yang tercatat dalam log' })
  async getResources(@CurrentUser() user: JwtPayload) {
    const data = await this.auditService.getAvailableResources(user.sekolah_id);
    return { data };
  }

  @Get('export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ekspor arsip log resmi dengan Digital Signature SHA-256' })
  async exportLogs(
    @CurrentUser() user: JwtPayload,
    @Query() query: ExportAuditLogDto,
    @Ip() ip: string,
  ) {
    const result = await this.auditService.exportLogsWithSignature(
      user.sekolah_id,
      { id: user.sub, role: user.role, name: user.nama || user.email },
      query,
      ip,
    );
    return result;
  }

  @Post('verify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Verifikasi keaslian dan integritas berkas arsip audit log' })
  async verifyArchive(@Body() dto: VerifyAuditLogDto) {
    const result = await this.auditService.verifyLogChecksum(dto);
    return result;
  }
}
