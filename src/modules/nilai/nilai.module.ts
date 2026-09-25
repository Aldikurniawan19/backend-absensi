import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MasterModule } from '../master/master.module';
import { NilaiController } from './nilai.controller';
import { NilaiService } from './nilai.service';

@Module({
  imports: [AuditModule, MasterModule],
  controllers: [NilaiController],
  providers: [NilaiService],
  exports: [NilaiService],
})
export class NilaiModule {}

