import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IzinJenis, IzinStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateIzinDto {
  @ApiProperty({ example: '2026-09-18', description: 'Tanggal izin (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'Format tanggal harus YYYY-MM-DD' })
  tanggal!: string;

  @ApiProperty({ enum: IzinJenis, example: IzinJenis.SAKIT })
  @IsEnum(IzinJenis, { message: 'Jenis izin harus IZIN atau SAKIT' })
  jenis!: IzinJenis;

  @ApiProperty({ example: 'Demam tinggi dan istirahat dokter 2 hari' })
  @IsString()
  @IsNotEmpty({ message: 'Keterangan izin wajib diisi' })
  keterangan!: string;
}

export class ApproveIzinDto {
  @ApiProperty({
    enum: [IzinStatus.DISETUJUI, IzinStatus.DITOLAK],
    example: IzinStatus.DISETUJUI,
  })
  @IsEnum(IzinStatus, { message: 'Status approval harus DISETUJUI atau DITOLAK' })
  status!: IzinStatus;

  @ApiPropertyOptional({ example: 'Surat dokter valid dan terverifikasi' })
  @IsOptional()
  @IsString()
  alasan_penolakan?: string;
}
