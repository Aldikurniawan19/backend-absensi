import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Pastikan folder upload tersedia
  const uploadDir = path.join(process.cwd(), 'uploads', 'izin');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : '*',
    credentials: true,
  });

  // Setup Swagger / OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('API Sistem Absensi Siswa Berbasis Scan QR')
    .setDescription(
      'Dokumentasi lengkap REST API untuk Sistem Absensi Siswa (Per Mata Pelajaran). Digunakan oleh Web Guru/Admin dan Mobile Flutter Siswa.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Masukkan Access Token JWT',
        in: 'header',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Server Sistem Absensi berjalan di: http://localhost:${port}`);
  logger.log(`Dokumentasi Swagger tersedia di: http://localhost:${port}/api/docs`);
}

bootstrap();
