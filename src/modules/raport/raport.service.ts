import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AbsensiStatus, KomponenNilai, StatusRaport, UserRole } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NilaiService } from '../nilai/nilai.service';
import {
  DetailRaportSiswaResponse,
  EkskulRaportItem,
  NilaiRaportMapel,
  RaportKelasListItem,
  RekapKehadiranRaport,
} from './raport.types';

@Injectable()
export class RaportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly nilaiService: NilaiService,
  ) {}

  // ==================== GENERATE / INITIATE RAPORT KELAS ====================

  async generateRaportKelas(
    kelasId: string,
    waliKelasId: string,
    sekolahId: string,
    tahunAjaranId?: string,
  ) {
    let resolvedTahunAjaranId = tahunAjaranId;
    if (!resolvedTahunAjaranId) {
      const activeTahun = await this.prisma.tahunAjaran.findFirst({
        where: { sekolah_id: sekolahId, status: 'AKTIF' },
        select: { id: true },
      });
      if (!activeTahun) {
        throw new NotFoundException('Tidak ada tahun ajaran aktif');
      }
      resolvedTahunAjaranId = activeTahun.id;
    }

    // Ambil semua siswa di kelas ini
    const riwayatList = await this.prisma.riwayatKelasSiswa.findMany({
      where: {
        kelas_id: kelasId,
        tahun_ajaran_id: resolvedTahunAjaranId,
      },
      select: { siswa_id: true },
    });

    if (riwayatList.length === 0) {
      throw new BadRequestException('Tidak ada siswa yang terdaftar di kelas ini');
    }

    // 1. Ambil data raport yang sudah ada di kelas ini (1 query)
    const existingRaports = await this.prisma.raport.findMany({
      where: {
        kelas_id: kelasId,
        tahun_ajaran_id: resolvedTahunAjaranId,
      },
      select: { siswa_id: true },
    });

    const existingSiswaIds = new Set(existingRaports.map((r) => r.siswa_id));
    const newStudentsToCreate = riwayatList
      .map((r) => r.siswa_id)
      .filter((sId) => !existingSiswaIds.has(sId));

    // 2. Buat draft raport untuk siswa yang belum punya dalam 1 operasi batch createMany
    if (newStudentsToCreate.length > 0) {
      await this.prisma.raport.createMany({
        data: newStudentsToCreate.map((siswaId) => ({
          siswa_id: siswaId,
          kelas_id: kelasId,
          tahun_ajaran_id: resolvedTahunAjaranId!,
          wali_kelas_id: waliKelasId,
          status: StatusRaport.DRAFT,
        })),
        skipDuplicates: true,
      });
    }


    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: waliKelasId,
      actor_type: UserRole.GURU,
      action: 'GENERATE_RAPORT_KELAS',
      resource: 'RAPORT',
      details: `Generate draft raport untuk ${newStudentsToCreate.length} siswa baru kelas ${kelasId} (total terdaftar: ${riwayatList.length})`,
    });

    return {
      message: `Draft raport untuk ${newStudentsToCreate.length} siswa berhasil disiapkan (total ${riwayatList.length} siswa)`,
      count: newStudentsToCreate.length,
    };
  }


  // ==================== DAFTAR STATUS RAPORT PER KELAS ====================

  async getRaportListKelas(
    kelasId: string,
    sekolahId: string,
    tahunAjaranId?: string,
  ): Promise<RaportKelasListItem[]> {
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

    const [riwayatSiswa, jadwalMapelList, raportList, allNilai] = await Promise.all([
      this.prisma.riwayatKelasSiswa.findMany({
        where: {
          kelas_id: kelasId,
          tahun_ajaran_id: resolvedTahunAjaranId,
        },
        select: {
          siswa: { select: { id: true, nama: true, nisn: true } },
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
      this.prisma.raport.findMany({
        where: {
          kelas_id: kelasId,
          tahun_ajaran_id: resolvedTahunAjaranId,
        },
      }),
      this.prisma.nilaiSiswa.findMany({
        where: {
          kelas_id: kelasId,
          tahun_ajaran_id: resolvedTahunAjaranId,
        },
        select: { siswa_id: true, mapel_id: true },
        distinct: ['siswa_id', 'mapel_id'],
      }),
    ]);

    const totalMapelCount =
      jadwalMapelList.length > 0
        ? jadwalMapelList.length
        : await this.prisma.mataPelajaran.count({
            where: { sekolah_id: sekolahId },
          });

    const raportMap = new Map<string, any>();
    for (const rap of raportList) {
      raportMap.set(rap.siswa_id, rap);
    }

    const nilaiCountMap = new Map<string, number>();
    for (const n of allNilai) {
      const count = nilaiCountMap.get(n.siswa_id) || 0;
      nilaiCountMap.set(n.siswa_id, count + 1);
    }

    return riwayatSiswa.map((r) => {
      const s = r.siswa;
      const rap = raportMap.get(s.id);
      return {
        siswa_id: s.id,
        nama: s.nama,
        nisn: s.nisn,
        raport_id: rap ? rap.id : null,
        status: rap ? (rap.status as 'DRAFT' | 'FINAL') : 'BELUM_DIBUAT',
        tanggal_terbit: rap && rap.tanggal_terbit ? rap.tanggal_terbit.toISOString() : null,
        jumlah_mapel_dinilai: nilaiCountMap.get(s.id) || 0,
        total_mapel: totalMapelCount,
        catatan_terisi: Boolean(rap && rap.catatan_wali_kelas && rap.catatan_wali_kelas.trim() !== ''),
      };
    });
  }

  // ==================== DETAIL RAPORT SATU SISWA ====================

  async getDetailRaportSiswa(
    siswaId: string,
    sekolahId: string,
    tahunAjaranId?: string,
  ): Promise<DetailRaportSiswaResponse> {
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

    const [siswa, tahunAjaran, sekolah, konfigurasi] = await Promise.all([
      this.prisma.siswa.findUnique({
        where: { id: siswaId },
        select: {
          id: true,
          nama: true,
          nisn: true,
          riwayat_kelas: {
            where: { tahun_ajaran_id: resolvedTahunAjaranId },
            include: {
              kelas: {
                include: { jurusan: true },
              },
            },
          },
        },
      }),
      this.prisma.tahunAjaran.findUnique({
        where: { id: resolvedTahunAjaranId },
        select: { id: true, nama: true, semester: true },
      }),
      this.prisma.sekolah.findUnique({
        where: { id: sekolahId },
        select: { id: true, nama: true, npsn: true, alamat: true },
      }),
      this.nilaiService.getKonfigurasiPenilaian(sekolahId, resolvedTahunAjaranId),
    ]);

    if (!siswa || !siswa.riwayat_kelas[0] || !tahunAjaran || !sekolah) {
      throw new NotFoundException('Data siswa, kelas, atau sekolah tidak ditemukan');
    }

    const kelas = siswa.riwayat_kelas[0].kelas;
    const namaKelasLengkap = `${kelas.tingkat} ${kelas.jurusan.kode} ${kelas.nama_rombel}`;

    // Cari mata pelajaran relevan untuk kelas/siswa ini
    const [jadwalMapel, nilaiMapelIds, capaianMapelIds] = await Promise.all([
      this.prisma.jadwalPelajaran.findMany({
        where: {
          kelas_id: kelas.id,
          tahun_ajaran_id: resolvedTahunAjaranId,
        },
        select: { mapel_id: true },
        distinct: ['mapel_id'],
      }),
      this.prisma.nilaiSiswa.findMany({
        where: {
          siswa_id: siswaId,
          tahun_ajaran_id: resolvedTahunAjaranId,
        },
        select: { mapel_id: true },
        distinct: ['mapel_id'],
      }),
      this.prisma.catatanCapaian.findMany({
        where: {
          siswa_id: siswaId,
          tahun_ajaran_id: resolvedTahunAjaranId,
        },
        select: { mapel_id: true },
        distinct: ['mapel_id'],
      }),
    ]);

    const relevantMapelIds = new Set<string>([
      ...jadwalMapel.map((j) => j.mapel_id),
      ...nilaiMapelIds.map((n) => n.mapel_id),
      ...capaianMapelIds.map((c) => c.mapel_id),
    ]);

    const mapelList = await this.prisma.mataPelajaran.findMany({
      where: {
        sekolah_id: sekolahId,
        ...(relevantMapelIds.size > 0 ? { id: { in: Array.from(relevantMapelIds) } } : {}),
      },
      select: { id: true, nama: true, kode: true },
      orderBy: { nama: 'asc' },
    });

    // Ambil wali kelas
    const penugasanWali = await this.prisma.penugasanWaliKelas.findUnique({
      where: {
        kelas_id_tahun_ajaran_id: {
          kelas_id: kelas.id,
          tahun_ajaran_id: resolvedTahunAjaranId,
        },
      },
      include: {
        guru: { select: { id: true, nama: true, nip: true } },
      },
    });

    // Ambil record raport jika ada
    const raportRecord = await this.prisma.raport.findUnique({
      where: {
        siswa_id_tahun_ajaran_id: {
          siswa_id: siswaId,
          tahun_ajaran_id: resolvedTahunAjaranId,
        },
      },
    });

    // Ambil semua nilai siswa
    const allNilaiSiswa = await this.prisma.nilaiSiswa.findMany({
      where: {
        siswa_id: siswaId,
        tahun_ajaran_id: resolvedTahunAjaranId,
      },
    });

    // Ambil catatan capaian kompetensi
    const catatanCapaianList = await this.prisma.catatanCapaian.findMany({
      where: {
        siswa_id: siswaId,
        tahun_ajaran_id: resolvedTahunAjaranId,
      },
    });
    const catatanMap = new Map<string, string>();
    for (const c of catatanCapaianList) {
      catatanMap.set(c.mapel_id, c.deskripsi);
    }

    // Bangun daftar nilai per mata pelajaran
    const nilaiMapel: NilaiRaportMapel[] = mapelList.map((m) => {
      const items = allNilaiSiswa.filter((n) => n.mapel_id === m.id);
      const formatif = items.filter((n) => n.komponen === KomponenNilai.FORMATIF);
      const sts = items.find((n) => n.komponen === KomponenNilai.STS);
      const sas = items.find((n) => n.komponen === KomponenNilai.SAS);

      let rataFormatif: number | null = null;
      if (formatif.length > 0) {
        const total = formatif.reduce((acc, curr) => acc + Number(curr.nilai), 0);
        rataFormatif = Math.round((total / formatif.length) * 100) / 100;
      }

      const nilaiSts = sts ? Number(sts.nilai) : null;
      const nilaiSas = sas ? Number(sas.nilai) : null;

      const nilaiAkhir = this.nilaiService.hitungNilaiAkhir(
        rataFormatif,
        nilaiSts,
        nilaiSas,
        konfigurasi,
      );

      let predikat = null;
      let predikatLabel = null;
      if (nilaiAkhir !== null) {
        const pInfo = this.nilaiService.hitungPredikat(nilaiAkhir, konfigurasi);
        predikat = pInfo.kode;
        predikatLabel = pInfo.label;
      }

      return {
        mapel_id: m.id,
        mapel_nama: m.nama,
        mapel_kode: m.kode,
        nilai_akhir: nilaiAkhir,
        predikat,
        predikat_label: predikatLabel,
        capaian_kompetensi:
          catatanMap.get(m.id) ||
          (predikat
            ? `Menunjukkan penguasaan yang ${predikatLabel?.toLowerCase()} dalam mencapai tujuan pembelajaran.`
            : 'Belum ada penilaian capaian kompetensi.'),
      };
    });

    // Ambil ekstrakurikuler siswa
    const ekskulSiswa = await this.prisma.ekstrakurikulerSiswa.findMany({
      where: {
        siswa_id: siswaId,
        tahun_ajaran_id: resolvedTahunAjaranId,
      },
      include: {
        ekstrakurikuler: { select: { nama: true } },
      },
    });

    const ekstrakurikuler: EkskulRaportItem[] = ekskulSiswa.map((e) => ({
      nama: e.ekstrakurikuler.nama,
      predikat: e.predikat || 'Baik',
      keterangan: e.keterangan || 'Aktif mengikuti kegiatan ekstrakurikuler.',
    }));

    // Ambil rekap kehadiran absensi siswa
    const absensiRecords = await this.prisma.absensi.findMany({
      where: {
        siswa_id: siswaId,
        sesi: {
          jadwal: {
            tahun_ajaran_id: resolvedTahunAjaranId,
          },
        },
      },
      select: { status: true },
    });

    const kehadiran: RekapKehadiranRaport = {
      hadir: 0,
      terlambat: 0,
      sakit: 0,
      izin: 0,
      alpa: 0,
    };

    for (const a of absensiRecords) {
      if (a.status === AbsensiStatus.HADIR) kehadiran.hadir++;
      else if (a.status === AbsensiStatus.TERLAMBAT) kehadiran.terlambat++;
      else if (a.status === AbsensiStatus.SAKIT) kehadiran.sakit++;
      else if (a.status === AbsensiStatus.IZIN) kehadiran.izin++;
      else if (a.status === AbsensiStatus.ALPA) kehadiran.alpa++;
    }

    return {
      raport_id: raportRecord ? raportRecord.id : null,
      status: raportRecord ? (raportRecord.status as 'DRAFT' | 'FINAL') : 'BELUM_DIBUAT',
      tanggal_terbit:
        raportRecord && raportRecord.tanggal_terbit
          ? raportRecord.tanggal_terbit.toISOString()
          : null,
      siswa: {
        id: siswa.id,
        nama: siswa.nama,
        nisn: siswa.nisn,
      },
      kelas: {
        id: kelas.id,
        nama_lengkap: namaKelasLengkap,
        tingkat: kelas.tingkat,
      },
      sekolah,
      tahun_ajaran: tahunAjaran,
      wali_kelas: penugasanWali?.guru
        ? {
            id: penugasanWali.guru.id,
            nama: penugasanWali.guru.nama,
            nip: penugasanWali.guru.nip,
          }
        : null,
      nilai_mapel: nilaiMapel,
      ekstrakurikuler,
      kehadiran,
      catatan_wali_kelas: raportRecord?.catatan_wali_kelas || null,
    };
  }

  // ==================== UPDATE CATATAN WALI KELAS ====================

  async updateCatatanWaliKelas(
    raportId: string,
    catatan: string,
    waliKelasId: string,
    userRole: UserRole,
    sekolahId: string,
  ) {
    const existing = await this.prisma.raport.findUnique({
      where: { id: raportId },
    });

    if (!existing) {
      throw new NotFoundException('Data raport tidak ditemukan');
    }

    if (existing.status === StatusRaport.FINAL && userRole !== UserRole.ADMIN) {
      throw new BadRequestException('Raport yang sudah difinalisasi tidak dapat diubah lagi');
    }

    const updated = await this.prisma.raport.update({
      where: { id: raportId },
      data: { catatan_wali_kelas: catatan },
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: waliKelasId,
      actor_type: userRole,
      action: 'UPDATE_CATATAN_RAPORT',
      resource: 'RAPORT',
      resource_id: raportId,
      details: `Update catatan wali kelas pada raport siswa ${existing.siswa_id}`,
    });

    return updated;
  }

  // ==================== FINALISASI RAPORT ====================

  async finalisasiRaport(
    raportId: string,
    waliKelasId: string,
    userRole: UserRole,
    sekolahId: string,
  ) {
    const existing = await this.prisma.raport.findUnique({
      where: { id: raportId },
    });

    if (!existing) {
      throw new NotFoundException('Data raport tidak ditemukan');
    }

    const updated = await this.prisma.raport.update({
      where: { id: raportId },
      data: {
        status: StatusRaport.FINAL,
        tanggal_terbit: new Date(),
      },
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: waliKelasId,
      actor_type: userRole,
      action: 'FINALISASI_RAPORT',
      resource: 'RAPORT',
      resource_id: raportId,
      details: `Finalisasi raport siswa ${existing.siswa_id} - status diubah ke FINAL`,
    });

    return updated;
  }

  async batalFinalisasiRaport(
    raportId: string,
    waliKelasId: string,
    userRole: UserRole,
    sekolahId: string,
  ) {
    const existing = await this.prisma.raport.findUnique({
      where: { id: raportId },
    });

    if (!existing) {
      throw new NotFoundException('Data raport tidak ditemukan');
    }

    const updated = await this.prisma.raport.update({
      where: { id: raportId },
      data: {
        status: StatusRaport.DRAFT,
      },
    });

    await this.auditService.log({
      sekolah_id: sekolahId,
      actor_id: waliKelasId,
      actor_type: userRole,
      action: 'BATAL_FINALISASI_RAPORT',
      resource: 'RAPORT',
      resource_id: raportId,
      details: `Batal finalisasi raport siswa ${existing.siswa_id} - status kembali ke DRAFT`,
    });

    return updated;
  }

  // =========================================================================
  // CETAK PDF RAPORT RESMI (KURIKULUM MERDEKA) DENGAN PDFKIT
  // =========================================================================

  async generateRaportPdf(
    siswaId: string,
    sekolahId: string,
    tahunAjaranId?: string,
  ): Promise<Buffer> {
    const data = await this.getDetailRaportSiswa(
      siswaId,
      sekolahId,
      tahunAjaranId,
    );

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 30, bottom: 30, left: 36, right: 36 },
          autoFirstPage: true,
          bufferPages: true,
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const range = doc.bufferedPageRange();
          for (let i = 0; i < range.count; i++) {
            doc.switchToPage(i);
            doc.font('Helvetica').fontSize(7).fillColor('#94a3b8');
            doc.text(
              `Dokumen Resmi Raport Siswa - Kurikulum Merdeka | Halaman ${i + 1} dari ${range.count}`,
              36,
              doc.page.height - 20,
              { width: doc.page.width - 72, align: 'center' },
            );
          }
          doc.flushPages();
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', (err: Error) => reject(err));

        const pageWidth = doc.page.width;
        const leftMargin = 36;
        const rightMargin = pageWidth - 36;
        const contentWidth = rightMargin - leftMargin;

        // Helper untuk menggambar badge predikat Kurikulum Merdeka (SB, BSH, MB, BB) pada Tabel A
        const drawPredikatBadge = (predikat: string | null, x: number, y: number, w: number, rowH: number = 18) => {
          if (!predikat || predikat === '-') {
            doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('-', x, y + 4.5, { width: w, align: 'center' });
            return;
          }
          let bgColor = '#f1f5f9';
          let textColor = '#475569';
          let strokeColor = '#cbd5e1';

          if (predikat === 'SB') {
            bgColor = '#f0fdf4';
            textColor = '#15803d';
            strokeColor = '#bbf7d0';
          } else if (predikat === 'BSH') {
            bgColor = '#eff6ff';
            textColor = '#1d4ed8';
            strokeColor = '#bfdbfe';
          } else if (predikat === 'MB') {
            bgColor = '#fefce8';
            textColor = '#a16207';
            strokeColor = '#fef08a';
          } else if (predikat === 'BB') {
            bgColor = '#fef2f2';
            textColor = '#b91c1c';
            strokeColor = '#fecaca';
          }

          const badgeH = 13;
          const badgeW = 28;
          const badgeX = x + (w - badgeW) / 2;
          const badgeY = y + (rowH - badgeH) / 2;

          doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3.5).fillColor(bgColor).fill();
          doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3.5).lineWidth(0.5).strokeColor(strokeColor).stroke();
          doc.font('Helvetica-Bold').fontSize(6.5).fillColor(textColor).text(predikat, badgeX, badgeY + 2.8, { width: badgeW, align: 'center' });
        };

        // 1. KOP / HEADER RAPORT RESMI
        doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#0f172a').text(data.sekolah.nama.toUpperCase(), { align: 'center' });
        doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(`NPSN: ${data.sekolah.npsn} ${data.sekolah.alamat ? `• ${data.sekolah.alamat}` : ''}`, { align: 'center' });
        doc.moveDown(0.2);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('LAPORAN HASIL BELAJAR (RAPOR)', { align: 'center' });
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#2563eb').text('Kurikulum Merdeka', { align: 'center' });
        doc.moveDown(0.3);

        // Garis Pembatas Kop (Garis Ganda Rapi)
        const lineY = doc.y;
        doc.moveTo(leftMargin, lineY).lineTo(rightMargin, lineY).lineWidth(1.2).strokeColor('#0f172a').stroke();
        doc.moveTo(leftMargin, lineY + 2).lineTo(rightMargin, lineY + 2).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
        doc.y = lineY + 7;

        // 2. IDENTITAS SISWA & SEKOLAH (CARD BERIKUT SUDUT BULAT)
        const startInfoY = doc.y;
        const halfColW = (contentWidth - 24) / 2;
        const infoRowHeight = 13.5;
        const infoBoxPadding = 9;
        const infoBoxHeight = infoRowHeight * 3 + infoBoxPadding * 2 - 2;

        doc.roundedRect(leftMargin, startInfoY, contentWidth, infoBoxHeight, 6).fillColor('#f8fafc').fill();
        doc.roundedRect(leftMargin, startInfoY, contentWidth, infoBoxHeight, 6).lineWidth(0.75).strokeColor('#e2e8f0').stroke();

        const drawInfoRow = (label: string, value: string, x: number, y: number, labelW = 95, valW = 145) => {
          doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(label, x, y, { width: labelW });
          doc.text(':', x + labelW - 6, y, { width: 6 });
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text(value || '-', x + labelW, y, { width: valW });
        };

        const infoInnerY = startInfoY + infoBoxPadding;
        // Kolom Kiri
        drawInfoRow('Nama Peserta Didik', data.siswa.nama, leftMargin + 12, infoInnerY);
        drawInfoRow('NISN / NIS', data.siswa.nisn, leftMargin + 12, infoInnerY + infoRowHeight);
        drawInfoRow('Kelas', data.kelas.nama_lengkap, leftMargin + 12, infoInnerY + infoRowHeight * 2);

        // Kolom Kanan
        const rightColX = leftMargin + halfColW + 20;
        drawInfoRow('Nama Sekolah', data.sekolah.nama, rightColX, infoInnerY);
        drawInfoRow('Fase', data.kelas.tingkat === 10 ? 'Fase E' : 'Fase F', rightColX, infoInnerY + infoRowHeight);
        drawInfoRow('Semester / TA', `${data.tahun_ajaran.semester} / ${data.tahun_ajaran.nama}`, rightColX, infoInnerY + infoRowHeight * 2);

        // Pastikan kursor X dan Y direset ke tepi kiri secara presisi
        const afterInfoY = startInfoY + infoBoxHeight + 11;
        doc.x = leftMargin;
        doc.y = afterInfoY;

        // 3. TABEL A: LAPORAN NILAI AKADEMIK & CAPAIAN KOMPETENSI
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('A. NILAI AKADEMIK DAN CAPAIAN KOMPETENSI', leftMargin, afterInfoY);
        
        // Keterangan Predikat Kurikulum Merdeka (Legend di atas tabel)
        const legendY = afterInfoY + 11.5;
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748b').text('Keterangan Predikat:', leftMargin, legendY);

        const legends = [
          { code: 'SB', label: 'Sangat Berkembang', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
          { code: 'BSH', label: 'Sesuai Harapan', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
          { code: 'MB', label: 'Mulai Berkembang', bg: '#fefce8', text: '#a16207', border: '#fef08a' },
          { code: 'BB', label: 'Belum Berkembang', bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
        ];

        let curLegX = leftMargin + 68;
        legends.forEach((item, idx) => {
          const bW = item.code.length > 2 ? 17 : 13;
          doc.roundedRect(curLegX, legendY - 1, bW, 9, 2.5).fillColor(item.bg).fill();
          doc.roundedRect(curLegX, legendY - 1, bW, 9, 2.5).lineWidth(0.4).strokeColor(item.border).stroke();
          doc.font('Helvetica-Bold').fontSize(5.5).fillColor(item.text).text(item.code, curLegX, legendY + 0.8, { width: bW, align: 'center' });

          curLegX += bW + 3;
          const labelWithBullet = item.label + (idx < legends.length - 1 ? '   •   ' : '');
          doc.font('Helvetica').fontSize(6.5).fillColor('#475569').text(labelWithBullet, curLegX, legendY);
          curLegX += doc.widthOfString(labelWithBullet);
        });

        let tableStartY = legendY + 12;
        const headerHeight = 18;

        const colNo = 26;
        const colMapel = 125;
        const colNilai = 40;
        const colPredikat = 48;
        const colCapaian = contentWidth - (colNo + colMapel + colNilai + colPredikat);

        // Hitung baris untuk tabel
        type RowData = {
          mapel: typeof data.nilai_mapel[0];
          index: number;
          rowHeight: number;
        };

        const rowsData: RowData[] = data.nilai_mapel.map((m, idx) => {
          doc.font('Helvetica').fontSize(7);
          const textHeight = doc.heightOfString(m.capaian_kompetensi || '-', { width: colCapaian - 10, lineGap: 1 });
          const mapelHeight = doc.heightOfString(m.mapel_nama, { width: colMapel - 10 });
          const rowHeight = Math.max(18, textHeight + 7, mapelHeight + 7);
          return { mapel: m, index: idx, rowHeight };
        });

        // Group rows per halaman
        let startIdx = 0;
        while (startIdx < rowsData.length) {
          let chunkRows: RowData[] = [];
          let currentChunkHeight = headerHeight;

          while (startIdx < rowsData.length) {
            const nextRow = rowsData[startIdx];
            if (tableStartY + currentChunkHeight + nextRow.rowHeight > doc.page.height - 35) {
              if (chunkRows.length === 0) {
                // Baris pertama sangat panjang, paksa masukkan
                chunkRows.push(nextRow);
                currentChunkHeight += nextRow.rowHeight;
                startIdx++;
              }
              break;
            }
            chunkRows.push(nextRow);
            currentChunkHeight += nextRow.rowHeight;
            startIdx++;
          }

          // Gambar container luar tabel dengan rounded corners (radius 6)
          doc.roundedRect(leftMargin, tableStartY, contentWidth, currentChunkHeight, 6).fillColor('#ffffff').fill();

          // Header background dengan sudut atas bulat
          doc.roundedRect(leftMargin, tableStartY, contentWidth, headerHeight, 6).fillColor('#f8fafc').fill();
          doc.rect(leftMargin, tableStartY + 8, contentWidth, headerHeight - 8).fillColor('#f8fafc').fill();

          // Garis horizontal pembatas header
          doc.moveTo(leftMargin, tableStartY + headerHeight).lineTo(rightMargin, tableStartY + headerHeight).lineWidth(0.75).strokeColor('#e2e8f0').stroke();

          // Header text
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
          doc.text('No', leftMargin, tableStartY + 5, { width: colNo, align: 'center' });
          doc.text('Mata Pelajaran', leftMargin + colNo + 5, tableStartY + 5, { width: colMapel - 10 });
          doc.text('Nilai', leftMargin + colNo + colMapel, tableStartY + 5, { width: colNilai, align: 'center' });
          doc.text('Predikat', leftMargin + colNo + colMapel + colNilai, tableStartY + 5, { width: colPredikat, align: 'center' });
          doc.text('Capaian Kompetensi', leftMargin + colNo + colMapel + colNilai + colPredikat + 5, tableStartY + 5, { width: colCapaian - 10 });

          // Render baris data
          let currentY = tableStartY + headerHeight;
          chunkRows.forEach((r, rowIdxInChunk) => {
            const isEven = r.index % 2 === 1;
            if (isEven) {
              doc.rect(leftMargin, currentY, contentWidth, r.rowHeight).fillColor('#fbfcfe').fill();
            }

            // Garis pemisah antar baris (kecuali baris terakhir)
            if (rowIdxInChunk < chunkRows.length - 1) {
              doc.moveTo(leftMargin, currentY + r.rowHeight).lineTo(rightMargin, currentY + r.rowHeight).lineWidth(0.5).strokeColor('#f1f5f9').stroke();
            }

            // Teks kolom baris
            let rx = leftMargin;
            doc.font('Helvetica').fontSize(7).fillColor('#64748b').text((r.index + 1).toString(), rx, currentY + 4.5, { width: colNo, align: 'center' });
            rx += colNo;
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a').text(r.mapel.mapel_nama, rx + 5, currentY + 4.5, { width: colMapel - 10 });
            rx += colMapel;
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text(r.mapel.nilai_akhir !== null ? r.mapel.nilai_akhir.toFixed(0) : '-', rx, currentY + 4.5, { width: colNilai, align: 'center' });
            rx += colNilai;
            drawPredikatBadge(r.mapel.predikat, rx, currentY, colPredikat, r.rowHeight);
            rx += colPredikat;
            doc.font('Helvetica').fontSize(7).fillColor('#334155').text(r.mapel.capaian_kompetensi || '-', rx + 5, currentY + 4.5, { width: colCapaian - 10, lineGap: 1 });

            currentY += r.rowHeight;
          });

          // Garis vertikal pemisah kolom
          let vx = leftMargin;
          [colNo, colMapel, colNilai, colPredikat].forEach((w) => {
            vx += w;
            doc.moveTo(vx, tableStartY).lineTo(vx, tableStartY + currentChunkHeight).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
          });

          // Stroke border luar tabel dengan rounded corners (radius 6)
          doc.roundedRect(leftMargin, tableStartY, contentWidth, currentChunkHeight, 6).lineWidth(0.75).strokeColor('#cbd5e1').stroke();

          tableStartY += currentChunkHeight + 9;
          if (startIdx < rowsData.length) {
            doc.addPage();
            tableStartY = 30;
          }
        }

        let currentY = tableStartY;

        // 4. TABEL B: EKSTRAKURIKULER & TABEL C: KEHADIRAN (BERDAMPINGAN)
        const estimatedBCHeight = 90;
        if (currentY + estimatedBCHeight > doc.page.height - 35) {
          doc.addPage();
          currentY = 30;
        }

        const twoColGap = 14;
        const halfWidth = (contentWidth - twoColGap) / 2;
        const twoColY = currentY;

        // ==========================================
        // Bagian B: Ekstrakurikuler (Kiri)
        // ==========================================
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('B. EKSTRAKURIKULER', leftMargin, twoColY);
        const startEkskulY = twoColY + 12;

        const colEkskulNama = 85;
        const colEkskulPredikat = 60;
        const colEkskulKet = halfWidth - (colEkskulNama + colEkskulPredikat);
        const ekskulHeaderH = 18;

        // Hitung tinggi konten ekskul
        let ekskulRowsHeight = 0;
        if (data.ekstrakurikuler.length === 0) {
          ekskulRowsHeight = 22;
        } else {
          data.ekstrakurikuler.forEach((e) => {
            doc.font('Helvetica').fontSize(7);
            const ketH = doc.heightOfString(e.keterangan || '-', { width: colEkskulKet - 8, lineGap: 1 });
            const rowH = Math.max(18, ketH + 6);
            ekskulRowsHeight += rowH;
          });
        }
        const totalEkskulH = ekskulHeaderH + ekskulRowsHeight;

        // Background container rounded
        doc.roundedRect(leftMargin, startEkskulY, halfWidth, totalEkskulH, 6).fillColor('#ffffff').fill();
        // Header background rounded top
        doc.roundedRect(leftMargin, startEkskulY, halfWidth, ekskulHeaderH, 6).fillColor('#f8fafc').fill();
        doc.rect(leftMargin, startEkskulY + 8, halfWidth, ekskulHeaderH - 8).fillColor('#f8fafc').fill();
        doc.moveTo(leftMargin, startEkskulY + ekskulHeaderH).lineTo(leftMargin + halfWidth, startEkskulY + ekskulHeaderH).lineWidth(0.75).strokeColor('#e2e8f0').stroke();

        // Header text
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
        doc.text('Kegiatan', leftMargin + 6, startEkskulY + 5, { width: colEkskulNama - 8 });
        doc.text('Predikat', leftMargin + colEkskulNama, startEkskulY + 5, { width: colEkskulPredikat, align: 'center' });
        doc.text('Keterangan', leftMargin + colEkskulNama + colEkskulPredikat + 4, startEkskulY + 5, { width: colEkskulKet - 8 });

        // Garis vertikal header ekskul
        doc.moveTo(leftMargin + colEkskulNama, startEkskulY).lineTo(leftMargin + colEkskulNama, startEkskulY + totalEkskulH).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
        doc.moveTo(leftMargin + colEkskulNama + colEkskulPredikat, startEkskulY).lineTo(leftMargin + colEkskulNama + colEkskulPredikat, startEkskulY + totalEkskulH).lineWidth(0.5).strokeColor('#e2e8f0').stroke();

        let ey = startEkskulY + ekskulHeaderH;
        if (data.ekstrakurikuler.length === 0) {
          doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b').text('Tidak mengikuti kegiatan ekstrakurikuler', leftMargin + 6, ey + 6, { width: halfWidth - 12 });
          ey += 22;
        } else {
          data.ekstrakurikuler.forEach((e, eIdx) => {
            doc.font('Helvetica').fontSize(7);
            const ketH = doc.heightOfString(e.keterangan || '-', { width: colEkskulKet - 8, lineGap: 1 });
            const rowH = Math.max(18, ketH + 6);

            if (eIdx > 0) {
              doc.moveTo(leftMargin, ey).lineTo(leftMargin + halfWidth, ey).lineWidth(0.5).strokeColor('#f1f5f9').stroke();
            }

            doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a').text(e.nama, leftMargin + 6, ey + 4.5, { width: colEkskulNama - 10 });
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a').text(e.predikat || '-', leftMargin + colEkskulNama, ey + 4.5, { width: colEkskulPredikat, align: 'center' });
            doc.font('Helvetica').fontSize(7).fillColor('#334155').text(e.keterangan || '-', leftMargin + colEkskulNama + colEkskulPredikat + 4, ey + 4.5, { width: colEkskulKet - 8, lineGap: 1 });

            ey += rowH;
          });
        }

        // Outer stroke ekskul rounded
        doc.roundedRect(leftMargin, startEkskulY, halfWidth, totalEkskulH, 6).lineWidth(0.75).strokeColor('#cbd5e1').stroke();

        // ==========================================
        // Bagian C: Ketidakhadiran (Kanan)
        // ==========================================
        const hadirX = leftMargin + halfWidth + twoColGap;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('C. KETIDAKHADIRAN', hadirX, twoColY);
        const startHadirY = twoColY + 12;

        const colHadirLabel = halfWidth - 60;
        const colHadirCount = 60;
        const hadirHeaderH = 18;
        const hadirRowH = 16.5;
        const totalHadirH = hadirHeaderH + (hadirRowH * 3);

        // Background container rounded
        doc.roundedRect(hadirX, startHadirY, halfWidth, totalHadirH, 6).fillColor('#ffffff').fill();
        // Header background rounded top
        doc.roundedRect(hadirX, startHadirY, halfWidth, hadirHeaderH, 6).fillColor('#f8fafc').fill();
        doc.rect(hadirX, startHadirY + 8, halfWidth, hadirHeaderH - 8).fillColor('#f8fafc').fill();
        doc.moveTo(hadirX, startHadirY + hadirHeaderH).lineTo(hadirX + halfWidth, startHadirY + hadirHeaderH).lineWidth(0.75).strokeColor('#e2e8f0').stroke();

        // Header text
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
        doc.text('Kriteria', hadirX + 8, startHadirY + 5, { width: colHadirLabel - 12 });
        doc.text('Jumlah', hadirX + colHadirLabel, startHadirY + 5, { width: colHadirCount, align: 'center' });

        // Garis vertikal header kehadiran
        doc.moveTo(hadirX + colHadirLabel, startHadirY).lineTo(hadirX + colHadirLabel, startHadirY + totalHadirH).lineWidth(0.5).strokeColor('#e2e8f0').stroke();

        let hy = startHadirY + hadirHeaderH;
        const ketidakhadiranList = [
          { label: 'Sakit (S)', count: data.kehadiran.sakit, isAlert: false },
          { label: 'Izin (I)', count: data.kehadiran.izin, isAlert: false },
          { label: 'Tanpa Keterangan (A)', count: data.kehadiran.alpa, isAlert: data.kehadiran.alpa > 0 },
        ];

        ketidakhadiranList.forEach((k, kIdx) => {
          if (kIdx > 0) {
            doc.moveTo(hadirX, hy).lineTo(hadirX + halfWidth, hy).lineWidth(0.5).strokeColor('#f1f5f9').stroke();
          }

          doc.font('Helvetica').fontSize(7).fillColor('#0f172a');
          doc.text(k.label, hadirX + 8, hy + 4.5, { width: colHadirLabel - 12 });

          if (k.isAlert) {
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#e11d48').text(`${k.count} hari`, hadirX + colHadirLabel, hy + 4.5, { width: colHadirCount, align: 'center' });
          } else {
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text(`${k.count} hari`, hadirX + colHadirLabel, hy + 4.5, { width: colHadirCount, align: 'center' });
          }

          hy += hadirRowH;
        });

        // Outer stroke kehadiran rounded
        doc.roundedRect(hadirX, startHadirY, halfWidth, totalHadirH, 6).lineWidth(0.75).strokeColor('#cbd5e1').stroke();

        // 5. BAGIAN D: CATATAN WALI KELAS
        let nextSectionY = Math.max(startEkskulY + totalEkskulH, startHadirY + totalHadirH) + 9;
        if (nextSectionY + 70 > doc.page.height - 35) {
          doc.addPage();
          nextSectionY = 30;
        }

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('D. CATATAN WALI KELAS', leftMargin, nextSectionY);
        
        const catatanBoxY = nextSectionY + 11;
        const catatanText = data.catatan_wali_kelas || 'Tingkatkan terus motivasi dan kedisiplinan dalam belajar untuk meraih prestasi yang lebih gemilang di semester mendatang.';
        
        doc.font('Helvetica-Oblique').fontSize(7.5);
        const textCatatanH = doc.heightOfString(`"${catatanText}"`, { width: contentWidth - 18, lineGap: 1.5 });
        const boxHeight = Math.max(26, textCatatanH + 10);

        doc.roundedRect(leftMargin, catatanBoxY, contentWidth, boxHeight, 6).fillColor('#f8fafc').fill();
        doc.roundedRect(leftMargin, catatanBoxY, contentWidth, boxHeight, 6).lineWidth(0.75).strokeColor('#e2e8f0').stroke();

        doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#1e293b');
        doc.text(`"${catatanText}"`, leftMargin + 9, catatanBoxY + 5, { width: contentWidth - 18, lineGap: 1.5 });

        // 6. TANDA TANGAN (FOOTER RAPORT)
        let ttdY = catatanBoxY + boxHeight + 10;
        if (ttdY + 75 > doc.page.height - 35) {
          doc.addPage();
          ttdY = 30;
        }

        const colTtdWidth = contentWidth / 3;

        // Orang Tua
        doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
        doc.text('Mengetahui,', leftMargin, ttdY, { align: 'center', width: colTtdWidth });
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
        doc.text('Orang Tua / Wali Murid', leftMargin, ttdY + 9.5, { align: 'center', width: colTtdWidth });
        doc.font('Helvetica').fontSize(7.5).fillColor('#cbd5e1');
        doc.text('...................................................', leftMargin, ttdY + 45, { align: 'center', width: colTtdWidth });

        // Wali Kelas
        const tanggalStr = data.tanggal_terbit ? new Date(data.tanggal_terbit).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
        doc.text(`${data.sekolah.nama || 'Sekolah'}, ${tanggalStr}`, leftMargin + colTtdWidth * 2, ttdY, { align: 'center', width: colTtdWidth });
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
        doc.text('Wali Kelas,', leftMargin + colTtdWidth * 2, ttdY + 9.5, { align: 'center', width: colTtdWidth });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a');
        doc.text(data.wali_kelas?.nama || '( Wali Kelas )', leftMargin + colTtdWidth * 2, ttdY + 44, { align: 'center', width: colTtdWidth });
        doc.font('Helvetica').fontSize(7).fillColor('#64748b');
        doc.text(`NIP. ${data.wali_kelas?.nip || '-'}`, leftMargin + colTtdWidth * 2, ttdY + 54, { align: 'center', width: colTtdWidth });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
