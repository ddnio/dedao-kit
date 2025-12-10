import { DOMParser } from 'xmldom';
import { DownloadManager } from '../src/services/download/manager.ts';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Cache directory
const CACHE_DIR = path.resolve(__dirname, '../.cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
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

// Patch fetch
global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const method = init?.method || 'GET';
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
        const filename = `dedao_${bookId}.epub`;
        fs.writeFileSync(filename, buffer);
        console.log(`Saved to ${filename}`);
        
    } catch (e: any) {
        console.error('\nDownload Failed:', e.message);
        process.exit(1);
    }
}

run();
