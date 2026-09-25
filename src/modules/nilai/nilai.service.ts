import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KomponenNilai, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateNilaiBatchDto,
  CreateNilaiDto,
  SaveCatatanCapaianBatchDto,
  SaveCatatanCapaianDto,
  UpdateNilaiDto,
} from './dto/nilai.dto';
import { UpdateKonfigurasiPenilaianDto } from './dto/konfigurasi-penilaian.dto';
import {
  PredikatBBPB,
  RekapKelasMapelResponse,
  RekapNilaiSiswaMapel,
  RekapSemuaMapelKelasResponse,
} from './nilai.types';

import { MasterCacheService } from '../master/master-cache.service';

@Injectable()
export class NilaiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly masterCache: MasterCacheService,
  ) {}

  // =========================================================================
  // KONFIGURASI PENILAIAN
  // =========================================================================

  async getKonfigurasiPenilaian(sekolahId: string, tahunAjaranId?: string) {
    let resolvedTahunAjaranId = tahunAjaranId;
    if (!resolvedTahunAjaranId) {
      const activeTahun = await this.prisma.tahunAjaran.findFirst({
        where: { sekolah_id: sekolahId, status: 'AKTIF' },
        select: { id: true },
      });
      resolvedTahunAjaranId = activeTahun?.id;
    }

    if (!resolvedTahunAjaranId) {
      return {
        bobot_formatif: 40,
        bobot_sts: 30,
        bobot_sas: 30,
        batas_bb: 40,
        batas_mb: 65,
        batas_bsh: 85,
      };
    }

    const cacheKey = `config_nilai:${sekolahId}:${resolvedTahunAjaranId}`;
    const cached = this.masterCache.get<any>(cacheKey);
    if (cached) return cached;

    const config = await this.prisma.konfigurasiPenilaian.findUnique({
      where: {
        sekolah_id_tahun_ajaran_id: {
          sekolah_id: sekolahId,
          tahun_ajaran_id: resolvedTahunAjaranId,
        },
      },
    });

    if (config) {
      this.masterCache.set(cacheKey, config, 10 * 60 * 1000); // 10 menit
      return config;
    }

    // Default Kurikulum Merdeka
    const defaultConfig = {
      sekolah_id: sekolahId,
      tahun_ajaran_id: resolvedTahunAjaranId,
      bobot_formatif: 40,
      bobot_sts: 30,
      bobot_sas: 30,
      batas_bb: 40,
      batas_mb: 65,
      batas_bsh: 85,
    };
    this.masterCache.set(cacheKey, defaultConfig, 10 * 60 * 1000);
    return defaultConfig;
  }

  async saveKonfigurasiPenilaian(
    sekolahId: string,
    dto: UpdateKonfigurasiPenilaianDto,
    actorId: string,
  ) {
    if (dto.bobot_formatif + dto.bobot_sts + dto.bobot_sas !== 100) {
      throw new BadRequestException('Total bobot penilaian (Formatif + STS + SAS) harus bernilai tepat 100%');
    }

    if (dto.batas_bb >= dto.batas_mb || dto.batas_mb >= dto.batas_bsh) {
      throw new BadRequestException('Batas predikat harus berurutan (Batas BB < Batas MB < Batas BSH)');
    }

    const config = await this.prisma.konfigurasiPenilaian.upsert({
      where: {
        sekolah_id_tahun_ajaran_id: {
          sekolah_id: sekolahId,
          tahun_ajaran_id: dto.tahun_ajaran_id,
        },
      },
      create: {
        sekolah_id: sekolahId,
        tahun_ajaran_id: dto.tahun_ajaran_id,
        bobot_formatif: dto.bobot_formatif,
        bobot_sts: dto.bobot_sts,
        bobot_sas: dto.bobot_sas,
        batas_bb: dto.batas_bb,
        batas_mb: dto.batas_mb,
        batas_bsh: dto.batas_bsh,
      },
      update: {
        bobot_formatif: dto.bobot_formatif,
        bobot_sts: dto.bobot_sts,
        bobot_sas: dto.bobot_sas,
        batas_bb: dto.batas_bb,
        batas_mb: dto.batas_mb,
        batas_bsh: dto.batas_bsh,
      },
    });

    this.masterCache.invalidate(`config_nilai:${sekolahId}`);

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: UserRole.ADMIN,
      action: 'UPDATE_KONFIGURASI_PENILAIAN',
      resource: 'PENILAIAN',
      resource_id: config.id,
      details: `Update bobot penilaian: Formatif ${dto.bobot_formatif}%, STS ${dto.bobot_sts}%, SAS ${dto.bobot_sas}%`,
    });

    return config;
  }


  // =========================================================================
  // HELPER PERHITUNGAN NILAI & PREDIKAT
  // =========================================================================

  hitungPredikat(
    nilai: number,
    config: { batas_bb: number; batas_mb: number; batas_bsh: number },
  ): { kode: PredikatBBPB; label: string } {
    if (nilai <= config.batas_bb) {
      return { kode: 'BB' as PredikatBBPB, label: 'Belum Berkembang' };
    }
    if (nilai <= config.batas_mb) {
      return { kode: 'MB' as PredikatBBPB, label: 'Mulai Berkembang' };
    }
    if (nilai <= config.batas_bsh) {
      return { kode: 'BSH' as PredikatBBPB, label: 'Berkembang Sesuai Harapan' };
    }
    return { kode: 'SB' as PredikatBBPB, label: 'Sangat Berkembang' };
  }

  hitungNilaiAkhir(
    rataFormatif: number | null,
    nilaiSTS: number | null,
    nilaiSAS: number | null,
    config: { bobot_formatif: number; bobot_sts: number; bobot_sas: number },
  ): number | null {
    // Jika semua belum diinput, return null
    if (rataFormatif === null && nilaiSTS === null && nilaiSAS === null) {
      return null;
    }

    let totalBobot = 0;
    let totalNilai = 0;

    if (rataFormatif !== null) {
      totalNilai += rataFormatif * (config.bobot_formatif / 100);
      totalBobot += config.bobot_formatif;
    }
    if (nilaiSTS !== null) {
      totalNilai += nilaiSTS * (config.bobot_sts / 100);
      totalBobot += config.bobot_sts;
    }
    if (nilaiSAS !== null) {
      totalNilai += nilaiSAS * (config.bobot_sas / 100);
      totalBobot += config.bobot_sas;
    }

    if (totalBobot === 0) return null;

    // Normalisasi jika belum semua komponen terisi
    const finalScore = (totalNilai / totalBobot) * 100;
    return Math.round(finalScore * 100) / 100;
  }

  // =========================================================================
  // VALIDASI HAK AKSES GURU (SCOPE CHECK)
  // =========================================================================

  private async checkTeacherScope(
    guruId: string,
    sekolahId: string,
    mapelId: string,
    kelasId: string,
    tahunAjaranId: string,
  ) {
    const hasJadwal = await this.prisma.jadwalPelajaran.findFirst({
      where: {
        guru_id: guruId,
        mapel_id: mapelId,
        kelas_id: kelasId,
        tahun_ajaran_id: tahunAjaranId,
      },
      select: { id: true },
    });

    if (!hasJadwal) {
      const isGuruMapel = await this.prisma.guruMapel.findFirst({
        where: { guru_id: guruId, mapel_id: mapelId },
        select: { id: true },
      });
      if (!isGuruMapel) {
        throw new ForbiddenException(
          'Anda tidak memiliki akses untuk menginput nilai pada mata pelajaran dan kelas ini.',
        );
      }
    }
  }

  // =========================================================================
  // INPUT & PENGELOLAAN NILAI SISWA
  // =========================================================================

  async createNilaiSingle(
    dto: CreateNilaiDto,
    guruId: string,
    userRole: UserRole,
    sekolahId: string,
  ) {
    if (userRole === UserRole.GURU) {
      await this.checkTeacherScope(
        guruId,
        sekolahId,
        dto.mapel_id,
        dto.kelas_id,
        dto.tahun_ajaran_id,
      );
    }

    // Untuk STS dan SAS, keunikan 1 per siswa per mapel per tahun ajaran
    if (dto.komponen === KomponenNilai.STS || dto.komponen === KomponenNilai.SAS) {
      const existing = await this.prisma.nilaiSiswa.findFirst({
        where: {
          siswa_id: dto.siswa_id,
          mapel_id: dto.mapel_id,
          tahun_ajaran_id: dto.tahun_ajaran_id,
          komponen: dto.komponen,
        },
      });

      if (existing) {
        const updated = await this.prisma.nilaiSiswa.update({
          where: { id: existing.id },
          data: {
            nilai: new Prisma.Decimal(dto.nilai),
            judul: dto.judul,
            catatan: dto.catatan,
            guru_id: guruId,
          },
        });

        await this.auditService.log({
          sekolah_id: sekolahId,
          actor_id: guruId,
          actor_type: userRole,
          action: 'UPDATE_NILAI',
          resource: 'NILAI',
          resource_id: updated.id,
          details: `Update nilai ${dto.komponen}: ${dto.nilai} untuk siswa ${dto.siswa_id}`,
        });

        return updated;
      }
    }

    const created = await this.prisma.nilaiSiswa.create({
      data: {
        siswa_id: dto.siswa_id,
        mapel_id: dto.mapel_id,
        kelas_id: dto.kelas_id,
        tahun_ajaran_id: dto.tahun_ajaran_id,
        guru_id: guruId,
        komponen: dto.komponen,
        judul: dto.judul,
        nilai: new Prisma.Decimal(dto.nilai),
        catatan: dto.catatan,
      },
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: guruId,
      actor_type: userRole,
      action: 'CREATE_NILAI',
      resource: 'NILAI',
      resource_id: created.id,
      details: `Input nilai ${dto.komponen} (${dto.judul}): ${dto.nilai} untuk siswa ${dto.siswa_id}`,
    });

    return created;
  }

  async createNilaiBatch(
    dto: CreateNilaiBatchDto,
    guruId: string,
    userRole: UserRole,
    sekolahId: string,
  ) {
    if (userRole === UserRole.GURU) {
      await this.checkTeacherScope(
        guruId,
        sekolahId,
        dto.mapel_id,
        dto.kelas_id,
        dto.tahun_ajaran_id,
      );
    }

    if (!dto.items || dto.items.length === 0) {
      return { message: 'Tidak ada data nilai yang disimpan', count: 0, data: [] };
    }

    const studentIds = dto.items.map((i) => i.siswa_id);

    // Ambil data nilai yang sudah ada dalam 1 query batch (Eliminasi puluhan findFirst di dalam transaksi)
    const existingList = await this.prisma.nilaiSiswa.findMany({
      where: {
        siswa_id: { in: studentIds },
        mapel_id: dto.mapel_id,
        kelas_id: dto.kelas_id,
        tahun_ajaran_id: dto.tahun_ajaran_id,
        komponen: dto.komponen,
        ...(dto.komponen === KomponenNilai.FORMATIF ? { judul: dto.judul } : {}),
      },
    });

    const existingMap = new Map<string, (typeof existingList)[0]>();
    for (const e of existingList) {
      existingMap.set(e.siswa_id, e);
    }

    const results = await this.prisma.$transaction(async (tx) => {
      const operations = dto.items.map((item) => {
        const existing = existingMap.get(item.siswa_id);

        if (existing) {
          return tx.nilaiSiswa.update({
            where: { id: existing.id },
            data: {
              nilai: new Prisma.Decimal(item.nilai),
              judul: dto.judul,
              catatan: item.catatan,
              guru_id: guruId,
            },
          });
        }

        return tx.nilaiSiswa.create({
          data: {
            siswa_id: item.siswa_id,
            mapel_id: dto.mapel_id,
            kelas_id: dto.kelas_id,
            tahun_ajaran_id: dto.tahun_ajaran_id,
            guru_id: guruId,
            komponen: dto.komponen,
            judul: dto.judul,
            nilai: new Prisma.Decimal(item.nilai),
            catatan: item.catatan,
          },
        });
      });

      return Promise.all(operations);
    });


    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: guruId,
      actor_type: userRole,
      action: 'BATCH_INPUT_NILAI',
      resource: 'NILAI',
      details: `Input batch ${results.length} nilai ${dto.komponen} (${dto.judul}) di kelas ${dto.kelas_id}`,
    });

    return {
      message: `${results.length} nilai berhasil disimpan`,
      count: results.length,
      data: results,
    };
  }

  async updateNilai(
    id: string,
    dto: UpdateNilaiDto,
    guruId: string,
    userRole: UserRole,
    sekolahId: string,
  ) {
    const existing = await this.prisma.nilaiSiswa.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Data nilai tidak ditemukan');
    }

    if (userRole === UserRole.GURU && existing.guru_id !== guruId) {
      await this.checkTeacherScope(
        guruId,
        sekolahId,
        existing.mapel_id,
        existing.kelas_id,
        existing.tahun_ajaran_id,
      );
    }

    const dataToUpdate: Prisma.NilaiSiswaUpdateInput = {};
    if (dto.nilai !== undefined) {
      dataToUpdate.nilai = new Prisma.Decimal(dto.nilai);
    }
    if (dto.judul !== undefined) {
      dataToUpdate.judul = dto.judul;
    }
    if (dto.catatan !== undefined) {
      dataToUpdate.catatan = dto.catatan;
    }

    const updated = await this.prisma.nilaiSiswa.update({
      where: { id },
      data: dataToUpdate,
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: guruId,
      actor_type: userRole,
      action: 'UPDATE_NILAI',
      resource: 'NILAI',
      resource_id: id,
      details: `Update nilai ${id} menjadi ${dto.nilai ?? existing.nilai}`,
    });

    return updated;
  }

  async deleteNilai(
    id: string,
    guruId: string,
    userRole: UserRole,
    sekolahId: string,
  ) {
    const existing = await this.prisma.nilaiSiswa.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Data nilai tidak ditemukan');
    }

    if (userRole === UserRole.GURU && existing.guru_id !== guruId) {
      await this.checkTeacherScope(
        guruId,
        sekolahId,
        existing.mapel_id,
        existing.kelas_id,
        existing.tahun_ajaran_id,
      );
    }

    await this.prisma.nilaiSiswa.delete({ where: { id } });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: guruId,
      actor_type: userRole,
      action: 'DELETE_NILAI',
      resource: 'NILAI',
      resource_id: id,
      details: `Hapus nilai ${existing.komponen} (${existing.judul}) siswa ${existing.siswa_id}`,
    });

    return { message: 'Nilai berhasil dihapus' };
  }

  // =========================================================================
  // REKAP NILAI KELAS PER MAPEL (GURU & WALI KELAS)
  // =========================================================================

  async getRekapKelasMapel(
    kelasId: string,
    mapelId: string,
    sekolahId: string,
    tahunAjaranId?: string,
  ): Promise<RekapKelasMapelResponse> {
    let resolvedTahunAjaranId = tahunAjaranId;
    if (!resolvedTahunAjaranId) {
      const activeTahun = await this.prisma.tahunAjaran.findFirst({
        where: { sekolah_id: sekolahId, status: 'AKTIF' },
        select: { id: true, nama: true, semester: true },
      });
      if (!activeTahun) {
        throw new NotFoundException('Tidak ada tahun ajaran aktif');
      }
      resolvedTahunAjaranId = activeTahun.id;
    }

    const [kelas, mapel, tahunAjaran, konfigurasi] = await Promise.all([
      this.prisma.kelas.findUnique({
        where: { id: kelasId },
        select: {
          id: true,
          tingkat: true,
          nama_rombel: true,
          jurusan: { select: { nama: true, kode: true } },
        },
      }),
      this.prisma.mataPelajaran.findUnique({
        where: { id: mapelId },
        select: { id: true, nama: true, kode: true },
      }),
      this.prisma.tahunAjaran.findUnique({
        where: { id: resolvedTahunAjaranId },
        select: { id: true, nama: true, semester: true },
      }),
      this.getKonfigurasiPenilaian(sekolahId, resolvedTahunAjaranId),
    ]);

    if (!kelas || !mapel || !tahunAjaran) {
      throw new NotFoundException('Data kelas, mapel, atau tahun ajaran tidak ditemukan');
    }

    // Ambil semua siswa di kelas ini pada tahun ajaran aktif
    const riwayatSiswa = await this.prisma.riwayatKelasSiswa.findMany({
      where: {
        kelas_id: kelasId,
        tahun_ajaran_id: resolvedTahunAjaranId,
      },
      select: {
        siswa: {
          select: {
            id: true,
            nisn: true,
            nama: true,
          },
        },
      },
      orderBy: { siswa: { nama: 'asc' } },
    });

    const siswaIds = riwayatSiswa.map((r) => r.siswa.id);

    // Ambil semua nilai siswa untuk mapel ini
    const allNilai = await this.prisma.nilaiSiswa.findMany({
      where: {
        kelas_id: kelasId,
        mapel_id: mapelId,
        tahun_ajaran_id: resolvedTahunAjaranId,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    // Ambil catatan capaian narasi
    const catatanList = await this.prisma.catatanCapaian.findMany({
      where: {
        siswa_id: { in: siswaIds },
        mapel_id: mapelId,
        tahun_ajaran_id: resolvedTahunAjaranId,
      },
      select: { siswa_id: true, deskripsi: true },
    });
    const catatanMap = new Map<string, string>();
    for (const c of catatanList) {
      catatanMap.set(c.siswa_id, c.deskripsi);
    }

    // Kumpulkan daftar judul formatif yang unik
    const kolomFormatifSet = new Set<string>();
    for (const n of allNilai) {
      if (n.komponen === KomponenNilai.FORMATIF) {
        kolomFormatifSet.add(n.judul);
      }
    }
    const kolomFormatif = Array.from(kolomFormatifSet);

    // Bangun data rekap per siswa
    const siswaList: RekapNilaiSiswaMapel[] = riwayatSiswa.map((r) => {
      const s = r.siswa;
      const nilaiSiswa = allNilai.filter((n) => n.siswa_id === s.id);

      const nilaiFormatif = nilaiSiswa
        .filter((n) => n.komponen === KomponenNilai.FORMATIF)
        .map((n) => ({
          id: n.id,
          judul: n.judul,
          nilai: Number(n.nilai),
          catatan: n.catatan,
        }));

      const stsRecord = nilaiSiswa.find((n) => n.komponen === KomponenNilai.STS);
      const sasRecord = nilaiSiswa.find((n) => n.komponen === KomponenNilai.SAS);

      const nilaiSts = stsRecord ? Number(stsRecord.nilai) : null;
      const nilaiSas = sasRecord ? Number(sasRecord.nilai) : null;

      let rataFormatif: number | null = null;
      if (nilaiFormatif.length > 0) {
        const total = nilaiFormatif.reduce((acc, curr) => acc + curr.nilai, 0);
        rataFormatif = Math.round((total / nilaiFormatif.length) * 100) / 100;
      }

      const nilaiAkhir = this.hitungNilaiAkhir(
        rataFormatif,
        nilaiSts,
        nilaiSas,
        konfigurasi,
      );

      let predikat: PredikatBBPB | null = null;
      let predikatLabel: string | null = null;
      if (nilaiAkhir !== null) {
        const pInfo = this.hitungPredikat(nilaiAkhir, konfigurasi);
        predikat = pInfo.kode;
        predikatLabel = pInfo.label;
      }

      return {
        siswa_id: s.id,
        nisn: s.nisn,
        nama: s.nama,
        nilai_formatif: nilaiFormatif,
        rata_formatif: rataFormatif,
        nilai_sts: nilaiSts,
        nilai_sas: nilaiSas,
        nilai_akhir: nilaiAkhir,
        predikat,
        predikat_label: predikatLabel,
        catatan_capaian: catatanMap.get(s.id) || null,
      };
    });

    const namaLengkapKelas = `${kelas.tingkat} ${kelas.jurusan.kode} ${kelas.nama_rombel}`;

    return {
      kelas: {
        id: kelas.id,
        tingkat: kelas.tingkat,
        nama_rombel: kelas.nama_rombel,
        nama_lengkap: namaLengkapKelas,
      },
      mapel: {
        id: mapel.id,
        nama: mapel.nama,
        kode: mapel.kode,
      },
      tahun_ajaran: {
        id: tahunAjaran.id,
        nama: tahunAjaran.nama,
        semester: tahunAjaran.semester,
      },
      konfigurasi: {
        bobot_formatif: konfigurasi.bobot_formatif,
        bobot_sts: konfigurasi.bobot_sts,
        bobot_sas: konfigurasi.bobot_sas,
        batas_bb: konfigurasi.batas_bb,
        batas_mb: konfigurasi.batas_mb,
        batas_bsh: konfigurasi.batas_bsh,
      },
      kolom_formatif: kolomFormatif,
      siswa_list: siswaList,
    };
  }

  // =========================================================================
  // REKAP SEMUA MAPEL KELAS (UNTUK WALI KELAS / ADMIN)
  // =========================================================================

  async getRekapSemuaMapelKelas(
    kelasId: string,
    sekolahId: string,
    tahunAjaranId?: string,
  ): Promise<RekapSemuaMapelKelasResponse> {
    let resolvedTahunAjaranId = tahunAjaranId;
    if (!resolvedTahunAjaranId) {
      const activeTahun = await this.prisma.tahunAjaran.findFirst({
        where: { sekolah_id: sekolahId, status: 'AKTIF' },
        select: { id: true },
      });
      resolvedTahunAjaranId = activeTahun?.id;
    }

    if (!resolvedTahunAjaranId) {
      throw new NotFoundException('Tahun ajaran tidak ditemukan');
    }

    const [kelas, tahunAjaran, konfigurasi, riwayatSiswa, jadwalMapel, allNilai] =
      await Promise.all([
        this.prisma.kelas.findUnique({
          where: { id: kelasId },
          select: {
            id: true,
            tingkat: true,
            nama_rombel: true,
            jurusan: { select: { kode: true } },
          },
        }),
        this.prisma.tahunAjaran.findUnique({
          where: { id: resolvedTahunAjaranId },
          select: { id: true, nama: true, semester: true },
        }),
        this.getKonfigurasiPenilaian(sekolahId, resolvedTahunAjaranId),
        this.prisma.riwayatKelasSiswa.findMany({
          where: {
            kelas_id: kelasId,
            tahun_ajaran_id: resolvedTahunAjaranId,
          },
          select: {
            siswa: {
              select: { id: true, nisn: true, nama: true },
            },
          },
          orderBy: { siswa: { nama: 'asc' } },
        }),
        this.prisma.jadwalPelajaran.findMany({
          where: {
            kelas_id: kelasId,
            tahun_ajaran_id: resolvedTahunAjaranId,
          },
          select: { mapel_id: true },
          distinct: ['mapel_id'],
        }),
        this.prisma.nilaiSiswa.findMany({
          where: {
            kelas_id: kelasId,
            tahun_ajaran_id: resolvedTahunAjaranId,
          },
        }),
      ]);

    if (!kelas || !tahunAjaran) {
      throw new NotFoundException('Data kelas atau tahun ajaran tidak valid');
    }

    const relevantMapelIds = new Set<string>([
      ...jadwalMapel.map((j) => j.mapel_id),
      ...allNilai.map((n) => n.mapel_id),
    ]);

    const mapelList = await this.prisma.mataPelajaran.findMany({
      where: {
        sekolah_id: sekolahId,
        ...(relevantMapelIds.size > 0 ? { id: { in: Array.from(relevantMapelIds) } } : {}),
      },
      select: { id: true, nama: true, kode: true },
      orderBy: { nama: 'asc' },
    });

    const namaLengkap = `${kelas.tingkat} ${kelas.jurusan.kode} ${kelas.nama_rombel}`;

    const siswaList = riwayatSiswa.map((r) => {
      const s = r.siswa;
      const mapelNilai: Record<
        string,
        {
          rata_formatif: number | null;
          nilai_sts: number | null;
          nilai_sas: number | null;
          nilai_akhir: number | null;
          predikat: PredikatBBPB | null;
        }
      > = {};

      for (const m of mapelList) {
        const nilaiMapel = allNilai.filter(
          (n) => n.siswa_id === s.id && n.mapel_id === m.id,
        );

        const formatifList = nilaiMapel.filter(
          (n) => n.komponen === KomponenNilai.FORMATIF,
        );
        const sts = nilaiMapel.find((n) => n.komponen === KomponenNilai.STS);
        const sas = nilaiMapel.find((n) => n.komponen === KomponenNilai.SAS);

        const nilaiSts = sts ? Number(sts.nilai) : null;
        const nilaiSas = sas ? Number(sas.nilai) : null;

        let rataFormatif: number | null = null;
        if (formatifList.length > 0) {
          const total = formatifList.reduce(
            (acc, curr) => acc + Number(curr.nilai),
            0,
          );
          rataFormatif =
            Math.round((total / formatifList.length) * 100) / 100;
        }

        const nilaiAkhir = this.hitungNilaiAkhir(
          rataFormatif,
          nilaiSts,
          nilaiSas,
          konfigurasi,
        );

        let predikat: PredikatBBPB | null = null;
        if (nilaiAkhir !== null) {
          predikat = this.hitungPredikat(nilaiAkhir, konfigurasi).kode;
        }

        mapelNilai[m.id] = {
          rata_formatif: rataFormatif,
          nilai_sts: nilaiSts,
          nilai_sas: nilaiSas,
          nilai_akhir: nilaiAkhir,
          predikat,
        };
      }

      return {
        siswa_id: s.id,
        nisn: s.nisn,
        nama: s.nama,
        mapel_nilai: mapelNilai,
      };
    });

    return {
      kelas: {
        id: kelas.id,
        tingkat: kelas.tingkat,
        nama_rombel: kelas.nama_rombel,
        nama_lengkap: namaLengkap,
      },
      tahun_ajaran: {
        id: tahunAjaran.id,
        nama: tahunAjaran.nama,
        semester: tahunAjaran.semester,
      },
      mapel_list: mapelList,
      siswa_list: siswaList,
    };
  }

  // =========================================================================
  // CATATAN CAPAIAN (DESKRIPSI NARASI)
  // =========================================================================

  async saveCatatanCapaianSingle(
    dto: SaveCatatanCapaianDto,
    guruId: string,
    userRole: UserRole,
    sekolahId: string,
  ) {
    const saved = await this.prisma.catatanCapaian.upsert({
      where: {
        siswa_id_mapel_id_tahun_ajaran_id: {
          siswa_id: dto.siswa_id,
          mapel_id: dto.mapel_id,
          tahun_ajaran_id: dto.tahun_ajaran_id,
        },
      },
      create: {
        siswa_id: dto.siswa_id,
        mapel_id: dto.mapel_id,
        tahun_ajaran_id: dto.tahun_ajaran_id,
        guru_id: guruId,
        deskripsi: dto.deskripsi,
      },
      update: {
        deskripsi: dto.deskripsi,
        guru_id: guruId,
      },
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: guruId,
      actor_type: userRole,
      action: 'SAVE_CATATAN_CAPAIAN',
      resource: 'NILAI',
      resource_id: saved.id,
      details: `Simpan catatan capaian untuk siswa ${dto.siswa_id} mapel ${dto.mapel_id}`,
    });

    return saved;
  }

  async saveCatatanCapaianBatch(
    dto: SaveCatatanCapaianBatchDto,
    guruId: string,
    userRole: UserRole,
    sekolahId: string,
  ) {
    if (!dto.items || dto.items.length === 0) {
      return { message: 'Tidak ada data catatan capaian yang disimpan', count: 0, data: [] };
    }

    const results = await this.prisma.$transaction(async (tx) => {
      const operations = dto.items.map((item) =>
        tx.catatanCapaian.upsert({
          where: {
            siswa_id_mapel_id_tahun_ajaran_id: {
              siswa_id: item.siswa_id,
              mapel_id: dto.mapel_id,
              tahun_ajaran_id: dto.tahun_ajaran_id,
            },
          },
          create: {
            siswa_id: item.siswa_id,
            mapel_id: dto.mapel_id,
            tahun_ajaran_id: dto.tahun_ajaran_id,
            guru_id: guruId,
            deskripsi: item.deskripsi,
          },
          update: {
            deskripsi: item.deskripsi,
            guru_id: guruId,
          },
        }),
      );

      return Promise.all(operations);
    });


    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: guruId,
      actor_type: userRole,
      action: 'BATCH_SAVE_CATATAN_CAPAIAN',
      resource: 'NILAI',
      details: `Simpan batch ${results.length} catatan capaian kelas ${dto.kelas_id}`,
    });

    return {
      message: `${results.length} catatan capaian berhasil disimpan`,
      count: results.length,
      data: results,
    };
  }

  async getCatatanCapaianKelasMapel(
    kelasId: string,
    mapelId: string,
    tahunAjaranId: string,
  ) {
    const riwayatSiswa = await this.prisma.riwayatKelasSiswa.findMany({
      where: {
        kelas_id: kelasId,
        tahun_ajaran_id: tahunAjaranId,
      },
      select: {
        siswa: { select: { id: true, nama: true, nisn: true } },
      },
      orderBy: { siswa: { nama: 'asc' } },
    });

    const siswaIds = riwayatSiswa.map((r) => r.siswa.id);

    const catatanList = await this.prisma.catatanCapaian.findMany({
      where: {
        siswa_id: { in: siswaIds },
        mapel_id: mapelId,
        tahun_ajaran_id: tahunAjaranId,
      },
    });

    const catatanMap = new Map<string, string>();
    for (const c of catatanList) {
      catatanMap.set(c.siswa_id, c.deskripsi);
    }

    return riwayatSiswa.map((r) => ({
      siswa_id: r.siswa.id,
      nama: r.siswa.nama,
      nisn: r.siswa.nisn,
      deskripsi: catatanMap.get(r.siswa.id) || '',
    }));
  }

  // =========================================================================
  // DAFTAR KELAS & MAPEL YANG DIAMPU GURU (UNTUK DASHBOARD GURU)
  // =========================================================================

  async getKelasMapelGuru(guruId: string, sekolahId: string) {
    const activeTahun = await this.prisma.tahunAjaran.findFirst({
      where: { sekolah_id: sekolahId, status: 'AKTIF' },
      select: { id: true, nama: true, semester: true },
    });

    if (!activeTahun) {
      return { tahun_ajaran: null, items: [] };
    }

    const jadwals = await this.prisma.jadwalPelajaran.findMany({
      where: {
        guru_id: guruId,
        tahun_ajaran_id: activeTahun.id,
      },
      select: {
        kelas: {
          select: {
            id: true,
            tingkat: true,
            nama_rombel: true,
            jurusan: { select: { nama: true, kode: true } },
            _count: {
              select: {
                riwayat_kelas_siswa: {
                  where: { tahun_ajaran_id: activeTahun.id },
                },
              },
            },
          },
        },
        mapel: {
          select: { id: true, nama: true, kode: true },
        },
      },
    });

    // Hilangkan duplikasi kelas+mapel yang sama di hari berbeda
    const uniqueMap = new Map<string, any>();
    for (const j of jadwals) {
      const key = `${j.kelas.id}-${j.mapel.id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          kelas_id: j.kelas.id,
          kelas_nama: `${j.kelas.tingkat} ${j.kelas.jurusan.kode} ${j.kelas.nama_rombel}`,
          tingkat: j.kelas.tingkat,
          jumlah_siswa: j.kelas._count.riwayat_kelas_siswa,
          mapel_id: j.mapel.id,
          mapel_nama: j.mapel.nama,
          mapel_kode: j.mapel.kode,
        });
      }
    }

    return {
      tahun_ajaran: activeTahun,
      items: Array.from(uniqueMap.values()),
    };
  }
}
