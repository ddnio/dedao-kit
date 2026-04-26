/**
 * @jest-environment jsdom
 */

import { extractCourseArticleMarkdown } from '../article-markdown-extractor.ts';
import type { CourseArticlePageContext } from '../book-context.ts';

function makeCtx(html: string, opts: { title?: string; courseTitle?: string } = {}): CourseArticlePageContext {
    document.body.innerHTML = `<div class="article-body-wrap">${html}</div>`;
    const root = document.querySelector('.article-body-wrap') as HTMLElement;
    const start = (root.querySelector('h1') ?? root.firstElementChild ?? root) as HTMLElement;
    const end = (root.lastElementChild ?? root) as HTMLElement;
    return {
        pageType: 'course-article',
        articleId: 'a1',
        title: opts.title ?? '示例标题',
        courseTitle: opts.courseTitle ?? '',
        captureRoot: root,
        captureStart: start,
        captureEnd: end,
    };
}

describe('extractCourseArticleMarkdown', () => {
    it('renders heading + paragraph', () => {
        const ctx = makeCtx('<h1>标题</h1><p>这是正文。</p>');
        expect(extractCourseArticleMarkdown(ctx)).toBe('# 标题\n\n这是正文。\n');
    });

    it('prepends title when no h1 exists', () => {
        const ctx = makeCtx('<p>仅有一段</p>', { title: '文件标题', courseTitle: '某课程' });
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('# 文件标题');
        expect(md).toContain('> 课程：某课程');
        expect(md).toContain('仅有一段');
    });

    it('does not prepend title when h1 exists', () => {
        const ctx = makeCtx('<h1>原文标题</h1><p>正文</p>', { title: '文件名标题' });
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).not.toContain('文件名标题');
        expect(md).toContain('# 原文标题');
    });

    it('renders bold / italic / code / link inline', () => {
        const ctx = makeCtx(
            '<p>这是<strong>粗体</strong>和<em>斜体</em>以及<code>行内</code>和<a href="/x">链接</a></p>',
        );
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('**粗体**');
        expect(md).toContain('*斜体*');
        expect(md).toContain('`行内`');
        // 相对 URL 已归一化
        expect(md).toMatch(/\[链接\]\(https?:\/\/[^)]+\/x\)/);
    });

    it('renders image with lazy-load fallback and absolute URL', () => {
        const ctx = makeCtx(
            '<p><img alt="封面" data-src="/assets/a.png"></p>',
        );
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toMatch(/!\[封面\]\(https?:\/\/[^)]+\/assets\/a\.png\)/);
    });

    it('skips img with no usable src', () => {
        const ctx = makeCtx('<p><img alt=""><span>文字</span></p>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).not.toContain('![](');
        expect(md).toContain('文字');
    });

    it('renders ordered and unordered list', () => {
        const ctx = makeCtx(`
            <ul><li>一</li><li>二</li></ul>
            <ol><li>甲</li><li>乙</li></ol>
        `);
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('- 一');
        expect(md).toContain('- 二');
        expect(md).toContain('1. 甲');
        expect(md).toContain('2. 乙');
    });

    it('renders nested list with indentation', () => {
        const ctx = makeCtx(`
            <ul><li>外1<ul><li>内1</li><li>内2</li></ul></li><li>外2</li></ul>
        `);
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toMatch(/- 外1[\s\S]*    - 内1[\s\S]*    - 内2[\s\S]*- 外2/);
    });

    it('renders blockquote with > prefix', () => {
        const ctx = makeCtx('<blockquote><p>引用一段话</p></blockquote>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('> 引用一段话');
    });

    it('renders fenced code block with language', () => {
        const ctx = makeCtx('<pre><code class="language-js">const x = 1;</code></pre>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('```js\nconst x = 1;\n```');
    });

    it('renders hr', () => {
        const ctx = makeCtx('<p>前</p><hr><p>后</p>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toMatch(/前[\s\S]*---[\s\S]*后/);
    });

    it('renders table', () => {
        const ctx = makeCtx(`
            <table><tr><th>名</th><th>值</th></tr><tr><td>a</td><td>1</td></tr></table>
        `);
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('| 名 | 值 |');
        expect(md).toContain('| --- | --- |');
        expect(md).toContain('| a | 1 |');
    });

    it('renders figure with caption', () => {
        const ctx = makeCtx('<figure><img alt="图" src="/x.png"><figcaption>说明</figcaption></figure>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('![图]');
        expect(md).toContain('*说明*');
    });

    it('escapes markdown special characters in plain text', () => {
        const ctx = makeCtx('<p>这是 *星号* 和 [括号] 还有 #井号</p>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('\\*星号\\*');
        expect(md).toContain('\\[括号\\]');
        expect(md).toContain('\\#井号');
    });

    it('does not escape > inside inline text (no syntax ambiguity)', () => {
        const ctx = makeCtx('<p>A>B 大于号</p>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('A>B 大于号');
        expect(md).not.toContain('\\>');
    });

    it('list item with only nested list emits empty marker (known acceptable behavior)', () => {
        const ctx = makeCtx('<ul><li><ul><li>nested</li></ul></li></ul>');
        const md = extractCourseArticleMarkdown(ctx);
        // 当前行为：外层 li 无文本时输出空 marker，子 list 4 空格缩进
        expect(md).toMatch(/^- \n/m);
        expect(md).toMatch(/\n {4}- nested/);
    });

    it('skips UI-control aside (展开目录)', () => {
        const ctx = makeCtx('<aside>展开目录</aside><p>正文</p>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).not.toContain('展开目录');
        expect(md).toContain('正文');
    });

    it('skips elements matching denylist class', () => {
        const ctx = makeCtx('<div class="recommend-card">推荐</div><p>正文</p>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).not.toContain('推荐');
        expect(md).toContain('正文');
    });

    it('skips style/script', () => {
        const ctx = makeCtx('<style>.x{}</style><script>alert(1)</script><p>纯净</p>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).not.toContain('alert');
        expect(md).not.toContain('.x{}');
        expect(md).toContain('纯净');
    });

    it('renders media fallback for video/audio', () => {
        const ctx = makeCtx('<video src="/v.mp4"></video><audio src="/a.mp3"></audio>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toMatch(/\[视频\]\(.*v\.mp4\)/);
        expect(md).toMatch(/\[音频\]\(.*a\.mp3\)/);
    });

    it('renders nested list with exactly 4-space indent per level', () => {
        const ctx = makeCtx('<ul><li>外1<ul><li>内1</li></ul></li></ul>');
        const md = extractCourseArticleMarkdown(ctx);
        // 外: "- 外1"，内层缩进 4 空格："    - 内1"
        expect(md).toContain('- 外1');
        expect(md).toMatch(/\n {4}- 内1/);
        // 不应出现 8 空格的内层（双重缩进 bug）
        expect(md).not.toMatch(/\n {8}- 内1/);
    });

    it('uses longer fence when code contains triple backticks', () => {
        const ctx = makeCtx('<pre><code>```\necho hi\n```</code></pre>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('````\n```\necho hi\n```\n````');
    });

    it('escapes ] in img alt and special chars in url', () => {
        const ctx = makeCtx('<p><img alt="a ] b" src="https://x.com/path with space.png"></p>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('![a \\] b](https://x.com/path%20with%20space.png)');
    });

    it('escapes parentheses inside url', () => {
        const ctx = makeCtx('<p><a href="https://x.com/a(b)c">链接</a></p>');
        const md = extractCourseArticleMarkdown(ctx);
        expect(md).toContain('[链接](https://x.com/a%28b%29c)');
    });

    describe('range cropping', () => {
        it('captureStart at h1, captureEnd at last child includes everything between', () => {
            document.body.innerHTML = `
                <div class="article-body-wrap">
                    <div class="meta">头部</div>
                    <h1>标题</h1>
                    <p>段一</p>
                    <p>段二</p>
                </div>`;
            const root = document.querySelector('.article-body-wrap') as HTMLElement;
            const start = root.querySelector('h1') as HTMLElement;
            const end = root.querySelectorAll('p')[1] as HTMLElement;
            const ctx: CourseArticlePageContext = {
                pageType: 'course-article', articleId: 'x', title: 't', courseTitle: '',
                captureRoot: root, captureStart: start, captureEnd: end,
            };
            const md = extractCourseArticleMarkdown(ctx);
            expect(md).not.toContain('头部');
            expect(md).toContain('# 标题');
            expect(md).toContain('段一');
            expect(md).toContain('段二');
        });

        it('captureEnd is deep descendant lifted to direct child', () => {
            document.body.innerHTML = `
                <div class="article-body-wrap">
                    <h1>标题</h1>
                    <p>段一</p>
                    <div class="elite-module"><div class="inner"><span>划重点</span></div></div>
                    <p>段三（应被裁掉）</p>
                </div>`;
            const root = document.querySelector('.article-body-wrap') as HTMLElement;
            const start = root.querySelector('h1') as HTMLElement;
            const end = root.querySelector('span') as HTMLElement;
            const ctx: CourseArticlePageContext = {
                pageType: 'course-article', articleId: 'x', title: 't', courseTitle: '',
                captureRoot: root, captureStart: start, captureEnd: end,
            };
            const md = extractCourseArticleMarkdown(ctx);
            expect(md).toContain('段一');
            expect(md).toContain('划重点');
            expect(md).not.toContain('段三');
        });
    });
});
