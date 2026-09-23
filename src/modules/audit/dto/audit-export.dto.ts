import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ExportAuditLogDto {
  @ApiPropertyOptional({ description: 'Filter tanggal mulai (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter tanggal akhir (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan modul resource' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ enum: UserRole, description: 'Filter berdasarkan peran aktor' })
  @IsOptional()
  @IsEnum(UserRole)
  actor_type?: UserRole;

  @ApiPropertyOptional({ description: 'Format ekspor: json atau csv', default: 'json' })
  @IsOptional()
  @IsString()
  format?: 'json' | 'csv' = 'json';
}

export class VerifyAuditLogDto {
  @ApiPropertyOptional({ description: 'Payload JSON arsip audit log yang akan diverifikasi' })
  @IsOptional()
  archive_data?: any;

  @ApiPropertyOptional({ description: 'SHA-256 checksum yang tertera pada berkas' })
  @IsOptional()
  @IsString()
  provided_checksum?: string;
}
