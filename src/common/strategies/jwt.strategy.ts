import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';
import { JwtPayload } from '../decorators/current-user.decorator';

// Cache in-memory untuk validasi user agar tidak query DB di setiap request (TTL 60 detik)
const userValidationCache = new Map<string, { exists: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 detik
const MAX_CACHE_SIZE = 5000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'super-secret-jwt-key-for-sistem-absensi-siswa-2026',
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload || !payload.sub || !payload.role) {
      throw new UnauthorizedException('Token autentikasi tidak valid');
    }

    const cacheKey = `${payload.role}:${payload.sub}`;
    const now = Date.now();
    const cached = userValidationCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      if (!cached.exists) {
        throw new UnauthorizedException('Sesi telah kedaluwarsa atau akun tidak ditemukan.');
      }
      return payload;
    }

    // Validasi apakah akun pengguna masih ada di database dengan proyeksi field minimal (hanya id)
    let userExists = false;
    if (payload.role === 'ADMIN') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      userExists = !!admin;
    } else if (payload.role === 'GURU') {
      const guru = await this.prisma.guru.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      userExists = !!guru;
    } else if (payload.role === 'SISWA') {
      const siswa = await this.prisma.siswa.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      userExists = !!siswa;
    }

    // Cegah memory leak dengan membatasi ukuran cache
    if (userValidationCache.size > MAX_CACHE_SIZE) {
      userValidationCache.clear();
    }

    userValidationCache.set(cacheKey, {
      exists: userExists,
      expiresAt: now + CACHE_TTL_MS,
    });

    if (!userExists) {
      throw new UnauthorizedException('Sesi telah kedaluwarsa atau basis data diperbarui. Silakan login kembali.');
    }

    return payload;
  }
}


