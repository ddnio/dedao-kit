/**
 * @jest-environment jsdom
 */

import { getBookContextFromPage, getPageContextFromPage } from '../book-context.ts';

describe('page context detection', () => {
    it('should detect ebook detail pages', () => {
        const ctx = getBookContextFromPage({
            pathname: '/ebook/detail',
            search: '?id=ebook123',
        } as Location);

        expect(ctx).toEqual({
            pageType: 'ebook',
            enid: 'ebook123',
        });
    });

    it('should detect course article pages', () => {
        document.body.innerHTML = `
            <div class="article">
                <h1>文章标题</h1>
                <div class="text">正文第一段</div>
                <div>划重点</div>
                <div class="summary">总结内容</div>
            </div>
        `;

        const ctx = getPageContextFromPage({
            pathname: '/course/article',
            search: '?id=article123',
        } as Location, document);

        expect(ctx?.pageType).toBe('course-article');
        if (!ctx || ctx.pageType !== 'course-article') {
            throw new Error('expected course article context');
        }
        expect(ctx.articleId).toBe('article123');
        expect(ctx.title).toBe('文章标题');
        expect(ctx.courseTitle).toBe('');
        expect(ctx.captureRoot).toBeInstanceOf(HTMLElement);
        expect(ctx.captureStart).toBeInstanceOf(HTMLElement);
        expect(ctx.captureEnd).toBeInstanceOf(HTMLElement);
    });

    it('should prefer the narrowed article body wrapper on real article pages', () => {
        document.body.innerHTML = `
            <div class="article">
                <div class="article-wrap">
                    <div class="article-body-wrap article-body-wrap-unfold">
                        <div class="toolbar">展开目录 设置文本</div>
                        <div>文章标题</div>
                        <div class="article-body">正文第一段</div>
                        <div class="elite-module">划重点</div>
                    </div>
                </div>
                <aside class="iget-side-button iget-side-portrait"></aside>
            </div>
        `;

        const ctx = getPageContextFromPage({
            pathname: '/course/article',
            search: '?id=article123',
        } as Location, document);

        if (!ctx || ctx.pageType !== 'course-article') {
            throw new Error('expected course article context');
        }

        expect(ctx.captureRoot.className).toContain('article-body-wrap');
        expect(ctx.captureStart.textContent).toBe('文章标题');
        expect(ctx.captureEnd.className).toContain('elite-module');
    });

    it('should extract course title and article title separately for filenames', () => {
        document.body.innerHTML = `
            <div class="article-body-wrap article-body-wrap-unfold">
                <div>
                    <div>191｜ 读庄子·大宗师（2）：庄子VS斯多葛派VS老子</div>
                    <div class="author-line">贾行家·年度人文课堂（年度日更）</div>
                    <div>今天</div>
                </div>
                <div class="article-body">正文第一段</div>
                <div class="elite-module">划重点</div>
            </div>
        `;

        const ctx = getPageContextFromPage({
            pathname: '/course/article',
            search: '?id=article123',
        } as Location, document);

        if (!ctx || ctx.pageType !== 'course-article') {
            throw new Error('expected course article context');
        }

        expect(ctx.title).toBe('191｜ 读庄子·大宗师（2）：庄子VS斯多葛派VS老子');
        expect(ctx.courseTitle).toBe('贾行家·年度人文课堂（年度日更）');
    });

    it('should prefer semantic article title and author nodes over publish date', () => {
        document.body.innerHTML = `
            <div class="article-body-wrap article-body-wrap-unfold">
                <div class="pageControl">展开目录 设置文本</div>
                <div>
                    <div class="article-title iget-common-c1">241｜李丰：2026年的中国AI产业趋势（上）</div>
                    <div class="article-info">
                        <div class="author">蔡钰·商业参考4（年度日更）</div>
                        <span class="article-publish-time iget-common-c3 iget-common-f4">2026年3月5日</span>
                    </div>
                </div>
                <div class="article-body">正文第一段</div>
                <div class="elite-module">划重点</div>
            </div>
        `;

        const ctx = getPageContextFromPage({
            pathname: '/course/article',
            search: '?id=article241',
        } as Location, document);

        if (!ctx || ctx.pageType !== 'course-article') {
            throw new Error('expected course article context');
        }

        expect(ctx.title).toBe('241｜李丰：2026年的中国AI产业趋势（上）');
        expect(ctx.courseTitle).toBe('蔡钰·商业参考4（年度日更）');
    });

    it('should return null for unsupported pages', () => {
        const ctx = getPageContextFromPage({
            pathname: '/course/list',
            search: '?id=article123',
        } as Location, document);

        expect(ctx).toBeNull();
    });
});
