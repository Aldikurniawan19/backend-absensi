import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh.dto';

interface AccountResult {
  id: string;
  nama: string;
  email: string;
  password: string;
  sekolah_id: string;
  role: UserRole;
  sekolah?: {
    id: string;
    nama: string;
    wajib_gps: boolean;
    maks_sesi_aktif_siswa: number;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Cari akun berdasarkan identifier (Email, NISN, atau NIP) di tiga tabel akun
   */
  private async findAccount(identifier: string): Promise<AccountResult | null> {
    const trimmed = identifier.trim();

    // 1. Cek Admin (Email)
    const admin = await this.prisma.admin.findFirst({
      where: { email: trimmed },
      include: {
        sekolah: {
          select: {
            id: true,
            nama: true,
            wajib_gps: true,
            maks_sesi_aktif_siswa: true,
          },
        },
      },
    });
    if (admin) {
      return {
        id: admin.id,
        nama: admin.nama,
        email: admin.email,
        password: admin.password,
        sekolah_id: admin.sekolah_id,
        role: UserRole.ADMIN,
        sekolah: admin.sekolah,
      };
    }

    // 2. Cek Guru (Email atau NIP)
    const guru = await this.prisma.guru.findFirst({
      where: {
        OR: [{ email: trimmed }, { nip: trimmed }],
      },
      include: {
        sekolah: {
          select: {
            id: true,
            nama: true,
            wajib_gps: true,
            maks_sesi_aktif_siswa: true,
          },
        },
      },
    });
    if (guru) {
      return {
        id: guru.id,
        nama: guru.nama,
        email: guru.email,
        password: guru.password,
        sekolah_id: guru.sekolah_id,
        role: UserRole.GURU,
        sekolah: guru.sekolah,
      };
    }

    // 3. Cek Siswa (Email atau NISN)
    const siswa = await this.prisma.siswa.findFirst({
      where: {
        OR: [{ email: trimmed }, { nisn: trimmed }],
      },
      include: {
        sekolah: {
          select: {
            id: true,
            nama: true,
            wajib_gps: true,
            maks_sesi_aktif_siswa: true,
          },
        },
      },
    });
    if (siswa) {
      return {
        id: siswa.id,
        nama: siswa.nama,
        email: siswa.email,
        password: siswa.password,
        sekolah_id: siswa.sekolah_id,
        role: UserRole.SISWA,
        sekolah: siswa.sekolah,
      };
    }

    return null;
  }

  async login(dto: LoginDto) {
    const account = await this.findAccount(dto.identifier);
    if (!account) {
      throw new UnauthorizedException('Kredensial login tidak cocok');
    }

    // Verifikasi password via argon2
    const passwordMatch = await argon2.verify(account.password, dto.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Kredensial login tidak cocok');
    }

    // Aturan khusus akun SISWA: Cek kuota sesi aktif
    if (account.role === UserRole.SISWA) {
      const maxSessions = account.sekolah?.maks_sesi_aktif_siswa ?? 1;

      const activeSessions = await this.prisma.sesiLogin.findMany({
        where: {
          siswa_id: account.id,
          status: 'AKTIF',
        },
      });

      if (activeSessions.length >= maxSessions) {
        if (!dto.paksa_logout_sesi_lama) {
          throw new ConflictException({
            message:
              'Akun Anda sedang aktif di perangkat lain. Silakan keluar dari perangkat lama atau centang opsi paksa keluar.',
            active_sessions_count: activeSessions.length,
            can_force_logout: true,
          });
        }

        // Jika user memilih paksa logout, nonaktifkan seluruh sesi lama
        await this.prisma.sesiLogin.updateMany({
          where: {
            siswa_id: account.id,
            status: 'AKTIF',
          },
          data: {
            status: 'LOGOUT',
            updatedAt: new Date(),
          },
        });
      }
    }

    // Buat sesi login baru di database (placeholder token refresh)
    const dummyHash = await argon2.hash(Date.now().toString());
    const sesi = await this.prisma.sesiLogin.create({
      data: {
        siswa_id: account.role === UserRole.SISWA ? account.id : null,
        guru_id: account.role === UserRole.GURU ? account.id : null,
        admin_id: account.role === UserRole.ADMIN ? account.id : null,
        device_info: dto.device_info,
        token_refresh: dummyHash,
        status: 'AKTIF',
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(account, sesi.id);

    // Hash dan simpan refresh token asli ke database
    const hashedRefreshToken = await argon2.hash(tokens.refresh_token);
    await this.prisma.sesiLogin.update({
      where: { id: sesi.id },
      data: { token_refresh: hashedRefreshToken },
    });

    // Catat audit log
    await this.auditService.log({
      sekolah_id: account.sekolah_id,
      actor_id: account.id,
      actor_type: account.role,
      action: 'LOGIN',
      resource: 'AUTH',
      details: `Login berhasil dari ${dto.device_info}`,
    });

    return {
      user: {
        id: account.id,
        nama: account.nama,
        email: account.email,
        role: account.role,
        sekolah_id: account.sekolah_id,
        sekolah: account.sekolah,
      },
      tokens,
    };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refresh_token, {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'super-secret-refresh-key-for-sistem-absensi-siswa-2026',
        ),
      });
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid atau kedaluwarsa');
    }

    const sesi = await this.prisma.sesiLogin.findUnique({
      where: { id: payload.sesi_id },
      include: {
        siswa: { select: { id: true, nama: true, email: true, sekolah_id: true } },
        guru: { select: { id: true, nama: true, email: true, sekolah_id: true } },
        admin: { select: { id: true, nama: true, email: true, sekolah_id: true } },
      },
    });

    if (!sesi || sesi.status !== 'AKTIF') {
      throw new UnauthorizedException('Sesi telah berakhir, silakan login kembali');
    }

    const tokenValid = await argon2.verify(sesi.token_refresh, dto.refresh_token);
    if (!tokenValid) {
      throw new UnauthorizedException('Refresh token tidak valid');
    }

    let account: AccountResult;
    if (sesi.siswa) {
      account = {
        id: sesi.siswa.id,
        nama: sesi.siswa.nama,
        email: sesi.siswa.email,
        password: '',
        sekolah_id: sesi.siswa.sekolah_id,
        role: UserRole.SISWA,
      };
    } else if (sesi.guru) {
      account = {
        id: sesi.guru.id,
        nama: sesi.guru.nama,
        email: sesi.guru.email,
        password: '',
        sekolah_id: sesi.guru.sekolah_id,
        role: UserRole.GURU,
      };
    } else if (sesi.admin) {
      account = {
        id: sesi.admin.id,
        nama: sesi.admin.nama,
        email: sesi.admin.email,
        password: '',
        sekolah_id: sesi.admin.sekolah_id,
        role: UserRole.ADMIN,
      };
    } else {
      throw new UnauthorizedException('Akun tidak ditemukan');
    }

    // Refresh token rotation
    const newTokens = await this.generateTokens(account, sesi.id);
    const newHashedRefresh = await argon2.hash(newTokens.refresh_token);

    await this.prisma.sesiLogin.update({
      where: { id: sesi.id },
      data: {
        token_refresh: newHashedRefresh,
        waktu_terakhir_aktif: new Date(),
      },
    });

    return newTokens;
  }

  async logout(sesiId: string, currentUser?: JwtPayload) {
    const sesi = await this.prisma.sesiLogin.findUnique({
      where: { id: sesiId },
    });

    if (sesi) {
      await this.prisma.sesiLogin.update({
        where: { id: sesiId },
        data: {
          status: 'LOGOUT',
          updatedAt: new Date(),
        },
      });

      if (currentUser) {
        await this.auditService.log({
          sekolah_id: currentUser.sekolah_id,
          actor_id: currentUser.sub,
          actor_type: currentUser.role,
          action: 'LOGOUT',
          resource: 'AUTH',
          details: `Logout dari sesi ${sesiId}`,
        });
      }
    }

    return { message: 'Berhasil keluar dari sistem' };
  }

  async getActiveSessions(user: JwtPayload) {
    const where: any = { status: 'AKTIF' };
    if (user.role === UserRole.SISWA) where.siswa_id = user.sub;
    if (user.role === UserRole.GURU) where.guru_id = user.sub;
    if (user.role === UserRole.ADMIN) where.admin_id = user.sub;

    return this.prisma.sesiLogin.findMany({
      where,
      select: {
        id: true,
        device_info: true,
        waktu_login: true,
        waktu_terakhir_aktif: true,
        status: true,
      },
      orderBy: { waktu_login: 'desc' },
    });
  }

  async deleteSession(user: JwtPayload, sesiId: string) {
    const sesi = await this.prisma.sesiLogin.findUnique({
      where: { id: sesiId },
    });

    if (!sesi) {
      throw new NotFoundException('Sesi tidak ditemukan');
    }

    // Verifikasi kepemilikan sesi jika bukan Admin
    if (user.role === UserRole.SISWA && sesi.siswa_id !== user.sub) {
      throw new UnauthorizedException('Anda tidak berhak menghapus sesi ini');
    }
    if (user.role === UserRole.GURU && sesi.guru_id !== user.sub) {
      throw new UnauthorizedException('Anda tidak berhak menghapus sesi ini');
    }

    await this.prisma.sesiLogin.update({
      where: { id: sesiId },
      data: { status: 'LOGOUT' },
    });

    return { message: 'Sesi perangkat berhasil dihentikan' };
  }

  async getMe(user: JwtPayload) {
    if (user.role === UserRole.SISWA) {
      const siswa = await this.prisma.siswa.findUnique({
        where: { id: user.sub },
        select: {
          id: true,
          nama: true,
          nisn: true,
          email: true,
          no_hp_ortu: true,
          sekolah: { select: { id: true, nama: true, wajib_gps: true } },
          riwayat_kelas: {
            include: {
              kelas: {
                include: {
                  jurusan: true,
                  penugasan_wali_kelas: {
                    include: {
                      guru: {
                        select: {
                          id: true,
                          nama: true,
                          nip: true,
                          email: true,
                          no_hp: true,
                        },
                      },
                    },
                  },
                },
              },
              tahun_ajaran: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      return { ...siswa, role: UserRole.SISWA };
    }

    if (user.role === UserRole.GURU) {
      const guru = await this.prisma.guru.findUnique({
        where: { id: user.sub },
        select: {
          id: true,
          nama: true,
          nip: true,
          email: true,
          no_hp: true,
          sekolah: { select: { id: true, nama: true } },
          guru_mapel: {
            include: { mapel: true },
          },
          penugasan_wali_kelas: {
            include: {
              kelas: { include: { jurusan: true } },
              tahun_ajaran: true,
            },
          },
        },
      });
      return { ...guru, role: UserRole.GURU };
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        nama: true,
        email: true,
        sekolah: { select: { id: true, nama: true } },
      },
    });
    return { ...admin, role: UserRole.ADMIN };
  }

  private async generateTokens(account: AccountResult, sesiId: string) {
    const payload: JwtPayload = {
      sub: account.id,
      email: account.email,
      role: account.role,
      sekolah_id: account.sekolah_id,
      nama: account.nama,
      sesi_id: sesiId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>(
        'JWT_SECRET',
        'super-secret-jwt-key-for-sistem-absensi-siswa-2026',
      ),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwtService.sign(
      { sub: account.id, sesi_id: sesiId },
      {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'super-secret-refresh-key-for-sistem-absensi-siswa-2026',
        ),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
      },
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 900, // 15 menit dalam detik
    };
  }
}
