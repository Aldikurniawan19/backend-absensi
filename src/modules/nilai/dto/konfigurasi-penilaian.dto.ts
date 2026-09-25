import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateKonfigurasiPenilaianDto {
  @ApiProperty({ description: 'ID Tahun Ajaran yang dikonfigurasi' })
  @IsString()
  @IsNotEmpty({ message: 'Tahun ajaran wajib diisi' })
  tahun_ajaran_id: string;

  @ApiProperty({ description: 'Bobot Formatif dalam persen (0-100)', example: 40 })
  @IsInt({ message: 'Bobot formatif harus berupa bilangan bulat' })
  @Min(0, { message: 'Bobot minimal 0%' })
  @Max(100, { message: 'Bobot maksimal 100%' })
  bobot_formatif: number;

  @ApiProperty({ description: 'Bobot STS dalam persen (0-100)', example: 30 })
  @IsInt({ message: 'Bobot STS harus berupa bilangan bulat' })
  @Min(0, { message: 'Bobot minimal 0%' })
  @Max(100, { message: 'Bobot maksimal 100%' })
  bobot_sts: number;

  @ApiProperty({ description: 'Bobot SAS dalam persen (0-100)', example: 30 })
  @IsInt({ message: 'Bobot SAS harus berupa bilangan bulat' })
  @Min(0, { message: 'Bobot minimal 0%' })
  @Max(100, { message: 'Bobot maksimal 100%' })
  bobot_sas: number;

  @ApiProperty({ description: 'Batas atas nilai Belum Berkembang (BB)', example: 40 })
  @IsInt()
  @Min(0)
  @Max(100)
  batas_bb: number;

  @ApiProperty({ description: 'Batas atas nilai Mulai Berkembang (MB)', example: 65 })
  @IsInt()
  @Min(0)
  @Max(100)
  batas_mb: number;

  @ApiProperty({ description: 'Batas atas nilai Berkembang Sesuai Harapan (BSH)', example: 85 })
  @IsInt()
  @Min(0)
  @Max(100)
  batas_bsh: number;
}
