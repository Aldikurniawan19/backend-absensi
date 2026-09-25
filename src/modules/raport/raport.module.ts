import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NilaiModule } from '../nilai/nilai.module';
import { RaportController } from './raport.controller';
import { RaportService } from './raport.service';

@Module({
  imports: [AuditModule, NilaiModule],
  controllers: [RaportController],
  providers: [RaportService],
  exports: [RaportService],
})
export class RaportModule {}
