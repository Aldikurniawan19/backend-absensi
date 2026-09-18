import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AbsensiStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class ScanQrDto {
  @ApiProperty({
    example: 'd9f8a7e6b5c4...',
    description: 'Token acak sesi yang terbaca dari scan QR Code',
  })
  @IsString()
  @IsNotEmpty({ message: 'Token QR tidak boleh kosong' })
  token_qr!: string;

  @ApiPropertyOptional({
    example: -6.1685,
    description: 'Latitude GPS perangkat siswa saat scan',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lokasi_lat?: number;

  @ApiPropertyOptional({
    example: 106.837,
    description: 'Longitude GPS perangkat siswa saat scan',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lokasi_lng?: number;
}

export class ManualAbsensiDto {
  @ApiProperty({ example: 'uuid-sesi' })
  @IsString()
  @IsNotEmpty()
  sesi_id!: string;

  @ApiProperty({ example: 'uuid-siswa' })
  @IsString()
  @IsNotEmpty()
  siswa_id!: string;

  @ApiProperty({ enum: AbsensiStatus, example: AbsensiStatus.HADIR })
  @IsEnum(AbsensiStatus)
  status!: AbsensiStatus;

  @ApiPropertyOptional({ example: 'Proyektor rusak, guru mencatat kehadiran manual' })
  @IsOptional()
  @IsString()
  keterangan?: string;
}
