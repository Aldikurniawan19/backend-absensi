import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AssignKelasSiswaDto,
  AssignWaliKelasDto,
  CreateAdminDto,
  CreateGuruDto,
  CreateSiswaDto,
  UpdateAdminDto,
  UpdateGuruDto,
  UpdateSiswaDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ==================== SISWA ====================
  async getSiswaList(
    sekolahId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    kelasId?: string,
    tahunAjaranId?: string,
    tingkat?: number,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { sekolah_id: sekolahId };

    if (search) {
      where.OR = [
        { nama: { contains: search, mode: 'insensitive' } },
        { nisn: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (kelasId || tahunAjaranId || tingkat) {
      where.riwayat_kelas = {
        some: {
          ...(kelasId ? { kelas_id: kelasId } : {}),
          ...(tahunAjaranId ? { tahun_ajaran_id: tahunAjaranId } : {}),
          ...(tingkat ? { kelas: { tingkat } } : {}),
        },
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.siswa.count({ where }),
      this.prisma.siswa.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          nama: true,
          nisn: true,
          email: true,
          no_hp_ortu: true,
          createdAt: true,
          riwayat_kelas: {
            include: {
              kelas: { include: { jurusan: true } },
              tahun_ajaran: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { nama: 'asc' },
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

  async getSiswaById(id: string) {
    const siswa = await this.prisma.siswa.findUnique({
      where: { id },
      include: {
        riwayat_kelas: {
          include: {
            kelas: { include: { jurusan: true } },
            tahun_ajaran: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!siswa) throw new NotFoundException('Siswa tidak ditemukan');
    const { password, ...result } = siswa;
    return result;
  }

  async createSiswa(sekolahId: string, dto: CreateSiswaDto, actorId: string) {
    const hashedPassword = await argon2.hash(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const siswa = await tx.siswa.create({
        data: {
          sekolah_id: sekolahId,
          nama: dto.nama,
          nisn: dto.nisn,
          email: dto.email,
          password: hashedPassword,
          no_hp_ortu: dto.no_hp_ortu,
        },
      });

      // Jika kelas_id diberikan, otomatis daftarkan ke tahun ajaran aktif
      if (dto.kelas_id) {
        const tahunAktif = await tx.tahunAjaran.findFirst({
          where: { sekolah_id: sekolahId, status: 'AKTIF' },
        });

        if (tahunAktif) {
          await tx.riwayatKelasSiswa.create({
            data: {
              siswa_id: siswa.id,
              kelas_id: dto.kelas_id,
              tahun_ajaran_id: tahunAktif.id,
            },
          });
        }
      }

      await this.auditService.log({
        sekolah_id: sekolahId,
        actor_id: actorId,
        actor_type: 'ADMIN',
        action: 'CREATE',
        resource: 'SISWA',
        resource_id: siswa.id,
        details: `Menambahkan siswa baru: ${siswa.nama} (${siswa.nisn})`,
      });

      const { password, ...result } = siswa;
      return result;
    });
  }

  async updateSiswa(id: string, dto: UpdateSiswaDto, actorId: string) {
    const data: any = { ...dto };
    if (dto.password) {
      data.password = await argon2.hash(dto.password);
    }

    const updated = await this.prisma.siswa.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      sekolah_id: updated.sekolah_id,
      actor_id: actorId,
      actor_type: 'ADMIN',
      action: 'UPDATE',
      resource: 'SISWA',
      resource_id: id,
      details: `Memperbarui data siswa: ${updated.nama}`,
    });

    const { password, ...result } = updated;
    return result;
  }

  async assignKelasSiswa(dto: AssignKelasSiswaDto) {
    return this.prisma.riwayatKelasSiswa.upsert({
      where: {
        siswa_id_tahun_ajaran_id: {
          siswa_id: dto.siswa_id,
          tahun_ajaran_id: dto.tahun_ajaran_id,
        },
      },
      create: {
        siswa_id: dto.siswa_id,
        kelas_id: dto.kelas_id,
        tahun_ajaran_id: dto.tahun_ajaran_id,
      },
      update: {
        kelas_id: dto.kelas_id,
      },
    });
  }

  async deleteSiswa(id: string) {
    return this.prisma.siswa.delete({ where: { id } });
  }

  // ==================== GURU ====================
  async getGuruList(
    sekolahId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { sekolah_id: sekolahId };

    if (search) {
      where.OR = [
        { nama: { contains: search, mode: 'insensitive' } },
        { nip: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.guru.count({ where }),
      this.prisma.guru.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          nama: true,
          nip: true,
          email: true,
          no_hp: true,
          createdAt: true,
          guru_mapel: {
            include: { mapel: true },
          },
          penugasan_wali_kelas: {
            include: {
              kelas: { include: { jurusan: true } },
              tahun_ajaran: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { nama: 'asc' },
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

  async getGuruById(id: string) {
    const guru = await this.prisma.guru.findUnique({
      where: { id },
      include: {
        guru_mapel: { include: { mapel: true } },
        penugasan_wali_kelas: {
          include: {
            kelas: { include: { jurusan: true } },
            tahun_ajaran: true,
          },
        },
      },
    });
    if (!guru) throw new NotFoundException('Guru tidak ditemukan');
    const { password, ...result } = guru;
    return result;
  }

  async createGuru(sekolahId: string, dto: CreateGuruDto, actorId: string) {
    const hashedPassword = await argon2.hash(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const guru = await tx.guru.create({
        data: {
          sekolah_id: sekolahId,
          nama: dto.nama,
          nip: dto.nip,
          email: dto.email,
          password: hashedPassword,
          no_hp: dto.no_hp,
        },
      });

      if (dto.mapel_ids && dto.mapel_ids.length > 0) {
        await tx.guruMapel.createMany({
          data: dto.mapel_ids.map((mapel_id) => ({
            guru_id: guru.id,
            mapel_id,
          })),
        });
      }

      await this.auditService.log({
        sekolah_id: sekolahId,
        actor_id: actorId,
        actor_type: 'ADMIN',
        action: 'CREATE',
        resource: 'GURU',
        resource_id: guru.id,
        details: `Menambahkan guru baru: ${guru.nama} (${guru.nip})`,
      });

      const { password, ...result } = guru;
      return result;
    });
  }

  async updateGuru(id: string, dto: UpdateGuruDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const data: any = {};
      if (dto.nama) data.nama = dto.nama;
      if (dto.nip) data.nip = dto.nip;
      if (dto.email) data.email = dto.email;
      if (dto.no_hp !== undefined) data.no_hp = dto.no_hp;
      if (dto.password) {
        data.password = await argon2.hash(dto.password);
      }

      const updated = await tx.guru.update({
        where: { id },
        data,
      });

      if (dto.mapel_ids) {
        await tx.guruMapel.deleteMany({ where: { guru_id: id } });
        if (dto.mapel_ids.length > 0) {
          await tx.guruMapel.createMany({
            data: dto.mapel_ids.map((mapel_id) => ({
              guru_id: id,
              mapel_id,
            })),
          });
        }
      }

      await this.auditService.log({
        sekolah_id: updated.sekolah_id,
        actor_id: actorId,
        actor_type: 'ADMIN',
        action: 'UPDATE',
        resource: 'GURU',
        resource_id: id,
        details: `Memperbarui data guru: ${updated.nama}`,
      });

      const { password, ...result } = updated;
      return result;
    });
  }

  async assignWaliKelas(dto: AssignWaliKelasDto, actorId: string) {
    const penugasan = await this.prisma.penugasanWaliKelas.upsert({
      where: {
        kelas_id_tahun_ajaran_id: {
          kelas_id: dto.kelas_id,
          tahun_ajaran_id: dto.tahun_ajaran_id,
        },
      },
      create: {
        guru_id: dto.guru_id,
        kelas_id: dto.kelas_id,
        tahun_ajaran_id: dto.tahun_ajaran_id,
      },
      update: {
        guru_id: dto.guru_id,
      },
      include: {
        guru: true,
        kelas: true,
        tahun_ajaran: true,
      },
    });

    await this.auditService.log({
      sekolah_id: penugasan.guru.sekolah_id,
      actor_id: actorId,
      actor_type: 'ADMIN',
      action: 'ASSIGN_WALI_KELAS',
      resource: 'PENUGASAN_WALI_KELAS',
      resource_id: penugasan.id,
      details: `Menugaskan ${penugasan.guru.nama} sebagai wali kelas ${penugasan.kelas.tingkat} pada ${penugasan.tahun_ajaran.nama}`,
    });

    return penugasan;
  }

  async deleteGuru(id: string) {
    return this.prisma.guru.delete({ where: { id } });
  }

  // ==================== ADMIN ====================
  async getAdminList(sekolahId: string) {
    return this.prisma.admin.findMany({
      where: { sekolah_id: sekolahId },
      select: {
        id: true,
        nama: true,
        email: true,
        createdAt: true,
      },
      orderBy: { nama: 'asc' },
    });
  }

  async createAdmin(sekolahId: string, dto: CreateAdminDto, actorId: string) {
    const hashedPassword = await argon2.hash(dto.password);

    const admin = await this.prisma.admin.create({
      data: {
        sekolah_id: sekolahId,
        nama: dto.nama,
        email: dto.email,
        password: hashedPassword,
      },
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: 'ADMIN',
      action: 'CREATE',
      resource: 'ADMIN',
      resource_id: admin.id,
      details: `Menambahkan admin baru: ${admin.nama} (${admin.email})`,
    });

    const { password, ...result } = admin;
    return result;
  }

  async updateAdmin(id: string, dto: UpdateAdminDto, actorId: string) {
    const data: any = { ...dto };
    if (dto.password) {
      data.password = await argon2.hash(dto.password);
    }

    const updated = await this.prisma.admin.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      sekolah_id: updated.sekolah_id,
      actor_id: actorId,
      actor_type: 'ADMIN',
      action: 'UPDATE',
      resource: 'ADMIN',
      resource_id: id,
      details: `Memperbarui admin: ${updated.nama}`,
    });

    const { password, ...result } = updated;
    return result;
  }

  async deleteAdmin(id: string) {
    return this.prisma.admin.delete({ where: { id } });
  }
}
