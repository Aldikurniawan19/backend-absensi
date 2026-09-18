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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateJurusanDto,
  CreateKelasDto,
  CreateMapelDto,
  CreateTahunAjaranDto,
  UpdateJurusanDto,
  UpdateKelasDto,
  UpdateMapelDto,
  UpdateSekolahDto,
  UpdateTahunAjaranDto,
} from './dto/master.dto';
import { MasterService } from './master.service';

@ApiTags('Data Master (Sekolah, Tahun Ajaran, Jurusan, Kelas, Mapel)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('master')
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // ==================== SEKOLAH ====================
  @Get('sekolah')
  @ApiOperation({ summary: 'Ambil profil & konfigurasi sekolah' })
  async getSekolah(@CurrentUser() user: JwtPayload) {
    const data = await this.masterService.getSekolah(user.sekolah_id);
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Patch('sekolah')
  @ApiOperation({ summary: 'Ubah konfigurasi sekolah (GPS, radius, batas sesi siswa) - Khusus Admin' })
  async updateSekolah(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSekolahDto,
  ) {
    const data = await this.masterService.updateSekolah(
      user.sekolah_id,
      dto,
      user.sub,
    );
    return { message: 'Konfigurasi sekolah berhasil diperbarui', data };
  }

  // ==================== TAHUN AJARAN ====================
  @Get('tahun-ajaran')
  @ApiOperation({ summary: 'Daftar semua tahun ajaran sekolah' })
  async getTahunAjaranList(@CurrentUser() user: JwtPayload) {
    const data = await this.masterService.getTahunAjaranList(user.sekolah_id);
    return { data };
  }

  @Get('tahun-ajaran/aktif')
  @ApiOperation({ summary: 'Ambil tahun ajaran yang sedang aktif' })
  async getTahunAjaranAktif(@CurrentUser() user: JwtPayload) {
    const data = await this.masterService.getTahunAjaranAktif(user.sekolah_id);
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Post('tahun-ajaran')
  @ApiOperation({ summary: 'Buat tahun ajaran baru (default draft) - Khusus Admin' })
  async createTahunAjaran(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTahunAjaranDto,
  ) {
    const data = await this.masterService.createTahunAjaran(
      user.sekolah_id,
      dto,
      user.sub,
    );
    return { message: 'Tahun ajaran berhasil dibuat', data };
  }

  @Roles(UserRole.ADMIN)
  @Patch('tahun-ajaran/:id')
  @ApiOperation({ summary: 'Ubah data tahun ajaran - Khusus Admin' })
  async updateTahunAjaran(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTahunAjaranDto,
  ) {
    const data = await this.masterService.updateTahunAjaran(id, dto, user.sub);
    return { message: 'Tahun ajaran berhasil diperbarui', data };
  }

  @Roles(UserRole.ADMIN)
  @Patch('tahun-ajaran/:id/aktifkan')
  @ApiOperation({
    summary: 'Aktifkan tahun ajaran — jadwalnya mulai dipakai untuk generate sesi absensi',
  })
  async aktifkanTahunAjaran(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const data = await this.masterService.aktifkanTahunAjaran(
      id,
      user.sekolah_id,
      user.sub,
    );
    return { message: 'Tahun ajaran berhasil diaktifkan', data };
  }

  @Roles(UserRole.ADMIN)
  @Delete('tahun-ajaran/:id')
  @ApiOperation({ summary: 'Hapus tahun ajaran - Khusus Admin' })
  async deleteTahunAjaran(@Param('id') id: string) {
    await this.masterService.deleteTahunAjaran(id);
    return { message: 'Tahun ajaran berhasil dihapus' };
  }

  // ==================== JURUSAN ====================
  @Get('jurusan')
  @ApiOperation({ summary: 'Daftar semua jurusan' })
  async getJurusanList(@CurrentUser() user: JwtPayload) {
    const data = await this.masterService.getJurusanList(user.sekolah_id);
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Post('jurusan')
  @ApiOperation({ summary: 'Tambah jurusan baru - Khusus Admin' })
  async createJurusan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateJurusanDto,
  ) {
    const data = await this.masterService.createJurusan(user.sekolah_id, dto);
    return { message: 'Jurusan berhasil ditambahkan', data };
  }

  @Roles(UserRole.ADMIN)
  @Patch('jurusan/:id')
  @ApiOperation({ summary: 'Ubah jurusan - Khusus Admin' })
  async updateJurusan(
    @Param('id') id: string,
    @Body() dto: UpdateJurusanDto,
  ) {
    const data = await this.masterService.updateJurusan(id, dto);
    return { message: 'Jurusan berhasil diperbarui', data };
  }

  @Roles(UserRole.ADMIN)
  @Delete('jurusan/:id')
  @ApiOperation({ summary: 'Hapus jurusan - Khusus Admin' })
  async deleteJurusan(@Param('id') id: string) {
    await this.masterService.deleteJurusan(id);
    return { message: 'Jurusan berhasil dihapus' };
  }

  // ==================== KELAS ====================
  @Get('kelas')
  @ApiOperation({ summary: 'Daftar semua kelas' })
  async getKelasList(
    @CurrentUser() user: JwtPayload,
    @Query('tingkat') tingkat?: number,
  ) {
    const data = await this.masterService.getKelasList(
      user.sekolah_id,
      tingkat ? Number(tingkat) : undefined,
    );
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Post('kelas')
  @ApiOperation({ summary: 'Tambah kelas baru - Khusus Admin' })
  async createKelas(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateKelasDto,
  ) {
    const data = await this.masterService.createKelas(user.sekolah_id, dto);
    return { message: 'Kelas berhasil dibuat', data };
  }

  @Roles(UserRole.ADMIN)
  @Patch('kelas/:id')
  @ApiOperation({ summary: 'Ubah kelas - Khusus Admin' })
  async updateKelas(
    @Param('id') id: string,
    @Body() dto: UpdateKelasDto,
  ) {
    const data = await this.masterService.updateKelas(id, dto);
    return { message: 'Kelas berhasil diperbarui', data };
  }

  @Roles(UserRole.ADMIN)
  @Delete('kelas/:id')
  @ApiOperation({ summary: 'Hapus kelas - Khusus Admin' })
  async deleteKelas(@Param('id') id: string) {
    await this.masterService.deleteKelas(id);
    return { message: 'Kelas berhasil dihapus' };
  }

  // ==================== MATA PELAJARAN ====================
  @Get('mapel')
  @ApiOperation({ summary: 'Daftar semua mata pelajaran' })
  async getMapelList(@CurrentUser() user: JwtPayload) {
    const data = await this.masterService.getMapelList(user.sekolah_id);
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Post('mapel')
  @ApiOperation({ summary: 'Tambah mata pelajaran baru - Khusus Admin' })
  async createMapel(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMapelDto,
  ) {
    const data = await this.masterService.createMapel(user.sekolah_id, dto);
    return { message: 'Mata pelajaran berhasil ditambahkan', data };
  }

  @Roles(UserRole.ADMIN)
  @Post('mapel/bulk')
  @ApiOperation({
    summary: 'Tambah banyak mata pelajaran sekaligus (impor) - Khusus Admin',
  })
  async createMapelBulk(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { items: Array<{ nama: string; kode?: string }> },
  ) {
    const data = await this.masterService.createMapelBulk(
      user.sekolah_id,
      dto.items,
    );
    return {
      message: `${data.count} mata pelajaran berhasil diimpor`,
      data,
    };
  }

  @Roles(UserRole.ADMIN)
  @Patch('mapel/:id')
  @ApiOperation({ summary: 'Ubah mata pelajaran - Khusus Admin' })
  async updateMapel(
    @Param('id') id: string,
    @Body() dto: UpdateMapelDto,
  ) {
    const data = await this.masterService.updateMapel(id, dto);
    return { message: 'Mata pelajaran berhasil diperbarui', data };
  }

  @Roles(UserRole.ADMIN)
  @Delete('mapel/:id')
  @ApiOperation({ summary: 'Hapus mata pelajaran - Khusus Admin' })
  async deleteMapel(@Param('id') id: string) {
    await this.masterService.deleteMapel(id);
    return { message: 'Mata pelajaran berhasil dihapus' };
  }
}
