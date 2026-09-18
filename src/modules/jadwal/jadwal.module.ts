import { Module } from '@nestjs/common';
import { JadwalController } from './jadwal.controller';
import { JadwalService } from './jadwal.service';
import { JadwalGeneratorService } from './jadwal-generator.service';

@Module({
  controllers: [JadwalController],
  providers: [JadwalService, JadwalGeneratorService],
  exports: [JadwalService, JadwalGeneratorService],
})
export class JadwalModule {}
