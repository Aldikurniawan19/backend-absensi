import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TahunAjaranStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

// --- SEKOLAH ---
export class UpdateSekolahDto {
  @ApiPropertyOptional({ example: 'SMA Negeri 1 Jakarta' })
  @IsOptional()
  @IsString()
  nama?: string;

  @ApiPropertyOptional({ example: 'Jl. Budi Utomo No. 7' })
  @IsOptional()
  @IsString()
  alamat?: string;

  @ApiPropertyOptional({ example: true, description: 'Apakah wajib validasi GPS saat scan QR' })
  @IsOptional()
  @IsBoolean()
  wajib_gps?: boolean;

  @ApiPropertyOptional({ example: -6.1685, description: 'Latitude pusat lokasi sekolah' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat_sekolah?: number;

  @ApiPropertyOptional({ example: 106.837, description: 'Longitude pusat lokasi sekolah' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng_sekolah?: number;

  @ApiPropertyOptional({ example: 100, description: 'Radius batas absensi dalam meter' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  radius_meter?: number;

  @ApiPropertyOptional({ example: 1, description: 'Batas maksimal sesi login aktif untuk akun siswa' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  maks_sesi_aktif_siswa?: number;
}

// --- TAHUN AJARAN ---
export class CreateTahunAjaranDto {
  @ApiProperty({ example: '2024/2025' })
  @IsString()
  @IsNotEmpty()
  nama!: string;

  @ApiProperty({ example: 'Ganjil' })
  @IsString()
  @IsNotEmpty()
  semester!: string;

  @ApiProperty({ example: '2024-07-15' })
  @IsDateString()
  tanggal_mulai!: string;

  @ApiProperty({ example: '2024-12-20' })
  @IsDateString()
  tanggal_selesai!: string;

  @ApiPropertyOptional({ enum: TahunAjaranStatus, default: TahunAjaranStatus.DRAFT })
  @IsOptional()
  @IsEnum(TahunAjaranStatus)
  status?: TahunAjaranStatus = TahunAjaranStatus.DRAFT;
}

export class UpdateTahunAjaranDto {
  @ApiPropertyOptional({ example: '2024/2025' })
  @IsOptional()
  @IsString()
  nama?: string;

  @ApiPropertyOptional({ example: 'Ganjil' })
  @IsOptional()
  @IsString()
  semester?: string;

  @ApiPropertyOptional({ example: '2024-07-15' })
  @IsOptional()
  @IsDateString()
  tanggal_mulai?: string;

  @ApiPropertyOptional({ example: '2024-12-20' })
  @IsOptional()
  @IsDateString()
  tanggal_selesai?: string;

  @ApiPropertyOptional({ enum: TahunAjaranStatus })
  @IsOptional()
  @IsEnum(TahunAjaranStatus)
  status?: TahunAjaranStatus;
}

// --- JURUSAN ---
export class CreateJurusanDto {
  @ApiProperty({ example: 'Matematika dan Ilmu Pengetahuan Alam' })
  @IsString()
  @IsNotEmpty()
  nama!: string;

  @ApiProperty({ example: 'MIPA' })
  @IsString()
  @IsNotEmpty()
  kode!: string;
}

export class UpdateJurusanDto {
  @ApiPropertyOptional({ example: 'Matematika dan Ilmu Pengetahuan Alam' })
  @IsOptional()
  @IsString()
  nama?: string;

  @ApiPropertyOptional({ example: 'MIPA' })
  @IsOptional()
  @IsString()
  kode?: string;
}

// --- KELAS ---
export class CreateKelasDto {
  @ApiProperty({ example: 'uuid-jurusan' })
  @IsString()
  @IsNotEmpty()
  jurusan_id!: string;

  @ApiProperty({ example: 10, description: 'Tingkat kelas: 10, 11, atau 12' })
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(12)
  tingkat!: number;

  @ApiProperty({ example: '1', description: 'Nomor rombel (misal 1, 2) menghasilkan nama lengkap 10 MIPA 1' })
  @IsString()
  @IsNotEmpty()
  nama_rombel!: string;
}

export class UpdateKelasDto {
  @ApiPropertyOptional({ example: 'uuid-jurusan' })
  @IsOptional()
  @IsString()
  jurusan_id?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(12)
  tingkat?: number;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  nama_rombel?: string;
}

// --- MATA PELAJARAN ---
export class CreateMapelDto {
  @ApiProperty({ example: 'Matematika Wajib' })
  @IsString()
  @IsNotEmpty()
  nama!: string;

  @ApiProperty({ example: 'MTK-W' })
  @IsString()
  @IsNotEmpty()
  kode!: string;
}

export class UpdateMapelDto {
  @ApiPropertyOptional({ example: 'Matematika Wajib' })
  @IsOptional()
  @IsString()
  nama?: string;

  @ApiPropertyOptional({ example: 'MTK-W' })
  @IsOptional()
  @IsString()
  kode?: string;
}
