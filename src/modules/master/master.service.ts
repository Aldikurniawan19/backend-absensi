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

import { MasterCacheService } from './master-cache.service';

@Injectable()
export class MasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly masterCache: MasterCacheService,
  ) {}

  // ==================== SEKOLAH ====================
  async getSekolah(sekolahId: string) {
    const cacheKey = `sekolah:${sekolahId}`;
    const cached = this.masterCache.get<any>(cacheKey);
    if (cached) return cached;

    const sekolah = await this.prisma.sekolah.findUnique({
      where: { id: sekolahId },
    });
    if (!sekolah) throw new NotFoundException('Data sekolah tidak ditemukan');

    this.masterCache.set(cacheKey, sekolah, 10 * 60 * 1000); // 10 menit
    return sekolah;
  }

  async updateSekolah(sekolahId: string, dto: UpdateSekolahDto, actorId: string) {
    const updated = await this.prisma.sekolah.update({
      where: { id: sekolahId },
      data: dto,
    });

    this.masterCache.invalidate(`sekolah:${sekolahId}`);

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

  async cariReferensiSekolah(query: string) {
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < 2) return [];

    const cacheKey = `ref-sekolah:${trimmed.toLowerCase()}`;
    const cached = this.masterCache.get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const isNpsn = /^\d{5,8}$/.test(trimmed);
      const queryList: string[] = [];

      if (isNpsn) {
        queryList.push(
          `https://api-sekolah-indonesia.vercel.app/sekolah?npsn=${encodeURIComponent(trimmed)}`,
        );
      } else {
        queryList.push(
          `https://api-sekolah-indonesia.vercel.app/sekolah/s?sekolah=${encodeURIComponent(trimmed)}&page=1&perPage=15`,
        );

        // Generate query variants for Indonesian school naming patterns in Dapodik
        if (/^sma negeri\b/i.test(trimmed)) {
          const v = trimmed.replace(/^sma negeri\b/i, 'SMAN');
          queryList.push(
            `https://api-sekolah-indonesia.vercel.app/sekolah/s?sekolah=${encodeURIComponent(v)}&page=1&perPage=15`,
          );
        } else if (/^sman\b/i.test(trimmed)) {
          const v = trimmed.replace(/^sman\b/i, 'SMA NEGERI');
          queryList.push(
            `https://api-sekolah-indonesia.vercel.app/sekolah/s?sekolah=${encodeURIComponent(v)}&page=1&perPage=15`,
          );
        }

        if (/^smp negeri\b/i.test(trimmed)) {
          const v = trimmed.replace(/^smp negeri\b/i, 'SMPN');
          queryList.push(
            `https://api-sekolah-indonesia.vercel.app/sekolah/s?sekolah=${encodeURIComponent(v)}&page=1&perPage=15`,
          );
        } else if (/^smpn\b/i.test(trimmed)) {
          const v = trimmed.replace(/^smpn\b/i, 'SMP NEGERI');
          queryList.push(
            `https://api-sekolah-indonesia.vercel.app/sekolah/s?sekolah=${encodeURIComponent(v)}&page=1&perPage=15`,
          );
        }

        if (/^smk negeri\b/i.test(trimmed)) {
          const v = trimmed.replace(/^smk negeri\b/i, 'SMKN');
          queryList.push(
            `https://api-sekolah-indonesia.vercel.app/sekolah/s?sekolah=${encodeURIComponent(v)}&page=1&perPage=15`,
          );
        } else if (/^smkn\b/i.test(trimmed)) {
          const v = trimmed.replace(/^smkn\b/i, 'SMK NEGERI');
          queryList.push(
            `https://api-sekolah-indonesia.vercel.app/sekolah/s?sekolah=${encodeURIComponent(v)}&page=1&perPage=15`,
          );
        }

        if (/^sd negeri\b/i.test(trimmed)) {
          const v = trimmed.replace(/^sd negeri\b/i, 'SDN');
          queryList.push(
            `https://api-sekolah-indonesia.vercel.app/sekolah/s?sekolah=${encodeURIComponent(v)}&page=1&perPage=15`,
          );
        } else if (/^sdn\b/i.test(trimmed)) {
          const v = trimmed.replace(/^sdn\b/i, 'SD NEGERI');
          queryList.push(
            `https://api-sekolah-indonesia.vercel.app/sekolah/s?sekolah=${encodeURIComponent(v)}&page=1&perPage=15`,
          );
        }
      }

      const fetchPromises = queryList.map(async (url) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4500);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'User-Agent': 'SistemAbsensiApp/1.0',
            },
          });
          clearTimeout(timeoutId);
          if (!res.ok) return [];
          const json = await res.json();
          return Array.isArray(json)
            ? json
            : json?.dataSekolah || json?.data || [];
        } catch {
          return [];
        }
      });

      const nestedItems = await Promise.all(fetchPromises);
      const allRaw = nestedItems.flat();

      // Deduplicate by NPSN or ID
      const seenNpsn = new Set<string>();
      const formatted: any[] = [];

      for (const item of allRaw) {
        const itemNpsn = String(item.npsn || '').trim();
        const itemKey = itemNpsn || item.id || item.sekolah;
        if (!itemKey || seenNpsn.has(itemKey)) continue;
        seenNpsn.add(itemKey);

        const shape = item.bentuk || 'Sekolah';
        const statusStr =
          item.status === 'N'
            ? 'Negeri'
            : item.status === 'S'
            ? 'Swasta'
            : item.status || '';
        const addressParts = [
          item.alamat_jalan,
          item.desa_kelurahan ? `Kel. ${item.desa_kelurahan}` : '',
          item.kecamatan
            ? item.kecamatan.replace(/^kec\.?\s*/i, 'Kec. ')
            : '',
          item.kabupaten_kota
            ? item.kabupaten_kota
                .replace(/^kab\.?\s*/i, 'Kab. ')
                .replace(/^kota\s*/i, 'Kota ')
            : '',
          item.propinsi ? item.propinsi.replace(/^prov\.?\s*/i, 'Prov. ') : '',
        ].filter(Boolean);

        const latNum = item.lintang ? parseFloat(item.lintang) : null;
        const lngNum = item.bujur ? parseFloat(item.bujur) : null;

        formatted.push({
          npsn: itemNpsn,
          nama: item.sekolah || '',
          bentuk: shape,
          status: statusStr,
          alamat: item.alamat_jalan || '',
          alamat_lengkap: addressParts.join(', ') || item.alamat_jalan || '',
          kecamatan: item.kecamatan || '',
          kabupaten_kota: item.kabupaten_kota || '',
          provinsi: item.propinsi || '',
          lat:
            latNum !== null && !isNaN(latNum)
              ? Number(latNum.toFixed(7))
              : null,
          lng:
            lngNum !== null && !isNaN(lngNum)
              ? Number(lngNum.toFixed(7))
              : null,
        });
      }

      this.masterCache.set(cacheKey, formatted, 60 * 60 * 1000); // 1 jam cache
      return formatted;
    } catch {
      return [];
    }
  }

  // ==================== TAHUN AJARAN ====================
  async getTahunAjaranList(sekolahId: string) {
    return this.prisma.tahunAjaran.findMany({
      where: { sekolah_id: sekolahId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTahunAjaranAktif(sekolahId: string) {
    const cacheKey = `ta_aktif:${sekolahId}`;
    const cached = this.masterCache.get<any>(cacheKey);
    if (cached) return cached;

    const activeTA = await this.prisma.tahunAjaran.findFirst({
      where: { sekolah_id: sekolahId, status: TahunAjaranStatus.AKTIF },
    });

    if (activeTA) {
      this.masterCache.set(cacheKey, activeTA, 5 * 60 * 1000); // 5 menit
    }
    return activeTA;
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

    this.masterCache.invalidate(`ta_aktif:${sekolahId}`);

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

    this.masterCache.invalidate(`ta_aktif:${updated.sekolah_id}`);

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

      this.masterCache.invalidate(`ta_aktif:${sekolahId}`);

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
    const deleted = await this.prisma.tahunAjaran.delete({ where: { id } });
    this.masterCache.invalidate(`ta_aktif:${deleted.sekolah_id}`);
    return deleted;
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
