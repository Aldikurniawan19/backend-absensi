import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LaporanService } from './laporan.service';

@ApiTags('Laporan & Analitik Kehadiran')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('laporan')
export class LaporanController {
  constructor(private readonly laporanService: LaporanService) {}

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Get('mapel/:id')
  @ApiOperation({ summary: 'Persentase dan rincian kehadiran per mata pelajaran' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  async getLaporanMapel(
    @Param('id') mapelId: string,
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
  ) {
    const data = await this.laporanService.getLaporanMapel(mapelId, tahunAjaranId);
    return { data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Get('kelas/:id')
  @ApiOperation({ summary: 'Rekap kehadiran seluruh siswa dalam satu kelas' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  async getLaporanKelas(
    @Param('id') kelasId: string,
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
  ) {
    const data = await this.laporanService.getLaporanKelas(kelasId, tahunAjaranId);
    return { data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Get('dashboard')
  @ApiOperation({ summary: 'Ringkasan kehadiran sekolah hari ini' })
  async getDashboardOverview(@CurrentUser() user: JwtPayload) {
    const data = await this.laporanService.getDashboardOverview(user.sekolah_id);
    return { data };
  }
}
