import { KomponenNilai } from '@prisma/client';

export type PredikatBBPB = 'BB' | 'MB' | 'BSH' | 'SB';

export interface PredikatInfo {
  kode: PredikatBBPB;
  label: string;
}

export interface RekapNilaiSiswaMapel {
  siswa_id: string;
  nisn: string;
  nama: string;
  nilai_formatif: Array<{
    id: string;
    judul: string;
    nilai: number;
    catatan?: string | null;
  }>;
  rata_formatif: number | null;
  nilai_sts: number | null;
  nilai_sas: number | null;
  nilai_akhir: number | null;
  predikat: PredikatBBPB | null;
  predikat_label?: string | null;
  catatan_capaian?: string | null;
}

export interface RekapKelasMapelResponse {
  kelas: {
    id: string;
    tingkat: number;
    nama_rombel: string;
    nama_lengkap: string;
  };
  mapel: {
    id: string;
    nama: string;
    kode: string;
  };
  tahun_ajaran: {
    id: string;
    nama: string;
    semester: string;
  };
  konfigurasi: {
    bobot_formatif: number;
    bobot_sts: number;
    bobot_sas: number;
    batas_bb: number;
    batas_mb: number;
    batas_bsh: number;
  };
  kolom_formatif: string[]; // Daftar judul formatif yang ada (misal: "Tugas 1", "Tugas 2")
  siswa_list: RekapNilaiSiswaMapel[];
}

export interface RekapSemuaMapelKelasResponse {
  kelas: {
    id: string;
    tingkat: number;
    nama_rombel: string;
    nama_lengkap: string;
  };
  tahun_ajaran: {
    id: string;
    nama: string;
    semester: string;
  };
  mapel_list: Array<{
    id: string;
    nama: string;
    kode: string;
    guru_nama?: string;
  }>;
  siswa_list: Array<{
    siswa_id: string;
    nisn: string;
    nama: string;
    mapel_nilai: Record<
      string,
      {
        rata_formatif: number | null;
        nilai_sts: number | null;
        nilai_sas: number | null;
        nilai_akhir: number | null;
        predikat: PredikatBBPB | null;
      }
    >;
  }>;
}
