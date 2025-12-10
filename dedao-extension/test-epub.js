#!/usr/bin/env node

// 设置环境变量
process.env.DEDAO_COOKIE = 'token=OEL-ZJAbIzDSG5Y_1SlFjYQx; _sid=1iv6sp40q3m3cf2g72asbt23bkanwumb; _guard_device_id=1j9mo197c8TqwNHdRvJ6ymwmbafSPdPTUGBhKZh; Hm_lvt_be36b12b82a5f4eaa42c23989d277bb0=1764211108,1764588364,1764844005,1764922535; HMACCOUNT=52699DB5F843DE35; csrfToken=OEL-ZJAbIzDSG5Y_1SlFjYQx; token=OEL-ZJAbIzDSG5Y_1SlFjYQx; _clck=103brh1%5E2%5Eg1p%5E0%5E2026; Hm_lpvt_be36b12b82a5f4eaa42c23989d277bb0=1765270677; _clsk=80rlam%5E1765270776262%5E3%5E1%5Ey.clarity.ms%2Fcollect';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DOMParser } = require('xmldom');

// Mock DOMParser globally
global.DOMParser = DOMParser;

// 导入编译后的模块
const { DownloadManager } = require('./dist/assets/content');

// 或者尝试从源代码导入（假设已编译）
console.log('📚 启动 EPUB 生成测试...\n');

const bookId = '131902';
const enid = 'pqvNQ1KRJa7EmgG8MPKrzykNVbDpBWZPGZ6wQA1xO54nlvZq296YodejLXVJE5eA';

// Cache 目录
const CACHE_DIR = path.resolve(__dirname, '.cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

// Mock fetch with caching
const originalFetch = global.fetch;
global.fetch = async (input, init) => {
    const url = input.toString();
    const method = init?.method || 'GET';
    const body = init?.body ? String(init.body) : '';
    const hash = crypto.createHash('md5').update(`${method}:${url}:${body}`).digest('hex');
    const cachePath = path.join(CACHE_DIR, `${hash}.json`);

    // Check cache
    if (fs.existsSync(cachePath)) {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

        if (cached.isBlob) {
            const buffer = Buffer.from(cached.data, 'base64');
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

    // Inject headers
    const headers = new Headers(init?.headers);
    headers.set('Cookie', process.env.DEDAO_COOKIE || '');
    headers.set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    headers.set('Origin', 'https://www.dedao.cn');
    headers.set('Referer', 'https://www.dedao.cn/');

    const newInit = { ...init, headers };

    try {
        const response = await originalFetch(input, newInit);
        const clonedRes = response.clone();

        let data;
        let isBlob = false;

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await clonedRes.json();
        } else if (contentType.includes('image') || url.match(/\.(jpg|jpeg|png|gif)$/i)) {
            const buffer = await clonedRes.arrayBuffer();
            data = Buffer.from(buffer).toString('base64');
            isBlob = true;
        } else {
            try {
                data = JSON.parse(await clonedRes.text());
            } catch {
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
        console.error(`❌ Fetch failed for ${url}`, e);
        throw e;
    }
};

async function run() {
    try {
        console.log(`📖 Book ID: ${bookId}`);
        console.log(`🔗 ENID: ${enid}\n`);

        // 注意：这里会失败，因为 DownloadManager 可能没有被正确导出或编译
        // 但我们可以检查是否至少能加载模块
        console.log('⚠️  注意：模块加载方式可能不支持，建议使用以下方式运行：\n');
        console.log('方案 1：在 src/ 中创建一个可执行的 test.ts');
        console.log('方案 2：使用编译后的 dist/ 文件');
        console.log('方案 3：配置 tsconfig.json 支持 ts-node\n');

    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

run();
