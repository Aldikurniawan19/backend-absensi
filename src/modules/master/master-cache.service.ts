import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Service Cache In-Memory untuk Master Data (Tahun Ajaran Aktif, Konfigurasi Penilaian, Sekolah)
 * Menghilangkan puluhan query redundan yang membaca data konfigurasi yang jarang berubah.
 */
@Injectable()
export class MasterCacheService {
  private readonly logger = new Logger(MasterCacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 menit

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number = this.DEFAULT_TTL_MS): void {
    // Batasi ukuran cache untuk mencegah memory leak
    if (this.cache.size > 2000) {
      this.cache.clear();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(prefixOrKey: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefixOrKey)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
