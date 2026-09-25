import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateJadwalUjianDto,
  GenerateJadwalUjianDto,
  GenerateKartuUjianDto,
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

export interface KartuUjianRecord {
  id: string;
  jadwal_ujian_id: string;
  siswa_id: string;
  kelas_id: string;
  ruangan: string;
  nomor_kursi: string;
  nomor_peserta: string;
  createdAt: string;
  updatedAt: string;
  siswa_nama?: string;
  siswa_nisn?: string;
  kelas_nama?: string;
  tingkat?: number;
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
   * Inisialisasi tabel basis data Jadwal Ujian & Kartu Ujian pada PostgreSQL
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
        CREATE TABLE IF NOT EXISTS "kartu_ujian" (
          "id" TEXT PRIMARY KEY,
          "jadwal_ujian_id" TEXT NOT NULL,
          "siswa_id" TEXT NOT NULL,
          "kelas_id" TEXT NOT NULL,
          "ruangan" TEXT NOT NULL,
          "nomor_kursi" TEXT NOT NULL,
          "nomor_peserta" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "uq_kartu_ujian_jadwal_siswa" UNIQUE ("jadwal_ujian_id", "siswa_id")
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_jadwal_ujian_sekolah" ON "jadwal_ujian"("sekolah_id", "is_active");
        CREATE INDEX IF NOT EXISTS "idx_jadwal_ujian_item_parent" ON "jadwal_ujian_item"("jadwal_ujian_id");
        CREATE INDEX IF NOT EXISTS "idx_jadwal_ujian_item_kelas" ON "jadwal_ujian_item"("kelas_id", "tanggal");
        CREATE INDEX IF NOT EXISTS "idx_jadwal_ujian_item_guru" ON "jadwal_ujian_item"("guru_id", "tanggal");
        CREATE INDEX IF NOT EXISTS "idx_kartu_ujian_jadwal" ON "kartu_ujian"("jadwal_ujian_id");
        CREATE INDEX IF NOT EXISTS "idx_kartu_ujian_siswa" ON "kartu_ujian"("siswa_id");
        CREATE INDEX IF NOT EXISTS "idx_kartu_ujian_ruangan" ON "kartu_ujian"("jadwal_ujian_id", "ruangan");
        CREATE INDEX IF NOT EXISTS "idx_kartu_ujian_kelas" ON "kartu_ujian"("jadwal_ujian_id", "kelas_id");
      `);
    } catch (err) {
      console.warn('Inisialisasi tabel jadwal_ujian/kartu_ujian selesai / menggunakan schema eksisting:', err);
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
        COALESCE(stat.total_items, 0)::int as total_items,
        COALESCE(stat.total_kelas, 0)::int as total_kelas
      FROM "jadwal_ujian" u
      LEFT JOIN "tahun_ajaran" t ON u.tahun_ajaran_id = t.id
      LEFT JOIN (
        SELECT 
          jadwal_ujian_id, 
          COUNT(id) as total_items, 
          COUNT(DISTINCT kelas_id) as total_kelas 
        FROM "jadwal_ujian_item" 
        GROUP BY jadwal_ujian_id
      ) stat ON u.id = stat.jadwal_ujian_id
      WHERE u.sekolah_id = $1
    `;

    const params: any[] = [sekolahId];

    if (tahunAjaranId) {
      query += ` AND u.tahun_ajaran_id = $2`;
      params.push(tahunAjaranId);
    }

    query += ` ORDER BY u."createdAt" DESC`;


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
  async getActiveJadwalUjian(sekolahId?: string, kelasId?: string, guruId?: string, siswaId?: string) {
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

    // Jika siswaId ada, resolve kelas siswa dan data kartu peserta ujian
    let siswaKartu: any = null;
    if (siswaId) {
      // 1. Cek kartu_ujian siswa jika sudah digenerate
      const kartuRows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT ku.ruangan, ku.nomor_kursi, ku.nomor_peserta, ku.kelas_id
        FROM "kartu_ujian" ku
        WHERE ku.jadwal_ujian_id = $1 AND ku.siswa_id = $2
        LIMIT 1
        `,
        activeUjian.id,
        siswaId,
      );

      if (kartuRows && kartuRows.length > 0) {
        siswaKartu = kartuRows[0];
        if (!kelasId && siswaKartu.kelas_id) {
          kelasId = siswaKartu.kelas_id;
        }
      }

      // 2. Jika kelasId masih belum didapat, cari dari riwayat_kelas_siswa pada tahun ajaran ujian terkait
      if (!kelasId) {
        const riwayat = await this.prisma.riwayatKelasSiswa.findFirst({
          where: {
            siswa_id: siswaId,
            tahun_ajaran_id: activeUjian.tahun_ajaran_id,
          },
          select: { kelas_id: true },
        });

        if (riwayat) {
          kelasId = riwayat.kelas_id;
        } else {
          const anyRiwayat = await this.prisma.riwayatKelasSiswa.findFirst({
            where: { siswa_id: siswaId },
            orderBy: { createdAt: 'desc' },
            select: { kelas_id: true },
          });
          if (anyRiwayat) {
            kelasId = anyRiwayat.kelas_id;
          }
        }
      }
    }

    // Ambil item ujian untuk kelas siswa / guru terkait
    let itemQuery = `
      SELECT 
        i.id, i.jadwal_ujian_id, i.kelas_id, i.mapel_id, i.guru_id,
        TO_CHAR(i.tanggal, 'YYYY-MM-DD') as tanggal,
        i.hari, i.jam_mulai, i.jam_selesai,
        COALESCE(i.ruangan, 'Ruang Ujian') as ruangan,
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

    const rawItems = await this.prisma.$queryRawUnsafe<any[]>(itemQuery, ...itemParams);

    // Jika siswa punya ruangan khusus dari kartu ujian, override ruangan item dengan ruangan kartu peserta
    const items = rawItems.map((item) => ({
      ...item,
      ruangan: (siswaKartu && siswaKartu.ruangan) ? siswaKartu.ruangan : item.ruangan,
      nomor_kursi: siswaKartu?.nomor_kursi,
      nomor_peserta: siswaKartu?.nomor_peserta,
    }));

    return {
      ...activeUjian,
      is_active: true,
      items,
      total_items: items.length,
      kartu_peserta: siswaKartu,
    };
  }

  /**
   * Men-generate simulasi/pratinjau Jadwal Ujian otomatis (PTS / PAS)
   * Setiap kelas hanya dijadwalkan sesuai mata pelajaran yang aktif diajarkan pada kelas tersebut
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

    // Ambil daftar guru dan mata pelajaran fallback sekolah
    const teachers = await this.prisma.guru.findMany({
      where: { sekolah_id: sekolahId },
      select: { id: true, nama: true, nip: true },
    });

    const fallbackSubjects = await this.prisma.mataPelajaran.findMany({
      where: { sekolah_id: sekolahId },
    });

    if (fallbackSubjects.length === 0) {
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

    // Generate slot ujian untuk setiap kelas spesifik sesuai mata pelajaran kelas tersebut
    const generatedItems: Array<JadwalUjianItemRecord & { kelas_nama: string; mapel_nama: string; guru_nama: string }> = [];

    let teacherIdx = 0;

    for (const cls of classes) {
      const kelasNama = `Kelas ${cls.tingkat} ${cls.jurusan.kode} ${cls.nama_rombel}`;
      const ruangan = `Ruang ${cls.tingkat}-${cls.jurusan.kode}-${cls.nama_rombel}`;

      // 1. Ambil mata pelajaran yang AKTIF diajarkan pada kelas ini di tahun ajaran terkait dari jadwal_pelajaran
      const jadwalClass = await this.prisma.jadwalPelajaran.findMany({
        where: {
          kelas_id: cls.id,
          tahun_ajaran_id: dto.tahun_ajaran_id,
        },
        include: {
          mapel: true,
          guru: { select: { id: true, nama: true, nip: true } },
        },
        orderBy: { mapel: { nama: 'asc' } },
      });

      const classMapelMap = new Map<string, { mapel: any; defaultGuru?: any }>();
      for (const jp of jadwalClass) {
        if (!classMapelMap.has(jp.mapel_id)) {
          classMapelMap.set(jp.mapel_id, { mapel: jp.mapel, defaultGuru: jp.guru });
        }
      }

      // 2. Jika jadwal_pelajaran belum ada, cek nilai_siswa pada kelas & tahun ajaran ini
      if (classMapelMap.size === 0) {
        const nilaiClass = await this.prisma.nilaiSiswa.findMany({
          where: {
            kelas_id: cls.id,
            tahun_ajaran_id: dto.tahun_ajaran_id,
          },
          include: {
            mapel: true,
            guru: { select: { id: true, nama: true, nip: true } },
          },
          distinct: ['mapel_id'],
        });

        for (const nc of nilaiClass) {
          if (!classMapelMap.has(nc.mapel_id)) {
            classMapelMap.set(nc.mapel_id, { mapel: nc.mapel, defaultGuru: nc.guru });
          }
        }
      }

      // 3. Fallback jika masih kosong (misal setup awal belum ada jadwal atau nilai)
      let classSubjects: Array<{ mapel: any; defaultGuru?: any }> = Array.from(classMapelMap.values());
      if (classSubjects.length === 0) {
        classSubjects = fallbackSubjects.map((m) => ({ mapel: m }));
      }

      let subjectIdx = 0;
      for (const d of examDates) {
        for (const s of sessions) {
          // Berhenti segera setelah semua mata pelajaran kelas ini terjadwalkan (e.g. 12 mapel)
          if (subjectIdx >= classSubjects.length) break;

          const { mapel, defaultGuru } = classSubjects[subjectIdx];
          const pengawas = teachers.length > 0 ? teachers[teacherIdx % teachers.length] : defaultGuru;
          teacherIdx++;
          subjectIdx++;

          generatedItems.push({
            id: crypto.randomUUID(),
            jadwal_ujian_id: '',
            kelas_id: cls.id,
            mapel_id: mapel.id,
            guru_id: pengawas?.id || null,
            tanggal: d.dateStr,
            hari: d.hari,
            jam_mulai: s.jam_mulai,
            jam_selesai: s.jam_selesai,
            ruangan,
            mapel_nama: mapel.nama,
            mapel_kode: mapel.kode,
            guru_nama: pengawas?.nama || 'Pengawas Belum Ditugaskan',
            kelas_nama: kelasNama,
          });
        }
        if (subjectIdx >= classSubjects.length) break;
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
        await tx.$executeRawUnsafe(`DELETE FROM "kartu_ujian" WHERE "jadwal_ujian_id" = $1`, id);
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

  // =========================================================================
  // FITUR KARTU UJIAN & PEMBAGIAN RUANG / KURSI
  // =========================================================================

  /**
   * Men-generate / menambahkan Kartu Ujian, Ruang Ujian, dan Nomor Kursi
   * Sesuai aturan:
   * 1. Urut mulai dari Kelas 10, 11, 12 (kemudian nama rombel & nama siswa)
   * 2. Kapasitas ruangan default 20 peserta per ruangan
   * 3. Jika ruangan penuh (20 peserta), sisa siswa lanjut ke ruangan berikutnya
   * 4. Format nomor kursi: A1, A2, A3, A4, B1, B2... (baris + kolom)
   * 5. Bersifat aditif (hanya menambahkan siswa yang belum punya nomor, tanpa mereset nomor yang ada)
   */
  async generateKartuUjian(
    jadwalUjianId: string,
    sekolahId: string,
    actorId: string,
    dto: GenerateKartuUjianDto = {},
  ) {
    const kapasitasRuangan = Math.max(1, Number(dto.kapasitas_ruangan) || 20);
    const kolomPerBaris = Math.max(1, Number(dto.kolom_per_baris) || 4);

    const ujianRows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT u.*, t.nama as tahun_ajaran_nama, t.semester as tahun_ajaran_semester
      FROM "jadwal_ujian" u
      LEFT JOIN "tahun_ajaran" t ON u.tahun_ajaran_id = t.id
      WHERE u.id = $1 AND u.sekolah_id = $2
      LIMIT 1
      `,
      jadwalUjianId,
      sekolahId,
    );

    if (!ujianRows || ujianRows.length === 0) {
      throw new NotFoundException('Jadwal ujian tidak ditemukan');
    }

    const ujian = ujianRows[0];

    // 1. Ambil seluruh kelas yang terdaftar pada jadwal ujian ini
    const examClasses = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT DISTINCT k.id as kelas_id, k.tingkat, k.nama_rombel, j.kode as jurusan_kode
      FROM "jadwal_ujian_item" i
      JOIN "kelas" k ON i.kelas_id = k.id
      JOIN "jurusan" j ON k.jurusan_id = j.id
      WHERE i.jadwal_ujian_id = $1
      ORDER BY k.tingkat ASC, j.kode ASC, k.nama_rombel ASC
      `,
      jadwalUjianId,
    );

    if (examClasses.length === 0) {
      throw new BadRequestException('Jadwal ujian belum memiliki sesi mata pelajaran atau kelas target.');
    }

    const classIds = examClasses.map((c) => c.kelas_id);

    // 2. Ambil seluruh siswa aktif yang terdaftar di kelas-kelas tersebut untuk tahun ajaran ujian
    const students = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT s.id as siswa_id, s.nama as siswa_nama, s.nisn as siswa_nisn,
             k.id as kelas_id, k.tingkat, k.nama_rombel, COALESCE(j.kode, '') as jurusan_kode,
             CONCAT('Kelas ', k.tingkat, ' ', COALESCE(j.kode, ''), ' ', k.nama_rombel) as kelas_nama
      FROM "riwayat_kelas_siswa" rks
      JOIN "siswa" s ON rks.siswa_id = s.id
      JOIN "kelas" k ON rks.kelas_id = k.id
      LEFT JOIN "jurusan" j ON k.jurusan_id = j.id
      WHERE rks.tahun_ajaran_id = $1 AND rks.kelas_id = ANY($2::text[])
      ORDER BY k.tingkat ASC, COALESCE(j.kode, '') ASC, k.nama_rombel ASC, s.nama ASC
      `,
      ujian.tahun_ajaran_id,
      classIds,
    );

    if (students.length === 0) {
      throw new BadRequestException('Tidak ditemukan siswa terdaftar pada kelas-kelas jadwal ujian ini.');
    }

    // 3. Cek kartu ujian yang sudah ada (existing)
    const existingCards = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, siswa_id, ruangan, nomor_kursi, nomor_peserta FROM "kartu_ujian" WHERE "jadwal_ujian_id" = $1 ORDER BY "ruangan" ASC, "nomor_kursi" ASC`,
      jadwalUjianId,
    );

    const existingSiswaIdSet = new Set<string>(existingCards.map((c) => c.siswa_id));
    const unassignedStudents = students.filter((s) => !existingSiswaIdSet.has(s.siswa_id));

    if (unassignedStudents.length === 0) {
      return {
        success: true,
        message: `Seluruh peserta (${existingCards.length} siswa) telah memiliki nomor kartu & kursi ujian.`,
        total_peserta: existingCards.length,
        newly_added: 0,
        total_ruangan: new Set(existingCards.map((c) => c.ruangan)).size,
      };
    }

    // 4. Hitung posisi ruangan dan kursi selanjutnya
    let nextRoomNumber = 1;
    let currentSeatIndex = 0;

    if (existingCards.length > 0) {
      const roomOccupancy = new Map<number, number>();
      for (const card of existingCards) {
        const match = String(card.ruangan).match(/(\d+)/);
        const rNum = match ? parseInt(match[1], 10) : 1;
        roomOccupancy.set(rNum, (roomOccupancy.get(rNum) || 0) + 1);
      }
      const maxRoom = Math.max(...Array.from(roomOccupancy.keys()), 1);
      const occupiedInMaxRoom = roomOccupancy.get(maxRoom) || 0;

      if (occupiedInMaxRoom < kapasitasRuangan) {
        nextRoomNumber = maxRoom;
        currentSeatIndex = occupiedInMaxRoom;
      } else {
        nextRoomNumber = maxRoom + 1;
        currentSeatIndex = 0;
      }
    }

    // Helper format kursi: A1, A2, A3, A4, B1, B2...
    const formatSeat = (seatIdx: number, cols: number): string => {
      const rowLetter = String.fromCharCode(65 + Math.floor(seatIdx / cols));
      const colNum = (seatIdx % cols) + 1;
      return `${rowLetter}${colNum}`;
    };

    const newCardsToInsert: Array<{
      id: string;
      jadwal_ujian_id: string;
      siswa_id: string;
      kelas_id: string;
      ruangan: string;
      nomor_kursi: string;
      nomor_peserta: string;
    }> = [];

    for (const student of unassignedStudents) {
      if (currentSeatIndex >= kapasitasRuangan) {
        nextRoomNumber++;
        currentSeatIndex = 0;
      }

      const roomName = `Ruang ${String(nextRoomNumber).padStart(2, '0')}`;
      const seatName = formatSeat(currentSeatIndex, kolomPerBaris);
      const pesertaCode = `${ujian.jenis || 'UJN'}-${String(nextRoomNumber).padStart(2, '0')}-${seatName}`;

      newCardsToInsert.push({
        id: crypto.randomUUID(),
        jadwal_ujian_id: jadwalUjianId,
        siswa_id: student.siswa_id,
        kelas_id: student.kelas_id,
        ruangan: roomName,
        nomor_kursi: seatName,
        nomor_peserta: pesertaCode,
      });

      currentSeatIndex++;
    }

    // 5. Batch insert kartu ujian baru (chunk 100 baris per query)
    const chunkSize = 100;
    for (let i = 0; i < newCardsToInsert.length; i += chunkSize) {
      const chunk = newCardsToInsert.slice(i, i + chunkSize);
      const placeholders: string[] = [];
      const params: any[] = [];
      let pIdx = 1;

      for (const card of chunk) {
        placeholders.push(
          `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, NOW(), NOW())`,
        );
        params.push(
          card.id,
          card.jadwal_ujian_id,
          card.siswa_id,
          card.kelas_id,
          card.ruangan,
          card.nomor_kursi,
          card.nomor_peserta,
        );
        pIdx += 7;
      }

      const insertSql = `
        INSERT INTO "kartu_ujian" (
          "id", "jadwal_ujian_id", "siswa_id", "kelas_id", "ruangan", "nomor_kursi", "nomor_peserta", "createdAt", "updatedAt"
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT ("jadwal_ujian_id", "siswa_id") DO NOTHING
      `;

      await this.prisma.$executeRawUnsafe(insertSql, ...params);
    }

    const totalPeserta = existingCards.length + newCardsToInsert.length;
    const allRoomsCount = nextRoomNumber;

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: UserRole.ADMIN,
      action: 'GENERATE_KARTU_UJIAN',
      resource: 'KARTU_UJIAN',
      resource_id: jadwalUjianId,
      details: `Men-generate kartu ujian ${ujian.nama_ujian}: ${newCardsToInsert.length} siswa baru dialokasikan ke ${allRoomsCount} ruangan (kapasitas ${kapasitasRuangan}/ruang). Total ${totalPeserta} peserta.`,
    });

    return {
      success: true,
      message: `Berhasil men-generate kartu ujian. ${newCardsToInsert.length} siswa baru dialokasikan ke ${allRoomsCount} ruangan.`,
      total_peserta: totalPeserta,
      newly_added: newCardsToInsert.length,
      total_ruangan: allRoomsCount,
    };
  }

  /**
   * Mengambil daftar kartu ujian terpaginasi dengan filter ruangan, kelas, atau pencarian nama/nisn
   */
  async getKartuUjianList(
    jadwalUjianId: string,
    sekolahId: string,
    page: number = 1,
    limit: number = 20,
    ruangan?: string,
    kelasId?: string,
    search?: string,
  ) {
    let whereClause = `WHERE ku.jadwal_ujian_id = $1 AND u.sekolah_id = $2`;
    const params: any[] = [jadwalUjianId, sekolahId];
    let paramIndex = 3;

    if (ruangan && ruangan !== 'ALL') {
      whereClause += ` AND ku.ruangan = $${paramIndex}`;
      params.push(ruangan);
      paramIndex++;
    }

    if (kelasId && kelasId !== 'ALL') {
      whereClause += ` AND ku.kelas_id = $${paramIndex}`;
      params.push(kelasId);
      paramIndex++;
    }

    if (search && search.trim() !== '') {
      const searchPattern = `%${search.trim()}%`;
      whereClause += ` AND (s.nama ILIKE $${paramIndex} OR s.nisn ILIKE $${paramIndex} OR ku.nomor_peserta ILIKE $${paramIndex} OR ku.nomor_kursi ILIKE $${paramIndex})`;
      params.push(searchPattern);
      paramIndex++;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(ku.id)::int as total
      FROM "kartu_ujian" ku
      JOIN "jadwal_ujian" u ON ku.jadwal_ujian_id = u.id
      JOIN "siswa" s ON ku.siswa_id = s.id
      JOIN "kelas" k ON ku.kelas_id = k.id
      ${whereClause}
    `;

    const countResult = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
      countQuery,
      ...params,
    );
    const total = Number(countResult[0]?.total || 0);

    const safeLimit = Math.max(1, Math.min(100, limit));
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;

    const dataParams = [...params, safeLimit, offset];
    const dataQuery = `
      SELECT 
        ku.id, ku.jadwal_ujian_id, ku.siswa_id, ku.kelas_id, ku.ruangan,
        ku.nomor_kursi, ku.nomor_peserta, ku."createdAt",
        s.nama as siswa_nama, s.nisn as siswa_nisn,
        k.tingkat,
        CONCAT('Kelas ', k.tingkat, ' ', COALESCE(j.kode, ''), ' ', k.nama_rombel) as kelas_nama
      FROM "kartu_ujian" ku
      JOIN "jadwal_ujian" u ON ku.jadwal_ujian_id = u.id
      JOIN "siswa" s ON ku.siswa_id = s.id
      JOIN "kelas" k ON ku.kelas_id = k.id
      LEFT JOIN "jurusan" j ON k.jurusan_id = j.id
      ${whereClause}
      ORDER BY ku.ruangan ASC, ku.nomor_kursi ASC, s.nama ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const items = await this.prisma.$queryRawUnsafe<any[]>(dataQuery, ...dataParams);

    return {
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
   * Mengambil ringkasan data kartu ujian (daftar ruangan, jumlah peserta, dsb)
   */
  async getKartuUjianSummary(jadwalUjianId: string, sekolahId: string) {
    const summaryRows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT 
        ku.ruangan,
        COUNT(ku.id)::int as total_siswa,
        COUNT(DISTINCT ku.kelas_id)::int as total_kelas
      FROM "kartu_ujian" ku
      JOIN "jadwal_ujian" u ON ku.jadwal_ujian_id = u.id
      WHERE ku.jadwal_ujian_id = $1 AND u.sekolah_id = $2
      GROUP BY ku.ruangan
      ORDER BY ku.ruangan ASC
      `,
      jadwalUjianId,
      sekolahId,
    );

    const totalPeserta = summaryRows.reduce((acc, r) => acc + Number(r.total_siswa || 0), 0);

    return {
      jadwal_ujian_id: jadwalUjianId,
      total_peserta: totalPeserta,
      total_ruangan: summaryRows.length,
      ruangan_list: summaryRows.map((r) => ({
        ruangan: r.ruangan,
        total_siswa: Number(r.total_siswa || 0),
        total_kelas: Number(r.total_kelas || 0),
      })),
    };
  }

  /**
   * Reset / Hapus seluruh Kartu Ujian untuk jadwal ujian tertentu
   */
  async deleteKartuUjian(jadwalUjianId: string, sekolahId: string, actorId: string) {
    const ujianRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "jadwal_ujian" WHERE "id" = $1 AND "sekolah_id" = $2 LIMIT 1`,
      jadwalUjianId,
      sekolahId,
    );

    if (!ujianRows || ujianRows.length === 0) {
      throw new NotFoundException('Jadwal ujian tidak ditemukan');
    }

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "kartu_ujian" WHERE "jadwal_ujian_id" = $1`,
      jadwalUjianId,
    );

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: actorId,
      actor_type: UserRole.ADMIN,
      action: 'RESET_KARTU_UJIAN',
      resource: 'KARTU_UJIAN',
      resource_id: jadwalUjianId,
      details: `Mereset nomor kursi dan kartu ujian untuk jadwal ${ujianRows[0].nama_ujian}`,
    });

    return {
      success: true,
      message: 'Kartu ujian dan alokasi nomor kursi berhasil direset.',
    };
  }

  /**
   * Men-generate Dokumen PDF Kartu Ujian Siswa (A5 Landscape) Tanpa Tabel Mapel,
   * Memuat Data Lengkap Peserta, Lokasi Ruang, Nomor Kursi, Tata Tertib, dan Pengesahan Resmi.
   */
  async generateKartuUjianPdf(
    jadwalUjianId: string,
    sekolahId: string,
    siswaId?: string,
    ruangan?: string,
    kelasId?: string,
  ): Promise<Buffer> {
    const ujianRows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT u.*, t.nama as tahun_ajaran_nama, t.semester as tahun_ajaran_semester,
             s.nama as sekolah_nama, s.npsn as sekolah_npsn, s.alamat as sekolah_alamat
      FROM "jadwal_ujian" u
      LEFT JOIN "tahun_ajaran" t ON u.tahun_ajaran_id = t.id
      LEFT JOIN "sekolah" s ON u.sekolah_id = s.id
      WHERE u.id = $1 AND u.sekolah_id = $2
      LIMIT 1
      `,
      jadwalUjianId,
      sekolahId,
    );

    if (!ujianRows || ujianRows.length === 0) {
      throw new NotFoundException('Jadwal ujian tidak ditemukan');
    }

    const ujian = ujianRows[0];

    // Filter siswa yang akan dibuatkan PDF
    let queryKartu = `
      SELECT 
        ku.id, ku.jadwal_ujian_id, ku.siswa_id, ku.kelas_id, ku.ruangan,
        ku.nomor_kursi, ku.nomor_peserta,
        s.nama as siswa_nama, s.nisn as siswa_nisn,
        k.tingkat,
        CONCAT('Kelas ', k.tingkat, ' ', COALESCE(j.kode, ''), ' ', k.nama_rombel) as kelas_nama
      FROM "kartu_ujian" ku
      JOIN "siswa" s ON ku.siswa_id = s.id
      JOIN "kelas" k ON ku.kelas_id = k.id
      LEFT JOIN "jurusan" j ON k.jurusan_id = j.id
      WHERE ku.jadwal_ujian_id = $1
    `;
    const params: any[] = [jadwalUjianId];
    let pIdx = 2;

    if (siswaId) {
      queryKartu += ` AND ku.siswa_id = $${pIdx}`;
      params.push(siswaId);
      pIdx++;
    } else {
      if (ruangan && ruangan !== 'ALL') {
        queryKartu += ` AND ku.ruangan = $${pIdx}`;
        params.push(ruangan);
        pIdx++;
      }
      if (kelasId && kelasId !== 'ALL') {
        queryKartu += ` AND ku.kelas_id = $${pIdx}`;
        params.push(kelasId);
        pIdx++;
      }
    }

    queryKartu += ` ORDER BY ku.ruangan ASC, ku.nomor_kursi ASC, s.nama ASC`;

    const cards = await this.prisma.$queryRawUnsafe<any[]>(queryKartu, ...params);

    if (!cards || cards.length === 0) {
      throw new BadRequestException('Belum ada kartu peserta ujian yang ter-generate untuk kriteria ini. Silakan klik tombol "Generate Kartu" terlebih dahulu.');
    }

    const doc = new PDFDocument({
      size: 'A5',
      layout: 'landscape',
      margin: 20,
      autoFirstPage: false,
    });

    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err: any) => reject(err));
    });

    const formatTgl = (tglInput: any): string => {
      if (!tglInput) return '-';
      try {
        const d = new Date(tglInput);
        if (isNaN(d.getTime())) return String(tglInput);
        const bulan = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
        ];
        return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
      } catch (_) {
        return String(tglInput);
      }
    };

    const periodeText = ujian.tanggal_mulai && ujian.tanggal_selesai
      ? `${formatTgl(ujian.tanggal_mulai)} s/d ${formatTgl(ujian.tanggal_selesai)}`
      : '-';

    for (const card of cards) {
      doc.addPage({ size: 'A5', layout: 'landscape', margin: 20 });

      // Lebar A5 landscape = 595.28 pt, tinggi = 419.53 pt
      // 1. Frame Luar Kartu
      doc.roundedRect(20, 14, 555, 392, 8).lineWidth(1.2).strokeColor('#0284C7').stroke();
      doc.roundedRect(23, 17, 549, 386, 6).lineWidth(0.5).strokeColor('#E2E8F0').stroke();

      // 2. KOP SURAT SEKOLAH
      doc.font('Helvetica-Bold').fontSize(12.5).fillColor('#0F172A')
        .text(String(ujian.sekolah_nama || 'SEKOLAH MENENGAH ATAS').toUpperCase(), 25, 25, { align: 'center' });

      doc.font('Helvetica').fontSize(7.5).fillColor('#64748B')
        .text(
          `NPSN: ${String(ujian.sekolah_npsn || '-')}  •  Alamat: ${String(ujian.sekolah_alamat || 'Indonesia')}`,
          25,
          41,
          { align: 'center' },
        );

      // Garis Ganda Pembatas KOP
      doc.moveTo(35, 54).lineTo(560, 54).lineWidth(1.5).strokeColor('#0F172A').stroke();
      doc.moveTo(35, 57).lineTo(560, 57).lineWidth(0.5).strokeColor('#94A3B8').stroke();

      // 3. JUDUL KARTU & INFO UJIAN
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A')
        .text('KARTU TANDA PESERTA UJIAN', 25, 64, { align: 'center' });

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#2563EB')
        .text(String(ujian.nama_ujian || 'Ujian').toUpperCase(), 25, 78, { align: 'center' });

      doc.font('Helvetica').fontSize(7.5).fillColor('#475569')
        .text(
          `Tahun Ajaran: ${String(ujian.tahun_ajaran_nama || '-')} (${String(ujian.tahun_ajaran_semester || '-')})  •  Periode: ${periodeText}`,
          25,
          90,
          { align: 'center' },
        );

      // 4. BAGIAN TENGAH (DUA KOLOM: IDENTITAS PESERTA & LOKASI/KURSI/FOTO)
      // Kolom Kiri: Box Identitas Peserta Ujian (Lebar: 345, Tinggi: 138)
      const leftX = 35;
      const midY = 104;
      const leftW = 345;
      const midH = 138;

      doc.roundedRect(leftX, midY, leftW, midH, 6).fillColor('#F8FAFC').fill();
      doc.roundedRect(leftX, midY, leftW, midH, 6).lineWidth(0.8).strokeColor('#E2E8F0').stroke();

      // Header strip identitas
      doc.roundedRect(leftX, midY, leftW, 20, 6).fillColor('#F1F5F9').fill();
      doc.rect(leftX, midY + 10, leftW, 10).fillColor('#F1F5F9').fill();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1E293B').text('IDENTITAS LENGKAP PESERTA UJIAN', leftX + 10, midY + 5.5);

      // Baris Data Identitas Siswa
      const labelX = leftX + 12;
      const valueX = leftX + 115;
      const startRowY = midY + 28;
      const rowSpacing = 17.5;

      // 1. Nomor Peserta
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Nomor Peserta', labelX, startRowY);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#2563EB').text(`:  ${String(card.nomor_peserta || '-')}`, valueX, startRowY - 1);

      // 2. Nama Siswa
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Nama Siswa', labelX, startRowY + rowSpacing);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A').text(`:  ${String(card.siswa_nama || '-')}`, valueX, startRowY + rowSpacing);

      // 3. NISN
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('NISN', labelX, startRowY + (rowSpacing * 2));
      doc.font('Helvetica').fontSize(8.5).fillColor('#0F172A').text(`:  ${String(card.siswa_nisn || '-')}`, valueX, startRowY + (rowSpacing * 2));

      // 4. Kelas / Rombel
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Kelas / Rombel', labelX, startRowY + (rowSpacing * 3));
      doc.font('Helvetica').fontSize(8.5).fillColor('#0F172A').text(`:  ${String(card.kelas_nama || '-')}`, valueX, startRowY + (rowSpacing * 3));

      // 5. Tingkat Pendidikan
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Tingkat Kelas', labelX, startRowY + (rowSpacing * 4));
      doc.font('Helvetica').fontSize(8.5).fillColor('#0F172A').text(`:  Tingkat ${String(card.tingkat || '-')}`, valueX, startRowY + (rowSpacing * 4));

      // 6. Status Peserta
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Status Validasi', labelX, startRowY + (rowSpacing * 5));
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#059669').text(':  TERDAFTAR & SAH SEBAGAI PESERTA', valueX, startRowY + (rowSpacing * 5));

      // Kolom Kanan: Box Ruangan, Nomor Kursi & Pas Foto (Lebar: 175, Tinggi: 138)
      const rightX = 390;
      const rightW = 170;

      // Sub-box 1: Ruang & Nomor Meja Kursi (Tinggi: 74)
      doc.roundedRect(rightX, midY, rightW, 74, 6).fillColor('#EFF6FF').lineWidth(0.8).strokeColor('#93C5FD').fillAndStroke();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1D4ED8').text('LOKASI & NOMOR MEJA', rightX + 10, midY + 8);

      doc.font('Helvetica').fontSize(7).fillColor('#475569').text('Ruangan Ujian:', rightX + 10, midY + 23);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1E293B').text(String(card.ruangan || 'Ruang 01'), rightX + 10, midY + 34);
      doc.font('Helvetica').fontSize(7).fillColor('#64748B').text('Nomor Kursi:', rightX + 10, midY + 52);

      // Badge Nomor Kursi Besar
      doc.roundedRect(rightX + 104, midY + 10, 56, 54, 5).fillColor('#2563EB').fill();
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#DBEAFE').text('KURSI', rightX + 104, midY + 17, { width: 56, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#FFFFFF').text(String(card.nomor_kursi || '-'), rightX + 104, midY + 29, { width: 56, align: 'center' });

      // Sub-box 2: Pas Foto & Pengesahan (Tinggi: 58)
      const fotoBoxY = midY + 80;
      doc.roundedRect(rightX, fotoBoxY, rightW, 58, 6).fillColor('#FAFAFA').lineWidth(0.8).strokeColor('#E2E8F0').fillAndStroke();

      // Placeholder Pas Foto 2x3 / 3x4 (Rounded)
      doc.roundedRect(rightX + 10, fotoBoxY + 5, 38, 48, 4).lineWidth(0.6).strokeColor('#94A3B8').dash(3, { space: 2 }).stroke();
      doc.undash();
      doc.font('Helvetica').fontSize(6).fillColor('#94A3B8').text('PAS FOTO\n2 x 3 / 3 x 4', rightX + 10, fotoBoxY + 19, { width: 38, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1E293B').text('Kartu Identitas Resmi', rightX + 54, fotoBoxY + 10);
      doc.font('Helvetica').fontSize(6.5).fillColor('#64748B').text('Wajib dibawa dan ditunjukkan kepada pengawas ujian pada setiap sesi.', rightX + 54, fotoBoxY + 22, { width: 108, lineGap: 1.5 });

      // 5. BAGIAN BAWAH (TATA TERTIB & PENGESAHAN)
      const botY = 249;
      const botH = 138;

      // Box Tata Tertib (Kiri: Lebar 345, Tinggi: 138)
      doc.roundedRect(leftX, botY, leftW, botH, 6).fillColor('#F8FAFC').fill();
      doc.roundedRect(leftX, botY, leftW, botH, 6).lineWidth(0.8).strokeColor('#E2E8F0').stroke();

      doc.roundedRect(leftX, botY, leftW, 18, 6).fillColor('#F1F5F9').fill();
      doc.rect(leftX, botY + 8, leftW, 10).fillColor('#F1F5F9').fill();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1E293B').text('TATA TERTIB & KETENTUAN PESERTA UJIAN', leftX + 10, botY + 5);

      const rules = [
        '1. Kartu tanda peserta ujian wajib dibawa dan diletakkan di atas meja selama ujian berlangsung.',
        '2. Peserta hadir di ruang ujian selambat-lambatnya 15 menit sebelum waktu ujian dimulai.',
        '3. Peserta wajib mengenakan seragam sekolah resmi, lengkap dengan atribut, dan bersepatu.',
        '4. Dilarang membawa buku, catatan, kalkulator, maupun alat komunikasi (HP/gawai) ke ruang ujian.',
        '5. Mengisi dan menandatangani daftar hadir ujian pada setiap sesi ujian yang diikuti.',
        '6. Menjaga ketertiban, kejujuran, dan integritas penuh selama proses evaluasi/ujian berlangsung.',
      ];

      let ruleY = botY + 24;
      for (const rule of rules) {
        doc.font('Helvetica').fontSize(6.8).fillColor('#334155').text(rule, leftX + 10, ruleY, { width: leftW - 20, lineGap: 1 });
        ruleY += 17.5;
      }

      // Box Pengesahan (Kanan: Lebar 175, Tinggi: 138)
      doc.roundedRect(rightX, botY, rightW, botH, 6).fillColor('#FFFFFF').fill();
      doc.roundedRect(rightX, botY, rightW, botH, 6).lineWidth(0.8).strokeColor('#E2E8F0').stroke();

      doc.font('Helvetica').fontSize(7).fillColor('#475569')
        .text(formatTgl(ujian.tanggal_mulai || new Date()), rightX, botY + 12, { align: 'center', width: rightW });

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0F172A')
        .text('Kepala Sekolah / Ketua Panitia,', rightX, botY + 24, { align: 'center', width: rightW });

      // Garis tanda tangan
      doc.moveTo(rightX + 18, botY + 98).lineTo(rightX + rightW - 18, botY + 98).lineWidth(0.6).strokeColor('#CBD5E1').stroke();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0F172A')
        .text('( .................................................. )', rightX, botY + 103, { align: 'center', width: rightW });

      doc.font('Helvetica').fontSize(6.5).fillColor('#64748B')
        .text('NIP. -', rightX, botY + 116, { align: 'center', width: rightW });

      // 6. CATATAN KAKI / VERIFIKASI DOKUMEN
      doc.font('Helvetica').fontSize(6).fillColor('#94A3B8')
        .text(`Verifikasi Dokumen: ${card.nomor_peserta}  •  Sistem Absensi & Informasi Akademik Terintegrasi`, 35, 393);
    }

    doc.end();
    return bufferPromise;
  }

  /**
   * Men-generate Dokumen PDF Label Meja / Denah Kursi untuk Ditempel pada Tiap Bangku (A4)
   * 1 Lembar A4 memuat 6 kartu label berukuran pas (~9 cm x 8.5 cm) lengkap dengan garis potong
   */
  async generateDenahKursiPdf(
    jadwalUjianId: string,
    sekolahId: string,
    ruangan?: string,
  ): Promise<Buffer> {
    const ujianRows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT u.*, t.nama as tahun_ajaran_nama, t.semester as tahun_ajaran_semester,
             s.nama as sekolah_nama, s.npsn as sekolah_npsn
      FROM "jadwal_ujian" u
      LEFT JOIN "tahun_ajaran" t ON u.tahun_ajaran_id = t.id
      LEFT JOIN "sekolah" s ON u.sekolah_id = s.id
      WHERE u.id = $1 AND u.sekolah_id = $2
      LIMIT 1
      `,
      jadwalUjianId,
      sekolahId,
    );

    if (!ujianRows || ujianRows.length === 0) {
      throw new NotFoundException('Jadwal ujian tidak ditemukan');
    }

    const ujian = ujianRows[0];

    let query = `
      SELECT 
        ku.id, ku.jadwal_ujian_id, ku.siswa_id, ku.kelas_id, ku.ruangan,
        ku.nomor_kursi, ku.nomor_peserta,
        s.nama as siswa_nama, s.nisn as siswa_nisn,
        k.tingkat,
        CONCAT('Kelas ', k.tingkat, ' ', COALESCE(j.kode, ''), ' ', k.nama_rombel) as kelas_nama
      FROM "kartu_ujian" ku
      JOIN "siswa" s ON ku.siswa_id = s.id
      JOIN "kelas" k ON ku.kelas_id = k.id
      LEFT JOIN "jurusan" j ON k.jurusan_id = j.id
      WHERE ku.jadwal_ujian_id = $1
    `;
    const params: any[] = [jadwalUjianId];

    if (ruangan && ruangan !== 'ALL') {
      query += ` AND ku.ruangan = $2`;
      params.push(ruangan);
    }

    query += ` ORDER BY ku.ruangan ASC, ku.nomor_kursi ASC, s.nama ASC`;

    const cards = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);

    if (!cards || cards.length === 0) {
      throw new BadRequestException('Belum ada kartu atau nomor kursi yang ter-generate untuk kriteria ruangan ini. Silakan klik tombol "Generate Kartu" terlebih dahulu.');
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 25,
      autoFirstPage: false,
    });

    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err: any) => reject(err));
    });

    // Dimensi A4 Portrait: 595.28 x 841.89 pt
    // 2 Kolom x 3 Baris = 6 Kartu per halaman A4
    const cardWidth = 260;
    const cardHeight = 245;
    const marginLeft = 28;
    const marginTop = 30;
    const gapX = 18;
    const gapY = 18;

    for (let i = 0; i < cards.length; i++) {
      const indexOnPage = i % 6;
      if (indexOnPage === 0) {
        doc.addPage({ size: 'A4', margin: 25 });
      }

      const col = indexOnPage % 2;
      const row = Math.floor(indexOnPage / 2);

      const cardX = marginLeft + col * (cardWidth + gapX);
      const cardY = marginTop + row * (cardHeight + gapY);

      const card = cards[i];

      // 1. Garis Potong Putus-Putus (Dashed Cut Border dengan sudut bulat)
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 6)
        .lineWidth(1)
        .dash(4, { space: 3 })
        .strokeColor('#94A3B8')
        .stroke();
      doc.undash();

      // 2. Header Label (Nama Sekolah & Nama Ujian)
      doc.roundedRect(cardX + 1, cardY + 1, cardWidth - 2, 28, 5)
        .fillColor('#F1F5F9')
        .fill();

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1E293B')
        .text(String(ujian.sekolah_nama || 'SEKOLAH').toUpperCase(), cardX + 8, cardY + 6, {
          width: cardWidth - 16,
          align: 'center',
        });

      doc.font('Helvetica').fontSize(7.5).fillColor('#64748B')
        .text(String(ujian.nama_ujian || 'UJIAN'), cardX + 8, cardY + 17, {
          width: cardWidth - 16,
          align: 'center',
        });

      // 3. Kotak Sorotan Nomor Kursi & Ruangan (Tengah Besar)
      const centerBoxY = cardY + 36;
      const centerBoxHeight = 115;
      doc.roundedRect(cardX + 12, centerBoxY, cardWidth - 24, centerBoxHeight, 6)
        .lineWidth(1.5)
        .strokeColor('#CBD5E1')
        .fillColor('#F8FAFC')
        .fillAndStroke();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B')
        .text('NOMOR KURSI / BANGKU', cardX + 16, centerBoxY + 8, {
          width: cardWidth - 32,
          align: 'center',
        });

      // Nomor Kursi Sangat Menonjol (Contoh: A1, B2)
      doc.font('Helvetica-Bold').fontSize(36).fillColor('#0F172A')
        .text(String(card.nomor_kursi || '-'), cardX + 16, centerBoxY + 22, {
          width: cardWidth - 32,
          align: 'center',
        });

      // Badge Ruang Ujian
      const roomBadgeWidth = 110;
      const roomBadgeX = cardX + (cardWidth - roomBadgeWidth) / 2;
      doc.roundedRect(roomBadgeX, centerBoxY + 76, roomBadgeWidth, 24, 4)
        .fillColor('#2563EB')
        .fill();

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF')
        .text(String(card.ruangan || 'RUANG 01').toUpperCase(), roomBadgeX, centerBoxY + 83, {
          width: roomBadgeWidth,
          align: 'center',
        });

      // 4. Informasi Identitas Peserta Ujian (Bawah)
      const studentInfoY = cardY + 160;

      // Nama Siswa
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A')
        .text(String(card.siswa_nama || 'Siswa'), cardX + 14, studentInfoY, {
          width: cardWidth - 28,
          align: 'center',
          ellipsis: true,
        });

      // NISN & Kelas
      doc.font('Helvetica').fontSize(8.5).fillColor('#475569')
        .text(`NISN: ${String(card.siswa_nisn || '-')} • ${String(card.kelas_nama || '-')}`, cardX + 14, studentInfoY + 16, {
          width: cardWidth - 28,
          align: 'center',
        });

      // Nomor Peserta
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#2563EB')
        .text(`No. Peserta: ${String(card.nomor_peserta || '-')}`, cardX + 14, studentInfoY + 30, {
          width: cardWidth - 28,
          align: 'center',
        });

      // Indikator Gunting
      doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#94A3B8')
        .text('[ Tempel pada Meja Ujian ]', cardX + 14, cardY + cardHeight - 14, {
          width: cardWidth - 28,
          align: 'center',
        });
    }

    doc.end();
    return bufferPromise;
  }
}

