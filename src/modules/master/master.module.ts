import { Module } from '@nestjs/common';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';
import { MasterCacheService } from './master-cache.service';

@Module({
  controllers: [MasterController],
  providers: [MasterService, MasterCacheService],
  exports: [MasterService, MasterCacheService],
})
export class MasterModule {}

