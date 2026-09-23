import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditRetentionService } from './audit-retention.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRetentionService],
  exports: [AuditService],
})
export class AuditModule {}
