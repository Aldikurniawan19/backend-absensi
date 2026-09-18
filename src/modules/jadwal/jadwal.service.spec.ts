import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JadwalService } from './jadwal.service';

describe('JadwalService (Clash Detection)', () => {
  let service: JadwalService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      jadwalPelajaran: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      tahunAjaran: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JadwalService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<JadwalService>(JadwalService);
  });

  describe('checkClash', () => {
    it('harus mendeteksi bentrok guru jika guru yang sama mengajar di kelas lain pada jam tumpang tindih', async () => {
      // Guru A sudah mengajar di Kelas 10 MIPA 1 jam 07:30 - 09:00
      prisma.jadwalPelajaran.findMany.mockResolvedValue([
        {
          id: 'jadwal-lama',
          guru_id: 'guru-A',
          kelas_id: 'kelas-10-mipa-1',
          mapel_id: 'mapel-mtk',
          hari: 1,
          jam_mulai: '07:30',
          jam_selesai: '09:00',
          guru: { nama: 'Ahmad Fauzi' },
          kelas: { tingkat: 10, nama_rombel: '1', jurusan: { kode: 'MIPA' } },
          mapel: { nama: 'Matematika' },
        },
      ]);

      // Coba input jadwal Guru A di Kelas 10 MIPA 2 pada jam 08:00 - 09:30 (tumpang tindih)
      const result = await service.checkClash(
        {
          guru_id: 'guru-A',
          kelas_id: 'kelas-10-mipa-2',
          mapel_id: 'mapel-mtk',
          hari: 1,
          jam_mulai: '08:00',
          jam_selesai: '09:30',
        },
        'tahun-ajaran-1',
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Bentrok Guru'))).toBe(true);
    });

    it('harus mendeteksi bentrok kelas jika kelas yang sama memiliki 2 jadwal pada jam tumpang tindih', async () => {
      // Kelas 10 MIPA 1 sudah ada pelajaran Fisika jam 07:30 - 09:00 bersama Guru B
      prisma.jadwalPelajaran.findMany.mockResolvedValue([
        {
          id: 'jadwal-lama',
          guru_id: 'guru-B',
          kelas_id: 'kelas-10-mipa-1',
          mapel_id: 'mapel-fisika',
          hari: 1,
          jam_mulai: '07:30',
          jam_selesai: '09:00',
          guru: { nama: 'Siti Rahma' },
          kelas: { tingkat: 10, nama_rombel: '1', jurusan: { kode: 'MIPA' } },
          mapel: { nama: 'Fisika' },
        },
      ]);

      // Coba input jadwal di Kelas 10 MIPA 1 untuk Guru A pada jam 08:30 - 10:00 (tumpang tindih)
      const result = await service.checkClash(
        {
          guru_id: 'guru-A',
          kelas_id: 'kelas-10-mipa-1',
          mapel_id: 'mapel-mtk',
          hari: 1,
          jam_mulai: '08:30',
          jam_selesai: '10:00',
        },
        'tahun-ajaran-1',
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Bentrok Kelas'))).toBe(true);
    });

    it('harus valid jika jam pelajaran tidak saling bertabrakan', async () => {
      // Sesi 1: 07:30 - 09:00
      prisma.jadwalPelajaran.findMany.mockResolvedValue([
        {
          id: 'jadwal-lama',
          guru_id: 'guru-A',
          kelas_id: 'kelas-10-mipa-1',
          mapel_id: 'mapel-mtk',
          hari: 1,
          jam_mulai: '07:30',
          jam_selesai: '09:00',
          guru: { nama: 'Ahmad Fauzi' },
          kelas: { tingkat: 10, nama_rombel: '1', jurusan: { kode: 'MIPA' } },
          mapel: { nama: 'Matematika' },
        },
      ]);

      // Sesi 2: 09:00 - 10:30 (bersambungan rapi, tidak bentrok)
      const result = await service.checkClash(
        {
          guru_id: 'guru-A',
          kelas_id: 'kelas-10-mipa-2',
          mapel_id: 'mapel-mtk',
          hari: 1,
          jam_mulai: '09:00',
          jam_selesai: '10:30',
        },
        'tahun-ajaran-1',
      );

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });
});
