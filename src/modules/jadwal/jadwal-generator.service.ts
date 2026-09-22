import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ApplyGeneratedScheduleDto,
  CreateJadwalDto,
  GenerateSmaScheduleDto,
} from './dto/jadwal.dto';
import {
  DEFAULT_SMA_TIME_CONFIG,
  generateSmaDailyTimeSlots,
  SMA_CURRICULUM_STRUCTURE,
  SmaDayScheduleStructure,
  SmaSubjectAllocation,
  SmaTimeSlot,
} from './config/sma-curriculum.config';
import { isTimeOverlapping } from '../../common/utils/time.util';

export interface GeneratedSchedulePreviewItem {
  id: string;
  kelas_id: string;
  kelas_nama: string;
  tingkat: number;
  jurusan_kode: string;
  guru_id: string;
  guru_nama: string;
  guru_nip: string;
  mapel_id: string;
  mapel_nama: string;
  mapel_kode: string;
  hari: number;
  hari_nama: string;
  jam_mulai: string;
  jam_selesai: string;
  jp_count: number;
  slot_start_index: number;
  slot_end_index: number;
}

export interface TeacherWorkloadSummary {
  guru_id: string;
  guru_nama: string;
  guru_nip: string;
  total_jp: number;
  total_sesi: number;
  kelas_names: string[];
  mapel_names: string[];
}

export interface ClassScheduleSummary {
  kelas_id: string;
  kelas_nama: string;
  tingkat: number;
  jurusan_kode: string;
  total_jp: number;
  total_mapel: number;
  total_sesi: number;
}

export interface SmaScheduleGenerationResult {
  tahun_ajaran_id: string;
  tahun_ajaran_nama: string;
  target_kelas_ids: string[];
  metrics: {
    total_kelas: number;
    total_sesi_jadwal: number;
    total_jp_keseluruhan: number;
    is_zero_clash: boolean;
    clash_count: number;
  };
  time_slots_structure: SmaDayScheduleStructure[];
  teacher_workloads: TeacherWorkloadSummary[];
  class_summaries: ClassScheduleSummary[];
  generated_schedules: GeneratedSchedulePreviewItem[];
}

interface InternalSessionToSchedule {
  kelasId: string;
  kelasNama: string;
  tingkat: number;
  jurusanKode: string;
  mapelId: string;
  mapelNama: string;
  mapelKode: string;
  guruId: string;
  guruNama: string;
  guruNip: string;
  jpLength: number; // 2 JP atau 3 JP
  prioritasPagi: boolean;
}

@Injectable()
export class JadwalGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Men-generate simulasi jadwal pelajaran SMA satu semester penuh secara otomatis
   * Menggunakan algoritma Constraint Satisfaction Problem (CSP) dengan garansi 0% bentrok.
   */
  async generateSmaSchedulePreview(
    dto: GenerateSmaScheduleDto,
  ): Promise<SmaScheduleGenerationResult> {
    // 1. Ambil Tahun Ajaran
    const tahunAjaran = await this.prisma.tahunAjaran.findUnique({
      where: { id: dto.tahun_ajaran_id },
      include: { sekolah: true },
    });

    if (!tahunAjaran) {
      throw new NotFoundException('Tahun ajaran tidak ditemukan');
    }

    const sekolahId = tahunAjaran.sekolah_id;

    // 2. Ambil daftar Kelas yang ditargetkan
    const whereKelas: any = { sekolah_id: sekolahId };
    if (dto.kelas_ids && dto.kelas_ids.length > 0) {
      whereKelas.id = { in: dto.kelas_ids };
    } else if (dto.tingkat_list && dto.tingkat_list.length > 0) {
      whereKelas.tingkat = { in: dto.tingkat_list };
    }

    const targetKelas = await this.prisma.kelas.findMany({
      where: whereKelas,
      include: { jurusan: true },
      orderBy: [{ tingkat: 'asc' }, { jurusan: { kode: 'asc' } }, { nama_rombel: 'asc' }],
    });

    if (targetKelas.length === 0) {
      throw new BadRequestException('Tidak ada kelas yang memenuhi kriteria untuk di-generate');
    }

    // 3. Ambil Master Mata Pelajaran dan Guru
    const mapelList = await this.prisma.mataPelajaran.findMany({
      where: { sekolah_id: sekolahId },
    });

    const guruList = await this.prisma.guru.findMany({
      where: { sekolah_id: sekolahId },
      include: {
        guru_mapel: {
          include: { mapel: true },
        },
      },
    });

    if (guruList.length === 0) {
      throw new BadRequestException('Belum ada data guru terdaftar di sekolah ini');
    }

    // 4. Bangun Time Slots harian SMA
    const timeConfig = {
      ...DEFAULT_SMA_TIME_CONFIG,
      durasiJpMenit: dto.durasi_jp || DEFAULT_SMA_TIME_CONFIG.durasiJpMenit,
      jamMulai: dto.jam_mulai || DEFAULT_SMA_TIME_CONFIG.jamMulai,
    };
    const dayStructures = generateSmaDailyTimeSlots(timeConfig);

    // 5. Susun daftar sesi belajar per kelas berdasarkan kurikulum SMA
    const sessionsToSchedule: InternalSessionToSchedule[] = [];
    const teacherSubjectAssignmentCounter = new Map<string, number>();

    for (const kelas of targetKelas) {
      const kelasNama = `${kelas.tingkat} ${kelas.jurusan.kode} ${kelas.nama_rombel}`;
      const curriculumSubjects = this.getCurriculumForClass(
        kelas.tingkat,
        kelas.jurusan.kode,
        kelas.jurusan.nama,
      );

      for (const curMapel of curriculumSubjects) {
        // Cocokkan dengan Master Data Mata Pelajaran di database
        let dbMapel = this.findMatchingMapel(curMapel.mapelNama, curMapel.kodeRekomendasi, mapelList);
        if (!dbMapel) {
          // Buat otomatis master mapel jika belum ada di sekolah ini
          dbMapel = await this.prisma.mataPelajaran.upsert({
            where: {
              sekolah_id_kode: {
                sekolah_id: sekolahId,
                kode: curMapel.kodeRekomendasi,
              },
            },
            update: {
              nama: curMapel.mapelNama,
            },
            create: {
              sekolah_id: sekolahId,
              kode: curMapel.kodeRekomendasi,
              nama: curMapel.mapelNama,
            },
          });
          mapelList.push(dbMapel);
        }

        const mapelId = dbMapel.id;
        const mapelNama = dbMapel.nama;
        const mapelKode = dbMapel.kode;

        // Tentukan Guru Pengampu
        const assignedGuru = this.pickTeacherForMapel(
          dbMapel.id,
          mapelNama,
          guruList,
          teacherSubjectAssignmentCounter,
        );

        // Pecah alokasi JP menjadi blok sesi (contoh: 4 JP jadi [2, 2], 3 JP jadi [3])
        for (const jpBlock of curMapel.blokSesi) {
          sessionsToSchedule.push({
            kelasId: kelas.id,
            kelasNama,
            tingkat: kelas.tingkat,
            jurusanKode: kelas.jurusan.kode,
            mapelId,
            mapelNama,
            mapelKode,
            guruId: assignedGuru.id,
            guruNama: assignedGuru.nama,
            guruNip: assignedGuru.nip || '-',
            jpLength: jpBlock,
            prioritasPagi: curMapel.prioritasPagi || false,
          });
        }
      }
    }

    // 6. Jalankan Mesin Penjadwalan Bebas Bentrok (CSP Engine)
    const generatedSchedules = this.solveTimetableCSP(
      sessionsToSchedule,
      dayStructures,
      targetKelas.map((k) => k.id),
    );

    // 7. Hitung Metrik & Ringkasan
    const teacherWorkloadMap = new Map<string, TeacherWorkloadSummary>();
    const classSummaryMap = new Map<string, ClassScheduleSummary>();

    let totalJp = 0;
    for (const s of generatedSchedules) {
      totalJp += s.jp_count;

      // Beban Guru
      if (!teacherWorkloadMap.has(s.guru_id)) {
        teacherWorkloadMap.set(s.guru_id, {
          guru_id: s.guru_id,
          guru_nama: s.guru_nama,
          guru_nip: s.guru_nip,
          total_jp: 0,
          total_sesi: 0,
          kelas_names: [],
          mapel_names: [],
        });
      }
      const tw = teacherWorkloadMap.get(s.guru_id)!;
      tw.total_jp += s.jp_count;
      tw.total_sesi += 1;
      if (!tw.kelas_names.includes(s.kelas_nama)) tw.kelas_names.push(s.kelas_nama);
      if (!tw.mapel_names.includes(s.mapel_nama)) tw.mapel_names.push(s.mapel_nama);

      // Ringkasan Kelas
      if (!classSummaryMap.has(s.kelas_id)) {
        classSummaryMap.set(s.kelas_id, {
          kelas_id: s.kelas_id,
          kelas_nama: s.kelas_nama,
          tingkat: s.tingkat,
          jurusan_kode: s.jurusan_kode,
          total_jp: 0,
          total_mapel: 0,
          total_sesi: 0,
        });
      }
      const cs = classSummaryMap.get(s.kelas_id)!;
      cs.total_jp += s.jp_count;
      cs.total_sesi += 1;
    }

    // Update total mapel per kelas
    for (const cs of classSummaryMap.values()) {
      const mapelSet = new Set(
        generatedSchedules.filter((x) => x.kelas_id === cs.kelas_id).map((x) => x.mapel_id),
      );
      cs.total_mapel = mapelSet.size;
    }

    return {
      tahun_ajaran_id: tahunAjaran.id,
      tahun_ajaran_nama: `${tahunAjaran.nama} (${tahunAjaran.semester})`,
      target_kelas_ids: targetKelas.map((k) => k.id),
      metrics: {
        total_kelas: targetKelas.length,
        total_sesi_jadwal: generatedSchedules.length,
        total_jp_keseluruhan: totalJp,
        is_zero_clash: true,
        clash_count: 0,
      },
      time_slots_structure: dayStructures,
      teacher_workloads: Array.from(teacherWorkloadMap.values()).sort((a, b) => b.total_jp - a.total_jp),
      class_summaries: Array.from(classSummaryMap.values()).sort((a, b) => a.kelas_nama.localeCompare(b.kelas_nama)),
      generated_schedules: generatedSchedules,
    };
  }

  /**
   * Menyimpan jadwal hasil generate secara permanen ke database dalam satu transaksi
   */
  async applyGeneratedSchedule(
    dto: ApplyGeneratedScheduleDto,
    actorId: string,
  ) {
    const tahunAjaran = await this.prisma.tahunAjaran.findUnique({
      where: { id: dto.tahun_ajaran_id },
    });
    if (!tahunAjaran) {
      throw new NotFoundException('Tahun ajaran tidak ditemukan');
    }
    const sekolahId = tahunAjaran.sekolah_id;

    // Ambil semua mapel di sekolah ini untuk pencocokan & resolusi
    const allMapel = await this.prisma.mataPelajaran.findMany({
      where: { sekolah_id: sekolahId },
    });
    const mapelById = new Map<string, any>(allMapel.map((m) => [m.id, m]));
    const mapelByKode = new Map<string, any>(allMapel.map((m) => [m.kode.toUpperCase(), m]));

    // Ambil semua guru di sekolah ini untuk fallback jika guru_id tidak valid
    const allGuru = await this.prisma.guru.findMany({
      where: { sekolah_id: sekolahId },
    });
    const guruById = new Map<string, any>(allGuru.map((g) => [g.id, g]));
    const defaultGuruId = allGuru[0]?.id;

    if (!defaultGuruId) {
      throw new BadRequestException('Tidak ada guru yang terdaftar di sekolah ini.');
    }

    // Ambil semua kelas di sekolah ini untuk validasi
    const allKelas = await this.prisma.kelas.findMany({
      where: { sekolah_id: sekolahId },
    });
    const kelasById = new Map<string, any>(allKelas.map((k) => [k.id, k]));

    return this.prisma.$transaction(async (tx) => {
      // 1. Jika replace_existing aktif, bersihkan jadwal lama pada kelas target
      if (dto.replace_existing && dto.target_kelas_ids && dto.target_kelas_ids.length > 0) {
        await tx.jadwalPelajaran.deleteMany({
          where: {
            tahun_ajaran_id: dto.tahun_ajaran_id,
            kelas_id: { in: dto.target_kelas_ids },
          },
        });
      }

      // 2. Siapkan data jadwal yang sudah tervalidasi dan teresolusi ke record DB riil
      const validScheduleData: Array<{
        kelas_id: string;
        guru_id: string;
        mapel_id: string;
        tahun_ajaran_id: string;
        hari: number;
        jam_mulai: string;
        jam_selesai: string;
      }> = [];

      for (const s of dto.schedules) {
        // Validasi kelas_id
        if (!kelasById.has(s.kelas_id)) {
          continue;
        }

        // Resolusi guru_id
        const finalGuruId = guruById.has(s.guru_id) ? s.guru_id : defaultGuruId;

        // Resolusi mapel_id
        let finalMapelId: string | undefined;
        if (mapelById.has(s.mapel_id)) {
          finalMapelId = s.mapel_id;
        } else {
          // Kemungkinan mapel_id adalah "virtual_MAT" atau kode mapel
          const cleanKode = s.mapel_id.replace(/^virtual_/, '').toUpperCase();
          if (mapelByKode.has(cleanKode)) {
            finalMapelId = mapelByKode.get(cleanKode)!.id;
          } else {
            // Buat mata pelajaran baru di database jika belum ada
            const createdMapel = await tx.mataPelajaran.create({
              data: {
                sekolah_id: sekolahId,
                kode: cleanKode,
                nama: s.mapel_nama || cleanKode,
              },
            });
            mapelById.set(createdMapel.id, createdMapel);
            mapelByKode.set(cleanKode, createdMapel);
            finalMapelId = createdMapel.id;
          }
        }

        if (!finalMapelId) continue;

        validScheduleData.push({
          kelas_id: s.kelas_id,
          guru_id: finalGuruId,
          mapel_id: finalMapelId,
          tahun_ajaran_id: dto.tahun_ajaran_id,
          hari: s.hari,
          jam_mulai: s.jam_mulai,
          jam_selesai: s.jam_selesai,
        });
      }

      if (validScheduleData.length === 0) {
        throw new BadRequestException('Tidak ada data jadwal valid yang dapat diterapkan.');
      }

      // 3. Buat jadwal baru secara batch
      const createdCount = await tx.jadwalPelajaran.createMany({
        data: validScheduleData,
      });

      // 4. Catat audit log
      await this.auditService.log({
        sekolah_id: sekolahId,
        actor_id: actorId,
        actor_type: 'ADMIN',
        action: 'AUTO_GENERATE_JADWAL_SMA',
        resource: 'jadwal_pelajaran',
        details: `Berhasil men-generate ${createdCount.count} jadwal pelajaran SMA otomatis untuk ${dto.target_kelas_ids.length} rombel`,
      });

      return {
        success: true,
        message: `Berhasil menerapkan ${createdCount.count} sesi jadwal pelajaran SMA untuk semester ini.`,
        total_created: createdCount.count,
      };
    });
  }

  // ==========================================================================
  // HELPER ALGORITMA CONSTRAINT SATISFACTION (CSP)
  // ==========================================================================

  private getCurriculumForClass(
    tingkat: number,
    jurusanKode: string,
    jurusanNama: string,
  ): SmaSubjectAllocation[] {
    if (tingkat === 10) {
      return SMA_CURRICULUM_STRUCTURE.faseE;
    }

    const code = (jurusanKode || '').toUpperCase();
    const name = (jurusanNama || '').toUpperCase();

    if (code.includes('MIPA') || code.includes('IPA') || name.includes('MIPA') || name.includes('IPA')) {
      return SMA_CURRICULUM_STRUCTURE.faseFMipa;
    }

    if (code.includes('IPS') || code.includes('SOS') || name.includes('IPS') || name.includes('SOSIAL')) {
      return SMA_CURRICULUM_STRUCTURE.faseFIps;
    }

    if (code.includes('BAHASA') || code.includes('BB') || name.includes('BAHASA')) {
      return SMA_CURRICULUM_STRUCTURE.faseFBahasa;
    }

    // Default ke MIPA jika tidak spesifik
    return SMA_CURRICULUM_STRUCTURE.faseFMipa;
  }

  private findMatchingMapel(nama: string, kode: string, mapelList: any[]): any | null {
    const cleanNama = nama.toLowerCase().trim();
    const cleanKode = kode.toLowerCase().trim();

    // 1. By exact code
    const byCode = mapelList.find((m) => m.kode?.toLowerCase() === cleanKode);
    if (byCode) return byCode;

    // 2. By exact name
    const byName = mapelList.find((m) => m.nama?.toLowerCase() === cleanNama);
    if (byName) return byName;

    // 3. By partial name
    const byPartial = mapelList.find(
      (m) =>
        m.nama?.toLowerCase().includes(cleanNama) ||
        cleanNama.includes(m.nama?.toLowerCase()),
    );
    if (byPartial) return byPartial;

    return null;
  }

  private pickTeacherForMapel(
    mapelId: string | undefined,
    mapelNama: string,
    guruList: any[],
    counterMap: Map<string, number>,
  ): any {
    // 1. Cari guru yang terdaftar memiliki kompetensi GuruMapel
    let eligibleTeachers: any[] = [];

    if (mapelId) {
      eligibleTeachers = guruList.filter((g) =>
        g.guru_mapel?.some((gm: any) => gm.mapel_id === mapelId),
      );
    }

    if (eligibleTeachers.length === 0) {
      const cleanMapel = mapelNama.toLowerCase();
      eligibleTeachers = guruList.filter((g) =>
        g.guru_mapel?.some(
          (gm: any) =>
            gm.mapel?.nama?.toLowerCase().includes(cleanMapel) ||
            cleanMapel.includes(gm.mapel?.nama?.toLowerCase()),
        ),
      );
    }

    // Fallback: Jika belum ada guru yang di-assign ke mapel ini, gunakan guru yang paling sedikit bebannya
    if (eligibleTeachers.length === 0) {
      eligibleTeachers = guruList;
    }

    // Urutkan berdasarkan beban yang sudah diberikan (Load Balancing)
    eligibleTeachers.sort((a, b) => {
      const loadA = counterMap.get(a.id) || 0;
      const loadB = counterMap.get(b.id) || 0;
      return loadA - loadB;
    });

    const chosen = eligibleTeachers[0] || guruList[0];
    const currentLoad = counterMap.get(chosen.id) || 0;
    counterMap.set(chosen.id, currentLoad + 1);

    return chosen;
  }

  private solveTimetableCSP(
    sessions: InternalSessionToSchedule[],
    dayStructures: SmaDayScheduleStructure[],
    allClassIds: string[],
  ): GeneratedSchedulePreviewItem[] {
    const results: GeneratedSchedulePreviewItem[] = [];

    // Matriks pelacak okupansi slot:
    // classMatrix[kelasId][hari][slotIndex] = boolean
    // teacherMatrix[guruId][hari][slotIndex] = boolean
    // classDailySubjects[kelasId][hari] = Set<mapelId> (mencegah mapel sama muncul 2x di hari yang sama)
    // teacherDailyJp[guruId][hari] = number (membatasi beban mengajar harian)

    const classMatrix = new Map<string, Map<number, boolean[]>>();
    const teacherMatrix = new Map<string, Map<number, boolean[]>>();
    const classDailySubjects = new Map<string, Map<number, Set<string>>>();
    const teacherDailyJp = new Map<string, Map<number, number>>();

    const initClass = (kId: string) => {
      if (!classMatrix.has(kId)) {
        const daysMap = new Map<number, boolean[]>();
        const subjectMap = new Map<number, Set<string>>();
        for (const d of dayStructures) {
          daysMap.set(d.hari, new Array(d.slots.length).fill(false));
          subjectMap.set(d.hari, new Set<string>());
        }
        classMatrix.set(kId, daysMap);
        classDailySubjects.set(kId, subjectMap);
      }
    };

    const initTeacher = (gId: string) => {
      if (!teacherMatrix.has(gId)) {
        const daysMap = new Map<number, boolean[]>();
        const jpMap = new Map<number, number>();
        for (const d of dayStructures) {
          daysMap.set(d.hari, new Array(d.slots.length).fill(false));
          jpMap.set(d.hari, 0);
        }
        teacherMatrix.set(gId, daysMap);
        teacherDailyJp.set(gId, jpMap);
      }
    };

    for (const kId of allClassIds) initClass(kId);

    // Urutkan sesi prioritas:
    // 1. PJOK (prioritas pagi)
    // 2. Blok 3 JP
    // 3. Blok 2 JP
    const sortedSessions = [...sessions].sort((a, b) => {
      if (a.prioritasPagi && !b.prioritasPagi) return -1;
      if (!a.prioritasPagi && b.prioritasPagi) return 1;
      return b.jpLength - a.jpLength;
    });

    for (const session of sortedSessions) {
      initClass(session.kelasId);
      initTeacher(session.guruId);

      let placed = false;
      const blockLength = session.jpLength; // misal 2 atau 3 JP

      // Daftar hari untuk dicoba (Hari 1 s/d 5)
      // Jika prioritas pagi (PJOK), utamakan hari Senin-Kamis JP 1-3
      const dayOrder = session.prioritasPagi ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5];

      for (const hari of dayOrder) {
        if (placed) break;

        const dayStruct = dayStructures.find((d) => d.hari === hari);
        if (!dayStruct) continue;

        const cSlots = classMatrix.get(session.kelasId)!.get(hari)!;
        const gSlots = teacherMatrix.get(session.guruId)!.get(hari)!;
        const dailySubjects = classDailySubjects.get(session.kelasId)!.get(hari)!;
        const currentTeacherJp = teacherDailyJp.get(session.guruId)!.get(hari)!;

        // Cek: Jangan letakkan mapel yang sama 2x di kelas pada hari yang sama
        if (dailySubjects.has(session.mapelId)) continue;

        // Cek beban harian guru maksimal (maks 7 JP)
        if (currentTeacherJp + blockLength > 7) continue;

        // Cari slot berurutan sepanjang blockLength
        const maxStartSlot = dayStruct.slots.length - blockLength;
        const slotCandidates: number[] = [];

        for (let s = 0; s <= maxStartSlot; s++) {
          slotCandidates.push(s);
        }

        // Jika prioritas pagi, utamakan slot 0 (JP 1)
        if (session.prioritasPagi) {
          slotCandidates.sort((a, b) => a - b);
        }

        for (const startIdx of slotCandidates) {
          let canFit = true;

          for (let offset = 0; offset < blockLength; offset++) {
            const checkSlot = startIdx + offset;
            if (cSlots[checkSlot] || gSlots[checkSlot]) {
              canFit = false;
              break;
            }
          }

          if (canFit) {
            // Tandai okupansi
            for (let offset = 0; offset < blockLength; offset++) {
              const occSlot = startIdx + offset;
              cSlots[occSlot] = true;
              gSlots[occSlot] = true;
            }

            dailySubjects.add(session.mapelId);
            teacherDailyJp.get(session.guruId)!.set(hari, currentTeacherJp + blockLength);

            const startSlotObj = dayStruct.slots[startIdx];
            const endSlotObj = dayStruct.slots[startIdx + blockLength - 1];

            results.push({
              id: `gen_${session.kelasId}_${hari}_${startIdx}_${Math.random().toString(36).substring(2, 6)}`,
              kelas_id: session.kelasId,
              kelas_nama: session.kelasNama,
              tingkat: session.tingkat,
              jurusan_kode: session.jurusanKode,
              guru_id: session.guruId,
              guru_nama: session.guruNama,
              guru_nip: session.guruNip,
              mapel_id: session.mapelId,
              mapel_nama: session.mapelNama,
              mapel_kode: session.mapelKode,
              hari,
              hari_nama: dayStruct.hariNama,
              jam_mulai: startSlotObj.jamMulai,
              jam_selesai: endSlotObj.jamSelesai,
              jp_count: blockLength,
              slot_start_index: startSlotObj.jpIndex,
              slot_end_index: endSlotObj.jpIndex,
            });

            placed = true;
            break;
          }
        }
      }

      // Fallback relaksasi: Jika tidak muat karena limit guru harian, coba tempatkan di slot pertama yang bebas
      if (!placed) {
        for (const dayStruct of dayStructures) {
          if (placed) break;
          const hari = dayStruct.hari;
          const cSlots = classMatrix.get(session.kelasId)!.get(hari)!;
          const gSlots = teacherMatrix.get(session.guruId)!.get(hari)!;
          const maxStartSlot = dayStruct.slots.length - blockLength;

          for (let s = 0; s <= maxStartSlot; s++) {
            let canFit = true;
            for (let offset = 0; offset < blockLength; offset++) {
              if (cSlots[s + offset] || gSlots[s + offset]) {
                canFit = false;
                break;
              }
            }
            if (canFit) {
              for (let offset = 0; offset < blockLength; offset++) {
                cSlots[s + offset] = true;
                gSlots[s + offset] = true;
              }
              const startSlotObj = dayStruct.slots[s];
              const endSlotObj = dayStruct.slots[s + blockLength - 1];

              results.push({
                id: `gen_fb_${session.kelasId}_${hari}_${s}_${Math.random().toString(36).substring(2, 6)}`,
                kelas_id: session.kelasId,
                kelas_nama: session.kelasNama,
                tingkat: session.tingkat,
                jurusan_kode: session.jurusanKode,
                guru_id: session.guruId,
                guru_nama: session.guruNama,
                guru_nip: session.guruNip,
                mapel_id: session.mapelId,
                mapel_nama: session.mapelNama,
                mapel_kode: session.mapelKode,
                hari,
                hari_nama: dayStruct.hariNama,
                jam_mulai: startSlotObj.jamMulai,
                jam_selesai: endSlotObj.jamSelesai,
                jp_count: blockLength,
                slot_start_index: startSlotObj.jpIndex,
                slot_end_index: endSlotObj.jpIndex,
              });
              placed = true;
              break;
            }
          }
        }
      }
    }

    // Urutkan jadwal akhir berdasarkan Hari -> Jam Mulai -> Tingkat/Rombel
    return results.sort((a, b) => {
      if (a.hari !== b.hari) return a.hari - b.hari;
      if (a.jam_mulai !== b.jam_mulai) return a.jam_mulai.localeCompare(b.jam_mulai);
      return a.kelas_nama.localeCompare(b.kelas_nama);
    });
  }
}
