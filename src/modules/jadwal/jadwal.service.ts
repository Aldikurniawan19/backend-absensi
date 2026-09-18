import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isTimeOverlapping } from '../../common/utils/time.util';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateJadwalDto,
  DuplikasiJadwalDto,
  UpdateJadwalDto,
  ValidateJadwalBatchDto,
  ValidateJadwalItemDto,
} from './dto/jadwal.dto';

export interface ClashResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class JadwalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Mesin Validasi Bentrok: Memeriksa bentrok guru dan kelas terhadap basis data
   */
  async checkClash(
    item: ValidateJadwalItemDto,
    tahunAjaranId: string,
    excludeJadwalId?: string,
  ): Promise<ClashResult> {
    const errors: string[] = [];

    // Ambil jadwal pada hari yang sama di tahun ajaran ini
    const existingSchedules = await this.prisma.jadwalPelajaran.findMany({
      where: {
        tahun_ajaran_id: tahunAjaranId,
        hari: item.hari,
        ...(excludeJadwalId ? { id: { not: excludeJadwalId } } : {}),
        OR: [{ guru_id: item.guru_id }, { kelas_id: item.kelas_id }],
      },
      include: {
        guru: { select: { nama: true } },
        kelas: {
          select: {
            tingkat: true,
            nama_rombel: true,
            jurusan: { select: { kode: true } },
          },
        },
        mapel: { select: { nama: true } },
      },
    });

    for (const ex of existingSchedules) {
      const overlap = isTimeOverlapping(
        item.jam_mulai,
        item.jam_selesai,
        ex.jam_mulai,
        ex.jam_selesai,
      );

      if (overlap) {
        // 1. Cek bentrok guru
        if (ex.guru_id === item.guru_id) {
          const kelasName = `${ex.kelas.tingkat} ${ex.kelas.jurusan.kode} ${ex.kelas.nama_rombel}`;
          errors.push(
            `Bentrok Guru: ${ex.guru.nama} sudah memiliki jadwal mengajar ${ex.mapel.nama} di kelas ${kelasName} pada jam ${ex.jam_mulai} - ${ex.jam_selesai}`,
          );
        }

        // 2. Cek bentrok kelas
        if (ex.kelas_id === item.kelas_id) {
          const kelasName = `${ex.kelas.tingkat} ${ex.kelas.jurusan.kode} ${ex.kelas.nama_rombel}`;
          errors.push(
            `Bentrok Kelas: Kelas ${kelasName} sudah memiliki jadwal ${ex.mapel.nama} bersama ${ex.guru.nama} pada jam ${ex.jam_mulai} - ${ex.jam_selesai}`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validasi batch jadwal (berguna untuk editor grid dan import spreadsheet)
   */
  async validateBatch(dto: ValidateJadwalBatchDto): Promise<ClashResult> {
    const allErrors: string[] = [];

    // 1. Cek bentrok internal dalam payload batch
    for (let i = 0; i < dto.items.length; i++) {
      for (let j = i + 1; j < dto.items.length; j++) {
        const a = dto.items[i];
        const b = dto.items[j];

        if (a.hari === b.hari && isTimeOverlapping(a.jam_mulai, a.jam_selesai, b.jam_mulai, b.jam_selesai)) {
          if (a.guru_id === b.guru_id) {
            allErrors.push(
              `Bentrok internal pada daftar: Guru yang sama dijadwalkan pada hari ${a.hari} jam ${a.jam_mulai}-${a.jam_selesai} dan ${b.jam_mulai}-${b.jam_selesai}`,
            );
          }
          if (a.kelas_id === b.kelas_id) {
            allErrors.push(
              `Bentrok internal pada daftar: Kelas yang sama memiliki 2 mapel pada hari ${a.hari} jam ${a.jam_mulai}-${a.jam_selesai} dan ${b.jam_mulai}-${b.jam_selesai}`,
            );
          }
        }
      }
    }

    // 2. Cek setiap item ke database
    for (const item of dto.items) {
      const clash = await this.checkClash(item, dto.tahun_ajaran_id);
      if (!clash.valid) {
        allErrors.push(...clash.errors);
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: Array.from(new Set(allErrors)),
    };
  }

  async createJadwal(dto: CreateJadwalDto, actorId: string) {
    // Validasi bentrok sebelum membuat
    const clash = await this.checkClash(
      {
        kelas_id: dto.kelas_id,
        guru_id: dto.guru_id,
        mapel_id: dto.mapel_id,
        hari: dto.hari,
        jam_mulai: dto.jam_mulai,
        jam_selesai: dto.jam_selesai,
      },
      dto.tahun_ajaran_id,
    );

    if (!clash.valid) {
      throw new BadRequestException({
        message: 'Jadwal bentrok dengan jadwal yang sudah ada',
        errors: clash.errors,
      });
    }

    const created = await this.prisma.jadwalPelajaran.create({
      data: dto,
      include: {
        kelas: { include: { jurusan: true } },
        guru: true,
        mapel: true,
      },
    });

    await this.auditService.log({
      sekolah_id: created.guru.sekolah_id,
      actor_id: actorId,
      actor_type: 'ADMIN',
      action: 'CREATE',
      resource: 'JADWAL',
      resource_id: created.id,
      details: `Membuat jadwal ${created.mapel.nama} di kelas ${created.kelas.tingkat} hari ${created.hari}`,
    });

    return created;
  }

  async createJadwalBulk(
    dto: {
      tahun_ajaran_id: string;
      items: Array<{
        kelas_id: string;
        mapel_id: string;
        guru_id: string;
        hari: number;
        jam_mulai: string;
        jam_selesai: string;
      }>;
    },
    actorId: string,
    sekolahId: string,
  ) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Tidak ada data jadwal yang dapat diimpor');
    }

    // 1. Validasi bentrok
    const clashResult = await this.validateBatch({
      tahun_ajaran_id: dto.tahun_ajaran_id,
      items: dto.items,
    });

    if (!clashResult.valid) {
      throw new BadRequestException({
        message: 'Beberapa jadwal mengalami bentrok waktu dan tidak dapat disimpan',
        errors: clashResult.errors,
      });
    }

    // 2. Simpan secara batch
    const dataToCreate = dto.items.map((item) => ({
      tahun_ajaran_id: dto.tahun_ajaran_id,
      kelas_id: item.kelas_id,
      mapel_id: item.mapel_id,
      guru_id: item.guru_id,
      hari: Number(item.hari),
      jam_mulai: item.jam_mulai,
      jam_selesai: item.jam_selesai,
    }));

    const created = await this.prisma.jadwalPelajaran.createMany({
      data: dataToCreate,
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: 'ADMIN',
      action: 'CREATE',
      resource: 'JADWAL',
      details: `Mengimpor ${created.count} jadwal pelajaran secara batch dari file spreadsheet`,
    });

    return created;
  }

  async updateJadwal(id: string, dto: UpdateJadwalDto, actorId: string) {
    const existing = await this.prisma.jadwalPelajaran.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Jadwal tidak ditemukan');

    const checkData: ValidateJadwalItemDto = {
      kelas_id: dto.kelas_id || existing.kelas_id,
      guru_id: dto.guru_id || existing.guru_id,
      mapel_id: dto.mapel_id || existing.mapel_id,
      hari: dto.hari !== undefined ? dto.hari : existing.hari,
      jam_mulai: dto.jam_mulai || existing.jam_mulai,
      jam_selesai: dto.jam_selesai || existing.jam_selesai,
    };

    const clash = await this.checkClash(checkData, existing.tahun_ajaran_id, id);
    if (!clash.valid) {
      throw new BadRequestException({
        message: 'Perubahan jadwal bentrok dengan jadwal lain',
        errors: clash.errors,
      });
    }

    const updated = await this.prisma.jadwalPelajaran.update({
      where: { id },
      data: dto,
      include: {
        kelas: { include: { jurusan: true } },
        guru: true,
        mapel: true,
      },
    });

    await this.auditService.log({
      sekolah_id: updated.guru.sekolah_id,
      actor_id: actorId,
      actor_type: 'ADMIN',
      action: 'UPDATE',
      resource: 'JADWAL',
      resource_id: id,
      details: `Mengubah jadwal ${updated.mapel.nama}`,
    });

    return updated;
  }

  async getJadwalList(tahunAjaranId: string, kelasId?: string, guruId?: string, hari?: number) {
    const where: any = { tahun_ajaran_id: tahunAjaranId };
    if (kelasId) where.kelas_id = kelasId;
    if (guruId) where.guru_id = guruId;
    if (hari) where.hari = hari;

    return this.prisma.jadwalPelajaran.findMany({
      where,
      include: {
        kelas: { include: { jurusan: true } },
        guru: { select: { id: true, nama: true, nip: true, email: true } },
        mapel: true,
      },
      orderBy: [{ hari: 'asc' }, { jam_mulai: 'asc' }],
    });
  }

  async getJadwalHariIni(guruId: string, customHari?: number) {
    // Cari tahun ajaran yang aktif untuk sekolah guru ini
    const guru = await this.prisma.guru.findUnique({
      where: { id: guruId },
      select: { sekolah_id: true },
    });
    if (!guru) throw new NotFoundException('Guru tidak ditemukan');

    const tahunAktif = await this.prisma.tahunAjaran.findFirst({
      where: { sekolah_id: guru.sekolah_id, status: 'AKTIF' },
    });
    if (!tahunAktif) {
      return [];
    }

    // Hari dalam JavaScript: 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    // Konversi ke format sistem: 1 = Senin, 2 = Selasa, ..., 7 = Minggu
    const jsDay = new Date().getDay();
    const systemDay = customHari ? Number(customHari) : (jsDay === 0 ? 7 : jsDay);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const schedules = await this.prisma.jadwalPelajaran.findMany({
      where: {
        guru_id: guruId,
        tahun_ajaran_id: tahunAktif.id,
        hari: systemDay,
      },
      include: {
        kelas: { include: { jurusan: true } },
        mapel: true,
        sesi_absensi: {
          where: {
            createdAt: { gte: startOfToday, lte: endOfToday },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { jam_mulai: 'asc' },
    });

    return schedules.map((s) => ({
      ...s,
      nama_kelas_lengkap: `${s.kelas.tingkat} ${s.kelas.jurusan.kode} ${s.kelas.nama_rombel}`,
      sesi_hari_ini: s.sesi_absensi[0] || null,
    }));
  }

  async getJadwalGuruSemua(guruId: string) {
    const guru = await this.prisma.guru.findUnique({
      where: { id: guruId },
      select: { sekolah_id: true },
    });
    if (!guru) throw new NotFoundException('Guru tidak ditemukan');

    const tahunAktif = await this.prisma.tahunAjaran.findFirst({
      where: { sekolah_id: guru.sekolah_id, status: 'AKTIF' },
    });
    if (!tahunAktif) {
      return [];
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const schedules = await this.prisma.jadwalPelajaran.findMany({
      where: {
        guru_id: guruId,
        tahun_ajaran_id: tahunAktif.id,
      },
      include: {
        kelas: { include: { jurusan: true } },
        mapel: true,
        sesi_absensi: {
          where: {
            createdAt: { gte: startOfToday, lte: endOfToday },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ hari: 'asc' }, { jam_mulai: 'asc' }],
    });

    return schedules.map((s) => ({
      ...s,
      nama_kelas_lengkap: `${s.kelas.tingkat} ${s.kelas.jurusan.kode} ${s.kelas.nama_rombel}`,
      sesi_hari_ini: s.sesi_absensi[0] || null,
    }));
  }

  async duplikasiJadwal(
    targetTahunAjaranId: string,
    dto: DuplikasiJadwalDto,
    actorId: string,
  ) {
    const sumberJadwal = await this.prisma.jadwalPelajaran.findMany({
      where: { tahun_ajaran_id: dto.sumber_tahun_ajaran_id },
    });

    if (sumberJadwal.length === 0) {
      throw new BadRequestException('Tahun ajaran sumber tidak memiliki jadwal untuk diduplikasi');
    }

    return this.prisma.$transaction(async (tx) => {
      // Hapus jadwal target yang sudah ada jika ada draft sebelumnya
      await tx.jadwalPelajaran.deleteMany({
        where: { tahun_ajaran_id: targetTahunAjaranId },
      });

      // Duplikasi seluruh baris jadwal
      await tx.jadwalPelajaran.createMany({
        data: sumberJadwal.map((j) => ({
          kelas_id: j.kelas_id,
          guru_id: j.guru_id,
          mapel_id: j.mapel_id,
          tahun_ajaran_id: targetTahunAjaranId,
          hari: j.hari,
          jam_mulai: j.jam_mulai,
          jam_selesai: j.jam_selesai,
        })),
      });

      const targetTA = await tx.tahunAjaran.findUnique({
        where: { id: targetTahunAjaranId },
      });

      if (targetTA) {
        await this.auditService.log({
          sekolah_id: targetTA.sekolah_id,
          actor_id: actorId,
          actor_type: 'ADMIN',
          action: 'DUPLICATE_SCHEDULE',
          resource: 'JADWAL',
          resource_id: targetTahunAjaranId,
          details: `Menduplikasi ${sumberJadwal.length} baris jadwal dari tahun ajaran sumber`,
        });
      }

      return {
        message: `Berhasil menduplikasi ${sumberJadwal.length} jadwal pelajaran`,
        total_duplicated: sumberJadwal.length,
      };
    });
  }

  async deleteJadwal(id: string) {
    return this.prisma.jadwalPelajaran.delete({ where: { id } });
  }
}
