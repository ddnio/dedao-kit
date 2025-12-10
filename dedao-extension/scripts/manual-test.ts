import { DOMParser } from 'xmldom';
import { DownloadManager } from '../src/services/download/manager.ts';
import { TaskStatus } from '../src/types/download.ts';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Cache directory
const CACHE_DIR = path.resolve(__dirname, '../.cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

// Mock browser APIs
// The global.fetch is already polyfilled by Node 18+, but we want to intercept it.
const originalFetch = global.fetch;

// Cookie jar to manage cookies across requests (similar to browser behavior)
let cookieJar: Record<string, string> = {};

// Parse cookies from Set-Cookie headers
function parseCookies(setCookieHeader: string) {
    if (!setCookieHeader) return {};
    const parts = setCookieHeader.split(';');
    if (parts.length === 0) return {};
    const cookiePair = parts[0].trim().split('=');
    if (cookiePair.length === 2) {
        return { [cookiePair[0]]: cookiePair[1] };
    }
    return {};
}

// Build cookie string from jar
function buildCookieString() {
    return Object.entries(cookieJar)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Generate cache key
    const url = input.toString();
    const method = init?.method || 'GET';
    const body = init?.body ? String(init.body) : '';
    const hash = crypto.createHash('md5').update(`${method}:${url}:${body}`).digest('hex');
    const cachePath = path.join(CACHE_DIR, `${hash}.json`);

    // Check cache
    if (fs.existsSync(cachePath)) {
        // console.log(`[Cache Hit] ${url}`);
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

        // Handle Blob responses (for images) vs JSON responses
        if (cached.isBlob) {
             const buffer = Buffer.from(cached.data, 'base64');
             // Mock Response with Blob/ArrayBuffer support
             return new Response(buffer, {
                 status: cached.status,
                 statusText: cached.statusText,
                 headers: new Headers(cached.headers)
             });
        } else {
            return new Response(JSON.stringify(cached.data), {
                status: cached.status,
                statusText: cached.statusText,
                headers: new Headers(cached.headers)
            });
        }
    }

    // console.log(`[Network] ${url}`);

    // Inject headers
    const headers = new Headers(init?.headers);

    // Initialize cookie jar from environment variable on first call
    if (Object.keys(cookieJar).length === 0) {
        const envCookies = process.env.DEDAO_COOKIE || '';
        envCookies.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (name && value) {
                cookieJar[name] = value;
            }
        });
    }

    // Use cookies from jar
    const cookieString = buildCookieString();
    if (cookieString) {
        headers.set('Cookie', cookieString);
    }

    headers.set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    headers.set('Origin', 'https://www.dedao.cn');
    headers.set('Referer', 'https://www.dedao.cn/');

    const newInit = { ...init, headers };

    // Debug: log request headers for POST requests
    if (method === 'POST' && url.includes('read/token')) {
        console.log(`[DEBUG] POST ${url}`);
        console.log(`[DEBUG] Cookies:`, cookieString);
        console.log(`[DEBUG] Body:`, body);
    }

    try {
        const response = await originalFetch(input, newInit);
        const clonedRes = response.clone();

        // Update cookie jar from response Set-Cookie headers
        const setCookieHeaders = response.headers.getSetCookie?.() || [];
        if (Array.isArray(setCookieHeaders)) {
            setCookieHeaders.forEach(header => {
                const cookies = parseCookies(header);
                Object.assign(cookieJar, cookies);
            });
        }

        // Cache the response
        let data: any;
        let isBlob = false;

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await clonedRes.json();
        } else if (contentType.includes('image') || url.match(/\.(jpg|jpeg|png|gif)$/i)) {
            const buffer = await clonedRes.arrayBuffer();
            data = Buffer.from(buffer).toString('base64');
            isBlob = true;
        } else {
            // Default to text
            try {
                data = JSON.parse(await clonedRes.text());
            } catch {
                // Fallback for non-json text? assume json for dedao api usually
                // but if text, maybe ignore or store as string?
                // For safety let's store as isBlob=false data=text if json parse fails?
                // For now assuming JSON for API and Blob for images covers 99% cases.
                data = {};
            }
        }

        fs.writeFileSync(cachePath, JSON.stringify({
            url,
            method,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data,
            isBlob
        }, null, 2));

        return response;
    } catch (e) {
        console.error(`Fetch failed for ${url}`, e);
        throw e;
    }
};

global.DOMParser = DOMParser as any;

// Quick dirty argument parsing
const args = process.argv.slice(2);
const bookId = args[0];
const enid = args[1]; // Need enid as well, usually the same or provided

if (!bookId || !enid) {
    console.error('Usage: ts-node scripts/manual-test.ts <bookId> <enid>');
    console.error('Example: ts-node scripts/manual-test.ts 123456 Enid123456');
    process.exit(1);
}

// Ensure cookies are present
if (!process.env.DEDAO_COOKIE) {
    console.error('Error: DEDAO_COOKIE environment variable is missing.');
    console.error('Please export DEDAO_COOKIE="your_cookie_string" before running.');
    process.exit(1);
}

// Polyfill for Blob and File if needed (Node 18+ has Blob)
// But we might need to save the blob to disk.

async function run() {
    console.log(`Starting manual download test for Book ID: ${bookId} (ENID: ${enid})`);
    const manager = new DownloadManager();

    try {
        const blob = await manager.startDownload(bookId, enid, (progress) => {
            // Overwrite line to show progress
            process.stdout.write(`\r[${progress.percentage}%] ${progress.message}          `);
        });

        console.log('\nDownload finished!');
        
        // Save to file
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const outputPath = path.resolve(process.cwd(), `dedao_${bookId}.epub`);
        
        fs.writeFileSync(outputPath, buffer);
        console.log(`Saved EPUB to: ${outputPath}`);

    } catch (error) {
        console.error('\nDownload failed:', error);
    }
}

run();
