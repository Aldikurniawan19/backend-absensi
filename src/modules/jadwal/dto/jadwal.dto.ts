import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateJadwalDto {
  @ApiProperty({ example: 'uuid-kelas' })
  @IsString()
  @IsNotEmpty()
  kelas_id!: string;

  @ApiProperty({ example: 'uuid-guru' })
  @IsString()
  @IsNotEmpty()
  guru_id!: string;

  @ApiProperty({ example: 'uuid-mapel' })
  @IsString()
  @IsNotEmpty()
  mapel_id!: string;

  @ApiProperty({ example: 'uuid-tahun-ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id!: string;

  @ApiProperty({ example: 1, description: '1 = Senin, 2 = Selasa, ..., 7 = Minggu' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  hari!: number;

  @ApiProperty({ example: '07:30', description: 'Format HH:mm' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Format jam_mulai harus berupa HH:mm (contoh 07:30)',
  })
  jam_mulai!: string;

  @ApiProperty({ example: '09:00', description: 'Format HH:mm' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Format jam_selesai harus berupa HH:mm (contoh 09:00)',
  })
  jam_selesai!: string;
}

export class UpdateJadwalDto {
  @ApiPropertyOptional({ example: 'uuid-kelas' })
  @IsOptional()
  @IsString()
  kelas_id?: string;

  @ApiPropertyOptional({ example: 'uuid-guru' })
  @IsOptional()
  @IsString()
  guru_id?: string;

  @ApiPropertyOptional({ example: 'uuid-mapel' })
  @IsOptional()
  @IsString()
  mapel_id?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  hari?: number;

  @ApiPropertyOptional({ example: '07:30' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Format jam_mulai harus berupa HH:mm',
  })
  jam_mulai?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Format jam_selesai harus berupa HH:mm',
  })
  jam_selesai?: string;
}

export class ValidateJadwalItemDto {
  @ApiProperty({ example: 'uuid-kelas' })
  @IsString()
  @IsNotEmpty()
  kelas_id!: string;

  @ApiProperty({ example: 'uuid-guru' })
  @IsString()
  @IsNotEmpty()
  guru_id!: string;

  @ApiProperty({ example: 'uuid-mapel' })
  @IsString()
  @IsNotEmpty()
  mapel_id!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(7)
  hari!: number;

  @ApiProperty({ example: '07:30' })
  @IsString()
  jam_mulai!: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  jam_selesai!: string;
}

export class ValidateJadwalBatchDto {
  @ApiProperty({ example: 'uuid-tahun-ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id!: string;

  @ApiProperty({ type: [ValidateJadwalItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateJadwalItemDto)
  items!: ValidateJadwalItemDto[];
}

export class DuplikasiJadwalDto {
  @ApiProperty({
    example: 'uuid-tahun-ajaran-sumber',
    description: 'ID tahun ajaran asal yang jadwalnya akan diduplikasi',
  })
  @IsString()
  @IsNotEmpty()
  sumber_tahun_ajaran_id!: string;
}

export class GenerateSmaScheduleDto {
  @ApiProperty({ example: 'uuid-tahun-ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id!: string;

  @ApiPropertyOptional({ example: [10, 11, 12], type: [Number] })
  @IsOptional()
  @IsArray()
  tingkat_list?: number[];

  @ApiPropertyOptional({ example: ['uuid-kelas-1', 'uuid-kelas-2'], type: [String] })
  @IsOptional()
  @IsArray()
  kelas_ids?: string[];

  @ApiPropertyOptional({ example: 45, description: 'Durasi per 1 JP dalam menit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(60)
  durasi_jp?: number;

  @ApiPropertyOptional({ example: '07:30', description: 'Jam mulai belajar harian' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Format jam_mulai harus berupa HH:mm',
  })
  jam_mulai?: string;

  @ApiPropertyOptional({ example: true, description: 'Jika true, hapus jadwal lama di kelas yang dipilih' })
  @IsOptional()
  replace_existing?: boolean;
}

export class ApplyGeneratedScheduleDto {
  @ApiProperty({ example: 'uuid-tahun-ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id!: string;

  @ApiProperty({ example: true, description: 'Hapus jadwal lama di kelas-kelas yang di-generate' })
  @IsOptional()
  replace_existing?: boolean;

  @ApiProperty({ example: ['uuid-kelas-1'], type: [String] })
  @IsArray()
  target_kelas_ids!: string[];

  @ApiProperty({ type: [CreateJadwalDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJadwalDto)
  schedules!: CreateJadwalDto[];
}

