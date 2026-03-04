import { DownloadManager } from '../services/download/manager.ts';
import { getBookContextFromPage } from './book-context.ts';
import { locateReadButton } from './read-button-locator.ts';
import { DownloadButtonUI, BUTTON_ID } from './download-button-ui.ts';

const DEBOUNCE_MS = 150;

/**
 * 编排器：监听 DOM 变化，在详情页注入下载按钮，协调下载流程。
 */
export class PageDownloadController {
    private ui: DownloadButtonUI | null = null;
    private observer: MutationObserver | null = null;
    private debounceTimer: number | null = null;
    private downloading = false;

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
        const ctx = getBookContextFromPage();
        if (!ctx) {
            // 离开详情页，移除按钮
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
