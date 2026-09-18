import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './database/prisma.service';

@ApiTags('Health & System')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Status API Root' })
  getRoot() {
    return {
      name: 'API Sistem Absensi Siswa',
      version: '1.0.0',
      status: 'online',
      docs: '/api/docs',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health Check Endpoint (Server & Supabase DB Status)' })
  async getHealth() {
    try {
      // Test koneksi database Supabase
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected (Supabase PostgreSQL)',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        status: 'degraded',
        database: 'disconnected',
        error: error?.message || 'Database connection error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
