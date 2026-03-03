export type DownloadState = 'idle' | 'downloading' | 'success' | 'error';

export interface DownloadButtonUIOptions {
    onClick: () => void;
}

const STYLE_ID = 'dd-epub-dl-style';
export const BUTTON_ID = 'dd-epub-dl-btn';

const CSS = `
#${BUTTON_ID} {
    --dd-progress: 0%;
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 120px;
    height: 38px;
    padding: 0 16px;
    margin-left: 8px;
    border: 1px solid #f87c36;
    border-radius: 4px;
    background: linear-gradient(90deg, rgba(248,124,54,0.18) var(--dd-progress), transparent var(--dd-progress)),
                #fff;
    color: #f87c36;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.3s, color 0.2s, border-color 0.2s;
    white-space: nowrap;
    vertical-align: middle;
    box-sizing: border-box;
}
#${BUTTON_ID}:hover:not(:disabled) {
    background: linear-gradient(90deg, rgba(248,124,54,0.18) var(--dd-progress), #fff3ec var(--dd-progress)),
                #fff3ec;
}
#${BUTTON_ID}:disabled {
    cursor: progress;
    opacity: 0.85;
}
#${BUTTON_ID}[data-state="success"] {
    --dd-progress: 100%;
    border-color: #52c41a;
    color: #52c41a;
    background: linear-gradient(90deg, rgba(82,196,26,0.15) 100%, transparent 100%), #fff;
}
#${BUTTON_ID}[data-state="error"] {
    border-color: #ff4d4f;
    color: #ff4d4f;
    background: #fff;
}
`;

function ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

export class DownloadButtonUI {
    private readonly btn: HTMLButtonElement;
    private state: DownloadState = 'idle';
    private successTimer: number | null = null;

    constructor(private readonly options: DownloadButtonUIOptions) {
        ensureStyle();
        this.btn = document.createElement('button');
        this.btn.type = 'button';
        this.btn.id = BUTTON_ID;
        this.btn.dataset.state = 'idle';
        this.btn.addEventListener('click', () => this.options.onClick());
        this.renderIdle();
    }

    getElement(): HTMLButtonElement {
        return this.btn;
    }

    getState(): DownloadState {
        return this.state;
    }

    /** 将按钮插入到 readButton 的后面（同一容器内） */
    mountNextTo(readButton: HTMLElement): void {
        // 避免重复插入
        if (this.btn.isConnected && this.btn.previousElementSibling === readButton) return;
        if (this.btn.isConnected) this.btn.remove();
        readButton.insertAdjacentElement('afterend', this.btn);
    }

    setProgress(percentage: number, message: string): void {
        if (this.state !== 'downloading') {
            this.state = 'downloading';
            this.btn.dataset.state = 'downloading';
            this.btn.disabled = true;
        }
        const pct = Math.max(0, Math.min(100, Math.round(percentage)));
        this.btn.style.setProperty('--dd-progress', `${pct}%`);
        this.btn.textContent = `${pct}% ${message}`;
        this.btn.title = message;
    }

    setSuccess(): void {
        this.clearSuccessTimer();
        this.state = 'success';
        this.btn.dataset.state = 'success';
        this.btn.disabled = false;
        this.btn.textContent = '✓ 下载完成';
        this.btn.title = '下载完成';
        // 2 秒后自动恢复到 idle
        this.successTimer = window.setTimeout(() => {
            this.successTimer = null;
            this.renderIdle();
        }, 2000);
    }

    setError(message: string): void {
        this.state = 'error';
        this.btn.dataset.state = 'error';
        this.btn.disabled = false;
        this.btn.textContent = '✗ 下载失败，点击重试';
        this.btn.title = message;
    }

    destroy(): void {
        this.clearSuccessTimer();
        this.btn.remove();
    }

    private renderIdle(): void {
        this.state = 'idle';
        this.btn.dataset.state = 'idle';
        this.btn.disabled = false;
        this.btn.style.setProperty('--dd-progress', '0%');
        this.btn.textContent = '下载 EPUB';
        this.btn.title = '将本书下载为 EPUB 文件';
    }

    private clearSuccessTimer(): void {
        if (this.successTimer !== null) {
            window.clearTimeout(this.successTimer);
            this.successTimer = null;
        }
    }
}
