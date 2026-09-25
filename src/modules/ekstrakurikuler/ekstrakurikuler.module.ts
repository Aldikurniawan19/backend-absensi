import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EkstrakurikulerController } from './ekstrakurikuler.controller';
import { EkstrakurikulerService } from './ekstrakurikuler.service';

@Module({
  imports: [AuditModule],
  controllers: [EkstrakurikulerController],
  providers: [EkstrakurikulerService],
  exports: [EkstrakurikulerService],
})
export class EkstrakurikulerModule {}
