import { DownloadManager } from '../services/download/manager.ts';
import { captureCourseArticleImage } from './article-capture-session.ts';
import { ArticleSideButtonUI, type SideAction } from './article-side-button-ui.ts';
import { getBookContextFromPage, getPageContextFromPage, type CourseArticlePageContext } from './book-context.ts';
import { locateReadButton } from './read-button-locator.ts';
import { DownloadButtonUI, BUTTON_ID } from './download-button-ui.ts';
import { extractCourseArticleMarkdown } from './article-markdown-extractor.ts';
import { copyTextToClipboard } from './clipboard.ts';

const ACTION_CAPTURE = 'capture';
const ACTION_MD_DOWNLOAD = 'md-download';
const ACTION_MD_COPY = 'md-copy';

const ICON_IMAGE = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/><circle cx="6" cy="7" r="1" fill="currentColor"/><path d="M3 12L6.5 8.5L9 11L11 9L13 12" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const ICON_MD = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M4 10V6L6 8.5L8 6V10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 6V10M9.5 8.5L11 10L12.5 8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_COPY = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="2.5" width="8" height="9" rx="1.2" stroke="currentColor" stroke-width="1.4"/><rect x="5.5" y="5" width="8" height="9" rx="1.2" stroke="currentColor" stroke-width="1.4"/></svg>`;

const ARTICLE_ACTIONS: SideAction[] = [
    { id: ACTION_CAPTURE, label: '下载长图', iconSvg: ICON_IMAGE },
    { id: ACTION_MD_DOWNLOAD, label: '下载 Markdown', iconSvg: ICON_MD },
    { id: ACTION_MD_COPY, label: '复制 Markdown', iconSvg: ICON_COPY },
];

const DEBOUNCE_MS = 150;

/**
 * 编排器：监听 DOM 变化，在详情页注入下载按钮，协调下载流程。
 */
export class PageDownloadController {
    private ui: DownloadButtonUI | null = null;
    private articleUi: ArticleSideButtonUI | null = null;
    private observer: MutationObserver | null = null;
    private debounceTimer: number | null = null;
    private downloading = false;
    private busyAction: typeof ACTION_CAPTURE | typeof ACTION_MD_DOWNLOAD | typeof ACTION_MD_COPY | null = null;

    start(): void {
        this.tryInject();

        // MutationObserver 监听 SPA 渲染完成 / DOM 变化
        this.observer = new MutationObserver(() => this.scheduleInject());
        this.observer.observe(document.documentElement, { childList: true, subtree: true });

        // popstate / hashchange 监听 SPA 路由跳转
        window.addEventListener('popstate', this.handleNavigation);
        window.addEventListener('hashchange', this.handleNavigation);
    }

    stop(): void {
        this.clearDebounce();
        this.observer?.disconnect();
        this.observer = null;
        window.removeEventListener('popstate', this.handleNavigation);
        window.removeEventListener('hashchange', this.handleNavigation);
        this.ui?.destroy();
        this.ui = null;
        this.articleUi?.destroy();
        this.articleUi = null;
    }

    /**
     * 供 GET_BOOK_ID 消息处理复用。
     * 不限路径，兼容阅读页（/ebook/reader）等场景。
     */
    getEnid(): string | null {
        const params = new URLSearchParams(window.location.search);
        return params.get('id') ?? null;
    }

    private readonly handleNavigation = (): void => {
        // 路由变化后重置注入状态（URL 可能已离开详情页）
        this.ui?.destroy();
        this.ui = null;
        this.articleUi?.destroy();
        this.articleUi = null;
        this.scheduleInject();
    };

    private scheduleInject(): void {
        this.clearDebounce();
        this.debounceTimer = window.setTimeout(() => {
            this.debounceTimer = null;
            this.tryInject();
        }, DEBOUNCE_MS);
    }

    private clearDebounce(): void {
        if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    private tryInject(): void {
        // 仅在详情页注入
        const pageCtx = getPageContextFromPage();
        if (!pageCtx) {
            if (this.ui) {
                this.ui.destroy();
                this.ui = null;
            }
            if (this.articleUi) {
                this.articleUi.destroy();
                this.articleUi = null;
            }
            return;
        }

        if (pageCtx.pageType === 'course-article') {
            this.tryInjectArticleButton();
            return;
        }

        const ctx = pageCtx;
        if (!ctx) {
            if (this.ui) {
                this.ui.destroy();
                this.ui = null;
            }
            return;
        }

        // 按钮由当前 controller 管理且仍在 DOM 中，无需重复注入
        if (this.ui?.getElement().isConnected) return;

        // 清理可能残留的旧按钮（热更新/上下文重建场景）
        document.getElementById(BUTTON_ID)?.remove();

        const location = locateReadButton();
        if (!location) return; // 页面未渲染完毕，等 Observer 下次触发

        // 创建（或复用）按钮 UI
        if (!this.ui) {
            this.ui = new DownloadButtonUI({ onClick: () => void this.handleClick() });
        }
        this.ui.mountNextTo(location.readButton, location.container);
    }

    private tryInjectArticleButton(): void {
        this.ui?.destroy();
        this.ui = null;

        const sideRail = document.querySelector<HTMLElement>('aside.iget-side-button.iget-side-portrait');
        if (!sideRail) return;

        if (!this.articleUi) {
            this.articleUi = new ArticleSideButtonUI({
                actions: ARTICLE_ACTIONS,
                onSelect: (id) => void this.handleArticleAction(id),
            });
        }
        this.articleUi.mount(sideRail);
    }

    private handleArticleAction(id: string): void {
        if (this.busyAction !== null) return;
        const ctx = getPageContextFromPage();
        if (!ctx || ctx.pageType !== 'course-article') {
            this.articleUi?.setError('未识别到文章内容');
            return;
        }
        if (id === ACTION_CAPTURE) void this.handleArticleCapture(ctx);
        else if (id === ACTION_MD_DOWNLOAD) void this.handleArticleMarkdownDownload(ctx);
        else if (id === ACTION_MD_COPY) void this.handleArticleMarkdownCopy(ctx);
    }

    private async handleClick(): Promise<void> {
        if (this.downloading) return;

        const ctx = getBookContextFromPage();
        if (!ctx) {
            this.ui?.setError('未识别到电子书 ID，请刷新页面重试');
            return;
        }

        this.downloading = true;
        this.ui?.setProgress(0, '准备中...');

        try {
            const manager = new DownloadManager();
            const blob = await manager.startDownload(ctx.enid, ctx.enid, (progress) => {
                this.ui?.setProgress(progress.percentage, progress.message);
            });

            const filename = this.buildFilename(manager.pkgTitle, ctx.enid);
            this.saveBlob(blob, filename);
            this.ui?.setSuccess();
        } catch (err) {
            const msg = err instanceof Error ? err.message : '未知错误，请重试';
            this.ui?.setError(msg);
        } finally {
            this.downloading = false;
        }
    }

    private async handleArticleCapture(ctx: CourseArticlePageContext): Promise<void> {
        this.busyAction = ACTION_CAPTURE;
        this.articleUi?.setBusy('准备中');
        try {
            const { blob, filename } = await captureCourseArticleImage(ctx, ({ phase, percent }) => {
                if (phase === 'capturing') {
                    this.articleUi?.setProgress(percent, '下长图中');
                } else {
                    this.articleUi?.setBusy('拼接中');
                }
            });
            this.saveBlob(blob, filename);
            this.articleUi?.setSuccess('长图已下载');
        } catch (err) {
            const msg = err instanceof Error ? err.message : '未知错误，请重试';
            console.error('[Dedao course capture] capture failed:', err);
            this.articleUi?.setError(msg);
        } finally {
            this.busyAction = null;
        }
    }

    private async handleArticleMarkdownDownload(ctx: CourseArticlePageContext): Promise<void> {
        this.busyAction = ACTION_MD_DOWNLOAD;
        this.articleUi?.setBusy('生成中');
        try {
            const md = extractCourseArticleMarkdown(ctx);
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
            this.saveBlob(blob, `${this.sanitizeFilename(ctx.title)}.md`);
            this.articleUi?.setSuccess('Markdown 已下载');
        } catch (err) {
            const msg = err instanceof Error ? err.message : '生成失败';
            console.error('[Dedao md download] failed:', err);
            this.articleUi?.setError(msg);
        } finally {
            this.busyAction = null;
        }
    }

    private async handleArticleMarkdownCopy(ctx: CourseArticlePageContext): Promise<void> {
        this.busyAction = ACTION_MD_COPY;
        this.articleUi?.setBusy('复制中');
        try {
            const md = extractCourseArticleMarkdown(ctx);
            try {
                await copyTextToClipboard(md);
                this.articleUi?.setSuccess('已复制');
            } catch (err) {
                console.warn('[Dedao md copy] clipboard failed, falling back to download:', err);
                const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                this.saveBlob(blob, `${this.sanitizeFilename(ctx.title)}.md`);
                this.articleUi?.setSuccess('复制失败，已下载');
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : '生成失败';
            console.error('[Dedao md copy] extract failed:', err);
            this.articleUi?.setError(msg);
        } finally {
            this.busyAction = null;
        }
    }

    private sanitizeFilename(name: string): string {
        const safe = (name || 'dedao_article').replace(/[\\/:*?"<>|]/g, '_').trim();
        return safe || 'dedao_article';
    }

    private buildFilename(pkgTitle: string, fallback: string): string {
        const raw = pkgTitle ? `${pkgTitle}.epub` : `dedao_${fallback}.epub`;
        return raw.replace(/[\\/:*?"<>|]/g, '_');
    }

    private saveBlob(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
}
