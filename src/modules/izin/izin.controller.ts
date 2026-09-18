import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';

const getUploadDir = () => {
  const dir =
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? path.join('/tmp', 'uploads', 'izin')
      : path.join(process.cwd(), 'uploads', 'izin');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // Diabaikan jika filesystem readonly
  }
  return dir;
};
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApproveIzinDto, CreateIzinDto } from './dto/izin.dto';
import { IzinService } from './izin.service';

@ApiTags('Pengajuan Izin / Sakit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('izin')
export class IzinController {
  constructor(private readonly izinService: IzinService) {}

  @Roles(UserRole.SISWA)
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file_bukti', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = getUploadDir();
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `bukti-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  @ApiOperation({
    summary: 'Ajukan izin atau sakit beserta unggahan surat/bukti (khusus Siswa)',
  })
  async ajukanIzin(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateIzinDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const data = await this.izinService.ajukanIzin(
      dto,
      user,
      file ? `/uploads/izin/${file.filename}` : undefined,
    );
    return { message: 'Pengajuan izin berhasil dikirim', data };
  }

  @Roles(UserRole.SISWA)
  @Get('riwayat')
  @ApiOperation({ summary: 'Lihat riwayat pengajuan izin milik sendiri' })
  async getRiwayatSendiri(@CurrentUser() user: JwtPayload) {
    const data = await this.izinService.getIzinListSiswa(user.sub, user);
    return { data };
  }

  @Get('siswa/:id')
  @ApiOperation({ summary: 'Lihat riwayat pengajuan izin siswa tertentu' })
  async getIzinListSiswa(
    @CurrentUser() user: JwtPayload,
    @Param('id') siswaId: string,
  ) {
    const data = await this.izinService.getIzinListSiswa(siswaId, user);
    return { data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Get('pending')
  @ApiOperation({
    summary: 'Daftar pengajuan izin berstatus PENDING (Wali kelas untuk kelasnya, Admin untuk seluruh sekolah)',
  })
  async getPendingIzin(@CurrentUser() user: JwtPayload) {
    const data = await this.izinService.getPendingIzin(user);
    return { data };
  }

  @Roles(UserRole.GURU, UserRole.ADMIN)
  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Setujui atau tolak pengajuan izin (Wali kelas atau Admin)',
  })
  async approveIzin(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ApproveIzinDto,
  ) {
    const result = await this.izinService.approveIzin(id, dto, user);
    return result;
  }
}
