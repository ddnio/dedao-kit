import { DOMParser } from 'xmldom';
import { DownloadManager } from '../src/services/download/manager.ts';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Cache directory for API responses
const CACHE_DIR = path.resolve(__dirname, '../.cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Check if cache should be used (--no-cache flag disables it)
const USE_CACHE = !process.argv.includes('--no-cache');
if (USE_CACHE) {
    console.log('[Cache] API 响应缓存已启用，使用 --no-cache 禁用');
} else {
    console.log('[Cache] API 响应缓存已禁用');
}

// Generate cache key from request
function getCacheKey(url: string, method: string, body?: string): string {
    const hash = crypto.createHash('md5');
    hash.update(`${method}:${url}`);
    if (body) hash.update(body);
    return hash.digest('hex');
}

// Get cached response
function getCachedResponse(cacheKey: string): { body: string, contentType: string } | null {
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    if (fs.existsSync(cachePath)) {
        try {
            const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
            console.log(`[Cache] HIT: ${cached.url?.substring(0, 60)}...`);
            return cached;
        } catch {
            return null;
        }
    }
    return null;
}

// Save response to cache
function saveToCache(cacheKey: string, url: string, body: string, contentType: string): void {
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    fs.writeFileSync(cachePath, JSON.stringify({ url, body, contentType }, null, 2));
}

// Mock browser APIs
const originalFetch = global.fetch;

// Cookie jar
let cookieJar: Record<string, string> = {};

function buildCookieString() {
    return Object.entries(cookieJar)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

// URLs that should be cached (API endpoints, not images)
function shouldCacheUrl(url: string): boolean {
    // Cache API calls to dedao.cn
    if (url.includes('dedao.cn') && !url.match(/\.(jpg|jpeg|png|gif|svg|webp)(\?|$)/i)) {
        return true;
    }
    return false;
}

// Patch fetch with caching
global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const method = init?.method || 'GET';
    const bodyStr = init?.body?.toString() || '';
    
    // Check cache first (only for cacheable URLs)
    if (USE_CACHE && shouldCacheUrl(url)) {
        const cacheKey = getCacheKey(url, method, bodyStr);
        const cached = getCachedResponse(cacheKey);
        if (cached) {
            return new Response(cached.body, {
                status: 200,
                statusText: 'OK (Cached)',
                headers: { 'Content-Type': cached.contentType }
            });
        }
    }
    
    const headers = new Headers(init?.headers);

    // Initialize cookies from env if jar is empty
    if (Object.keys(cookieJar).length === 0) {
        const envCookies = process.env.DEDAO_COOKIE || '';
        envCookies.split(';').forEach(c => {
            const [name, ...rest] = c.trim().split('=');
            if (name && rest.length > 0) {
                cookieJar[name] = rest.join('=');
            }
        });
    }

    const cookieString = buildCookieString();
    if (cookieString) {
        headers.set('Cookie', cookieString);
    }

    // Set Common Headers to mimic browser/dedao-dl
    headers.set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36');
    headers.set('Referer', 'https://www.dedao.cn/');
    headers.set('Origin', 'https://www.dedao.cn');

    // Handle CSRF Token if present in cookies (dedao-dl pattern)
    // Note: dedao-dl uses 'Xi-Csrf-Token' header for some requests
    if (cookieJar['csrfToken']) {
        headers.set('Xi-Csrf-Token', cookieJar['csrfToken']);
    }

    const newInit = { ...init, headers };

    try {
        const response = await originalFetch(input, newInit);
        
        // Update jar with Set-Cookie
        let setCookieHeaders: string[] = [];
        if (typeof response.headers.getSetCookie === 'function') {
            setCookieHeaders = response.headers.getSetCookie();
        } else {
            const sc = response.headers.get('set-cookie');
            if (sc) setCookieHeaders = [sc];
        }

        setCookieHeaders.forEach(header => {
            const parts = header.split(';');
            if (parts.length > 0) {
                const [name, ...valParts] = parts[0].trim().split('=');
                if (name && valParts.length > 0) {
                    cookieJar[name] = valParts.join('=');
                }
            }
        });

        // Error Logging for 401/403
        if (response.status === 401 || response.status === 403) {
            const text = await response.text();
            console.error(`
[API ERROR] ${response.status} ${response.statusText} - ${url}`);
            console.error(`Body: ${text}\n`);
            // Return recreated response to allow calling code to handle status
            return new Response(text, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        }

        // Cache successful API responses
        if (USE_CACHE && shouldCacheUrl(url) && response.ok) {
            const cacheKey = getCacheKey(url, method, bodyStr);
            const clonedResponse = response.clone();
            const responseBody = await clonedResponse.text();
            const contentType = response.headers.get('Content-Type') || 'application/json';
            saveToCache(cacheKey, url, responseBody, contentType);
            console.log(`[Cache] SAVE: ${url.substring(0, 60)}...`);
            // Return a new response with the same body
            return new Response(responseBody, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        }

        return response;
    } catch (e) {
        throw e;
    }
};

global.DOMParser = DOMParser as any;

const args = process.argv.slice(2);
const bookId = args[0];
const enid = args[1];

if (!bookId || !enid) {
    console.log('Usage: npx ts-node scripts/manual-test.ts <BookID> <EnID>');
    process.exit(1);
}

async function run() {
    console.log(`Starting download test for Book ${bookId}...`);
    const manager = new DownloadManager();

    try {
        const blob = await manager.startDownload(bookId, enid, (p) => {
            process.stdout.write(`\r[${p.percentage}%] ${p.message}          `);
        });
        
        console.log('\nDownload finished!');
        const buffer = Buffer.from(await blob.arrayBuffer());
        
        // Use the title from the metadata for filename if possible
        const filename = `${(manager as any).pkgTitle || bookId}.epub`.replace(/[\\\/:*?"<>|]/g, '_');
        fs.writeFileSync(filename, buffer);
        console.log(`Saved to ${filename}`);
        
    } catch (e: any) {
        console.error('\nDownload Failed:', e.message);
        process.exit(1);
    }
}

run();
