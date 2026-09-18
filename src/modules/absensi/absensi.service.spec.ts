import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AbsensiStatus, UserRole } from '@prisma/client';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SesiGateway } from '../sesi/sesi.gateway';
import { AbsensiService } from './absensi.service';

describe('AbsensiService', () => {
  let service: AbsensiService;
  let prisma: any;
  let sesiGateway: any;
  let auditService: any;

  const mockUser: JwtPayload = {
    sub: 'siswa-1',
    nama: 'Budi Santoso',
    email: 'budi@siswa.sch.id',
    role: UserRole.SISWA,
    sekolah_id: 'sekolah-1',
  };

  beforeEach(async () => {
    prisma = {
      sesiAbsensi: { findUnique: jest.fn() },
      riwayatKelasSiswa: { findFirst: jest.fn() },
      absensi: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      sekolah: { findUnique: jest.fn() },
    };

    sesiGateway = {
      emitScanMasuk: jest.fn(),
    };

    auditService = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbsensiService,
        { provide: PrismaService, useValue: prisma },
        { provide: SesiGateway, useValue: sesiGateway },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AbsensiService>(AbsensiService);
  });

  describe('scanQr', () => {
    it('harus mencatat kehadiran sebagai HADIR jika scan dilakukan dalam batas 10 menit', async () => {
      const waktuMulai = new Date(Date.now() - 5 * 60 * 1000); // 5 menit yang lalu
      const waktuExp = new Date(Date.now() + 10 * 60 * 1000); // 10 menit ke depan

      prisma.sesiAbsensi.findUnique.mockResolvedValue({
        id: 'sesi-1',
        token_qr: 'valid-token',
        status: 'BERLANGSUNG',
        waktu_mulai: waktuMulai,
        waktu_exp: waktuExp,
        jadwal: {
          kelas_id: 'kelas-10-mipa-1',
          tahun_ajaran_id: 'ta-1',
        },
      });

      prisma.riwayatKelasSiswa.findFirst.mockResolvedValue({
        id: 'riwayat-1',
        siswa_id: 'siswa-1',
        kelas_id: 'kelas-10-mipa-1',
      });

      prisma.absensi.findUnique.mockResolvedValue(null);
      prisma.sekolah.findUnique.mockResolvedValue({ wajib_gps: false });

      prisma.absensi.create.mockImplementation((args: any) => ({
        id: 'absen-1',
        ...args.data,
        siswa: { id: 'siswa-1', nama: 'Budi Santoso', nisn: '0051234567' },
      }));

      const result = await service.scanQr(
        { token_qr: 'valid-token' },
        mockUser,
      );

      expect(result.data.status).toBe(AbsensiStatus.HADIR);
      expect(sesiGateway.emitScanMasuk).toHaveBeenCalled();
    });

    it('harus mencatat kehadiran sebagai TERLAMBAT jika scan dilakukan setelah 10 menit', async () => {
      const waktuMulai = new Date(Date.now() - 15 * 60 * 1000); // 15 menit yang lalu (lewat 10 menit)
      const waktuExp = new Date(Date.now() + 5 * 60 * 1000); // masih aktif

      prisma.sesiAbsensi.findUnique.mockResolvedValue({
        id: 'sesi-1',
        token_qr: 'valid-token',
        status: 'BERLANGSUNG',
        waktu_mulai: waktuMulai,
        waktu_exp: waktuExp,
        jadwal: {
          kelas_id: 'kelas-10-mipa-1',
          tahun_ajaran_id: 'ta-1',
        },
      });

      prisma.riwayatKelasSiswa.findFirst.mockResolvedValue({
        id: 'riwayat-1',
        siswa_id: 'siswa-1',
        kelas_id: 'kelas-10-mipa-1',
      });

      prisma.absensi.findUnique.mockResolvedValue(null);
      prisma.sekolah.findUnique.mockResolvedValue({ wajib_gps: false });

      prisma.absensi.create.mockImplementation((args: any) => ({
        id: 'absen-1',
        ...args.data,
        siswa: { id: 'siswa-1', nama: 'Budi Santoso', nisn: '0051234567' },
      }));

      const result = await service.scanQr(
        { token_qr: 'valid-token' },
        mockUser,
      );

      expect(result.data.status).toBe(AbsensiStatus.TERLAMBAT);
    });

    it('harus melempar ConflictException jika siswa mencoba absen ulang pada sesi yang sama', async () => {
      prisma.sesiAbsensi.findUnique.mockResolvedValue({
        id: 'sesi-1',
        token_qr: 'valid-token',
        status: 'BERLANGSUNG',
        waktu_mulai: new Date(),
        waktu_exp: new Date(Date.now() + 10 * 60 * 1000),
        jadwal: {
          kelas_id: 'kelas-10-mipa-1',
          tahun_ajaran_id: 'ta-1',
        },
      });

      prisma.riwayatKelasSiswa.findFirst.mockResolvedValue({ id: 'riwayat-1' });

      // Sudah ada record absen sebelumnya
      prisma.absensi.findUnique.mockResolvedValue({
        id: 'absen-lama',
        sesi_id: 'sesi-1',
        siswa_id: 'siswa-1',
      });

      await expect(
        service.scanQr({ token_qr: 'valid-token' }, mockUser),
      ).rejects.toThrow(ConflictException);
    });

    it('harus melempar ForbiddenException jika siswa tidak terdaftar di kelas sesi ini', async () => {
      prisma.sesiAbsensi.findUnique.mockResolvedValue({
        id: 'sesi-1',
        token_qr: 'valid-token',
        status: 'BERLANGSUNG',
        waktu_mulai: new Date(),
        waktu_exp: new Date(Date.now() + 10 * 60 * 1000),
        jadwal: {
          kelas_id: 'kelas-10-mipa-1',
          tahun_ajaran_id: 'ta-1',
        },
      });

      // Siswa tidak terdaftar di kelas 10 MIPA 1
      prisma.riwayatKelasSiswa.findFirst.mockResolvedValue(null);

      await expect(
        service.scanQr({ token_qr: 'valid-token' }, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
