import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as zlib from 'zlib';

/**
 * Middleware Kompresi HTTP berbasis standard library Node.js (zlib)
 * Mengompresi payload respons JSON / Text yang lebih besar dari 1KB
 * Mengurangi ukuran transfer jaringan hingga 70-90% untuk mempercepat respons frontend.
 */
@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Jika client tidak mendukung kompresi gzip/deflate, lanjutkan normal
    if (
      typeof acceptEncoding !== 'string' ||
      (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate'))
    ) {
      return next();
    }

    const useGzip = acceptEncoding.includes('gzip');
    const encoding = useGzip ? 'gzip' : 'deflate';
    const compressor = useGzip ? zlib.createGzip({ level: 6 }) : zlib.createDeflate({ level: 6 });

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    let isCompressed = false;
    const thresholdBytes = 1024; // 1 KB minimum threshold

    // Tangkap data saat response dikirim
    const chunks: Buffer[] = [];

    res.write = function (chunk: any, ...args: any[]): boolean {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return true;
    };

    res.end = function (chunk?: any, ...args: any[]): Response {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const totalBuffer = Buffer.concat(chunks);

      // Jangan kompres jika respons berupa binary gambar/file/stream atau di bawah threshold
      const contentType = String(res.getHeader('Content-Type') || '');
      const isCompressible =
        contentType.includes('application/json') ||
        contentType.includes('text/') ||
        contentType.includes('application/javascript') ||
        contentType.length === 0;

      if (!isCompressible || totalBuffer.length < thresholdBytes || res.headersSent) {
        return originalEnd(totalBuffer, ...args);
      }

      try {
        const compressed = useGzip ? zlib.gzipSync(totalBuffer) : zlib.deflateSync(totalBuffer);
        res.setHeader('Content-Encoding', encoding);
        res.removeHeader('Content-Length');
        res.setHeader('Content-Length', compressed.length);
        res.setHeader('Vary', 'Accept-Encoding');
        return originalEnd(compressed, ...args);
      } catch {
        // Fallback ke uncompressed jika terjadi error pada zlib
        return originalEnd(totalBuffer, ...args);
      }
    };

    next();
  }
}
