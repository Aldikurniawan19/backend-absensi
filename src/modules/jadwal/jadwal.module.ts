import { Module } from '@nestjs/common';
import { JadwalController } from './jadwal.controller';
import { JadwalService } from './jadwal.service';
import { JadwalGeneratorService } from './jadwal-generator.service';
import { JadwalUjianService } from './jadwal-ujian.service';

@Module({
  controllers: [JadwalController],
  providers: [JadwalService, JadwalGeneratorService, JadwalUjianService],
  exports: [JadwalService, JadwalGeneratorService, JadwalUjianService],
})
export class JadwalModule {}
