import { Module } from '@nestjs/common';
import { SesiController } from './sesi.controller';
import { SesiCronService } from './sesi-cron.service';
import { SesiGateway } from './sesi.gateway';
import { SesiService } from './sesi.service';

@Module({
  controllers: [SesiController],
  providers: [SesiService, SesiGateway, SesiCronService],
  exports: [SesiService, SesiGateway],
})
export class SesiModule {}
