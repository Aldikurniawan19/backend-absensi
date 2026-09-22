import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Tingkatkan batas ukuran body payload (misal untuk batch jadwal ujian & upload file)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Pastikan folder upload tersedia jika filesystem writable
  try {
    const uploadDir = path.join(process.cwd(), 'uploads', 'izin');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch {
    // Diabaikan pada environment serverless/readonly
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
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
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
