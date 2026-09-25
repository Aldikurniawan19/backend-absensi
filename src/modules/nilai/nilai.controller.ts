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
import { UpdateKonfigurasiPenilaianDto } from './dto/konfigurasi-penilaian.dto';
import {
  CreateNilaiBatchDto,
  CreateNilaiDto,
  SaveCatatanCapaianBatchDto,
  SaveCatatanCapaianDto,
  UpdateNilaiDto,
} from './dto/nilai.dto';
import { NilaiService } from './nilai.service';

@ApiTags('Penilaian Siswa (Kurikulum Merdeka)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nilai')
export class NilaiController {
  constructor(private readonly nilaiService: NilaiService) {}

  // ==================== KONFIGURASI PENILAIAN ====================

  @Get('konfigurasi')
  @ApiOperation({ summary: 'Ambil konfigurasi bobot & predikat penilaian aktif' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  async getKonfigurasi(
    @CurrentUser() user: JwtPayload,
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
  ) {
    const data = await this.nilaiService.getKonfigurasiPenilaian(
      user.sekolah_id,
      tahunAjaranId,
    );
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Post('konfigurasi')
  @ApiOperation({ summary: 'Simpan konfigurasi bobot & predikat penilaian - Khusus Admin' })
  async saveKonfigurasi(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateKonfigurasiPenilaianDto,
  ) {
    const data = await this.nilaiService.saveKonfigurasiPenilaian(
      user.sekolah_id,
      dto,
      user.sub,
    );
    return { message: 'Konfigurasi penilaian berhasil diperbarui', data };
  }

  // ==================== DAFTAR KELAS & MAPEL GURU ====================

  @Roles(UserRole.GURU)
  @Get('guru/kelas-mapel')
  @ApiOperation({ summary: 'Daftar kelas dan mapel yang diampu oleh guru yang sedang login' })
  async getKelasMapelGuru(@CurrentUser() user: JwtPayload) {
    const data = await this.nilaiService.getKelasMapelGuru(
      user.sub,
      user.sekolah_id,
    );
    return { data };
  }

  // ==================== INPUT NILAI ====================

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Input satu nilai siswa' })
  async createNilaiSingle(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateNilaiDto,
  ) {
    const data = await this.nilaiService.createNilaiSingle(
      dto,
      user.sub,
      user.role,
      user.sekolah_id,
    );
    return { message: 'Nilai berhasil disimpan', data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Post('batch')
  @ApiOperation({ summary: 'Input banyak nilai siswa sekaligus (batch)' })
  async createNilaiBatch(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateNilaiBatchDto,
  ) {
    const result = await this.nilaiService.createNilaiBatch(
      dto,
      user.sub,
      user.role,
      user.sekolah_id,
    );
    return result;
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update nilai siswa' })
  async updateNilai(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateNilaiDto,
  ) {
    const data = await this.nilaiService.updateNilai(
      id,
      dto,
      user.sub,
      user.role,
      user.sekolah_id,
    );
    return { message: 'Nilai berhasil diperbarui', data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Hapus data nilai siswa' })
  async deleteNilai(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.nilaiService.deleteNilai(
      id,
      user.sub,
      user.role,
      user.sekolah_id,
    );
    return result;
  }

  // ==================== REKAP NILAI ====================

  @Get('rekap/kelas/:kelasId/mapel/:mapelId')
  @ApiOperation({ summary: 'Ambil rekap nilai siswa per kelas per mata pelajaran' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  async getRekapKelasMapel(
    @CurrentUser() user: JwtPayload,
    @Param('kelasId') kelasId: string,
    @Param('mapelId') mapelId: string,
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
  ) {
    const data = await this.nilaiService.getRekapKelasMapel(
      kelasId,
      mapelId,
      user.sekolah_id,
      tahunAjaranId,
    );
    return { data };
  }

  @Get('rekap/kelas/:kelasId')
  @ApiOperation({ summary: 'Ambil rekap nilai semua mapel di satu kelas (Wali Kelas & Admin)' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  async getRekapSemuaMapelKelas(
    @CurrentUser() user: JwtPayload,
    @Param('kelasId') kelasId: string,
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
  ) {
    const data = await this.nilaiService.getRekapSemuaMapelKelas(
      kelasId,
      user.sekolah_id,
      tahunAjaranId,
    );
    return { data };
  }

  // ==================== CATATAN CAPAIAN ====================

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Post('catatan-capaian')
  @ApiOperation({ summary: 'Simpan narasi catatan capaian kompetensi siswa' })
  async saveCatatanCapaian(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SaveCatatanCapaianDto,
  ) {
    const data = await this.nilaiService.saveCatatanCapaianSingle(
      dto,
      user.sub,
      user.role,
      user.sekolah_id,
    );
    return { message: 'Catatan capaian berhasil disimpan', data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Post('catatan-capaian/batch')
  @ApiOperation({ summary: 'Simpan batch narasi catatan capaian kompetensi siswa satu kelas' })
  async saveCatatanCapaianBatch(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SaveCatatanCapaianBatchDto,
  ) {
    const result = await this.nilaiService.saveCatatanCapaianBatch(
      dto,
      user.sub,
      user.role,
      user.sekolah_id,
    );
    return result;
  }

  @Get('catatan-capaian/kelas/:kelasId/mapel/:mapelId')
  @ApiOperation({ summary: 'Daftar catatan capaian kompetensi siswa per kelas per mapel' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: true })
  async getCatatanCapaianList(
    @Param('kelasId') kelasId: string,
    @Param('mapelId') mapelId: string,
    @Query('tahun_ajaran_id') tahunAjaranId: string,
  ) {
    const data = await this.nilaiService.getCatatanCapaianKelasMapel(
      kelasId,
      mapelId,
      tahunAjaranId,
    );
    return { data };
  }
}
