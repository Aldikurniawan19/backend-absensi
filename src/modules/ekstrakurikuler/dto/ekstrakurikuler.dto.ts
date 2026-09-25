import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreateEkstrakurikulerDto {
  @ApiProperty({ description: 'Nama Ekstrakurikuler (misal: Pramuka, Paskibra, PMR, Basket)' })
  @IsString()
  @IsNotEmpty({ message: 'Nama ekstrakurikuler wajib diisi' })
  nama: string;
}

export class UpdateEkstrakurikulerDto {
  @ApiProperty({ description: 'Nama Ekstrakurikuler' })
  @IsString()
  @IsNotEmpty()
  nama: string;
}

export class AssignEkstrakurikulerSiswaDto {
  @ApiProperty({ description: 'ID Siswa' })
  @IsString()
  @IsNotEmpty()
  siswa_id: string;

  @ApiProperty({ description: 'ID Ekstrakurikuler' })
  @IsString()
  @IsNotEmpty()
  ekstrakurikuler_id: string;

  @ApiProperty({ description: 'ID Tahun Ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id: string;

  @ApiPropertyOptional({ description: 'Predikat (misal: Sangat Baik, Baik, Cukup)' })
  @IsOptional()
  @IsString()
  predikat?: string;

  @ApiPropertyOptional({ description: 'Keterangan tambahan kegiatan' })
  @IsOptional()
  @IsString()
  keterangan?: string;
}

export class UpdateEkstrakurikulerSiswaDto {
  @ApiPropertyOptional({ description: 'Predikat (misal: Sangat Baik, Baik, Cukup)' })
  @IsOptional()
  @IsString()
  predikat?: string;

  @ApiPropertyOptional({ description: 'Keterangan tambahan kegiatan' })
  @IsOptional()
  @IsString()
  keterangan?: string;
}

export class EkskulSiswaBatchItemDto {
  @ApiProperty({ description: 'ID Siswa' })
  @IsString()
  @IsNotEmpty()
  siswa_id: string;

  @ApiProperty({ description: 'ID Ekstrakurikuler' })
  @IsString()
  @IsNotEmpty()
  ekstrakurikuler_id: string;

  @ApiPropertyOptional({ description: 'Predikat (misal: Sangat Baik, Baik, Cukup)' })
  @IsOptional()
  @IsString()
  predikat?: string;

  @ApiPropertyOptional({ description: 'Keterangan' })
  @IsOptional()
  @IsString()
  keterangan?: string;
}

export class SaveEkskulSiswaBatchDto {
  @ApiProperty({ description: 'ID Tahun Ajaran' })
  @IsString()
  @IsNotEmpty()
  tahun_ajaran_id: string;

  @ApiProperty({ type: [EkskulSiswaBatchItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EkskulSiswaBatchItemDto)
  items: EkskulSiswaBatchItemDto[];
}
