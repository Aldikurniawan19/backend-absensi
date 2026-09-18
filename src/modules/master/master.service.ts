import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TahunAjaranStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateJurusanDto,
  CreateKelasDto,
  CreateMapelDto,
  CreateTahunAjaranDto,
  UpdateJurusanDto,
  UpdateKelasDto,
  UpdateMapelDto,
  UpdateSekolahDto,
  UpdateTahunAjaranDto,
} from './dto/master.dto';

@Injectable()
export class MasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ==================== SEKOLAH ====================
  async getSekolah(sekolahId: string) {
    const sekolah = await this.prisma.sekolah.findUnique({
      where: { id: sekolahId },
    });
    if (!sekolah) throw new NotFoundException('Data sekolah tidak ditemukan');
    return sekolah;
  }

  async updateSekolah(sekolahId: string, dto: UpdateSekolahDto, actorId: string) {
    const updated = await this.prisma.sekolah.update({
      where: { id: sekolahId },
      data: dto,
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: 'ADMIN',
      action: 'UPDATE',
      resource: 'SEKOLAH',
      resource_id: sekolahId,
      details: 'Memperbarui konfigurasi sekolah',
    });

    return updated;
  }

  // ==================== TAHUN AJARAN ====================
  async getTahunAjaranList(sekolahId: string) {
    return this.prisma.tahunAjaran.findMany({
      where: { sekolah_id: sekolahId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTahunAjaranAktif(sekolahId: string) {
    return this.prisma.tahunAjaran.findFirst({
      where: { sekolah_id: sekolahId, status: TahunAjaranStatus.AKTIF },
    });
  }

  async createTahunAjaran(sekolahId: string, dto: CreateTahunAjaranDto, actorId: string) {
    const created = await this.prisma.tahunAjaran.create({
      data: {
        sekolah_id: sekolahId,
        nama: dto.nama,
        semester: dto.semester,
        tanggal_mulai: new Date(dto.tanggal_mulai),
        tanggal_selesai: new Date(dto.tanggal_selesai),
        status: dto.status || TahunAjaranStatus.DRAFT,
      },
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: 'ADMIN',
      action: 'CREATE',
      resource: 'TAHUN_AJARAN',
      resource_id: created.id,
      details: `Menambahkan tahun ajaran ${created.nama} ${created.semester}`,
    });

    return created;
  }

  async updateTahunAjaran(id: string, dto: UpdateTahunAjaranDto, actorId: string) {
    const data: any = { ...dto };
    if (dto.tanggal_mulai) data.tanggal_mulai = new Date(dto.tanggal_mulai);
    if (dto.tanggal_selesai) data.tanggal_selesai = new Date(dto.tanggal_selesai);

    const updated = await this.prisma.tahunAjaran.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      sekolah_id: updated.sekolah_id,
      actor_id: actorId,
      actor_type: 'ADMIN',
      action: 'UPDATE',
      resource: 'TAHUN_AJARAN',
      resource_id: id,
      details: `Memperbarui tahun ajaran ${updated.nama} ${updated.semester}`,
    });

    return updated;
  }

  async aktifkanTahunAjaran(id: string, sekolahId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Nonaktifkan tahun ajaran aktif lainnya di sekolah ini
      await tx.tahunAjaran.updateMany({
        where: {
          sekolah_id: sekolahId,
          status: TahunAjaranStatus.AKTIF,
        },
        data: { status: TahunAjaranStatus.NONAKTIF },
      });

      // 2. Aktifkan tahun ajaran target
      const activated = await tx.tahunAjaran.update({
        where: { id },
        data: { status: TahunAjaranStatus.AKTIF },
      });

      await this.auditService.log({
        sekolah_id: sekolahId,
        actor_id: actorId,
        actor_type: 'ADMIN',
        action: 'ACTIVATE',
        resource: 'TAHUN_AJARAN',
        resource_id: id,
        details: `Mengaktifkan tahun ajaran ${activated.nama} ${activated.semester}`,
      });

      return activated;
    });
  }

  async deleteTahunAjaran(id: string) {
    return this.prisma.tahunAjaran.delete({ where: { id } });
  }

  // ==================== JURUSAN ====================
  async getJurusanList(sekolahId: string) {
    return this.prisma.jurusan.findMany({
      where: { sekolah_id: sekolahId },
      orderBy: { nama: 'asc' },
    });
  }

  async createJurusan(sekolahId: string, dto: CreateJurusanDto) {
    return this.prisma.jurusan.create({
      data: {
        sekolah_id: sekolahId,
        nama: dto.nama,
        kode: dto.kode,
      },
    });
  }

  async updateJurusan(id: string, dto: UpdateJurusanDto) {
    return this.prisma.jurusan.update({
      where: { id },
      data: dto,
    });
  }

  async deleteJurusan(id: string) {
    return this.prisma.jurusan.delete({ where: { id } });
  }

  // ==================== KELAS ====================
  async getKelasList(sekolahId: string, tingkat?: number) {
    const where: any = { sekolah_id: sekolahId };
    if (tingkat) where.tingkat = tingkat;

    const list = await this.prisma.kelas.findMany({
      where,
      include: {
        jurusan: true,
      },
      orderBy: [{ tingkat: 'asc' }, { nama_rombel: 'asc' }],
    });

    // Format nama tampilan kelas, misal "10 MIPA 1"
    return list.map((k) => ({
      ...k,
      nama_lengkap: `${k.tingkat} ${k.jurusan.kode} ${k.nama_rombel}`,
    }));
  }

  async createKelas(sekolahId: string, dto: CreateKelasDto) {
    return this.prisma.kelas.create({
      data: {
        sekolah_id: sekolahId,
        jurusan_id: dto.jurusan_id,
        tingkat: dto.tingkat,
        nama_rombel: dto.nama_rombel,
      },
      include: { jurusan: true },
    });
  }

  async updateKelas(id: string, dto: UpdateKelasDto) {
    return this.prisma.kelas.update({
      where: { id },
      data: dto,
      include: { jurusan: true },
    });
  }

  async deleteKelas(id: string) {
    return this.prisma.kelas.delete({ where: { id } });
  }

  // ==================== MATA PELAJARAN ====================
  async getMapelList(sekolahId: string) {
    return this.prisma.mataPelajaran.findMany({
      where: { sekolah_id: sekolahId },
      orderBy: { nama: 'asc' },
    });
  }

  async createMapel(sekolahId: string, dto: CreateMapelDto) {
    return this.prisma.mataPelajaran.create({
      data: {
        sekolah_id: sekolahId,
        nama: dto.nama,
        kode: dto.kode,
      },
    });
  }

  async createMapelBulk(
    sekolahId: string,
    items: Array<{ nama: string; kode?: string }>,
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Data mata pelajaran tidak boleh kosong');
    }

    const existing = await this.prisma.mataPelajaran.findMany({
      where: { sekolah_id: sekolahId },
      select: { kode: true },
    });
    const existingCodes = new Set(existing.map((e) => e.kode.toUpperCase()));

    const toCreate: Array<{ sekolah_id: string; nama: string; kode: string }> = [];

    for (const item of items) {
      const nama = item.nama?.trim();
      if (!nama) continue;

      let kode = item.kode?.trim().toUpperCase();
      if (!kode) {
        kode = nama.substring(0, 5).toUpperCase();
      }

      let uniqueKode = kode;
      let counter = 1;
      while (existingCodes.has(uniqueKode)) {
        uniqueKode = `${kode}-${counter}`;
        counter++;
      }
      existingCodes.add(uniqueKode);

      toCreate.push({
        sekolah_id: sekolahId,
        nama,
        kode: uniqueKode,
      });
    }

    if (toCreate.length === 0) {
      throw new BadRequestException('Tidak ada data mata pelajaran valid yang dapat disimpan');
    }

    const created = await this.prisma.mataPelajaran.createMany({
      data: toCreate,
      skipDuplicates: true,
    });

    return created;
  }

  async updateMapel(id: string, dto: UpdateMapelDto) {
    return this.prisma.mataPelajaran.update({
      where: { id },
      data: dto,
    });
  }

  async deleteMapel(id: string) {
    return this.prisma.mataPelajaran.delete({ where: { id } });
  }
}
