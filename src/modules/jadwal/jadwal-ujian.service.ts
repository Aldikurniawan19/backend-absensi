import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateJadwalUjianDto,
  GenerateJadwalUjianDto,
} from './dto/jadwal-ujian.dto';

export interface JadwalUjianRecord {
  id: string;
  sekolah_id: string;
  tahun_ajaran_id: string;
  nama_ujian: string;
  jenis: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  tahun_ajaran_nama?: string;
  total_items?: number;
  total_kelas?: number;
}

export interface JadwalUjianItemRecord {
  id: string;
  jadwal_ujian_id: string;
  kelas_id: string;
  mapel_id: string;
  guru_id: string | null;
  tanggal: string;
  hari: number;
  jam_mulai: string;
  jam_selesai: string;
  ruangan: string | null;
  mapel_nama?: string;
  mapel_kode?: string;
  guru_nama?: string;
  kelas_nama?: string;
}

@Injectable()
export class JadwalUjianService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.initDatabaseTables();
  }

  /**
   * Inisialisasi tabel basis data Jadwal Ujian pada PostgreSQL
   */
  private async initDatabaseTables() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "jadwal_ujian" (
          "id" TEXT PRIMARY KEY,
          "sekolah_id" TEXT NOT NULL,
          "tahun_ajaran_id" TEXT NOT NULL,
          "nama_ujian" TEXT NOT NULL,
          "jenis" TEXT NOT NULL DEFAULT 'PTS',
          "tanggal_mulai" DATE NOT NULL,
          "tanggal_selesai" DATE NOT NULL,
          "is_active" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "jadwal_ujian_item" (
          "id" TEXT PRIMARY KEY,
          "jadwal_ujian_id" TEXT NOT NULL,
          "kelas_id" TEXT NOT NULL,
          "mapel_id" TEXT NOT NULL,
          "guru_id" TEXT,
          "tanggal" DATE NOT NULL,
          "hari" INTEGER NOT NULL,
          "jam_mulai" TEXT NOT NULL,
          "jam_selesai" TEXT NOT NULL,
          "ruangan" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_jadwal_ujian_sekolah" ON "jadwal_ujian"("sekolah_id", "is_active");
        CREATE INDEX IF NOT EXISTS "idx_jadwal_ujian_item_parent" ON "jadwal_ujian_item"("jadwal_ujian_id");
        CREATE INDEX IF NOT EXISTS "idx_jadwal_ujian_item_kelas" ON "jadwal_ujian_item"("kelas_id", "tanggal");
        CREATE INDEX IF NOT EXISTS "idx_jadwal_ujian_item_guru" ON "jadwal_ujian_item"("guru_id", "tanggal");
      `);
    } catch (err) {
      console.warn('Inisialisasi tabel jadwal_ujian selesai / menggunakan schema eksisting:', err);
    }
  }

  /**
   * Mengambil daftar seluruh jadwal ujian untuk sekolah/tahun ajaran
   */
  async getJadwalUjianList(sekolahId: string, tahunAjaranId?: string): Promise<JadwalUjianRecord[]> {
    let query = `
      SELECT 
        u.id, 
        u.sekolah_id, 
        u.tahun_ajaran_id, 
        u.nama_ujian, 
        u.jenis, 
        TO_CHAR(u.tanggal_mulai, 'YYYY-MM-DD') as tanggal_mulai, 
        TO_CHAR(u.tanggal_selesai, 'YYYY-MM-DD') as tanggal_selesai, 
        u.is_active, 
        u."createdAt", 
        u."updatedAt",
        t.nama as tahun_ajaran_nama,
        t.semester as tahun_ajaran_semester,
        COUNT(DISTINCT i.id)::int as total_items,
        COUNT(DISTINCT i.kelas_id)::int as total_kelas
      FROM "jadwal_ujian" u
      LEFT JOIN "tahun_ajaran" t ON u.tahun_ajaran_id = t.id
      LEFT JOIN "jadwal_ujian_item" i ON u.id = i.jadwal_ujian_id
      WHERE u.sekolah_id = $1
    `;

    const params: any[] = [sekolahId];

    if (tahunAjaranId) {
      query += ` AND u.tahun_ajaran_id = $2`;
      params.push(tahunAjaranId);
    }

    query += ` GROUP BY u.id, t.nama, t.semester ORDER BY u."createdAt" DESC`;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);

    return rows.map((r) => ({
      ...r,
      is_active: Boolean(r.is_active),
      total_items: Number(r.total_items || 0),
      total_kelas: Number(r.total_kelas || 0),
      tahun_ajaran_nama: r.tahun_ajaran_nama ? `${r.tahun_ajaran_nama} (${r.tahun_ajaran_semester || ''})` : '-',
    }));
  }

  /**
   * Mengambil detail jadwal ujian beserta slot sesi ujian (dengan pagination & filter optimal)
   */
  async getJadwalUjianDetail(
    id: string,
    sekolahId: string,
    page: number = 1,
    limit: number = 20,
    kelasId?: string,
    search?: string,
    tanggal?: string,
  ) {
    const ujianRows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT 
        u.id, u.sekolah_id, u.tahun_ajaran_id, u.nama_ujian, u.jenis,
        TO_CHAR(u.tanggal_mulai, 'YYYY-MM-DD') as tanggal_mulai, 
        TO_CHAR(u.tanggal_selesai, 'YYYY-MM-DD') as tanggal_selesai, 
        u.is_active, u."createdAt", u."updatedAt",
        t.nama as tahun_ajaran_nama, t.semester as tahun_ajaran_semester
      FROM "jadwal_ujian" u
      LEFT JOIN "tahun_ajaran" t ON u.tahun_ajaran_id = t.id
      WHERE u.id = $1 AND u.sekolah_id = $2
      LIMIT 1
      `,
      id,
      sekolahId,
    );

    if (!ujianRows || ujianRows.length === 0) {
      throw new NotFoundException('Jadwal ujian tidak ditemukan');
    }

    const ujian = ujianRows[0];

    // Bangun filter query items
    let whereClause = `WHERE i.jadwal_ujian_id = $1`;
    const params: any[] = [id];
    let paramIndex = 2;

    if (kelasId && kelasId !== 'ALL') {
      whereClause += ` AND i.kelas_id = $${paramIndex}`;
      params.push(kelasId);
      paramIndex++;
    }

    if (tanggal) {
      whereClause += ` AND i.tanggal = CAST($${paramIndex} AS DATE)`;
      params.push(tanggal);
      paramIndex++;
    }

    if (search && search.trim() !== '') {
      const searchPattern = `%${search.trim()}%`;
      whereClause += ` AND (m.nama ILIKE $${paramIndex} OR m.kode ILIKE $${paramIndex} OR g.nama ILIKE $${paramIndex} OR i.ruangan ILIKE $${paramIndex})`;
      params.push(searchPattern);
      paramIndex++;
    }

    // Hitung total data sesuai filter
    const countQuery = `
      SELECT COUNT(i.id)::int as total
      FROM "jadwal_ujian_item" i
      LEFT JOIN "mata_pelajaran" m ON i.mapel_id = m.id
      LEFT JOIN "guru" g ON i.guru_id = g.id
      LEFT JOIN "kelas" k ON i.kelas_id = k.id
      ${whereClause}
    `;

    const countResult = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
      countQuery,
      ...params,
    );
    const total = Number(countResult[0]?.total || 0);

    // Ambil data terpaginasi
    const safeLimit = Math.max(1, Math.min(100, limit));
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;

    const dataParams = [...params, safeLimit, offset];
    const dataQuery = `
      SELECT 
        i.id, i.jadwal_ujian_id, i.kelas_id, i.mapel_id, i.guru_id,
        TO_CHAR(i.tanggal, 'YYYY-MM-DD') as tanggal,
        i.hari, i.jam_mulai, i.jam_selesai, i.ruangan,
        m.nama as mapel_nama, m.kode as mapel_kode,
        g.nama as guru_nama,
        CONCAT('Kelas ', k.tingkat, ' ', j.kode, ' ', k.nama_rombel) as kelas_nama
      FROM "jadwal_ujian_item" i
      LEFT JOIN "mata_pelajaran" m ON i.mapel_id = m.id
      LEFT JOIN "guru" g ON i.guru_id = g.id
      LEFT JOIN "kelas" k ON i.kelas_id = k.id
      LEFT JOIN "jurusan" j ON k.jurusan_id = j.id
      ${whereClause}
      ORDER BY i.tanggal ASC, i.jam_mulai ASC, k.tingkat ASC, k.nama_rombel ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const items = await this.prisma.$queryRawUnsafe<any[]>(dataQuery, ...dataParams);

    return {
      ...ujian,
      is_active: Boolean(ujian.is_active),
      items,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    };
  }

  /**
   * Mengambil Jadwal Ujian yang sedang AKTIF (untuk Tampilan Mobile Siswa & Guru)
   */
  async getActiveJadwalUjian(sekolahId?: string, kelasId?: string, guruId?: string) {
    let whereSekolah = '';
    const params: any[] = [];

    if (sekolahId) {
      whereSekolah = 'WHERE u.sekolah_id = $1 AND u.is_active = true';
      params.push(sekolahId);
    } else {
      whereSekolah = 'WHERE u.is_active = true';
    }

    const activeUjianRows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT 
        u.id, u.sekolah_id, u.tahun_ajaran_id, u.nama_ujian, u.jenis,
        TO_CHAR(u.tanggal_mulai, 'YYYY-MM-DD') as tanggal_mulai, 
        TO_CHAR(u.tanggal_selesai, 'YYYY-MM-DD') as tanggal_selesai, 
        u.is_active,
        t.nama as tahun_ajaran_nama, t.semester as tahun_ajaran_semester
      FROM "jadwal_ujian" u
      LEFT JOIN "tahun_ajaran" t ON u.tahun_ajaran_id = t.id
      ${whereSekolah}
      ORDER BY u."updatedAt" DESC
      LIMIT 1
      `,
      ...params,
    );

    if (!activeUjianRows || activeUjianRows.length === 0) {
      return null;
    }

    const activeUjian = activeUjianRows[0];

    // Ambil item ujian untuk kelas siswa / guru terkait
    let itemQuery = `
      SELECT 
        i.id, i.jadwal_ujian_id, i.kelas_id, i.mapel_id, i.guru_id,
        TO_CHAR(i.tanggal, 'YYYY-MM-DD') as tanggal,
        i.hari, i.jam_mulai, i.jam_selesai, i.ruangan,
        m.nama as mapel_nama, m.kode as mapel_kode,
        g.nama as guru_nama,
        CONCAT('Kelas ', k.tingkat, ' ', j.kode, ' ', k.nama_rombel) as kelas_nama
      FROM "jadwal_ujian_item" i
      LEFT JOIN "mata_pelajaran" m ON i.mapel_id = m.id
      LEFT JOIN "guru" g ON i.guru_id = g.id
      LEFT JOIN "kelas" k ON i.kelas_id = k.id
      LEFT JOIN "jurusan" j ON k.jurusan_id = j.id
      WHERE i.jadwal_ujian_id = $1
    `;

    const itemParams: any[] = [activeUjian.id];

    if (kelasId) {
      itemQuery += ` AND i.kelas_id = $2`;
      itemParams.push(kelasId);
    } else if (guruId) {
      itemQuery += ` AND i.guru_id = $2`;
      itemParams.push(guruId);
    }

    itemQuery += ` ORDER BY i.tanggal ASC, i.jam_mulai ASC`;

    const items = await this.prisma.$queryRawUnsafe<any[]>(itemQuery, ...itemParams);

    return {
      ...activeUjian,
      is_active: true,
      items,
      total_items: items.length,
    };
  }

  /**
   * Men-generate simulasi/pratinjau Jadwal Ujian otomatis (PTS / PAS)
   */
  async generateJadwalUjianPreview(dto: GenerateJadwalUjianDto, sekolahId: string) {
    const tahunAjaran = await this.prisma.tahunAjaran.findUnique({
      where: { id: dto.tahun_ajaran_id },
    });
    if (!tahunAjaran) {
      throw new NotFoundException('Tahun ajaran tidak ditemukan');
    }

    // Ambil kelas-kelas target
    const whereKelas: any = { sekolah_id: sekolahId };
    if (dto.kelas_ids && dto.kelas_ids.length > 0) {
      whereKelas.id = { in: dto.kelas_ids };
    } else if (dto.tingkat_list && dto.tingkat_list.length > 0) {
      whereKelas.tingkat = { in: dto.tingkat_list };
    }

    const classes = await this.prisma.kelas.findMany({
      where: whereKelas,
      include: { jurusan: true },
      orderBy: [{ tingkat: 'asc' }, { jurusan: { kode: 'asc' } }, { nama_rombel: 'asc' }],
    });

    if (classes.length === 0) {
      throw new BadRequestException('Tidak ada kelas yang dipilih untuk jadwal ujian.');
    }

    // Ambil daftar guru dan mata pelajaran
    const teachers = await this.prisma.guru.findMany({
      where: { sekolah_id: sekolahId },
      select: { id: true, nama: true, nip: true },
    });

    const subjects = await this.prisma.mataPelajaran.findMany({
      where: { sekolah_id: sekolahId },
    });

    if (subjects.length === 0) {
      throw new BadRequestException('Belum ada data mata pelajaran terdaftar.');
    }

    // Bangun daftar tanggal ujian (Senin - Sabtu, Minggu diskip)
    const [sY, sM, sD] = dto.tanggal_mulai.split('-').map(Number);
    const [eY, eM, eD] = dto.tanggal_selesai.split('-').map(Number);
    const startDate = new Date(sY, sM - 1, sD);
    const endDate = new Date(eY, eM - 1, eD);
    const examDates: Array<{ dateStr: string; hari: number; display: string }> = [];

    const dayLabels = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const cur = new Date(startDate);
    while (cur <= endDate) {
      const jsDay = cur.getDay();
      if (jsDay !== 0) {
        // Bukan hari Minggu
        const sysDay = jsDay; // 1=Senin..6=Sabtu
        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        examDates.push({
          dateStr,
          hari: sysDay,
          display: `${dayLabels[jsDay]}, ${dd}/${mm}/${yyyy}`,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (examDates.length === 0) {
      throw new BadRequestException('Rentang tanggal ujian tidak memuat hari efektif (Senin-Sabtu).');
    }

    // Sesi waktu ujian per hari
    const sessions = [
      {
        sesi: 1,
        jam_mulai: dto.jam_mulai_sesi_1 || '07:30',
        jam_selesai: dto.jam_selesai_sesi_1 || '09:00',
      },
    ];

    if ((dto.sesi_per_hari || 2) >= 2) {
      sessions.push({
        sesi: 2,
        jam_mulai: dto.jam_mulai_sesi_2 || '09:30',
        jam_selesai: dto.jam_selesai_sesi_2 || '11:00',
      });
    }

    // Generate slot ujian untuk setiap kelas
    const generatedItems: Array<JadwalUjianItemRecord & { kelas_nama: string; mapel_nama: string; guru_nama: string }> = [];

    let teacherIdx = 0;

    for (const cls of classes) {
      const kelasNama = `Kelas ${cls.tingkat} ${cls.jurusan.kode} ${cls.nama_rombel}`;
      const ruangan = `Ruang ${cls.tingkat}-${cls.jurusan.kode}-${cls.nama_rombel}`;

      let subjectIdx = 0;
      for (const d of examDates) {
        for (const s of sessions) {
          if (subjectIdx >= subjects.length) break;

          const mapel = subjects[subjectIdx % subjects.length];
          const guru = teachers.length > 0 ? teachers[teacherIdx % teachers.length] : null;
          teacherIdx++;
          subjectIdx++;

          generatedItems.push({
            id: crypto.randomUUID(),
            jadwal_ujian_id: '',
            kelas_id: cls.id,
            mapel_id: mapel.id,
            guru_id: guru?.id || null,
            tanggal: d.dateStr,
            hari: d.hari,
            jam_mulai: s.jam_mulai,
            jam_selesai: s.jam_selesai,
            ruangan,
            mapel_nama: mapel.nama,
            mapel_kode: mapel.kode,
            guru_nama: guru?.nama || 'Pengawas Belum Ditugaskan',
            kelas_nama: kelasNama,
          });
        }
      }
    }

    return {
      nama_ujian: dto.nama_ujian,
      jenis: dto.jenis,
      tahun_ajaran_id: dto.tahun_ajaran_id,
      tahun_ajaran_nama: `${tahunAjaran.nama} (${tahunAjaran.semester})`,
      tanggal_mulai: dto.tanggal_mulai,
      tanggal_selesai: dto.tanggal_selesai,
      total_hari: examDates.length,
      total_kelas: classes.length,
      total_items: generatedItems.length,
      is_active: dto.is_active ?? true,
      items: generatedItems,
    };
  }

  /**
   * Menyimpan Jadwal Ujian baru beserta seluruh item slot ujian
   */
  async createJadwalUjian(dto: CreateJadwalUjianDto, sekolahId: string, actorId: string) {
    try {
      await this.initDatabaseTables();

      const ujianId = crypto.randomUUID();

      // Jika items tidak dikirim (optimasi payload), generate langsung di server
      let itemsToInsert = dto.items;
      if (!itemsToInsert || itemsToInsert.length === 0) {
        const preview = await this.generateJadwalUjianPreview(
          {
            nama_ujian: dto.nama_ujian,
            jenis: dto.jenis,
            tahun_ajaran_id: dto.tahun_ajaran_id,
            tanggal_mulai: dto.tanggal_mulai,
            tanggal_selesai: dto.tanggal_selesai,
            sesi_per_hari: dto.sesi_per_hari,
            jam_mulai_sesi_1: dto.jam_mulai_sesi_1,
            jam_selesai_sesi_1: dto.jam_selesai_sesi_1,
            jam_mulai_sesi_2: dto.jam_mulai_sesi_2,
            jam_selesai_sesi_2: dto.jam_selesai_sesi_2,
            tingkat_list: dto.tingkat_list,
            kelas_ids: dto.kelas_ids,
            is_active: dto.is_active,
          },
          sekolahId,
        );
        itemsToInsert = (preview.items || []).map((it) => ({
          kelas_id: it.kelas_id,
          mapel_id: it.mapel_id,
          guru_id: it.guru_id || undefined,
          tanggal: it.tanggal,
          hari: it.hari,
          jam_mulai: it.jam_mulai,
          jam_selesai: it.jam_selesai,
          ruangan: it.ruangan || undefined,
        }));
      }

      const totalItemsCount = itemsToInsert ? itemsToInsert.length : 0;

      const result = await this.prisma.$transaction(
        async (tx) => {
          // Jika status aktif dipilih, nonaktifkan jadwal ujian lain di sekolah ini
          if (dto.is_active) {
            await tx.$executeRawUnsafe(
              `UPDATE "jadwal_ujian" SET "is_active" = false WHERE "sekolah_id" = $1`,
              sekolahId,
            );
          }

          // Buat data header jadwal_ujian
          await tx.$executeRawUnsafe(
            `
            INSERT INTO "jadwal_ujian" (
              "id", "sekolah_id", "tahun_ajaran_id", "nama_ujian", "jenis", 
              "tanggal_mulai", "tanggal_selesai", "is_active", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, CAST($6 AS DATE), CAST($7 AS DATE), $8, NOW(), NOW())
            `,
            ujianId,
            sekolahId,
            dto.tahun_ajaran_id,
            dto.nama_ujian,
            dto.jenis || 'PTS',
            dto.tanggal_mulai,
            dto.tanggal_selesai,
            Boolean(dto.is_active),
          );

          // Simpan seluruh slot item ujian secara batch chunk (100 baris per query)
          if (itemsToInsert && itemsToInsert.length > 0) {
            const chunkSize = 100;
            for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
              const chunk = itemsToInsert.slice(i, i + chunkSize);
              const placeholders: string[] = [];
              const params: any[] = [];
              let pIdx = 1;

              for (const item of chunk) {
                const itemId = crypto.randomUUID();
                placeholders.push(
                  `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, CAST($${pIdx + 5} AS DATE), $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, NOW(), NOW())`,
                );
                params.push(
                  itemId,
                  ujianId,
                  String(item.kelas_id),
                  String(item.mapel_id),
                  item.guru_id ? String(item.guru_id) : null,
                  String(item.tanggal),
                  Number(item.hari) || 1,
                  String(item.jam_mulai),
                  String(item.jam_selesai),
                  item.ruangan ? String(item.ruangan) : null,
                );
                pIdx += 10;
              }

              const insertItemsSql = `
                INSERT INTO "jadwal_ujian_item" (
                  "id", "jadwal_ujian_id", "kelas_id", "mapel_id", "guru_id",
                  "tanggal", "hari", "jam_mulai", "jam_selesai", "ruangan", "createdAt", "updatedAt"
                ) VALUES ${placeholders.join(', ')}
              `;

              await tx.$executeRawUnsafe(insertItemsSql, ...params);
            }
          }

          return {
            success: true,
            id: ujianId,
            message: `Jadwal ujian "${dto.nama_ujian}" berhasil dibuat (${totalItemsCount} sesi). Status: ${dto.is_active ? 'Aktif di Mobile' : 'Disimpan sebagai Draf'}.`,
            is_active: Boolean(dto.is_active),
          };
        },
        {
          timeout: 30000,
          maxWait: 10000,
        },
      );

      // Audit log dicatat di luar transaksi agar tidak membebani transaksi DB
      await this.auditService.log({
        sekolah_id: sekolahId,
        actor_id: actorId,
        actor_type: UserRole.ADMIN,
        action: 'CREATE_JADWAL_UJIAN',
        resource: 'JADWAL_UJIAN',
        resource_id: ujianId,
        details: `Membuat jadwal ujian ${dto.nama_ujian} (${dto.items?.length || 0} sesi ujian, Status: ${dto.is_active ? 'AKTIF (Tampil di Mobile)' : 'NONAKTIF'})`,
      });

      return result;
    } catch (err: any) {
      console.error('Error saat membuat jadwal ujian:', err);
      if (err instanceof HttpException) {
        throw err;
      }
      throw new BadRequestException(
        err?.message || 'Gagal menyimpan jadwal ujian pada database',
      );
    }
  }

  /**
   * Mengubah status aktivasi Jadwal Ujian (Aktifkan / Nonaktifkan untuk Mobile)
   */
  async toggleStatus(id: string, isActive: boolean, sekolahId: string, actorId: string) {
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "jadwal_ujian" WHERE "id" = $1 AND "sekolah_id" = $2 LIMIT 1`,
      id,
      sekolahId,
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException('Jadwal ujian tidak ditemukan');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        if (isActive) {
          // Nonaktifkan jadwal ujian lain di sekolah ini
          await tx.$executeRawUnsafe(
            `UPDATE "jadwal_ujian" SET "is_active" = false WHERE "sekolah_id" = $1`,
            sekolahId,
          );
        }

        await tx.$executeRawUnsafe(
          `UPDATE "jadwal_ujian" SET "is_active" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
          isActive,
          id,
        );

        return {
          success: true,
          message: isActive
            ? `Jadwal ujian "${existing[0].nama_ujian}" sekarang AKTIF dan muncul di aplikasi mobile.`
            : `Jadwal ujian "${existing[0].nama_ujian}" DINONAKTIFKAN (aplikasi mobile kembali ke jadwal reguler).`,
          is_active: isActive,
        };
      },
      {
        timeout: 15000,
        maxWait: 5000,
      },
    );

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: UserRole.ADMIN,
      action: 'TOGGLE_JADWAL_UJIAN',
      resource: 'JADWAL_UJIAN',
      resource_id: id,
      details: `${isActive ? 'Mengaktifkan' : 'Menonaktifkan'} jadwal ujian ${existing[0].nama_ujian} untuk aplikasi mobile`,
    });

    return result;
  }

  /**
   * Menghapus Jadwal Ujian
   */
  async deleteJadwalUjian(id: string, sekolahId: string, actorId: string) {
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "jadwal_ujian" WHERE "id" = $1 AND "sekolah_id" = $2 LIMIT 1`,
      id,
      sekolahId,
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException('Jadwal ujian tidak ditemukan');
    }

    if (Boolean(existing[0].is_active)) {
      throw new BadRequestException(
        'Jadwal ujian yang sedang aktif tidak dapat dihapus. Silakan nonaktifkan jadwal terlebih dahulu.',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`DELETE FROM "jadwal_ujian_item" WHERE "jadwal_ujian_id" = $1`, id);
        await tx.$executeRawUnsafe(`DELETE FROM "jadwal_ujian" WHERE "id" = $1`, id);
      },
      {
        timeout: 15000,
        maxWait: 5000,
      },
    );

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: UserRole.ADMIN,
      action: 'DELETE_JADWAL_UJIAN',
      resource: 'JADWAL_UJIAN',
      resource_id: id,
      details: `Menghapus jadwal ujian ${existing[0].nama_ujian}`,
    });

    return {
      success: true,
      message: `Jadwal ujian "${existing[0].nama_ujian}" berhasil dihapus.`,
    };
  }
}
