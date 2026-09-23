import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class GenerateJadwalUjianDto {
  @ApiProperty({ example: 'Penilaian Tengah Semester (PTS) Ganjil 2026/2027' })
  @IsString()
  @IsNotEmpty()
  nama_ujian!: string;

  @ApiProperty({ example: 'PTS', enum: ['PTS', 'PAS', 'PAT', 'US'] })
  @IsString()
  @IsNotEmpty()
  jenis!: string;

  @ApiProperty({ example: 'uuid-tahun-ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id!: string;

  @ApiProperty({ example: '2026-10-05', description: 'Format YYYY-MM-DD' })
  @IsDateString()
  @IsNotEmpty()
  tanggal_mulai!: string;

  @ApiProperty({ example: '2026-10-10', description: 'Format YYYY-MM-DD' })
  @IsDateString()
  @IsNotEmpty()
  tanggal_selesai!: string;

  @ApiPropertyOptional({ example: 2, description: 'Jumlah sesi ujian per hari' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sesi_per_hari?: number = 2;

  @ApiPropertyOptional({ example: '07:30', description: 'Jam mulai sesi 1' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  jam_mulai_sesi_1?: string = '07:30';

  @ApiPropertyOptional({ example: '09:00', description: 'Jam selesai sesi 1' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  jam_selesai_sesi_1?: string = '09:00';

  @ApiPropertyOptional({ example: '09:30', description: 'Jam mulai sesi 2' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  jam_mulai_sesi_2?: string = '09:30';

  @ApiPropertyOptional({ example: '11:00', description: 'Jam selesai sesi 2' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  jam_selesai_sesi_2?: string = '11:00';

  @ApiPropertyOptional({ type: [String], description: 'Daftar ID Kelas target' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kelas_ids?: string[];

  @ApiPropertyOptional({ type: [Number], description: 'Daftar Tingkat (10, 11, 12)' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tingkat_list?: number[];

  @ApiPropertyOptional({ example: true, description: 'Aktifkan agar langsung muncul di mobile' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}

export class JadwalUjianItemInputDto {
  @ApiProperty({ example: 'uuid-kelas' })
  @IsString()
  @IsNotEmpty()
  kelas_id!: string;

  @ApiProperty({ example: 'uuid-mapel' })
  @IsString()
  @IsNotEmpty()
  mapel_id!: string;

  @ApiPropertyOptional({ example: 'uuid-guru' })
  @IsOptional()
  @IsString()
  guru_id?: string;

  @ApiProperty({ example: '2026-10-05' })
  @IsDateString()
  @IsNotEmpty()
  tanggal!: string;

  @ApiProperty({ example: 1, description: '1=Senin..7=Minggu' })
  @Type(() => Number)
  @IsInt()
  hari!: number;

  @ApiProperty({ example: '07:30' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  jam_mulai!: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  jam_selesai!: string;

  @ApiPropertyOptional({ example: 'Ruang 101' })
  @IsOptional()
  @IsString()
  ruangan?: string;
}

export class CreateJadwalUjianDto {
  @ApiProperty({ example: 'Penilaian Tengah Semester (PTS) Ganjil 2026/2027' })
  @IsString()
  @IsNotEmpty()
  nama_ujian!: string;

  @ApiProperty({ example: 'PTS' })
  @IsString()
  @IsNotEmpty()
  jenis!: string;

  @ApiProperty({ example: 'uuid-tahun-ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id!: string;

  @ApiProperty({ example: '2026-10-05' })
  @IsDateString()
  @IsNotEmpty()
  tanggal_mulai!: string;

  @ApiProperty({ example: '2026-10-10' })
  @IsDateString()
  @IsNotEmpty()
  tanggal_selesai!: string;

  @ApiPropertyOptional({ example: 2, description: 'Jumlah sesi ujian per hari' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sesi_per_hari?: number = 2;

  @ApiPropertyOptional({ example: '07:30', description: 'Jam mulai sesi 1' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  jam_mulai_sesi_1?: string = '07:30';

  @ApiPropertyOptional({ example: '09:00', description: 'Jam selesai sesi 1' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  jam_selesai_sesi_1?: string = '09:00';

  @ApiPropertyOptional({ example: '09:30', description: 'Jam mulai sesi 2' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  jam_mulai_sesi_2?: string = '09:30';

  @ApiPropertyOptional({ example: '11:00', description: 'Jam selesai sesi 2' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  jam_selesai_sesi_2?: string = '11:00';

  @ApiPropertyOptional({ type: [String], description: 'Daftar ID Kelas target' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kelas_ids?: string[];

  @ApiPropertyOptional({ type: [Number], description: 'Daftar Tingkat (10, 11, 12)' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tingkat_list?: number[];

  @ApiProperty({ example: true, description: 'Pilihan opsi aktifkan agar langsung tampil di mobile' })
  @IsBoolean()
  is_active!: boolean;

  @ApiPropertyOptional({ type: [JadwalUjianItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JadwalUjianItemInputDto)
  items?: JadwalUjianItemInputDto[];
}

export class ToggleJadwalUjianStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  is_active!: boolean;
}
