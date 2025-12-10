import CryptoJS from 'crypto-js';

/**
 * Generate a hash key for caching API responses
 * Uses MD5 hash of the URL/endpoint to create a unique cache key
 */
export function generateCacheKey(endpoint: string, params?: Record<string, any>): string {
    const cacheInput = params
        ? `${endpoint}:${JSON.stringify(params)}`
        : endpoint;
    return CryptoJS.MD5(cacheInput).toString();
}

/**
 * Simple in-memory cache for API responses
 * This helps avoid redundant API calls during a single download session
 */
export class ApiResponseCache {
    private cache = new Map<string, { data: any; timestamp: number }>();
    private readonly TTL = 3600000; // 1 hour in milliseconds

    get(key: string): any | null {
        const item = this.cache.get(key);
        if (!item) return null;

        // Check if cache has expired
        if (Date.now() - item.timestamp > this.TTL) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    }

    set(key: string, data: any): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clear(): void {
        this.cache.clear();
    }

    has(key: string): boolean {
        return this.get(key) !== null;
    }
}

// Global cache instance
export const apiCache = new ApiResponseCache();
