import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// --- SISWA ---
export class CreateSiswaDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  nama!: string;

  @ApiProperty({ example: '0051234567' })
  @IsString()
  @IsNotEmpty()
  nisn!: string;

  @ApiProperty({ example: 'budi@siswa.sch.id' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: '08123456789' })
  @IsOptional()
  @IsString()
  no_hp_ortu?: string;

  @ApiPropertyOptional({ example: 'uuid-kelas', description: 'ID kelas saat ini (tahun ajaran aktif)' })
  @IsOptional()
  @IsString()
  kelas_id?: string;
}

export class UpdateSiswaDto {
  @ApiPropertyOptional({ example: 'Budi Santoso' })
  @IsOptional()
  @IsString()
  nama?: string;

  @ApiPropertyOptional({ example: '0051234567' })
  @IsOptional()
  @IsString()
  nisn?: string;

  @ApiPropertyOptional({ example: 'budi@siswa.sch.id' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'passwordBaru123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: '08123456789' })
  @IsOptional()
  @IsString()
  no_hp_ortu?: string;
}

export class AssignKelasSiswaDto {
  @ApiProperty({ example: 'uuid-siswa' })
  @IsString()
  @IsNotEmpty()
  siswa_id!: string;

  @ApiProperty({ example: 'uuid-kelas' })
  @IsString()
  @IsNotEmpty()
  kelas_id!: string;

  @ApiProperty({ example: 'uuid-tahun-ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id!: string;
}

// --- GURU ---
export class CreateGuruDto {
  @ApiProperty({ example: 'Drs. Ahmad Fauzi, M.Pd.' })
  @IsString()
  @IsNotEmpty()
  nama!: string;

  @ApiProperty({ example: '197501012000031001' })
  @IsString()
  @IsNotEmpty()
  nip!: string;

  @ApiProperty({ example: 'ahmad.fauzi@guru.sch.id' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: '08129876543' })
  @IsOptional()
  @IsString()
  no_hp?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['uuid-mapel-1', 'uuid-mapel-2'],
    description: 'Daftar ID mata pelajaran yang berwenang diajarkan',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mapel_ids?: string[];
}

export class UpdateGuruDto {
  @ApiPropertyOptional({ example: 'Drs. Ahmad Fauzi, M.Pd.' })
  @IsOptional()
  @IsString()
  nama?: string;

  @ApiPropertyOptional({ example: '197501012000031001' })
  @IsOptional()
  @IsString()
  nip?: string;

  @ApiPropertyOptional({ example: 'ahmad.fauzi@guru.sch.id' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'passwordBaru123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: '08129876543' })
  @IsOptional()
  @IsString()
  no_hp?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mapel_ids?: string[];
}

export class AssignWaliKelasDto {
  @ApiProperty({ example: 'uuid-guru' })
  @IsString()
  @IsNotEmpty()
  guru_id!: string;

  @ApiProperty({ example: 'uuid-kelas' })
  @IsString()
  @IsNotEmpty()
  kelas_id!: string;

  @ApiProperty({ example: 'uuid-tahun-ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id!: string;
}

// --- ADMIN ---
export class CreateAdminDto {
  @ApiProperty({ example: 'Admin Tata Usaha' })
  @IsString()
  @IsNotEmpty()
  nama!: string;

  @ApiProperty({ example: 'admin@sch.id' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'adminSecret123' })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class UpdateAdminDto {
  @ApiPropertyOptional({ example: 'Admin Tata Usaha' })
  @IsOptional()
  @IsString()
  nama?: string;

  @ApiPropertyOptional({ example: 'admin@sch.id' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'adminSecret123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
