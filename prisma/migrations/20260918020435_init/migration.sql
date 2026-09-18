-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SISWA', 'GURU', 'ADMIN');

-- CreateEnum
CREATE TYPE "TahunAjaranStatus" AS ENUM ('DRAFT', 'AKTIF', 'NONAKTIF');

-- CreateEnum
CREATE TYPE "SesiAbsensiStatus" AS ENUM ('BERLANGSUNG', 'SELESAI', 'DIBATALKAN');

-- CreateEnum
CREATE TYPE "AbsensiStatus" AS ENUM ('HADIR', 'TERLAMBAT', 'ALPA', 'IZIN', 'SAKIT');

-- CreateEnum
CREATE TYPE "AbsensiSumber" AS ENUM ('SCAN_QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "IzinJenis" AS ENUM ('IZIN', 'SAKIT');

-- CreateEnum
CREATE TYPE "IzinStatus" AS ENUM ('PENDING', 'DISETUJUI', 'DITOLAK');

-- CreateEnum
CREATE TYPE "SesiLoginStatus" AS ENUM ('AKTIF', 'LOGOUT', 'EXPIRED');

-- CreateTable
CREATE TABLE "sekolah" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "npsn" TEXT NOT NULL,
    "alamat" TEXT,
    "wajib_gps" BOOLEAN NOT NULL DEFAULT false,
    "lat_sekolah" DECIMAL(10,7),
    "lng_sekolah" DECIMAL(10,7),
    "radius_meter" INTEGER NOT NULL DEFAULT 100,
    "maks_sesi_aktif_siswa" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sekolah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tahun_ajaran" (
    "id" TEXT NOT NULL,
    "sekolah_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "tanggal_mulai" DATE NOT NULL,
    "tanggal_selesai" DATE NOT NULL,
    "status" "TahunAjaranStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tahun_ajaran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jurusan" (
    "id" TEXT NOT NULL,
    "sekolah_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jurusan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kelas" (
    "id" TEXT NOT NULL,
    "sekolah_id" TEXT NOT NULL,
    "jurusan_id" TEXT NOT NULL,
    "tingkat" INTEGER NOT NULL,
    "nama_rombel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siswa" (
    "id" TEXT NOT NULL,
    "sekolah_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "nisn" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "no_hp_ortu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siswa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_kelas_siswa" (
    "id" TEXT NOT NULL,
    "siswa_id" TEXT NOT NULL,
    "kelas_id" TEXT NOT NULL,
    "tahun_ajaran_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "riwayat_kelas_siswa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guru" (
    "id" TEXT NOT NULL,
    "sekolah_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "no_hp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guru_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin" (
    "id" TEXT NOT NULL,
    "sekolah_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penugasan_wali_kelas" (
    "id" TEXT NOT NULL,
    "guru_id" TEXT NOT NULL,
    "kelas_id" TEXT NOT NULL,
    "tahun_ajaran_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penugasan_wali_kelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mata_pelajaran" (
    "id" TEXT NOT NULL,
    "sekolah_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mata_pelajaran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guru_mapel" (
    "id" TEXT NOT NULL,
    "guru_id" TEXT NOT NULL,
    "mapel_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guru_mapel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jadwal_pelajaran" (
    "id" TEXT NOT NULL,
    "kelas_id" TEXT NOT NULL,
    "guru_id" TEXT NOT NULL,
    "mapel_id" TEXT NOT NULL,
    "tahun_ajaran_id" TEXT NOT NULL,
    "hari" INTEGER NOT NULL,
    "jam_mulai" TEXT NOT NULL,
    "jam_selesai" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jadwal_pelajaran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesi_login" (
    "id" TEXT NOT NULL,
    "siswa_id" TEXT,
    "guru_id" TEXT,
    "admin_id" TEXT,
    "device_info" TEXT NOT NULL,
    "token_refresh" TEXT NOT NULL,
    "waktu_login" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waktu_terakhir_aktif" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SesiLoginStatus" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sesi_login_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesi_absensi" (
    "id" TEXT NOT NULL,
    "jadwal_id" TEXT NOT NULL,
    "token_qr" TEXT NOT NULL,
    "waktu_mulai" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waktu_exp" TIMESTAMP(3) NOT NULL,
    "status" "SesiAbsensiStatus" NOT NULL DEFAULT 'BERLANGSUNG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sesi_absensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absensi" (
    "id" TEXT NOT NULL,
    "sesi_id" TEXT NOT NULL,
    "siswa_id" TEXT NOT NULL,
    "waktu_scan" TIMESTAMP(3),
    "status" "AbsensiStatus" NOT NULL,
    "lokasi_lat" DECIMAL(10,7),
    "lokasi_lng" DECIMAL(10,7),
    "sumber" "AbsensiSumber" NOT NULL DEFAULT 'SCAN_QR',
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengajuan_izin" (
    "id" TEXT NOT NULL,
    "siswa_id" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "jenis" "IzinJenis" NOT NULL,
    "keterangan" TEXT NOT NULL,
    "file_bukti" TEXT,
    "status_approval" "IzinStatus" NOT NULL DEFAULT 'PENDING',
    "disetujui_oleh_id" TEXT,
    "alasan_penolakan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pengajuan_izin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "sekolah_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_type" "UserRole" NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sekolah_npsn_key" ON "sekolah"("npsn");

-- CreateIndex
CREATE INDEX "tahun_ajaran_sekolah_id_status_idx" ON "tahun_ajaran"("sekolah_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "jurusan_sekolah_id_kode_key" ON "jurusan"("sekolah_id", "kode");

-- CreateIndex
CREATE INDEX "kelas_sekolah_id_tingkat_idx" ON "kelas"("sekolah_id", "tingkat");

-- CreateIndex
CREATE UNIQUE INDEX "kelas_sekolah_id_tingkat_jurusan_id_nama_rombel_key" ON "kelas"("sekolah_id", "tingkat", "jurusan_id", "nama_rombel");

-- CreateIndex
CREATE UNIQUE INDEX "siswa_nisn_key" ON "siswa"("nisn");

-- CreateIndex
CREATE UNIQUE INDEX "siswa_email_key" ON "siswa"("email");

-- CreateIndex
CREATE INDEX "siswa_sekolah_id_nisn_idx" ON "siswa"("sekolah_id", "nisn");

-- CreateIndex
CREATE INDEX "riwayat_kelas_siswa_kelas_id_tahun_ajaran_id_idx" ON "riwayat_kelas_siswa"("kelas_id", "tahun_ajaran_id");

-- CreateIndex
CREATE UNIQUE INDEX "riwayat_kelas_siswa_siswa_id_tahun_ajaran_id_key" ON "riwayat_kelas_siswa"("siswa_id", "tahun_ajaran_id");

-- CreateIndex
CREATE UNIQUE INDEX "guru_nip_key" ON "guru"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "guru_email_key" ON "guru"("email");

-- CreateIndex
CREATE INDEX "guru_sekolah_id_nip_idx" ON "guru"("sekolah_id", "nip");

-- CreateIndex
CREATE UNIQUE INDEX "admin_email_key" ON "admin"("email");

-- CreateIndex
CREATE INDEX "admin_sekolah_id_email_idx" ON "admin"("sekolah_id", "email");

-- CreateIndex
CREATE INDEX "penugasan_wali_kelas_guru_id_tahun_ajaran_id_idx" ON "penugasan_wali_kelas"("guru_id", "tahun_ajaran_id");

-- CreateIndex
CREATE UNIQUE INDEX "penugasan_wali_kelas_kelas_id_tahun_ajaran_id_key" ON "penugasan_wali_kelas"("kelas_id", "tahun_ajaran_id");

-- CreateIndex
CREATE UNIQUE INDEX "mata_pelajaran_sekolah_id_kode_key" ON "mata_pelajaran"("sekolah_id", "kode");

-- CreateIndex
CREATE UNIQUE INDEX "guru_mapel_guru_id_mapel_id_key" ON "guru_mapel"("guru_id", "mapel_id");

-- CreateIndex
CREATE INDEX "jadwal_pelajaran_guru_id_hari_idx" ON "jadwal_pelajaran"("guru_id", "hari");

-- CreateIndex
CREATE INDEX "jadwal_pelajaran_kelas_id_hari_idx" ON "jadwal_pelajaran"("kelas_id", "hari");

-- CreateIndex
CREATE INDEX "jadwal_pelajaran_tahun_ajaran_id_idx" ON "jadwal_pelajaran"("tahun_ajaran_id");

-- CreateIndex
CREATE INDEX "sesi_login_siswa_id_status_idx" ON "sesi_login"("siswa_id", "status");

-- CreateIndex
CREATE INDEX "sesi_login_guru_id_status_idx" ON "sesi_login"("guru_id", "status");

-- CreateIndex
CREATE INDEX "sesi_login_admin_id_status_idx" ON "sesi_login"("admin_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sesi_absensi_token_qr_key" ON "sesi_absensi"("token_qr");

-- CreateIndex
CREATE INDEX "sesi_absensi_jadwal_id_status_idx" ON "sesi_absensi"("jadwal_id", "status");

-- CreateIndex
CREATE INDEX "absensi_siswa_id_status_idx" ON "absensi"("siswa_id", "status");

-- CreateIndex
CREATE INDEX "absensi_sesi_id_status_idx" ON "absensi"("sesi_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "absensi_sesi_id_siswa_id_key" ON "absensi"("sesi_id", "siswa_id");

-- CreateIndex
CREATE INDEX "pengajuan_izin_siswa_id_tanggal_idx" ON "pengajuan_izin"("siswa_id", "tanggal");

-- CreateIndex
CREATE INDEX "audit_log_sekolah_id_actor_id_idx" ON "audit_log"("sekolah_id", "actor_id");

-- AddForeignKey
ALTER TABLE "tahun_ajaran" ADD CONSTRAINT "tahun_ajaran_sekolah_id_fkey" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurusan" ADD CONSTRAINT "jurusan_sekolah_id_fkey" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kelas" ADD CONSTRAINT "kelas_sekolah_id_fkey" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kelas" ADD CONSTRAINT "kelas_jurusan_id_fkey" FOREIGN KEY ("jurusan_id") REFERENCES "jurusan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siswa" ADD CONSTRAINT "siswa_sekolah_id_fkey" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_kelas_siswa" ADD CONSTRAINT "riwayat_kelas_siswa_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "siswa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_kelas_siswa" ADD CONSTRAINT "riwayat_kelas_siswa_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "kelas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_kelas_siswa" ADD CONSTRAINT "riwayat_kelas_siswa_tahun_ajaran_id_fkey" FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guru" ADD CONSTRAINT "guru_sekolah_id_fkey" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin" ADD CONSTRAINT "admin_sekolah_id_fkey" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_wali_kelas" ADD CONSTRAINT "penugasan_wali_kelas_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "guru"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_wali_kelas" ADD CONSTRAINT "penugasan_wali_kelas_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "kelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_wali_kelas" ADD CONSTRAINT "penugasan_wali_kelas_tahun_ajaran_id_fkey" FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mata_pelajaran" ADD CONSTRAINT "mata_pelajaran_sekolah_id_fkey" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guru_mapel" ADD CONSTRAINT "guru_mapel_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "guru"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guru_mapel" ADD CONSTRAINT "guru_mapel_mapel_id_fkey" FOREIGN KEY ("mapel_id") REFERENCES "mata_pelajaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_pelajaran" ADD CONSTRAINT "jadwal_pelajaran_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "kelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_pelajaran" ADD CONSTRAINT "jadwal_pelajaran_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "guru"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_pelajaran" ADD CONSTRAINT "jadwal_pelajaran_mapel_id_fkey" FOREIGN KEY ("mapel_id") REFERENCES "mata_pelajaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_pelajaran" ADD CONSTRAINT "jadwal_pelajaran_tahun_ajaran_id_fkey" FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesi_login" ADD CONSTRAINT "sesi_login_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "siswa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesi_login" ADD CONSTRAINT "sesi_login_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "guru"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesi_login" ADD CONSTRAINT "sesi_login_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesi_absensi" ADD CONSTRAINT "sesi_absensi_jadwal_id_fkey" FOREIGN KEY ("jadwal_id") REFERENCES "jadwal_pelajaran"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_sesi_id_fkey" FOREIGN KEY ("sesi_id") REFERENCES "sesi_absensi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "siswa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pengajuan_izin" ADD CONSTRAINT "pengajuan_izin_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "siswa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_sekolah_id_fkey" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah"("id") ON DELETE CASCADE ON UPDATE CASCADE;
