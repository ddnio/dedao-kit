/**
 * EPUB 生成功能测试 (T012)
 *
 * 使用 .cache/ 目录中的 44 个 API 响应缓存文件驱动完整 EPUB 生成流程，
 * 无需网络连接或 cookie，可在 CI 中运行。
 *
 * 测试分三层验证：
 *   Layer 1 - 文件结构：必要文件是否存在
 *   Layer 2 - 元数据：package.opf 中的 title/creator/cover-image
 *   Layer 3 - 章节内容：div.part 存在且 aside epub:type="footnote" 位于其中
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import { DOMParser } from 'xmldom';
import { DownloadManager } from '../../src/services/download/manager.ts';
import { apiCache } from '../../src/utils/cache.ts';

// ─── 常量 ───────────────────────────────────────────────────────────────────

const BOOK_ID = '131902';
const ENID    = 'pqvNQ1KRJa7EmgG8MPKrzykNVbDpBWZPGZ6wQA1xO54nlvZq296YodejLXVJE5eA';

/**
 * .cache/ 目录相对于 dedao-extension/ 根目录
 * Jest 的 cwd 默认为项目根（package.json 所在目录）
 */
const CACHE_DIR = path.resolve(process.cwd(), '.cache');

/** dedao API 路径前缀，用于区分「API 请求」和「图片请求」 */
const DEDAO_API_PATH_PREFIXES = [
    '/pc/ebook2/v1/pc/detail',
    '/api/pc/ebook2/v1/pc/read/token',
    '/ebk_web/v1/get_book_info',
    '/ebk_web_go/v2/get_pages',
];

/**
 * 最小 1×1 透明 PNG（base64），用于所有图片 URL 的 mock 返回值
 * 避免任何外网依赖
 */
const ONE_PIXEL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+MXYAAAAASUVORK5CYII=',
    'base64',
);

// ─── 缓存回放工具函数 ────────────────────────────────────────────────────────

/**
 * 生成与 manual-test.ts 完全一致的缓存 key
 * key = MD5(method:url) 或 MD5(method:url + body)
 */
function buildCacheKey(url: string, method: string, body?: string): string {
    const hash = crypto.createHash('md5');
    hash.update(`${method}:${url}`);
    if (body) hash.update(body);
    return hash.digest('hex');
}

/**
 * 将 fetch 的 body 参数标准化为字符串（用于 cache key 计算）
 */
function stringifyBody(body: BodyInit | null | undefined): string {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (body instanceof URLSearchParams) return body.toString();
    if (Buffer.isBuffer(body as unknown)) return (body as unknown as Buffer).toString('utf-8');
    return String(body);
}

/**
 * 判断 URL 是否为已知的 dedao API 端点
 * 返回 false 表示该请求是图片或其他资源请求，应返回 mock 图片数据
 */
function isDedaoApiUrl(rawUrl: string): boolean {
    try {
        const u = new URL(rawUrl);
        if (!u.hostname.endsWith('dedao.cn')) return false;
        return DEDAO_API_PATH_PREFIXES.some(prefix => u.pathname.startsWith(prefix));
    } catch {
        return false;
    }
}

// ─── 章节 HTML 分析 ──────────────────────────────────────────────────────────

interface ChapterAnalysis {
    hasPart: boolean;
    hasFootnoteAsideInPart: boolean;
}

/**
 * 解析章节 XHTML，检查 Layer 3 要求：
 *   - 存在 `<div class="part">`
 *   - `<aside epub:type="footnote">` 位于某个 div.part 内部
 */
function analyzeChapterHtml(xhtml: string): ChapterAnalysis {
    const doc = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml');
    const divs = doc.getElementsByTagName('div');

    let hasPart = false;
    let hasFootnoteAsideInPart = false;

    for (let i = 0; i < divs.length; i++) {
        const div = divs.item(i);
        if (!div) continue;

        const cls = div.getAttribute('class') || '';
        // 匹配 class="part" 或包含 part（处理多 class 情况）
        if (!/(^|\s)part(\s|$)/.test(cls)) continue;
        hasPart = true;

        const asides = div.getElementsByTagName('aside');
        for (let j = 0; j < asides.length; j++) {
            const aside = asides.item(j);
            if (aside?.getAttribute('epub:type') === 'footnote') {
                hasFootnoteAsideInPart = true;
                break;
            }
        }

        if (hasFootnoteAsideInPart) break;
    }

    return { hasPart, hasFootnoteAsideInPart };
}

// ─── 测试套件 ────────────────────────────────────────────────────────────────

describe('EPUB 生成功能测试（缓存回放）', () => {
    /** 预加载的缓存 key → 文件路径 映射 */
    const cacheByKey = new Map<string, string>();
    let originalFetch: typeof fetch;

    // 生成完整 EPUB 比较耗时（需处理 38 个章节缓存），设置充裕超时
    jest.setTimeout(120_000);

    beforeAll(() => {
        // 1. 预加载所有缓存 key 映射（只存路径，按需读取内容）
        if (!fs.existsSync(CACHE_DIR)) {
            throw new Error(`缓存目录不存在：${CACHE_DIR}。请先运行 manual-test.ts 生成缓存。`);
        }
        for (const name of fs.readdirSync(CACHE_DIR)) {
            if (name.endsWith('.json')) {
                cacheByKey.set(name.slice(0, -5), path.join(CACHE_DIR, name));
            }
        }

        // 2. 安装 fetch mock
        originalFetch = global.fetch;
        global.fetch = buildFetchMock(cacheByKey);
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    beforeEach(() => {
        // 每个测试前清空运行时 API 缓存，确保测试隔离
        apiCache.clear();
    });

    // ─── 主测试 ───────────────────────────────────────────────────────────

    it('应生成结构完整、元数据正确、章节格式符合要求的 EPUB', async () => {
        expect(cacheByKey.size).toBeGreaterThan(0);

        const manager = new DownloadManager();
        const blob = await manager.startDownload(BOOK_ID, ENID);

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(0);

        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const fileNames = Object.keys(zip.files);

        // ── Layer 1：文件结构 ───────────────────────────────────────────────
        expect(fileNames).toContain('META-INF/container.xml');
        expect(fileNames).toContain('EPUB/css/cover.css');
        expect(fileNames).toContain('EPUB/package.opf');
        expect(fileNames).toContain('EPUB/nav.xhtml');
        expect(fileNames).toContain('EPUB/toc.ncx');

        // 至少有一张图片
        const imageFiles = fileNames.filter(
            f => f.startsWith('EPUB/images/') && !f.endsWith('/'),
        );
        expect(imageFiles.length).toBeGreaterThan(0);

        // 图片命名规则：image_XXX.ext
        const hasCorrectImageNaming = imageFiles.some(f =>
            /image_\d{3,}\./.test(path.basename(f)),
        );
        expect(hasCorrectImageNaming).toBe(true);

        // 至少有一个章节文件
        const xhtmlFiles = fileNames.filter(
            f => f.startsWith('EPUB/xhtml/') && f.endsWith('.xhtml'),
        );
        expect(xhtmlFiles.length).toBeGreaterThan(0);

        // ── Layer 2：package.opf 元数据 ────────────────────────────────────
        const opfEntry = zip.file('EPUB/package.opf');
        expect(opfEntry).not.toBeNull();

        const opfContent = await opfEntry!.async('string');
        expect(opfContent).toMatch(/<dc:title>[\s\S]*?<\/dc:title>/);
        expect(opfContent).toMatch(/<dc:creator[^>]*>[\s\S]*?<\/dc:creator>/);
        // cover-image 可以是 properties="cover-image" 或 <meta name="cover">
        expect(opfContent).toMatch(/cover-image|name="cover"/);

        // ── Layer 3：章节 HTML 结构 ─────────────────────────────────────────
        let hasPart = false;
        let hasFootnoteAsideInPart = false;

        for (const chapterPath of xhtmlFiles) {
            if (hasPart && hasFootnoteAsideInPart) break;

            const entry = zip.file(chapterPath);
            if (!entry) continue;

            const html = await entry.async('string');
            const analysis = analyzeChapterHtml(html);

            hasPart = hasPart || analysis.hasPart;
            hasFootnoteAsideInPart = hasFootnoteAsideInPart || analysis.hasFootnoteAsideInPart;
        }

        expect(hasPart).toBe(true);
        expect(hasFootnoteAsideInPart).toBe(true);
    });
});

// ─── Fetch Mock 工厂函数 ─────────────────────────────────────────────────────

/**
 * 构建 fetch mock：
 * - 已知 API URL → 从 .cache/ 目录回放响应
 * - 其他 URL（图片/封面/脚注图标）→ 返回 1×1 PNG
 *
 * 与 manual-test.ts 的缓存 key 算法完全一致，确保可以命中同一批缓存文件。
 */
function buildFetchMock(
    cacheByKey: Map<string, string>,
): typeof fetch {
    return jest.fn(async (
        input: RequestInfo | URL,
        init?: RequestInit,
    ): Promise<Response> => {
        const url = typeof input === 'string'
            ? input
            : input instanceof URL
                ? input.toString()
                : (input as Request).url;

        const method = (init?.method || 'GET').toUpperCase();

        // 非 API 请求（封面图、章节图片、脚注图标等）→ 返回 mock 图片
        if (!isDedaoApiUrl(url)) {
            return new Response(ONE_PIXEL_PNG, {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            });
        }

        // API 请求 → 从缓存回放
        const bodyStr = stringifyBody(init?.body);
        const key = buildCacheKey(url, method, bodyStr);
        const cacheFile = cacheByKey.get(key);

        if (!cacheFile) {
            const hint = bodyStr ? ` body=${bodyStr.slice(0, 120)}` : '';
            throw new Error(
                `[epub-test] 未命中 API 缓存\n  ${method} ${url}\n  key=${key}${hint}`,
            );
        }

        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as {
            url: string;
            body: string;
            contentType?: string;
        };

        return new Response(cached.body, {
            status: 200,
            statusText: 'OK (cache)',
            headers: { 'Content-Type': cached.contentType || 'application/json; charset=utf-8' },
        });
    }) as unknown as typeof fetch;
}
