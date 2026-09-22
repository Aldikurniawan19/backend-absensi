import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AbsensiStatus, AbsensiSumber, UserRole } from '@prisma/client';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { hitungJarakMeter } from '../../common/utils/geo.util';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SesiGateway } from '../sesi/sesi.gateway';
import { BulkManualAbsensiDto, ManualAbsensiDto, ScanQrDto } from './dto/absensi.dto';

@Injectable()
export class AbsensiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sesiGateway: SesiGateway,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Memproses data scan QR dari aplikasi mobile siswa
   */
  async scanQr(dto: ScanQrDto, currentUser: JwtPayload) {
    if (currentUser.role !== UserRole.SISWA) {
      throw new ForbiddenException('Hanya siswa yang dapat melakukan scan absensi');
    }

    const siswaId = currentUser.sub;
    const now = new Date();

    // 1. Cari sesi berdasarkan token QR
    const sesi = await this.prisma.sesiAbsensi.findUnique({
      where: { token_qr: dto.token_qr },
      include: {
        jadwal: {
          include: {
            kelas: true,
            mapel: true,
            guru: true,
          },
        },
      },
    });

    if (!sesi) {
      throw new NotFoundException('QR Code tidak valid atau sesi tidak ditemukan');
    }

    // 2. Validasi status dan masa berlaku sesi
    if (sesi.status !== 'BERLANGSUNG') {
      throw new BadRequestException('Sesi absensi ini sudah tidak aktif');
    }

    if (now > new Date(sesi.waktu_exp)) {
      throw new BadRequestException('QR Code sudah kedaluwarsa');
    }

    // 3. Validasi apakah siswa terdaftar di kelas sesi ini
    const isEnrolled = await this.prisma.riwayatKelasSiswa.findFirst({
      where: {
        siswa_id: siswaId,
        kelas_id: sesi.jadwal.kelas_id,
        tahun_ajaran_id: sesi.jadwal.tahun_ajaran_id,
      },
    });

    if (!isEnrolled) {
      throw new ForbiddenException('Anda tidak terdaftar di kelas sesi pelajaran ini');
    }

    // 4. Validasi apakah siswa sudah pernah absen pada sesi ini (mencegah absen ganda)
    const existingAbsen = await this.prisma.absensi.findUnique({
      where: {
        sesi_id_siswa_id: {
          sesi_id: sesi.id,
          siswa_id: siswaId,
        },
      },
    });

    if (existingAbsen) {
      throw new ConflictException('Anda sudah melakukan absensi untuk sesi ini');
    }

    // 5. Validasi Lokasi GPS (jika sekolah mengaktifkan wajib GPS)
    const sekolah = await this.prisma.sekolah.findUnique({
      where: { id: currentUser.sekolah_id },
    });

    if (sekolah?.wajib_gps) {
      if (dto.lokasi_lat === undefined || dto.lokasi_lng === undefined) {
        throw new BadRequestException('Lokasi GPS wajib disertakan untuk melakukan absensi');
      }

      if (sekolah.lat_sekolah && sekolah.lng_sekolah) {
        const jarakMeter = hitungJarakMeter(
          Number(sekolah.lat_sekolah),
          Number(sekolah.lng_sekolah),
          dto.lokasi_lat,
          dto.lokasi_lng,
        );

        if (jarakMeter > sekolah.radius_meter) {
          throw new BadRequestException(
            `Lokasi Anda berada di luar radius sekolah (${Math.round(jarakMeter)} meter dari titik sekolah, maksimal ${sekolah.radius_meter} meter)`,
          );
        }
      }
    }

    // 6. Hitung Status: Hadir vs Terlambat
    // Ambang batas seragam: 10 menit (600.000 ms) dari waktu_mulai sesi
    const waktuMulaiSesi = new Date(sesi.waktu_mulai).getTime();
    const selisihMenit = (now.getTime() - waktuMulaiSesi) / (1000 * 60);

    let statusAbsensi: AbsensiStatus = AbsensiStatus.HADIR;
    if (selisihMenit > 10) {
      statusAbsensi = AbsensiStatus.TERLAMBAT;
    }

    // 7. Simpan absensi
    const absensi = await this.prisma.absensi.create({
      data: {
        sesi_id: sesi.id,
        siswa_id: siswaId,
        waktu_scan: now,
        status: statusAbsensi,
        lokasi_lat: dto.lokasi_lat ? dto.lokasi_lat : null,
        lokasi_lng: dto.lokasi_lng ? dto.lokasi_lng : null,
        sumber: AbsensiSumber.SCAN_QR,
        keterangan:
          statusAbsensi === AbsensiStatus.TERLAMBAT
            ? `Scan terlambat (${Math.round(selisihMenit)} menit setelah sesi dibuka)`
            : 'Scan tepat waktu',
      },
      include: {
        siswa: {
          select: { id: true, nama: true, nisn: true },
        },
      },
    });

    // 8. Push real-time event ke layar guru lewat WebSocket
    this.sesiGateway.emitScanMasuk(sesi.id, {
      id: absensi.id,
      siswa: absensi.siswa,
      waktu_scan: absensi.waktu_scan,
      status: absensi.status,
      keterangan: absensi.keterangan,
    });

    return {
      message:
        statusAbsensi === AbsensiStatus.HADIR
          ? 'Absensi berhasil dicatat (Hadir)'
          : 'Absensi berhasil dicatat (Terlambat)',
      data: absensi,
    };
  }

  /**
   * Absensi manual oleh guru atau admin
   */
  async manualAbsensi(dto: ManualAbsensiDto, currentUser: JwtPayload) {
    const sesi = await this.prisma.sesiAbsensi.findUnique({
      where: { id: dto.sesi_id },
      include: { jadwal: true },
    });

    if (!sesi) throw new NotFoundException('Sesi tidak ditemukan');

    if (currentUser.role === UserRole.GURU && sesi.jadwal.guru_id !== currentUser.sub) {
      throw new ForbiddenException('Anda tidak berhak mengubah absensi sesi ini');
    }

    const absensi = await this.prisma.absensi.upsert({
      where: {
        sesi_id_siswa_id: {
          sesi_id: dto.sesi_id,
          siswa_id: dto.siswa_id,
        },
      },
      create: {
        sesi_id: dto.sesi_id,
        siswa_id: dto.siswa_id,
        status: dto.status,
        waktu_scan: new Date(),
        sumber: AbsensiSumber.MANUAL,
        keterangan: dto.keterangan || `Diubah manual oleh ${currentUser.nama}`,
      },
      update: {
        status: dto.status,
        sumber: AbsensiSumber.MANUAL,
        keterangan: dto.keterangan || `Diubah manual oleh ${currentUser.nama}`,
      },
      include: {
        siswa: { select: { id: true, nama: true, nisn: true } },
      },
    });

    // Audit log pencatatan manual
    await this.auditService.log({
      sekolah_id: currentUser.sekolah_id,
      actor_id: currentUser.sub,
      actor_type: currentUser.role,
      action: 'MANUAL_ATTENDANCE',
      resource: 'ABSENSI',
      resource_id: absensi.id,
      details: `Menandai manual ${absensi.siswa.nama} status ${dto.status} (${dto.keterangan || '-'})`,
    });

    return {
      message: 'Status absensi berhasil disimpan',
      data: absensi,
    };
  }

  /**
   * Absensi manual massal / bulk oleh guru atau admin (disimpan ketika klik tombol Simpan)
   */
  async manualAbsensiBulk(dto: BulkManualAbsensiDto, currentUser: JwtPayload) {
    const sesi = await this.prisma.sesiAbsensi.findUnique({
      where: { id: dto.sesi_id },
      include: { jadwal: true },
    });

    if (!sesi) throw new NotFoundException('Sesi tidak ditemukan');

    if (currentUser.role === UserRole.GURU && sesi.jadwal.guru_id !== currentUser.sub) {
      throw new ForbiddenException('Anda tidak berhak mengubah absensi sesi ini');
    }

    if (!dto.items || dto.items.length === 0) {
      return { message: 'Tidak ada data yang disimpan', total: 0 };
    }

    const now = new Date();
    const defaultKeterangan = `Diubah manual oleh ${currentUser.nama}`;

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.absensi.upsert({
          where: {
            sesi_id_siswa_id: {
              sesi_id: dto.sesi_id,
              siswa_id: item.siswa_id,
            },
          },
          create: {
            sesi_id: dto.sesi_id,
            siswa_id: item.siswa_id,
            status: item.status,
            waktu_scan: now,
            sumber: AbsensiSumber.MANUAL,
            keterangan: item.keterangan || defaultKeterangan,
          },
          update: {
            status: item.status,
            sumber: AbsensiSumber.MANUAL,
            keterangan: item.keterangan || defaultKeterangan,
          },
        }),
      ),
    );

    // Audit log
    await this.auditService.log({
      sekolah_id: currentUser.sekolah_id,
      actor_id: currentUser.sub,
      actor_type: currentUser.role,
      action: 'MANUAL_ATTENDANCE_BULK',
      resource: 'ABSENSI',
      resource_id: dto.sesi_id,
      details: `Menyimpan manual absensi massal untuk ${dto.items.length} siswa pada sesi ${dto.sesi_id}`,
    });

    return {
      message: `Berhasil menyimpan status absensi untuk ${dto.items.length} siswa`,
      total: dto.items.length,
    };
  }


  async getRiwayatSiswa(
    siswaId: string,
    currentUser: JwtPayload,
    page: number = 1,
    limit: number = 20,
  ) {
    // Siswa hanya boleh lihat riwayat sendiri
    if (currentUser.role === UserRole.SISWA && currentUser.sub !== siswaId) {
      throw new ForbiddenException('Anda hanya berhak melihat riwayat absensi diri sendiri');
    }

    const skip = (page - 1) * limit;
    const where = { siswa_id: siswaId };

    const [total, data] = await Promise.all([
      this.prisma.absensi.count({ where }),
      this.prisma.absensi.findMany({
        where,
        skip,
        take: limit,
        include: {
          sesi: {
            include: {
              jadwal: {
                include: {
                  mapel: true,
                  guru: { select: { nama: true } },
                  kelas: { include: { jurusan: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRekapKelas(
    kelasId: string,
    tanggalStr: string,
    currentUser: JwtPayload,
  ) {
    const tanggal = new Date(tanggalStr);
    tanggal.setHours(0, 0, 0, 0);
    const nextDay = new Date(tanggal);
    nextDay.setDate(nextDay.getDate() + 1);

    // Ambil semua sesi di kelas ini pada tanggal tersebut
    const sessions = await this.prisma.sesiAbsensi.findMany({
      where: {
        jadwal: { kelas_id: kelasId },
        createdAt: { gte: tanggal, lt: nextDay },
      },
      include: {
        jadwal: { include: { mapel: true, guru: { select: { nama: true } } } },
        absensi: {
          include: {
            siswa: { select: { id: true, nama: true, nisn: true } },
          },
        },
      },
      orderBy: { waktu_mulai: 'asc' },
    });

    return {
      tanggal: tanggalStr,
      kelas_id: kelasId,
      total_sesi: sessions.length,
      sesi: sessions,
    };
  }
}
