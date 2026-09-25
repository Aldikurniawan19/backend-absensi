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
  AssignEkstrakurikulerSiswaDto,
  CreateEkstrakurikulerDto,
  SaveEkskulSiswaBatchDto,
  UpdateEkstrakurikulerDto,
  UpdateEkstrakurikulerSiswaDto,
} from './dto/ekstrakurikuler.dto';
import { EkstrakurikulerService } from './ekstrakurikuler.service';

@ApiTags('Ekstrakurikuler & Nilai Ekskul')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ekstrakurikuler')
export class EkstrakurikulerController {
  constructor(private readonly ekskulService: EkstrakurikulerService) {}

  // ==================== MASTER EKSTRAKURIKULER ====================

  @Get()
  @ApiOperation({ summary: 'Daftar semua ekstrakurikuler di sekolah' })
  async getAllMaster(@CurrentUser() user: JwtPayload) {
    const data = await this.ekskulService.getAllMasterEkskul(user.sekolah_id);
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Tambah ekstrakurikuler baru - Khusus Admin' })
  async createMaster(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEkstrakurikulerDto,
  ) {
    const data = await this.ekskulService.createMasterEkskul(
      dto,
      user.sekolah_id,
      user.sub,
    );
    return { message: 'Ekstrakurikuler berhasil ditambahkan', data };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Ubah nama ekstrakurikuler - Khusus Admin' })
  async updateMaster(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEkstrakurikulerDto,
  ) {
    const data = await this.ekskulService.updateMasterEkskul(
      id,
      dto,
      user.sekolah_id,
      user.sub,
    );
    return { message: 'Ekstrakurikuler berhasil diperbarui', data };
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Hapus ekstrakurikuler - Khusus Admin' })
  async deleteMaster(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.ekskulService.deleteMasterEkskul(
      id,
      user.sekolah_id,
      user.sub,
    );
    return result;
  }

  // ==================== KEANGGOTAAN / NILAI EKSKUL SISWA ====================

  @Get('siswa/kelas/:kelasId')
  @ApiOperation({ summary: 'Daftar ekstrakurikuler siswa per kelas' })
  @ApiQuery({ name: 'tahun_ajaran_id', required: true })
  async getEkskulSiswaByKelas(
    @CurrentUser() user: JwtPayload,
    @Param('kelasId') kelasId: string,
    @Query('tahun_ajaran_id') tahunAjaranId: string,
  ) {
    const data = await this.ekskulService.getEkskulSiswaByKelas(
      kelasId,
      tahunAjaranId,
      user.sekolah_id,
    );
    return { data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Post('siswa')
  @ApiOperation({ summary: 'Assign / Update ekstrakurikuler siswa' })
  async assignEkskulSiswa(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AssignEkstrakurikulerSiswaDto,
  ) {
    const data = await this.ekskulService.assignEkskulSiswa(
      dto,
      user.sekolah_id,
      user.sub,
      user.role,
    );
    return { message: 'Ekstrakurikuler siswa berhasil disimpan', data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Post('siswa/batch')
  @ApiOperation({ summary: 'Simpan batch ekstrakurikuler siswa' })
  async saveEkskulSiswaBatch(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SaveEkskulSiswaBatchDto,
  ) {
    const result = await this.ekskulService.saveEkskulSiswaBatch(
      dto,
      user.sekolah_id,
      user.sub,
      user.role,
    );
    return result;
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Delete('siswa/:id')
  @ApiOperation({ summary: 'Hapus keanggotaan ekstrakurikuler siswa' })
  async removeEkskulSiswa(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.ekskulService.removeEkskulSiswa(
      id,
      user.sekolah_id,
      user.sub,
      user.role,
    );
    return result;
  }
}
