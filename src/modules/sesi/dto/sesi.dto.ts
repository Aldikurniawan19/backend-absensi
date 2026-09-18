import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SesiAbsensiStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateSesiDto {
  @ApiProperty({ example: 'uuid-jadwal', description: 'ID jadwal pelajaran yang akan dibuka sesinya' })
  @IsString()
  @IsNotEmpty()
  jadwal_id!: string;

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Durasi aktif QR dalam menit (5-60 menit)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  durasi_menit?: number = 10;
}

export class UpdateSesiDto {
  @ApiPropertyOptional({ example: 5, description: 'Perpanjangan durasi dalam menit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  tambah_menit?: number;

  @ApiPropertyOptional({ enum: SesiAbsensiStatus, description: 'Status baru sesi (misal SELESAI untuk menutup lebih awal)' })
  @IsOptional()
  @IsEnum(SesiAbsensiStatus)
  status?: SesiAbsensiStatus;
}
