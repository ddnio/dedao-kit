import type { CourseArticlePageContext } from './book-context.ts';

const BLOCK_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DETAILS', 'DIALOG', 'DD',
    'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HGROUP', 'HR', 'LI',
    'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'UL',
]);

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);

const UI_CONTROL_TEXTS = ['展开目录', '设置文本', '收起目录', '目录'];
const DENYLIST_CLASS_KEYWORDS = ['recommend', 'pay-tip', 'vip-tip', 'subscribe-bar', 'audio-controls'];

interface RenderCtx {
    baseUrl: string;
    listDepth: number;
    listKind: Array<'ul' | 'ol'>;
    listIndex: number[];
}

export function extractCourseArticleMarkdown(
    ctx: CourseArticlePageContext,
    options: { baseUrl?: string } = {},
): string {
    const { captureRoot, captureStart, captureEnd, title, courseTitle } = ctx;
    const baseUrl = options.baseUrl ?? (typeof window !== 'undefined' ? window.location.href : 'https://www.dedao.cn/');

    const blocks = collectBlocksInRange(captureRoot, captureStart, captureEnd);
    const renderCtx: RenderCtx = { baseUrl, listDepth: 0, listKind: [], listIndex: [] };

    const parts: string[] = [];
    const hasH1 = blocks.some((el) => el.tagName === 'H1' || el.querySelector('h1'));
    if (!hasH1 && title) {
        parts.push(`# ${escapeMd(title)}`);
        if (courseTitle) parts.push(`> 课程：${escapeMd(courseTitle)}`);
    }

    for (const block of blocks) {
        const md = renderBlock(block, renderCtx);
        if (md.trim()) parts.push(md);
    }

    return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function collectBlocksInRange(root: HTMLElement, start: HTMLElement, end: HTMLElement): HTMLElement[] {
    const startBlock = liftToDirectChild(root, start);
    const endBlock = liftToDirectChild(root, end);
    const children = Array.from(root.children) as HTMLElement[];

    const startIdx = startBlock ? children.indexOf(startBlock) : 0;
    const endIdx = endBlock ? children.indexOf(endBlock) : children.length - 1;
    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
        return children;
    }
    return children.slice(startIdx, endIdx + 1);
}

function liftToDirectChild(root: HTMLElement, node: HTMLElement | null): HTMLElement | null {
    if (!node) return null;
    if (node === root) return null;
    let cur: HTMLElement | null = node;
    while (cur && cur.parentElement && cur.parentElement !== root) {
        cur = cur.parentElement;
    }
    return cur && cur.parentElement === root ? cur : null;
}

function renderBlock(el: HTMLElement, ctx: RenderCtx): string {
    if (shouldSkipElement(el)) return '';

    const tag = el.tagName;
    switch (tag) {
        case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': {
            const level = Number(tag[1]);
            return `${'#'.repeat(level)} ${renderInline(el, ctx).trim()}`;
        }
        case 'P':
            return renderInline(el, ctx).trim();
        case 'BLOCKQUOTE': {
            const inner = renderChildrenAsBlocks(el, ctx).trim();
            return inner.split('\n').map((l) => `> ${l}`).join('\n');
        }
        case 'UL': case 'OL':
            return renderList(el, tag === 'OL' ? 'ol' : 'ul', ctx);
        case 'PRE':
            return renderPre(el);
        case 'HR':
            return '---';
        case 'TABLE':
            return renderTable(el, ctx);
        case 'FIGURE':
            return renderFigure(el, ctx);
        case 'IMG':
            return renderImg(el as HTMLImageElement, ctx);
        case 'VIDEO': case 'AUDIO': case 'IFRAME':
            return renderMediaCard(el, ctx);
        case 'BR':
            return '';
        default:
            // 容器元素 → 递归子节点；纯行内 → 当作段落
            if (hasBlockChildren(el)) return renderChildrenAsBlocks(el, ctx);
            return renderInline(el, ctx).trim();
    }
}

function renderChildrenAsBlocks(el: HTMLElement, ctx: RenderCtx): string {
    const out: string[] = [];
    for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            const md = renderBlock(child as HTMLElement, ctx);
            if (md.trim()) out.push(md);
        } else if (child.nodeType === Node.TEXT_NODE) {
            const text = (child.textContent ?? '').trim();
            if (text) out.push(escapeMd(text));
        }
    }
    return out.join('\n\n');
}

function renderInline(el: HTMLElement, ctx: RenderCtx): string {
    let out = '';
    for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
            out += escapeMd(child.textContent ?? '');
            continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const e = child as HTMLElement;
        if (shouldSkipElement(e)) continue;

        const tag = e.tagName;
        if (tag === 'BR') { out += '  \n'; continue; }
        if (tag === 'IMG') { out += renderImg(e as HTMLImageElement, ctx); continue; }
        if (tag === 'A') { out += renderLink(e as HTMLAnchorElement, ctx); continue; }
        if (tag === 'STRONG' || tag === 'B') { out += `**${renderInline(e, ctx)}**`; continue; }
        if (tag === 'EM' || tag === 'I') { out += `*${renderInline(e, ctx)}*`; continue; }
        if (tag === 'CODE') { out += `\`${(e.textContent ?? '').replace(/`/g, '\\`')}\``; continue; }
        if (tag === 'DEL' || tag === 'S') { out += `~~${renderInline(e, ctx)}~~`; continue; }
        // 行内默认：透传
        out += renderInline(e, ctx);
    }
    return out;
}

function renderList(el: HTMLElement, kind: 'ul' | 'ol', ctx: RenderCtx): string {
    const items = Array.from(el.children).filter((c) => c.tagName === 'LI') as HTMLElement[];
    const indent = '    '.repeat(ctx.listDepth);
    const continuationIndent = `${indent}    `;
    const childCtx: RenderCtx = { ...ctx, listDepth: ctx.listDepth + 1 };
    const lines: string[] = [];
    items.forEach((li, i) => {
        const marker = kind === 'ol' ? `${i + 1}. ` : '- ';
        const { first, continuationBlocks } = renderListItemBody(li, childCtx);
        lines.push(`${indent}${marker}${first}`);
        for (const block of continuationBlocks) {
            lines.push('');
            // 子 list 已自带正确层级 indent；其它 block 需补 continuationIndent
            if (block.isList) {
                lines.push(block.text);
            } else {
                for (const ln of block.text.split('\n')) {
                    lines.push(ln ? `${continuationIndent}${ln}` : '');
                }
            }
        }
    });
    return lines.join('\n');
}

interface ContinuationBlock { text: string; isList: boolean; }

function renderListItemBody(li: HTMLElement, ctx: RenderCtx): { first: string; continuationBlocks: ContinuationBlock[] } {
    let inlineBuf = '';
    const continuationBlocks: ContinuationBlock[] = [];
    let firstCaptured = false;
    let first = '';
    const flushInlineToFirst = () => {
        const trimmed = inlineBuf.trim();
        inlineBuf = '';
        if (!trimmed) return;
        if (!firstCaptured) {
            first = trimmed;
            firstCaptured = true;
        } else {
            continuationBlocks.push({ text: trimmed, isList: false });
        }
    };

    for (const child of Array.from(li.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
            inlineBuf += escapeMd(child.textContent ?? '');
            continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const e = child as HTMLElement;
        if (BLOCK_TAGS.has(e.tagName)) {
            flushInlineToFirst();
            const md = renderBlock(e, ctx);
            if (!md.trim()) continue;
            const isList = e.tagName === 'UL' || e.tagName === 'OL';
            continuationBlocks.push({ text: md, isList });
        } else {
            inlineBuf += renderInline(e, ctx);
        }
    }
    flushInlineToFirst();
    if (!firstCaptured) first = '';
    return { first, continuationBlocks };
}

function renderPre(el: HTMLElement): string {
    const code = el.querySelector('code');
    let lang = '';
    if (code) {
        const cls = code.className || '';
        const m = cls.match(/language-([\w+-]+)/);
        if (m) lang = m[1];
    }
    const text = (code?.textContent ?? el.textContent ?? '').replace(/\n$/, '');
    // 围栏需比内容里最长的连续反引号串至少长 1，避免提前闭合
    let maxRun = 0;
    for (const m of text.matchAll(/`+/g)) maxRun = Math.max(maxRun, m[0].length);
    const fence = '`'.repeat(Math.max(3, maxRun + 1));
    return `${fence}${lang}\n${text}\n${fence}`;
}

function renderTable(el: HTMLElement, ctx: RenderCtx): string {
    const rows = Array.from(el.querySelectorAll<HTMLTableRowElement>('tr'));
    if (!rows.length) return '';
    const headerRow = rows[0];
    const headerCells = Array.from(headerRow.children) as HTMLElement[];
    const cols = headerCells.length || 1;
    const lines: string[] = [];
    lines.push('| ' + headerCells.map((c) => renderInline(c, ctx).trim()).join(' | ') + ' |');
    lines.push('| ' + new Array(cols).fill('---').join(' | ') + ' |');
    for (const row of rows.slice(1)) {
        const cells = Array.from(row.children) as HTMLElement[];
        lines.push('| ' + cells.map((c) => renderInline(c, ctx).trim().replace(/\|/g, '\\|')).join(' | ') + ' |');
    }
    return lines.join('\n');
}

function renderFigure(el: HTMLElement, ctx: RenderCtx): string {
    const img = el.querySelector('img');
    const caption = el.querySelector('figcaption');
    const out: string[] = [];
    if (img) out.push(renderImg(img as HTMLImageElement, ctx));
    if (caption) {
        const text = renderInline(caption as HTMLElement, ctx).trim();
        if (text) out.push(`*${text}*`);
    }
    return out.join('\n\n');
}

function renderImg(img: HTMLImageElement, ctx: RenderCtx): string {
    const src = pickImgSrc(img);
    if (!src) return '';
    const url = escapeMdUrl(normalizeUrl(src, ctx.baseUrl));
    const alt = escapeMdAlt((img.getAttribute('alt') ?? '').trim());
    return `![${alt}](${url})`;
}

function escapeMdAlt(alt: string): string {
    return alt.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
}

function escapeMdUrl(url: string): string {
    return url.replace(/ /g, '%20').replace(/\)/g, '%29').replace(/\(/g, '%28');
}

function pickImgSrc(img: HTMLImageElement): string {
    const candidates = [
        img.currentSrc,
        img.getAttribute('src'),
        img.getAttribute('data-src'),
        img.getAttribute('data-original'),
        firstSrcsetUrl(img.getAttribute('srcset')),
        firstSrcsetUrl(img.getAttribute('data-srcset')),
    ];
    for (const c of candidates) {
        if (c && c.trim() && !c.startsWith('data:image/gif;base64,')) return c.trim();
    }
    return '';
}

function firstSrcsetUrl(srcset: string | null): string {
    if (!srcset) return '';
    const first = srcset.split(',')[0]?.trim();
    if (!first) return '';
    return first.split(/\s+/)[0] ?? '';
}

function renderLink(a: HTMLAnchorElement, ctx: RenderCtx): string {
    const href = (a.getAttribute('href') ?? '').trim();
    const text = renderInline(a, ctx).trim();
    if (!href || href.startsWith('javascript:')) return text;
    return `[${text}](${escapeMdUrl(normalizeUrl(href, ctx.baseUrl))})`;
}

function renderMediaCard(el: HTMLElement, ctx: RenderCtx): string {
    const tag = el.tagName.toLowerCase();
    const src = el.getAttribute('src') || el.getAttribute('data-url') || el.querySelector('source')?.getAttribute('src') || '';
    const labelMap: Record<string, string> = { video: '视频', audio: '音频', iframe: '嵌入内容' };
    const label = labelMap[tag] ?? '媒体';
    if (!src) return `[${label}]`;
    return `[${label}](${escapeMdUrl(normalizeUrl(src, ctx.baseUrl))})`;
}

function normalizeUrl(url: string, base: string): string {
    try {
        return new URL(url, base).href;
    } catch {
        return url;
    }
}

function shouldSkipElement(el: HTMLElement): boolean {
    if (SKIP_TAGS.has(el.tagName)) return true;

    // 隐藏元素（jsdom 下 getComputedStyle 部分支持）
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        try {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return true;
        } catch { /* jsdom 偶发抛错，忽略 */ }
    }

    const cls = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
    if (cls && DENYLIST_CLASS_KEYWORDS.some((k) => cls.includes(k))) return true;

    if (el.tagName === 'ASIDE') {
        const text = (el.textContent ?? '').replace(/\s+/g, '');
        if (UI_CONTROL_TEXTS.some((t) => text.includes(t))) return true;
    }

    return false;
}

function hasBlockChildren(el: HTMLElement): boolean {
    for (const child of Array.from(el.children)) {
        if (BLOCK_TAGS.has(child.tagName)) return true;
    }
    return false;
}

function escapeMd(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/([*_`\[\]()#>|])/g, '\\$1');
}
