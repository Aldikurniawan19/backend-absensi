import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AssignEkstrakurikulerSiswaDto,
  CreateEkstrakurikulerDto,
  SaveEkskulSiswaBatchDto,
  UpdateEkstrakurikulerDto,
  UpdateEkstrakurikulerSiswaDto,
} from './dto/ekstrakurikuler.dto';

@Injectable()
export class EkstrakurikulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ==================== MASTER EKSTRAKURIKULER ====================

  async getAllMasterEkskul(sekolahId: string) {
    return this.prisma.ekstrakurikuler.findMany({
      where: { sekolah_id: sekolahId },
      orderBy: { nama: 'asc' },
      select: {
        id: true,
        nama: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { keanggotaan: true },
        },
      },
    });
  }

  async createMasterEkskul(
    dto: CreateEkstrakurikulerDto,
    sekolahId: string,
    actorId: string,
  ) {
    const existing = await this.prisma.ekstrakurikuler.findUnique({
      where: {
        sekolah_id_nama: {
          sekolah_id: sekolahId,
          nama: dto.nama.trim(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Ekstrakurikuler "${dto.nama}" sudah ada`);
    }

    const created = await this.prisma.ekstrakurikuler.create({
      data: {
        sekolah_id: sekolahId,
        nama: dto.nama.trim(),
      },
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: UserRole.ADMIN,
      action: 'CREATE_EKSTRAKURIKULER',
      resource: 'EKSTRAKURIKULER',
      resource_id: created.id,
      details: `Tambah ekstrakurikuler: ${created.nama}`,
    });

    return created;
  }

  async updateMasterEkskul(
    id: string,
    dto: UpdateEkstrakurikulerDto,
    sekolahId: string,
    actorId: string,
  ) {
    const existing = await this.prisma.ekstrakurikuler.findFirst({
      where: { id, sekolah_id: sekolahId },
    });

    if (!existing) {
      throw new NotFoundException('Ekstrakurikuler tidak ditemukan');
    }

    const updated = await this.prisma.ekstrakurikuler.update({
      where: { id },
      data: { nama: dto.nama.trim() },
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: UserRole.ADMIN,
      action: 'UPDATE_EKSTRAKURIKULER',
      resource: 'EKSTRAKURIKULER',
      resource_id: id,
      details: `Ubah nama ekstrakurikuler ${existing.nama} -> ${updated.nama}`,
    });

    return updated;
  }

  async deleteMasterEkskul(id: string, sekolahId: string, actorId: string) {
    const existing = await this.prisma.ekstrakurikuler.findFirst({
      where: { id, sekolah_id: sekolahId },
    });

    if (!existing) {
      throw new NotFoundException('Ekstrakurikuler tidak ditemukan');
    }

    await this.prisma.ekstrakurikuler.delete({ where: { id } });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: UserRole.ADMIN,
      action: 'DELETE_EKSTRAKURIKULER',
      resource: 'EKSTRAKURIKULER',
      resource_id: id,
      details: `Hapus ekstrakurikuler: ${existing.nama}`,
    });

    return { message: 'Ekstrakurikuler berhasil dihapus' };
  }

  // ==================== NILAI / KEANGGOTAAN EKSKUL SISWA ====================

  async getEkskulSiswaByKelas(
    kelasId: string,
    tahunAjaranId: string,
    sekolahId: string,
  ) {
    const riwayatSiswa = await this.prisma.riwayatKelasSiswa.findMany({
      where: {
        kelas_id: kelasId,
        tahun_ajaran_id: tahunAjaranId,
      },
      select: {
        siswa: {
          select: {
            id: true,
            nisn: true,
            nama: true,
            ekstrakurikuler_siswa: {
              where: { tahun_ajaran_id: tahunAjaranId },
              select: {
                id: true,
                ekstrakurikuler_id: true,
                predikat: true,
                keterangan: true,
                ekstrakurikuler: {
                  select: { id: true, nama: true },
                },
              },
            },
          },
        },
      },
      orderBy: { siswa: { nama: 'asc' } },
    });

    return riwayatSiswa.map((r) => ({
      siswa_id: r.siswa.id,
      nisn: r.siswa.nisn,
      nama: r.siswa.nama,
      ekskul_list: r.siswa.ekstrakurikuler_siswa.map((e) => ({
        id: e.id,
        ekstrakurikuler_id: e.ekstrakurikuler_id,
        nama_ekskul: e.ekstrakurikuler.nama,
        predikat: e.predikat,
        keterangan: e.keterangan,
      })),
    }));
  }

  async assignEkskulSiswa(
    dto: AssignEkstrakurikulerSiswaDto,
    sekolahId: string,
    actorId: string,
    actorRole: UserRole,
  ) {
    const saved = await this.prisma.ekstrakurikulerSiswa.upsert({
      where: {
        siswa_id_ekstrakurikuler_id_tahun_ajaran_id: {
          siswa_id: dto.siswa_id,
          ekstrakurikuler_id: dto.ekstrakurikuler_id,
          tahun_ajaran_id: dto.tahun_ajaran_id,
        },
      },
      create: {
        siswa_id: dto.siswa_id,
        ekstrakurikuler_id: dto.ekstrakurikuler_id,
        tahun_ajaran_id: dto.tahun_ajaran_id,
        predikat: dto.predikat,
        keterangan: dto.keterangan,
      },
      update: {
        predikat: dto.predikat,
        keterangan: dto.keterangan,
      },
      include: {
        ekstrakurikuler: { select: { nama: true } },
      },
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: actorRole,
      action: 'ASSIGN_EKSKUL_SISWA',
      resource: 'EKSTRAKURIKULER',
      resource_id: saved.id,
      details: `Assign/update ekskul ${saved.ekstrakurikuler.nama} untuk siswa ${dto.siswa_id} (Predikat: ${dto.predikat || '-'})`,
    });

    return saved;
  }

  async saveEkskulSiswaBatch(
    dto: SaveEkskulSiswaBatchDto,
    sekolahId: string,
    actorId: string,
    actorRole: UserRole,
  ) {
    const results = await this.prisma.$transaction(async (tx) => {
      const items = [];
      for (const item of dto.items) {
        const saved = await tx.ekstrakurikulerSiswa.upsert({
          where: {
            siswa_id_ekstrakurikuler_id_tahun_ajaran_id: {
              siswa_id: item.siswa_id,
              ekstrakurikuler_id: item.ekstrakurikuler_id,
              tahun_ajaran_id: dto.tahun_ajaran_id,
            },
          },
          create: {
            siswa_id: item.siswa_id,
            ekstrakurikuler_id: item.ekstrakurikuler_id,
            tahun_ajaran_id: dto.tahun_ajaran_id,
            predikat: item.predikat,
            keterangan: item.keterangan,
          },
          update: {
            predikat: item.predikat,
            keterangan: item.keterangan,
          },
        });
        items.push(saved);
      }
      return items;
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: actorRole,
      action: 'BATCH_ASSIGN_EKSKUL',
      resource: 'EKSTRAKURIKULER',
      details: `Batch assign ${results.length} ekskul siswa`,
    });

    return {
      message: `${results.length} data ekskul siswa berhasil disimpan`,
      count: results.length,
      data: results,
    };
  }

  async removeEkskulSiswa(id: string, sekolahId: string, actorId: string, actorRole: UserRole) {
    const existing = await this.prisma.ekstrakurikulerSiswa.findUnique({
      where: { id },
      include: { ekstrakurikuler: { select: { nama: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Data ekskul siswa tidak ditemukan');
    }

    await this.prisma.ekstrakurikulerSiswa.delete({ where: { id } });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: actorRole,
      action: 'DELETE_EKSKUL_SISWA',
      resource: 'EKSTRAKURIKULER',
      resource_id: id,
      details: `Hapus ekskul ${existing.ekstrakurikuler.nama} siswa ${existing.siswa_id}`,
    });

    return { message: 'Data ekskul siswa berhasil dihapus' };
  }
}
