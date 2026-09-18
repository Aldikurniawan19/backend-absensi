import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: '1234567890',
    description: 'Identifier login: NISN (siswa), NIP (guru), atau Email (semua peran)',
  })
  @IsString({ message: 'Identifier harus berupa teks' })
  @IsNotEmpty({ message: 'Identifier tidak boleh kosong' })
  identifier!: string;

  @ApiProperty({
    example: 'password123',
    description: 'Kata sandi akun',
  })
  @IsString({ message: 'Kata sandi harus berupa teks' })
  @IsNotEmpty({ message: 'Kata sandi tidak boleh kosong' })
  password!: string;

  @ApiProperty({
    example: 'Chrome 120 / Windows 11 / Redmi Note 12',
    description: 'Informasi perangkat dan peramban klien',
  })
  @IsString({ message: 'Informasi perangkat harus berupa teks' })
  @IsNotEmpty({ message: 'Informasi perangkat tidak boleh kosong' })
  device_info!: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Jika bernilai true, sistem akan memaksa logout sesi aktif di perangkat lain (khusus akun siswa)',
  })
  @IsOptional()
  @IsBoolean({ message: 'Flag paksa_logout_sesi_lama harus bernilai boolean' })
  paksa_logout_sesi_lama?: boolean = false;
}
