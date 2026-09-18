import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh.dto';

@ApiTags('Autentikasi & Sesi')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login Siswa, Guru, atau Admin',
    description:
      'Login multi-role menggunakan NISN (siswa), NIP (guru), atau Email. Untuk siswa, jika sudah ada sesi aktif di perangkat lain, request akan ditolak (409) kecuali flag paksa_logout_sesi_lama diaktifkan.',
  })
  @ApiResponse({ status: 200, description: 'Login berhasil' })
  @ApiResponse({ status: 401, description: 'Kredensial tidak valid' })
  @ApiResponse({ status: 409, description: 'Sesi aktif di perangkat lain' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      message: 'Login berhasil',
      data: result,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perpanjang Access Token menggunakan Refresh Token' })
  @ApiResponse({ status: 200, description: 'Token berhasil diperpanjang' })
  @ApiResponse({ status: 401, description: 'Refresh token tidak valid atau kedaluwarsa' })
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refreshTokens(dto);
    return {
      message: 'Token berhasil diperbarui',
      data: tokens,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Keluar dari sesi saat ini' })
  async logout(@CurrentUser() user: JwtPayload) {
    if (user.sesi_id) {
      await this.authService.logout(user.sesi_id, user);
    }
    return { message: 'Berhasil keluar dari sistem' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Ambil profil akun yang sedang aktif' })
  async getMe(@CurrentUser() user: JwtPayload) {
    const profile = await this.authService.getMe(user);
    return {
      message: 'Profil berhasil diambil',
      data: profile,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('sesi')
  @ApiOperation({ summary: 'Lihat daftar sesi / perangkat aktif akun sendiri' })
  async getActiveSessions(@CurrentUser() user: JwtPayload) {
    const sessions = await this.authService.getActiveSessions(user);
    return {
      message: 'Daftar sesi aktif berhasil diambil',
      data: sessions,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('sesi/:id')
  @ApiOperation({ summary: 'Hentikan sesi aktif di perangkat tertentu secara paksa' })
  async deleteSession(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.authService.deleteSession(user, id);
    return result;
  }
}
