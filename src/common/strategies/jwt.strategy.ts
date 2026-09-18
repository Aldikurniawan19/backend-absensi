import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';
import { JwtPayload } from '../decorators/current-user.decorator';

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

    // Validasi apakah akun pengguna masih ada di database
    let userExists = false;
    if (payload.role === 'ADMIN') {
      const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub } });
      userExists = !!admin;
    } else if (payload.role === 'GURU') {
      const guru = await this.prisma.guru.findUnique({ where: { id: payload.sub } });
      userExists = !!guru;
    } else if (payload.role === 'SISWA') {
      const siswa = await this.prisma.siswa.findUnique({ where: { id: payload.sub } });
      userExists = !!siswa;
    }

    if (!userExists) {
      throw new UnauthorizedException('Sesi telah kedaluwarsa atau basis data diperbarui. Silakan login kembali.');
    }

    return payload;
  }
}

