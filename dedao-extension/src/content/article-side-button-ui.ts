export interface ArticleSideButtonUIOptions {
    onClick: () => void;
}

const STYLE_ID = 'dd-course-shot-style';
const ROOT_CLASS = 'dd-course-shot-root';

const CSS = `
    .${ROOT_CLASS} {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }
    .${ROOT_CLASS} .button-module {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }
    .${ROOT_CLASS} .button {
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 999px;
        background: rgb(216, 216, 216);
        color: rgb(255, 255, 255);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }
    .${ROOT_CLASS} .button:disabled {
        cursor: progress;
        opacity: 0.85;
    }
    .${ROOT_CLASS} .button svg {
        width: 14px;
        height: 14px;
        display: block;
    }
    .${ROOT_CLASS} .font {
        font-size: 12px;
        font-weight: 400;
        line-height: 1.4;
        color: rgb(153, 153, 153);
        text-align: center;
    }
    .${ROOT_CLASS}[data-state="success"] .button {
        background: rgb(82, 196, 26);
    }
    .${ROOT_CLASS}[data-state="error"] .button {
        background: rgb(255, 77, 79);
    }
`;

function ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

export class ArticleSideButtonUI {
    private readonly wrapper: HTMLDivElement;
    private readonly button: HTMLButtonElement;
    private readonly label: HTMLSpanElement;
    private resetTimer: number | null = null;

    constructor(private readonly options: ArticleSideButtonUIOptions) {
        ensureStyle();
        this.wrapper = document.createElement('div');
        this.wrapper.className = `side-button-main ${ROOT_CLASS}`;
        this.wrapper.dataset.state = 'idle';

        const module = document.createElement('div');
        module.className = 'button-module';

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'button dd-course-shot-button';
        this.button.addEventListener('click', () => this.options.onClick());

        this.label = document.createElement('span');
        this.label.className = 'font dd-course-shot-label';

        module.appendChild(this.button);
        module.appendChild(this.label);
        this.wrapper.appendChild(module);
        this.render('idle', '下长图', false);
    }

    mount(container: HTMLElement): void {
        const phoneBlock = Array.from(container.querySelectorAll<HTMLElement>('.side-button-main'))
            .find((el) => el.textContent?.includes('手机端'));
        const desiredParent = phoneBlock?.parentElement === container ? container : container;

        if (this.wrapper.isConnected && this.wrapper.parentElement === desiredParent) {
            return;
        }

        if (this.wrapper.isConnected) this.wrapper.remove();
        if (phoneBlock?.parentElement === container) {
            container.insertBefore(this.wrapper, phoneBlock);
            return;
        }
        container.appendChild(this.wrapper);
    }

    getElement(): HTMLElement {
        return this.wrapper;
    }

    setCapturingProgress(percent: number): void {
        this.render('capturing', `下载中 ${Math.max(0, Math.min(100, Math.round(percent)))}%`, true);
    }

    setStitching(): void {
        this.render('stitching', '拼接中', true);
    }

    setSuccess(): void {
        this.render('success', '下载完成', false);
        this.clearResetTimer();
        this.resetTimer = window.setTimeout(() => {
            this.resetTimer = null;
            this.render('idle', '下长图', false);
        }, 2000);
    }

    setError(_message: string): void {
        this.render('error', '失败重试', false);
    }

    setHidden(hidden: boolean): void {
        this.wrapper.style.visibility = hidden ? 'hidden' : '';
    }

    destroy(): void {
        this.clearResetTimer();
        this.wrapper.remove();
    }

    private render(state: string, label: string, disabled: boolean): void {
        this.wrapper.dataset.state = state;
        this.button.disabled = disabled;
        this.label.textContent = label;
        this.button.innerHTML = this.getIconMarkup(state);
    }

    private getIconMarkup(state: string): string {
        if (state === 'success') {
            return `
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" data-icon="success">
                    <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
        }
        if (state === 'error') {
            return `
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" data-icon="retry">
                    <path d="M12.5 6V3.5H10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12.3 3.7A5.5 5.5 0 1 0 13.2 9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
            `;
        }
        return `
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" data-icon="download">
                <path d="M8 3V10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M5.2 7.7L8 10.5L10.8 7.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M4 12.5H12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
        `;
    }

    private clearResetTimer(): void {
        if (this.resetTimer !== null) {
            window.clearTimeout(this.resetTimer);
            this.resetTimer = null;
        }
    }
}
