import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import {
  ApplyGeneratedScheduleDto,
  CreateJadwalDto,
  DuplikasiJadwalDto,
  GenerateSmaScheduleDto,
  UpdateJadwalDto,
  ValidateJadwalBatchDto,
  ValidateJadwalItemDto,
} from './dto/jadwal.dto';
import {
  CreateJadwalUjianDto,
  GenerateJadwalUjianDto,
  ToggleJadwalUjianStatusDto,
} from './dto/jadwal-ujian.dto';
import { JadwalService } from './jadwal.service';
import { JadwalGeneratorService } from './jadwal-generator.service';
import { JadwalUjianService } from './jadwal-ujian.service';

@ApiTags('Jadwal Pelajaran & Deteksi Bentrok')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('jadwal')
export class JadwalController {
  constructor(
    private readonly jadwalService: JadwalService,
    private readonly jadwalGeneratorService: JadwalGeneratorService,
    private readonly jadwalUjianService: JadwalUjianService,
  ) {}

  @Roles(UserRole.GURU)
  @Get('hari-ini')
  @ApiOperation({
    summary: 'Ambil jadwal mengajar guru hari ini (otomatis sesuai hari & tahun ajaran aktif)',
  })
  @ApiQuery({ name: 'hari', required: false, description: 'Hari 1-7 (1=Senin, 7=Minggu)' })
  async getJadwalHariIni(
    @CurrentUser() user: JwtPayload,
    @Query('hari') hari?: number,
  ) {
    const data = await this.jadwalService.getJadwalHariIni(user.sub, hari ? Number(hari) : undefined);
    return { data };
  }

  @Roles(UserRole.GURU)
  @Get('guru/saya')
  @ApiOperation({
    summary: 'Ambil seluruh jadwal mengajar guru yang sedang login untuk tahun ajaran aktif',
  })
  async getJadwalGuruSaya(@CurrentUser() user: JwtPayload) {
    const data = await this.jadwalService.getJadwalGuruSemua(user.sub);
    return { data };
  }

  @Post('validasi')
  @ApiOperation({
    summary: 'Validasi bentrok jadwal sebelum disimpan (cek bentrok guru & bentrok kelas)',
  })
  async validateBatch(@Body() dto: ValidateJadwalBatchDto) {
    const result = await this.jadwalService.validateBatch(dto);
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'Daftar jadwal pelajaran berdasarkan tahun ajaran, kelas, guru, atau hari' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  @ApiQuery({ name: 'kelas_id', required: false })
  @ApiQuery({ name: 'guru_id', required: false })
  @ApiQuery({ name: 'hari', required: false })
  async getJadwalList(
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
    @Query('kelas_id') kelasId?: string,
    @Query('guru_id') guruId?: string,
    @Query('hari') hari?: number,
  ) {
    const data = await this.jadwalService.getJadwalList(
      tahunAjaranId,
      kelasId,
      guruId,
      hari ? Number(hari) : undefined,
    );
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Buat satu baris jadwal pelajaran - Khusus Admin' })
  async createJadwal(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateJadwalDto,
  ) {
    const data = await this.jadwalService.createJadwal(dto, user.sub);
    return { message: 'Jadwal berhasil dibuat', data };
  }

  @Roles(UserRole.ADMIN)
  @Post('bulk')
  @ApiOperation({ summary: 'Tambah banyak jadwal pelajaran sekaligus (impor) - Khusus Admin' })
  async createJadwalBulk(
    @CurrentUser() user: JwtPayload,
    @Body() dto: {
      tahun_ajaran_id: string;
      items: Array<{
        kelas_id: string;
        mapel_id: string;
        guru_id: string;
        hari: number;
        jam_mulai: string;
        jam_selesai: string;
      }>;
    },
  ) {
    const data = await this.jadwalService.createJadwalBulk(dto, user.sub, user.sekolah_id);
    return {
      message: `${data.count} jadwal pelajaran berhasil diimpor`,
      data,
    };
  }

  @Roles(UserRole.ADMIN)
  @Post('generate/sma-preview')
  @ApiOperation({
    summary: 'Simulasi penjadwalan otomatis SMA per semester (0% Bentrok, Kurikulum Merdeka Fase E & F)',
  })
  async generateSmaPreview(@Body() dto: GenerateSmaScheduleDto) {
    const result = await this.jadwalGeneratorService.generateSmaSchedulePreview(dto);
    return { data: result };
  }

  @Roles(UserRole.ADMIN)
  @Post('generate/sma-apply')
  @ApiOperation({
    summary: 'Terapkan hasil generate jadwal SMA secara permanen ke semester aktif',
  })
  async applyGeneratedSchedule(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApplyGeneratedScheduleDto,
  ) {
    const result = await this.jadwalGeneratorService.applyGeneratedSchedule(dto, user.sub);
    return result;
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Ubah baris jadwal pelajaran - Khusus Admin' })
  async updateJadwal(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateJadwalDto,
  ) {
    const data = await this.jadwalService.updateJadwal(id, dto, user.sub);
    return { message: 'Jadwal berhasil diperbarui', data };
  }

  @Roles(UserRole.ADMIN)
  @Post('tahun-ajaran/:id/duplikasi')
  @ApiOperation({
    summary: 'Duplikasi seluruh jadwal dari tahun ajaran lama ke tahun ajaran target (draft)',
  })
  async duplikasiJadwal(
    @CurrentUser() user: JwtPayload,
    @Param('id') targetTahunAjaranId: string,
    @Body() dto: DuplikasiJadwalDto,
  ) {
    const result = await this.jadwalService.duplikasiJadwal(
      targetTahunAjaranId,
      dto,
      user.sub,
    );
    return result;
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Hapus baris jadwal pelajaran - Khusus Admin' })
  async deleteJadwal(@Param('id') id: string) {
    await this.jadwalService.deleteJadwal(id);
    return { message: 'Jadwal berhasil dihapus' };
  }

  // =========================================================================
  // FITUR JADWAL UJIAN (PTS / PAS / PAT) & AKTIVASI MOBILE
  // =========================================================================

  @Get('ujian/active')
  @ApiOperation({
    summary: 'Ambil Jadwal Ujian yang sedang AKTIF untuk tampilan mobile siswa/guru',
  })
  @ApiQuery({ name: 'kelas_id', required: false })
  async getActiveJadwalUjian(
    @CurrentUser() user: JwtPayload,
    @Query('kelas_id') kelasId?: string,
  ) {
    let resolvedKelasId = kelasId;
    let resolvedGuruId: string | undefined;

    if (user.role === UserRole.GURU) {
      resolvedGuruId = user.sub;
    }

    const data = await this.jadwalUjianService.getActiveJadwalUjian(
      user.sekolah_id,
      resolvedKelasId,
      resolvedGuruId,
    );
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Get('ujian')
  @ApiOperation({ summary: 'Daftar riwayat jadwal ujian di sekolah ini - Khusus Admin' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  async getJadwalUjianList(
    @CurrentUser() user: JwtPayload,
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
  ) {
    const data = await this.jadwalUjianService.getJadwalUjianList(
      user.sekolah_id,
      tahunAjaranId,
    );
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Get('ujian/:id')
  @ApiOperation({ summary: 'Detail jadwal ujian beserta seluruh slot mapel - Khusus Admin' })
  async getJadwalUjianDetail(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const data = await this.jadwalUjianService.getJadwalUjianDetail(id, user.sekolah_id);
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Post('ujian/generate-preview')
  @ApiOperation({
    summary: 'Simulasi/Pratinjau generate Jadwal Ujian otomatis (PTS / PAS) - Khusus Admin',
  })
  async generateJadwalUjianPreview(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateJadwalUjianDto,
  ) {
    const result = await this.jadwalUjianService.generateJadwalUjianPreview(
      dto,
      user.sekolah_id,
    );
    return { data: result };
  }

  @Roles(UserRole.ADMIN)
  @Post('ujian')
  @ApiOperation({
    summary: 'Simpan Jadwal Ujian dengan opsi Aktifkan/Nonaktifkan untuk Mobile - Khusus Admin',
  })
  async createJadwalUjian(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateJadwalUjianDto,
  ) {
    const result = await this.jadwalUjianService.createJadwalUjian(
      dto,
      user.sekolah_id,
      user.sub,
    );
    return result;
  }

  @Roles(UserRole.ADMIN)
  @Patch('ujian/:id/toggle-status')
  @ApiOperation({
    summary: 'Ubah status aktivasi Jadwal Ujian (Aktifkan / Nonaktifkan untuk Mobile) - Khusus Admin',
  })
  async toggleJadwalUjianStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ToggleJadwalUjianStatusDto,
  ) {
    const result = await this.jadwalUjianService.toggleStatus(
      id,
      dto.is_active,
      user.sekolah_id,
      user.sub,
    );
    return result;
  }

  @Roles(UserRole.ADMIN)
  @Delete('ujian/:id')
  @ApiOperation({ summary: 'Hapus Jadwal Ujian - Khusus Admin' })
  async deleteJadwalUjian(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.jadwalUjianService.deleteJadwalUjian(
      id,
      user.sekolah_id,
      user.sub,
    );
    return result;
  }
}
