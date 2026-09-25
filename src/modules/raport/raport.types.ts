import { PredikatBBPB } from '../nilai/nilai.types';

export interface NilaiRaportMapel {
  mapel_id: string;
  mapel_nama: string;
  mapel_kode: string;
  guru_nama?: string;
  rata_formatif?: number | null;
  nilai_sts?: number | null;
  nilai_sas?: number | null;
  nilai_akhir: number | null;
  predikat: PredikatBBPB | null;
  predikat_label?: string | null;
  capaian_kompetensi: string;
}

export interface RekapKehadiranRaport {
  hadir: number;
  terlambat: number;
  sakit: number;
  izin: number;
  alpa: number;
}

export interface EkskulRaportItem {
  nama: string;
  predikat: string;
  keterangan: string;
}

export interface DetailRaportSiswaResponse {
  raport_id: string | null;
  status: 'DRAFT' | 'FINAL' | 'BELUM_DIBUAT';
  tanggal_terbit: string | null;
  siswa: {
    id: string;
    nama: string;
    nisn: string;
  };
  kelas: {
    id: string;
    nama_lengkap: string;
    tingkat: number;
  };
  sekolah: {
    id: string;
    nama: string;
    npsn: string;
    alamat?: string | null;
  };
  tahun_ajaran: {
    id: string;
    nama: string;
    semester: string;
  };
  wali_kelas: {
    id: string;
    nama: string;
    nip?: string | null;
  } | null;
  nilai_mapel: NilaiRaportMapel[];
  ekstrakurikuler: EkskulRaportItem[];
  kehadiran: RekapKehadiranRaport;
  catatan_wali_kelas: string | null;
}

export interface RaportKelasListItem {
  siswa_id: string;
  nama: string;
  nisn: string;
  raport_id: string | null;
  status: 'DRAFT' | 'FINAL' | 'BELUM_DIBUAT';
  tanggal_terbit: string | null;
  jumlah_mapel_dinilai: number;
  total_mapel: number;
  catatan_terisi: boolean;
}
