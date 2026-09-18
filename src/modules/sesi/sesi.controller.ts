import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSesiDto, UpdateSesiDto } from './dto/sesi.dto';
import { SesiService } from './sesi.service';

@ApiTags('Sesi Absensi Guru')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sesi')
export class SesiController {
  constructor(private readonly sesiService: SesiService) {}

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Buat sesi absensi baru + generate token & QR Code',
  })
  async createSesi(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSesiDto,
  ) {
    const data = await this.sesiService.createSesi(dto, user);
    return { message: 'Sesi absensi berhasil dibuka', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail sesi absensi beserta data absensi siswa' })
  async getSesiById(@Param('id') id: string) {
    const data = await this.sesiService.getSesiById(id);
    return { data };
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Cek status sesi real-time (statistik kehadiran dan status kedaluwarsa)',
  })
  async getSesiStatus(@Param('id') id: string) {
    const data = await this.sesiService.getSesiStatus(id);
    return { data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({
    summary: 'Ubah waktu exp / tutup sesi lebih awal',
  })
  async updateSesi(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSesiDto,
  ) {
    const data = await this.sesiService.updateSesi(id, dto, user);
    return { message: 'Sesi berhasil diperbarui', data };
  }
}
