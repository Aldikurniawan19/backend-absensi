export interface SmaTimeSlot {
  jpIndex: number;
  jamMulai: string;
  jamSelesai: string;
  durasiMenit: number;
}

export interface SmaDayScheduleStructure {
  hari: number; // 1 = Senin ... 5 = Jumat
  hariNama: string;
  slots: SmaTimeSlot[];
}

export interface SmaSubjectAllocation {
  mapelNama: string;
  kodeRekomendasi: string;
  totalJp: number;
  blokSesi: number[]; // misal [2, 2] untuk 4 JP dipecah 2 hari, atau [3] untuk 3 JP sekali
  prioritasPagi?: boolean; // seperti PJOK
  isKejuruanPeminatan?: boolean;
}

export interface SmaCurriculumStructure {
  faseE: SmaSubjectAllocation[]; // Kelas 10
  faseFMipa: SmaSubjectAllocation[]; // Kelas 11 & 12 MIPA
  faseFIps: SmaSubjectAllocation[]; // Kelas 11 & 12 IPS
  faseFBahasa: SmaSubjectAllocation[]; // Kelas 11 & 12 Bahasa
}

/**
 * Konfigurasi Alokasi Waktu Jam Pelajaran SMA (1 JP = 45 Menit)
 * Berdasarkan standar Permendikbudristek No. 12/2024 & Permendikdasmen No. 13/2025
 */
export const DEFAULT_SMA_TIME_CONFIG = {
  durasiJpMenit: 45,
  jamMulai: '07:30',
  // Istirahat 1 (30 Menit) setelah JP ke-3: 09:45 - 10:15
  istirahat1: {
    setelahJp: 3,
    durasiMenit: 30,
  },
  // Istirahat 2 / Ishoma (45 Menit) setelah JP ke-6: 12:30 - 13:15
  istirahat2: {
    setelahJp: 6,
    durasiMenit: 45,
  },
  maxJpSeninKamis: 8, // 07:30 s/d 14:45
  maxJpJumat: 5, // 07:30 s/d 11:45 (sebelum Sholat Jumat)
};

/**
 * Menghitung time slots presisi per hari untuk jenjang SMA
 */
export function generateSmaDailyTimeSlots(
  config = DEFAULT_SMA_TIME_CONFIG,
): SmaDayScheduleStructure[] {
  const days: { hari: number; hariNama: string; maxJp: number }[] = [
    { hari: 1, hariNama: 'Senin', maxJp: config.maxJpSeninKamis },
    { hari: 2, hariNama: 'Selasa', maxJp: config.maxJpSeninKamis },
    { hari: 3, hariNama: 'Rabu', maxJp: config.maxJpSeninKamis },
    { hari: 4, hariNama: 'Kamis', maxJp: config.maxJpSeninKamis },
    { hari: 5, hariNama: 'Jumat', maxJp: config.maxJpJumat },
  ];

  const parseMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const formatMinutes = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return days.map((d) => {
    const slots: SmaTimeSlot[] = [];
    let currentMinutes = parseMinutes(config.jamMulai);

    for (let jp = 1; jp <= d.maxJp; jp++) {
      const startMinutes = currentMinutes;
      const endMinutes = currentMinutes + config.durasiJpMenit;

      slots.push({
        jpIndex: jp,
        jamMulai: formatMinutes(startMinutes),
        jamSelesai: formatMinutes(endMinutes),
        durasiMenit: config.durasiJpMenit,
      });

      currentMinutes = endMinutes;

      // Sisipkan Istirahat 1 setelah JP 3
      if (jp === config.istirahat1.setelahJp) {
        currentMinutes += config.istirahat1.durasiMenit;
      }

      // Sisipkan Istirahat 2 / Ishoma setelah JP 6 (khusus Senin - Kamis)
      if (d.hari <= 4 && jp === config.istirahat2.setelahJp) {
        currentMinutes += config.istirahat2.durasiMenit;
      }
    }

    return {
      hari: d.hari,
      hariNama: d.hariNama,
      slots,
    };
  });
}

/**
 * Struktur Alokasi Mata Pelajaran Kurikulum Merdeka SMA
 */
export const SMA_CURRICULUM_STRUCTURE: SmaCurriculumStructure = {
  // 1. FASE E (KELAS X SMA - Semua Rombel Umum)
  faseE: [
    { mapelNama: 'Pendidikan Agama dan Budi Pekerti', kodeRekomendasi: 'PAI', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Pendidikan Pancasila', kodeRekomendasi: 'PPKN', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Bahasa Indonesia', kodeRekomendasi: 'BIND', totalJp: 4, blokSesi: [2, 2] },
    { mapelNama: 'Matematika', kodeRekomendasi: 'MTK', totalJp: 4, blokSesi: [2, 2] },
    { mapelNama: 'Fisika', kodeRekomendasi: 'FIS', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Kimia', kodeRekomendasi: 'KIM', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Biologi', kodeRekomendasi: 'BIO', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Sosiologi', kodeRekomendasi: 'SOS', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Ekonomi', kodeRekomendasi: 'EKO', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Sejarah', kodeRekomendasi: 'SEJ', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Geografi', kodeRekomendasi: 'GEO', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Bahasa Inggris', kodeRekomendasi: 'BING', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Pendidikan Jasmani Olahraga dan Kesehatan', kodeRekomendasi: 'PJOK', totalJp: 3, blokSesi: [3], prioritasPagi: true },
    { mapelNama: 'Informatika', kodeRekomendasi: 'INF', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Seni Budaya', kodeRekomendasi: 'SBD', totalJp: 2, blokSesi: [2] },
  ],

  // 2. FASE F (KELAS XI & XII SMA - PEMINATAN MIPA)
  faseFMipa: [
    // Kelompok Umum
    { mapelNama: 'Pendidikan Agama dan Budi Pekerti', kodeRekomendasi: 'PAI', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Pendidikan Pancasila', kodeRekomendasi: 'PPKN', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Bahasa Indonesia', kodeRekomendasi: 'BIND', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Matematika', kodeRekomendasi: 'MTK', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Bahasa Inggris', kodeRekomendasi: 'BING', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Pendidikan Jasmani Olahraga dan Kesehatan', kodeRekomendasi: 'PJOK', totalJp: 3, blokSesi: [3], prioritasPagi: true },
    { mapelNama: 'Sejarah', kodeRekomendasi: 'SEJ', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Seni Budaya', kodeRekomendasi: 'SBD', totalJp: 2, blokSesi: [2] },
    // Kelompok Pilihan MIPA
    { mapelNama: 'Matematika Tingkat Lanjut', kodeRekomendasi: 'MTK-TL', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
    { mapelNama: 'Fisika', kodeRekomendasi: 'FIS', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
    { mapelNama: 'Kimia', kodeRekomendasi: 'KIM', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
    { mapelNama: 'Biologi', kodeRekomendasi: 'BIO', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
  ],

  // 3. FASE F (KELAS XI & XII SMA - PEMINATAN IPS)
  faseFIps: [
    // Kelompok Umum
    { mapelNama: 'Pendidikan Agama dan Budi Pekerti', kodeRekomendasi: 'PAI', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Pendidikan Pancasila', kodeRekomendasi: 'PPKN', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Bahasa Indonesia', kodeRekomendasi: 'BIND', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Matematika', kodeRekomendasi: 'MTK', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Bahasa Inggris', kodeRekomendasi: 'BING', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Pendidikan Jasmani Olahraga dan Kesehatan', kodeRekomendasi: 'PJOK', totalJp: 3, blokSesi: [3], prioritasPagi: true },
    { mapelNama: 'Sejarah', kodeRekomendasi: 'SEJ', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Seni Budaya', kodeRekomendasi: 'SBD', totalJp: 2, blokSesi: [2] },
    // Kelompok Pilihan IPS
    { mapelNama: 'Sosiologi', kodeRekomendasi: 'SOS', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
    { mapelNama: 'Ekonomi', kodeRekomendasi: 'EKO', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
    { mapelNama: 'Geografi', kodeRekomendasi: 'GEO', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
    { mapelNama: 'Sejarah Tingkat Lanjut', kodeRekomendasi: 'SEJ-TL', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
  ],

  // 4. FASE F (KELAS XI & XII SMA - PEMINATAN BAHASA)
  faseFBahasa: [
    // Kelompok Umum
    { mapelNama: 'Pendidikan Agama dan Budi Pekerti', kodeRekomendasi: 'PAI', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Pendidikan Pancasila', kodeRekomendasi: 'PPKN', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Bahasa Indonesia', kodeRekomendasi: 'BIND', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Matematika', kodeRekomendasi: 'MTK', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Bahasa Inggris', kodeRekomendasi: 'BING', totalJp: 3, blokSesi: [3] },
    { mapelNama: 'Pendidikan Jasmani Olahraga dan Kesehatan', kodeRekomendasi: 'PJOK', totalJp: 3, blokSesi: [3], prioritasPagi: true },
    { mapelNama: 'Sejarah', kodeRekomendasi: 'SEJ', totalJp: 2, blokSesi: [2] },
    { mapelNama: 'Seni Budaya', kodeRekomendasi: 'SBD', totalJp: 2, blokSesi: [2] },
    // Kelompok Pilihan Bahasa
    { mapelNama: 'Bahasa dan Sastra Indonesia', kodeRekomendasi: 'BS-IND', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
    { mapelNama: 'Bahasa dan Sastra Inggris', kodeRekomendasi: 'BS-ING', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
    { mapelNama: 'Bahasa Asing Pilihan', kodeRekomendasi: 'BASING', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
    { mapelNama: 'Antropologi', kodeRekomendasi: 'ANT', totalJp: 4, blokSesi: [2, 2], isKejuruanPeminatan: true },
  ],
};
