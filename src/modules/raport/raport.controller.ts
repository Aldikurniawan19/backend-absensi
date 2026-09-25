import {
  Body,
  Controller,
  ForbiddenException,
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
import { GenerateRaportKelasDto, UpdateCatatanWaliKelasDto } from './dto/raport.dto';
import { RaportService } from './raport.service';

@ApiTags('Raport Siswa (Kurikulum Merdeka)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('raport')
export class RaportController {
  constructor(private readonly raportService: RaportService) {}

  @Roles(UserRole.SISWA)
  @Get('my')
  @ApiOperation({ summary: 'Ambil detail kartu hasil studi / raport siswa yang sedang login' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  async getMyRaport(
    @CurrentUser() user: JwtPayload,
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
  ) {
    const data = await this.raportService.getDetailRaportSiswa(
      user.sub,
      user.sekolah_id,
      tahunAjaranId,
    );
    return { data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Post('generate/:kelasId')
  @ApiOperation({ summary: 'Generate draft raport semua siswa di kelas' })
  async generateRaportKelas(
    @CurrentUser() user: JwtPayload,
    @Param('kelasId') kelasId: string,
    @Body() dto: GenerateRaportKelasDto,
  ) {
    const result = await this.raportService.generateRaportKelas(
      kelasId,
      user.sub,
      user.sekolah_id,
      dto.tahun_ajaran_id,
    );
    return result;
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Get('kelas/:kelasId')
  @ApiOperation({ summary: 'Daftar status raport per kelas' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  async getRaportListKelas(
    @CurrentUser() user: JwtPayload,
    @Param('kelasId') kelasId: string,
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
  ) {
    const data = await this.raportService.getRaportListKelas(
      kelasId,
      user.sekolah_id,
      tahunAjaranId,
    );
    return { data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN, UserRole.SISWA)
  @Get('siswa/:siswaId')
  @ApiOperation({ summary: 'Ambil detail lengkap raport satu siswa' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  async getDetailRaportSiswa(
    @CurrentUser() user: JwtPayload,
    @Param('siswaId') siswaId: string,
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
  ) {
    if (user.role === UserRole.SISWA && user.sub !== siswaId) {
      throw new ForbiddenException('Siswa hanya dapat mengakses data hasil studi diri sendiri');
    }
    const data = await this.raportService.getDetailRaportSiswa(
      siswaId,
      user.sekolah_id,
      tahunAjaranId,
    );
    return { data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Patch(':id/catatan')
  @ApiOperation({ summary: 'Simpan / update catatan wali kelas pada raport' })
  async updateCatatanWaliKelas(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCatatanWaliKelasDto,
  ) {
    const data = await this.raportService.updateCatatanWaliKelas(
      id,
      dto.catatan_wali_kelas,
      user.sub,
      user.role,
      user.sekolah_id,
    );
    return { message: 'Catatan wali kelas berhasil diperbarui', data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Patch(':id/finalisasi')
  @ApiOperation({ summary: 'Finalisasi raport siswa (mengunci raport)' })
  async finalisasiRaport(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const data = await this.raportService.finalisasiRaport(
      id,
      user.sub,
      user.role,
      user.sekolah_id,
    );
    return { message: 'Raport berhasil difinalisasi', data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Patch(':id/batal-finalisasi')
  @ApiOperation({ summary: 'Batal finalisasi raport siswa (kembali ke DRAFT)' })
  async batalFinalisasiRaport(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const data = await this.raportService.batalFinalisasiRaport(
      id,
      user.sub,
      user.role,
      user.sekolah_id,
    );
    return { message: 'Finalisasi raport dibatalkan', data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN, UserRole.SISWA)
  @Get('siswa/:siswaId/pdf')
  @ApiOperation({ summary: 'Unduh dokumen PDF Raport Kurikulum Merdeka siswa' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  async downloadRaportPdf(
    @CurrentUser() user: JwtPayload,
    @Param('siswaId') siswaId: string,
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
  ): Promise<StreamableFile> {
    if (user.role === UserRole.SISWA && user.sub !== siswaId) {
      throw new ForbiddenException('Siswa hanya dapat mengunduh dokumen hasil studi diri sendiri');
    }
    const pdfBuffer = await this.raportService.generateRaportPdf(
      siswaId,
      user.sekolah_id,
      tahunAjaranId,
    );

    return new StreamableFile(pdfBuffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="raport-${siswaId}.pdf"`,
      length: pdfBuffer.length,
    });
  }
}
