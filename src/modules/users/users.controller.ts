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
  AssignKelasSiswaDto,
  AssignWaliKelasDto,
  CreateAdminDto,
  CreateGuruDto,
  CreateSiswaDto,
  UpdateAdminDto,
  UpdateGuruDto,
  UpdateSiswaDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('Manajemen Pengguna (Siswa, Guru, Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ==================== SISWA ====================
  @Get('siswa')
  @ApiOperation({ summary: 'Daftar data siswa dengan paginasi dan filter' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'kelas_id', required: false })
  @ApiQuery({ name: 'tahun_ajaran_id', required: false })
  async getSiswaList(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('kelas_id') kelasId?: string,
    @Query('tahun_ajaran_id') tahunAjaranId?: string,
  ) {
    const result = await this.usersService.getSiswaList(
      user.sekolah_id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      search,
      kelasId,
      tahunAjaranId,
    );
    return result;
  }

  @Get('siswa/:id')
  @ApiOperation({ summary: 'Detail siswa berdasarkan ID' })
  async getSiswaById(@Param('id') id: string) {
    const data = await this.usersService.getSiswaById(id);
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Post('siswa')
  @ApiOperation({ summary: 'Tambah siswa baru - Khusus Admin' })
  async createSiswa(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSiswaDto,
  ) {
    const data = await this.usersService.createSiswa(
      user.sekolah_id,
      dto,
      user.sub,
    );
    return { message: 'Siswa berhasil ditambahkan', data };
  }

  @Roles(UserRole.ADMIN)
  @Patch('siswa/:id')
  @ApiOperation({ summary: 'Ubah data siswa - Khusus Admin' })
  async updateSiswa(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSiswaDto,
  ) {
    const data = await this.usersService.updateSiswa(id, dto, user.sub);
    return { message: 'Data siswa berhasil diperbarui', data };
  }

  @Roles(UserRole.ADMIN)
  @Post('siswa/assign-kelas')
  @ApiOperation({ summary: 'Daftarkan siswa ke kelas pada tahun ajaran tertentu' })
  async assignKelasSiswa(@Body() dto: AssignKelasSiswaDto) {
    const data = await this.usersService.assignKelasSiswa(dto);
    return { message: 'Siswa berhasil didaftarkan ke kelas', data };
  }

  @Roles(UserRole.ADMIN)
  @Delete('siswa/:id')
  @ApiOperation({ summary: 'Hapus data siswa - Khusus Admin' })
  async deleteSiswa(@Param('id') id: string) {
    await this.usersService.deleteSiswa(id);
    return { message: 'Data siswa berhasil dihapus' };
  }

  // ==================== GURU ====================
  @Get('guru')
  @ApiOperation({ summary: 'Daftar data guru dengan paginasi dan pencarian' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getGuruList(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    const result = await this.usersService.getGuruList(
      user.sekolah_id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      search,
    );
    return result;
  }

  @Get('guru/:id')
  @ApiOperation({ summary: 'Detail guru berdasarkan ID' })
  async getGuruById(@Param('id') id: string) {
    const data = await this.usersService.getGuruById(id);
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Post('guru')
  @ApiOperation({ summary: 'Tambah guru baru - Khusus Admin' })
  async createGuru(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateGuruDto,
  ) {
    const data = await this.usersService.createGuru(
      user.sekolah_id,
      dto,
      user.sub,
    );
    return { message: 'Guru berhasil ditambahkan', data };
  }

  @Roles(UserRole.ADMIN)
  @Patch('guru/:id')
  @ApiOperation({ summary: 'Ubah data guru & mapel yang diampu - Khusus Admin' })
  async updateGuru(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateGuruDto,
  ) {
    const data = await this.usersService.updateGuru(id, dto, user.sub);
    return { message: 'Data guru berhasil diperbarui', data };
  }

  @Roles(UserRole.ADMIN)
  @Post('guru/assign-wali-kelas')
  @ApiOperation({ summary: 'Tugaskan guru sebagai wali kelas pada tahun ajaran tertentu' })
  async assignWaliKelas(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AssignWaliKelasDto,
  ) {
    const data = await this.usersService.assignWaliKelas(dto, user.sub);
    return { message: 'Penugasan wali kelas berhasil disimpan', data };
  }

  @Roles(UserRole.ADMIN)
  @Delete('guru/:id')
  @ApiOperation({ summary: 'Hapus data guru - Khusus Admin' })
  async deleteGuru(@Param('id') id: string) {
    await this.usersService.deleteGuru(id);
    return { message: 'Data guru berhasil dihapus' };
  }

  // ==================== ADMIN ====================
  @Roles(UserRole.ADMIN)
  @Get('admin')
  @ApiOperation({ summary: 'Daftar admin sekolah' })
  async getAdminList(@CurrentUser() user: JwtPayload) {
    const data = await this.usersService.getAdminList(user.sekolah_id);
    return { data };
  }

  @Roles(UserRole.ADMIN)
  @Post('admin')
  @ApiOperation({ summary: 'Tambah admin baru' })
  async createAdmin(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAdminDto,
  ) {
    const data = await this.usersService.createAdmin(
      user.sekolah_id,
      dto,
      user.sub,
    );
    return { message: 'Admin berhasil ditambahkan', data };
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/:id')
  @ApiOperation({ summary: 'Ubah data admin' })
  async updateAdmin(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
  ) {
    const data = await this.usersService.updateAdmin(id, dto, user.sub);
    return { message: 'Data admin berhasil diperbarui', data };
  }

  @Roles(UserRole.ADMIN)
  @Delete('admin/:id')
  @ApiOperation({ summary: 'Hapus admin' })
  async deleteAdmin(@Param('id') id: string) {
    await this.usersService.deleteAdmin(id);
    return { message: 'Admin berhasil dihapus' };
  }
}
