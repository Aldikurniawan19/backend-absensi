import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KomponenNilai } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateNilaiDto {
  @ApiProperty({ description: 'ID Siswa' })
  @IsString()
  @IsNotEmpty({ message: 'ID Siswa wajib diisi' })
  siswa_id: string;

  @ApiProperty({ description: 'ID Mata Pelajaran' })
  @IsString()
  @IsNotEmpty({ message: 'ID Mapel wajib diisi' })
  mapel_id: string;

  @ApiProperty({ description: 'ID Kelas' })
  @IsString()
  @IsNotEmpty({ message: 'ID Kelas wajib diisi' })
  kelas_id: string;

  @ApiProperty({ description: 'ID Tahun Ajaran' })
  @IsString()
  @IsNotEmpty({ message: 'ID Tahun Ajaran wajib diisi' })
  tahun_ajaran_id: string;

  @ApiProperty({ enum: KomponenNilai, description: 'Komponen Nilai: FORMATIF | STS | SAS' })
  @IsEnum(KomponenNilai, { message: 'Komponen nilai harus FORMATIF, STS, atau SAS' })
  komponen: KomponenNilai;

  @ApiProperty({ description: 'Judul / Penamaan nilai (mis: Tugas 1, Ulangan Harian 1, STS)', example: 'Tugas 1' })
  @IsString()
  @IsNotEmpty({ message: 'Judul nilai wajib diisi' })
  judul: string;

  @ApiProperty({ description: 'Nilai angka (0-100)', example: 85.5 })
  @IsNumber({}, { message: 'Nilai harus berupa angka' })
  @Min(0, { message: 'Nilai minimal 0' })
  @Max(100, { message: 'Nilai maksimal 100' })
  nilai: number;

  @ApiPropertyOptional({ description: 'Catatan tambahan untuk nilai' })
  @IsOptional()
  @IsString()
  catatan?: string;
}

export class UpdateNilaiDto {
  @ApiPropertyOptional({ description: 'Judul nilai' })
  @IsOptional()
  @IsString()
  judul?: string;

  @ApiPropertyOptional({ description: 'Nilai angka (0-100)', example: 90 })
  @IsOptional()
  @IsNumber({}, { message: 'Nilai harus berupa angka' })
  @Min(0, { message: 'Nilai minimal 0' })
  @Max(100, { message: 'Nilai maksimal 100' })
  nilai?: number;

  @ApiPropertyOptional({ description: 'Catatan tambahan untuk nilai' })
  @IsOptional()
  @IsString()
  catatan?: string;
}

export class NilaiBatchItemDto {
  @ApiProperty({ description: 'ID Siswa' })
  @IsString()
  @IsNotEmpty()
  siswa_id: string;

  @ApiProperty({ description: 'Nilai angka (0-100)', example: 85 })
  @IsNumber({}, { message: 'Nilai harus berupa angka' })
  @Min(0, { message: 'Nilai minimal 0' })
  @Max(100, { message: 'Nilai maksimal 100' })
  nilai: number;

  @ApiPropertyOptional({ description: 'Catatan tambahan' })
  @IsOptional()
  @IsString()
  catatan?: string;
}

export class CreateNilaiBatchDto {
  @ApiProperty({ description: 'ID Mata Pelajaran' })
  @IsString()
  @IsNotEmpty()
  mapel_id: string;

  @ApiProperty({ description: 'ID Kelas' })
  @IsString()
  @IsNotEmpty()
  kelas_id: string;

  @ApiProperty({ description: 'ID Tahun Ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id: string;

  @ApiProperty({ enum: KomponenNilai, description: 'Komponen Nilai' })
  @IsEnum(KomponenNilai)
  komponen: KomponenNilai;

  @ApiProperty({ description: 'Judul nilai (mis: Tugas 1, STS)', example: 'Tugas 1' })
  @IsString()
  @IsNotEmpty()
  judul: string;

  @ApiProperty({ type: [NilaiBatchItemDto], description: 'Daftar nilai per siswa' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NilaiBatchItemDto)
  items: NilaiBatchItemDto[];
}

export class SaveCatatanCapaianDto {
  @ApiProperty({ description: 'ID Siswa' })
  @IsString()
  @IsNotEmpty()
  siswa_id: string;

  @ApiProperty({ description: 'ID Mata Pelajaran' })
  @IsString()
  @IsNotEmpty()
  mapel_id: string;

  @ApiProperty({ description: 'ID Tahun Ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id: string;

  @ApiProperty({ description: 'Deskripsi capaian kompetensi Kurikulum Merdeka' })
  @IsString()
  @IsNotEmpty({ message: 'Deskripsi capaian wajib diisi' })
  deskripsi: string;
}

export class CatatanCapaianBatchItemDto {
  @ApiProperty({ description: 'ID Siswa' })
  @IsString()
  @IsNotEmpty()
  siswa_id: string;

  @ApiProperty({ description: 'Deskripsi narasi capaian kompetensi' })
  @IsString()
  @IsNotEmpty()
  deskripsi: string;
}

export class SaveCatatanCapaianBatchDto {
  @ApiProperty({ description: 'ID Mata Pelajaran' })
  @IsString()
  @IsNotEmpty()
  mapel_id: string;

  @ApiProperty({ description: 'ID Kelas' })
  @IsString()
  @IsNotEmpty()
  kelas_id: string;

  @ApiProperty({ description: 'ID Tahun Ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id: string;

  @ApiProperty({ type: [CatatanCapaianBatchItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatatanCapaianBatchItemDto)
  items: CatatanCapaianBatchItemDto[];
}
