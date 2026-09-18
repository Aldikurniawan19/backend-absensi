import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AbsensiService } from './absensi.service';
import { ManualAbsensiDto, ScanQrDto } from './dto/absensi.dto';

@ApiTags('Absensi (Scan Siswa & Manual Guru)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('absensi')
export class AbsensiController {
  constructor(private readonly absensiService: AbsensiService) {}

  @Roles(UserRole.SISWA)
  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kirim data scan QR dari aplikasi mobile siswa',
    description:
      'Memvalidasi token QR, masa berlaku, pendaftaran kelas, radius GPS (jika aktif), dan toleransi 10 menit (Hadir vs Terlambat).',
  })
  async scanQr(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ScanQrDto,
  ) {
    const result = await this.absensiService.scanQr(dto, user);
    return result;
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Post('manual')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tandai absensi manual untuk siswa (cadangan jika proyektor/QR bermasalah)',
  })
  async manualAbsensi(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ManualAbsensiDto,
  ) {
    const result = await this.absensiService.manualAbsensi(dto, user);
    return result;
  }

  @Get('siswa/:id')
  @ApiOperation({ summary: 'Riwayat kehadiran siswa tertentu' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getRiwayatSiswa(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.absensiService.getRiwayatSiswa(
      id,
      user,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
    return result;
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Get('kelas/:id')
  @ApiOperation({ summary: 'Rekap kehadiran satu kelas pada tanggal tertentu' })
  @ApiQuery({ name: 'tanggal', required: true, example: '2026-09-18' })
  async getRekapKelas(
    @CurrentUser() user: JwtPayload,
    @Param('id') kelasId: string,
    @Query('tanggal') tanggal: string,
  ) {
    const data = await this.absensiService.getRekapKelas(kelasId, tanggal, user);
    return { data };
  }
}
