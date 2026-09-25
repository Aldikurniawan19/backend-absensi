import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCatatanWaliKelasDto {
  @ApiProperty({ description: 'Catatan / narasi perkembangan siswa dari wali kelas' })
  @IsString()
  @IsNotEmpty({ message: 'Catatan wali kelas wajib diisi' })
  catatan_wali_kelas: string;
}

export class GenerateRaportKelasDto {
  @ApiPropertyOptional({ description: 'ID Tahun Ajaran (opsional, default aktif)' })
  @IsOptional()
  @IsString()
  tahun_ajaran_id?: string;
}
