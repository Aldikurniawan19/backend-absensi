import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryAuditLogDto {
  @ApiPropertyOptional({ default: 1, description: 'Nomor halaman' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, description: 'Jumlah data per halaman' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter berdasarkan modul resource' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan tipe aksi' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ enum: UserRole, description: 'Filter berdasarkan peran aktor' })
  @IsOptional()
  @IsEnum(UserRole)
  actor_type?: UserRole;

  @ApiPropertyOptional({ description: 'Pencarian kata kunci pada rincian log' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter tanggal mulai (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter tanggal akhir (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
