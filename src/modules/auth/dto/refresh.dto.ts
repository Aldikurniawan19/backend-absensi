import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token yang didapat saat login',
  })
  @IsString({ message: 'Refresh token harus berupa teks' })
  @IsNotEmpty({ message: 'Refresh token tidak boleh kosong' })
  refresh_token!: string;
}
