import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Operasi berhasil dilakukan' })
  message!: string;

  data?: T;

  @ApiProperty({ example: '2026-09-18T08:00:00.000Z' })
  timestamp!: string;
}
