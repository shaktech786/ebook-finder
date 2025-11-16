import { promises as fs } from 'fs';
import path from 'path';
import { CacheEntry } from './types';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Ensures cache directory exists
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create cache directory:', error);
  }
}

/**
 * Generates cache key from query parameters
 */
function getCacheKey(source: string, query: string, page: number = 1): string {
  const sanitized = query.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${source}_${sanitized}_page${page}.json`;
}

/**
 * Retrieves cached data if valid
 */
export async function getCache<T>(source: string, query: string, page: number = 1): Promise<T | null> {
  try {
    await ensureCacheDir();
    const cacheKey = getCacheKey(source, query, page);
    const cachePath = path.join(CACHE_DIR, cacheKey);

    const data = await fs.readFile(cachePath, 'utf-8');
    const entry: CacheEntry<T> = JSON.parse(data);

    // Check if cache is still valid
    if (Date.now() < entry.expiresAt) {
      return entry.data;
    }

    // Cache expired, delete it
    await fs.unlink(cachePath).catch(() => {});
    return null;
  } catch (error) {
    // Cache miss or error
    return null;
  }
}

/**
 * Stores data in cache
 */
export async function setCache<T>(source: string, query: string, data: T, page: number = 1): Promise<void> {
  try {
    await ensureCacheDir();
    const cacheKey = getCacheKey(source, query, page);
    const cachePath = path.join(CACHE_DIR, cacheKey);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION,
    };

    await fs.writeFile(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write cache:', error);
  }
}

/**
 * Clears old cache entries
 */
export async function clearExpiredCache(): Promise<void> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_DIR);

    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        const entry: CacheEntry<unknown> = JSON.parse(data);

        if (Date.now() >= entry.expiresAt) {
          await fs.unlink(filePath);
        }
      } catch {
        // Invalid cache file, delete it
        await fs.unlink(filePath).catch(() => {});
      }
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}
