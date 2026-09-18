import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let auditService: any;

  const mockPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$mockHash';

  beforeEach(async () => {
    prisma = {
      admin: { findFirst: jest.fn() },
      guru: { findFirst: jest.fn() },
      siswa: { findFirst: jest.fn() },
      sesiLogin: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((key, defaultVal) => defaultVal),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('harus melempar UnauthorizedException jika identifier tidak ditemukan', async () => {
      prisma.admin.findFirst.mockResolvedValue(null);
      prisma.guru.findFirst.mockResolvedValue(null);
      prisma.siswa.findFirst.mockResolvedValue(null);

      await expect(
        service.login({
          identifier: 'nonexistent@siswa.sch.id',
          password: 'password123',
          device_info: 'Chrome / Windows',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('harus melempar UnauthorizedException jika password salah', async () => {
      jest.spyOn(argon2, 'verify').mockResolvedValue(false);

      prisma.admin.findFirst.mockResolvedValue(null);
      prisma.guru.findFirst.mockResolvedValue(null);
      prisma.siswa.findFirst.mockResolvedValue({
        id: 'siswa-1',
        nama: 'Budi',
        email: 'budi@siswa.sch.id',
        password: mockPasswordHash,
        sekolah_id: 'sekolah-1',
      });

      await expect(
        service.login({
          identifier: 'budi@siswa.sch.id',
          password: 'wrongpassword',
          device_info: 'Chrome / Windows',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('harus menolak login siswa (ConflictException) jika ada sesi lain yang masih aktif tanpa opsi paksa logout', async () => {
      jest.spyOn(argon2, 'verify').mockResolvedValue(true);

      prisma.admin.findFirst.mockResolvedValue(null);
      prisma.guru.findFirst.mockResolvedValue(null);
      prisma.siswa.findFirst.mockResolvedValue({
        id: 'siswa-1',
        nama: 'Budi',
        email: 'budi@siswa.sch.id',
        password: mockPasswordHash,
        sekolah_id: 'sekolah-1',
        sekolah: { maks_sesi_aktif_siswa: 1 },
      });

      // Ada 1 sesi aktif di perangkat lain
      prisma.sesiLogin.findMany.mockResolvedValue([
        { id: 'sesi-lama', status: 'AKTIF', device_info: 'HP Lama' },
      ]);

      await expect(
        service.login({
          identifier: 'budi@siswa.sch.id',
          password: 'password123',
          device_info: 'HP Baru',
          paksa_logout_sesi_lama: false,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('harus berhasil login dan menonaktifkan sesi lama jika paksa_logout_sesi_lama = true', async () => {
      jest.spyOn(argon2, 'verify').mockResolvedValue(true);
      jest.spyOn(argon2, 'hash').mockResolvedValue('$argon2id$mockHashedRefresh');

      prisma.admin.findFirst.mockResolvedValue(null);
      prisma.guru.findFirst.mockResolvedValue(null);
      prisma.siswa.findFirst.mockResolvedValue({
        id: 'siswa-1',
        nama: 'Budi',
        email: 'budi@siswa.sch.id',
        password: mockPasswordHash,
        sekolah_id: 'sekolah-1',
        sekolah: { maks_sesi_aktif_siswa: 1 },
      });

      prisma.sesiLogin.findMany.mockResolvedValue([
        { id: 'sesi-lama', status: 'AKTIF', device_info: 'HP Lama' },
      ]);

      prisma.sesiLogin.updateMany.mockResolvedValue({ count: 1 });
      prisma.sesiLogin.create.mockResolvedValue({
        id: 'sesi-baru',
        siswa_id: 'siswa-1',
        device_info: 'HP Baru',
        status: 'AKTIF',
      });
      prisma.sesiLogin.update.mockResolvedValue({});

      const result = await service.login({
        identifier: 'budi@siswa.sch.id',
        password: 'password123',
        device_info: 'HP Baru',
        paksa_logout_sesi_lama: true,
      });

      expect(prisma.sesiLogin.updateMany).toHaveBeenCalledWith({
        where: { siswa_id: 'siswa-1', status: 'AKTIF' },
        data: expect.objectContaining({ status: 'LOGOUT' }),
      });
      expect(result.user.email).toBe('budi@siswa.sch.id');
      expect(result.tokens.access_token).toBe('mock-jwt-token');
    });
  });
});
