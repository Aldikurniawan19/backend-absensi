import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
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
  GenerateKartuUjianDto,
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
  @ApiOperation({ summary: 'Detail jadwal ujian beserta slot mapel (dengan pagination & filter) - Khusus Admin' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'kelas_id', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'tanggal', required: false, type: String })
  async getJadwalUjianDetail(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('kelas_id') kelasId?: string,
    @Query('search') search?: string,
    @Query('tanggal') tanggal?: string,
  ) {
    const data = await this.jadwalUjianService.getJadwalUjianDetail(
      id,
      user.sekolah_id,
      Number(page) || 1,
      Number(limit) || 20,
      kelasId,
      search,
      tanggal,
    );
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

  // =========================================================================
  // ENDPOINT KARTU UJIAN & DENAH KURSI
  // =========================================================================

  @Roles(UserRole.ADMIN)
  @Post('ujian/:id/kartu/generate')
  @ApiOperation({
    summary: 'Generate nomor kartu ujian, pembagian ruang, dan nomor kursi siswa - Khusus Admin',
  })
  async generateKartuUjian(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: GenerateKartuUjianDto,
  ) {
    const result = await this.jadwalUjianService.generateKartuUjian(
      id,
      user.sekolah_id,
      user.sub,
      dto,
    );
    return result;
  }

  @Roles(UserRole.ADMIN, UserRole.GURU, UserRole.SISWA)
  @Get('ujian/:id/kartu')
  @ApiOperation({
    summary: 'Daftar nomor kartu peserta dan kursi ujian (terpaginasi)',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'ruangan', required: false })
  @ApiQuery({ name: 'kelas_id', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getKartuUjianList(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('ruangan') ruangan?: string,
    @Query('kelas_id') kelasId?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.jadwalUjianService.getKartuUjianList(
      id,
      user.sekolah_id,
      Number(page) || 1,
      Number(limit) || 20,
      ruangan,
      kelasId,
      search,
    );
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Get('ujian/:id/kartu/summary')
  @ApiOperation({
    summary: 'Ringkasan jumlah peserta dan alokasi per ruangan ujian - Khusus Admin',
  })
  async getKartuUjianSummary(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const data = await this.jadwalUjianService.getKartuUjianSummary(
      id,
      user.sekolah_id,
    );
    return { data };
  }

  @Roles(UserRole.ADMIN, UserRole.GURU, UserRole.SISWA)
  @Get('ujian/:id/kartu/pdf')
  @ApiOperation({
    summary: 'Unduh Dokumen PDF Kartu Ujian Siswa (A5 Landscape)',
  })
  @ApiQuery({ name: 'siswa_id', required: false })
  @ApiQuery({ name: 'ruangan', required: false })
  @ApiQuery({ name: 'kelas_id', required: false })
  async downloadKartuUjianPdf(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('siswa_id') siswaId?: string,
    @Query('ruangan') ruangan?: string,
    @Query('kelas_id') kelasId?: string,
  ): Promise<StreamableFile> {
    const targetSiswaId = user.role === UserRole.SISWA ? user.sub : siswaId;

    const pdfBuffer = await this.jadwalUjianService.generateKartuUjianPdf(
      id,
      user.sekolah_id,
      targetSiswaId,
      ruangan,
      kelasId,
    );

    return new StreamableFile(pdfBuffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="kartu-ujian-${id}${targetSiswaId ? `-${targetSiswaId}` : ''}.pdf"`,
      length: pdfBuffer.length,
    });
  }

  @Roles(UserRole.ADMIN)
  @Get('ujian/:id/label-kursi/pdf')
  @ApiOperation({
    summary: 'Unduh Dokumen PDF Label Meja / Denah Kursi untuk ditempel pada tiap bangku (A4 Multi-label)',
  })
  @ApiQuery({ name: 'ruangan', required: false })
  async downloadDenahKursiPdf(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('ruangan') ruangan?: string,
  ): Promise<StreamableFile> {
    const pdfBuffer = await this.jadwalUjianService.generateDenahKursiPdf(
      id,
      user.sekolah_id,
      ruangan,
    );

    const suffix = ruangan && ruangan !== 'ALL' ? `-${ruangan}` : '';
    return new StreamableFile(pdfBuffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="label-kursi-meja-${id}${suffix}.pdf"`,
      length: pdfBuffer.length,
    });
  }

  @Roles(UserRole.ADMIN)
  @Delete('ujian/:id/kartu')
  @ApiOperation({
    summary: 'Reset / Hapus seluruh kartu ujian dan nomor kursi pada jadwal ujian - Khusus Admin',
  })
  async deleteKartuUjian(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.jadwalUjianService.deleteKartuUjian(
      id,
      user.sekolah_id,
      user.sub,
    );
    return result;
  }
}

