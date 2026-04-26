export interface SideAction {
    id: string;
    label: string;
    iconSvg: string;
}

export interface ArticleSideButtonUIOptions {
    actions: SideAction[];
    onSelect: (actionId: string) => void;
}

const STYLE_ID = 'dd-course-shot-style';
const ROOT_CLASS = 'dd-course-shot-root';
const MENU_CLASS = 'dd-course-shot-menu';

const CSS = `
    .${ROOT_CLASS} {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        position: relative;
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
    .${ROOT_CLASS}[data-state="success"] .button { background: rgb(82, 196, 26); }
    .${ROOT_CLASS}[data-state="error"] .button { background: rgb(255, 77, 79); }

    .${MENU_CLASS} {
        position: absolute;
        right: calc(100% + 8px);
        top: 0;
        min-width: 140px;
        margin: 0;
        padding: 6px 0;
        list-style: none;
        background: rgb(255, 255, 255);
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 8px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
        z-index: 9999;
        display: none;
    }
    .${MENU_CLASS}[data-open="true"] { display: block; }
    .${MENU_CLASS} li {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        font-size: 13px;
        color: rgb(51, 51, 51);
        cursor: pointer;
        white-space: nowrap;
    }
    .${MENU_CLASS} li:hover { background: rgba(0, 0, 0, 0.04); }
    .${MENU_CLASS} li svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
        color: rgb(102, 102, 102);
    }
`;

const DOWNLOAD_ICON = `
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" data-icon="download">
        <path d="M8 3V10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M5.2 7.7L8 10.5L10.8 7.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 12.5H12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
`;
const SUCCESS_ICON = `
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" data-icon="success">
        <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
`;
const ERROR_ICON = `
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" data-icon="retry">
        <path d="M12.5 6V3.5H10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12.3 3.7A5.5 5.5 0 1 0 13.2 9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
`;
const MENU_ICON = `
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" data-icon="menu">
        <path d="M3 5H13M3 8H13M3 11H13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
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
    private readonly menu: HTMLUListElement;
    private resetTimer: number | null = null;
    private busy = false;
    private readonly outsideClick = (e: MouseEvent): void => {
        if (!this.wrapper.contains(e.target as Node)) this.closeMenu();
    };
    private readonly escListener = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') this.closeMenu();
    };

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
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.busy) return;
            this.toggleMenu();
        });

        this.label = document.createElement('span');
        this.label.className = 'font dd-course-shot-label';

        module.appendChild(this.button);
        module.appendChild(this.label);
        this.wrapper.appendChild(module);

        this.menu = document.createElement('ul');
        this.menu.className = MENU_CLASS;
        this.menu.dataset.open = 'false';
        for (const action of options.actions) {
            const li = document.createElement('li');
            li.dataset.actionId = action.id;
            li.innerHTML = `${action.iconSvg}<span>${action.label}</span>`;
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeMenu();
                this.options.onSelect(action.id);
            });
            this.menu.appendChild(li);
        }
        this.wrapper.appendChild(this.menu);

        this.render('idle', '小助手', false);
    }

    mount(container: HTMLElement): void {
        const phoneBlock = Array.from(container.querySelectorAll<HTMLElement>('.side-button-main'))
            .find((el) => el.textContent?.includes('手机端'));

        if (this.wrapper.isConnected && this.wrapper.parentElement === container) {
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

    setBusy(label: string): void {
        this.busy = true;
        this.closeMenu();
        this.clearResetTimer();
        this.render('capturing', label, true);
    }

    setProgress(percent: number, prefix = '下载中'): void {
        const p = Math.max(0, Math.min(100, Math.round(percent)));
        this.render('capturing', `${prefix} ${p}%`, true);
    }

    setSuccess(label = '完成'): void {
        this.busy = false;
        this.clearResetTimer();
        this.render('success', label, false);
        this.resetTimer = window.setTimeout(() => {
            this.resetTimer = null;
            this.render('idle', '小助手', false);
        }, 2000);
    }

    setError(label = '失败重试'): void {
        this.busy = false;
        this.clearResetTimer();
        this.render('error', label, false);
        this.resetTimer = window.setTimeout(() => {
            this.resetTimer = null;
            this.render('idle', '小助手', false);
        }, 3000);
    }

    setHidden(hidden: boolean): void {
        this.wrapper.style.visibility = hidden ? 'hidden' : '';
    }

    destroy(): void {
        this.clearResetTimer();
        this.closeMenu();
        this.wrapper.remove();
    }

    private toggleMenu(): void {
        if (this.menu.dataset.open === 'true') this.closeMenu();
        else this.openMenu();
    }

    private openMenu(): void {
        this.menu.dataset.open = 'true';
        document.addEventListener('click', this.outsideClick);
        document.addEventListener('keydown', this.escListener);
    }

    private closeMenu(): void {
        if (this.menu.dataset.open !== 'true') return;
        this.menu.dataset.open = 'false';
        document.removeEventListener('click', this.outsideClick);
        document.removeEventListener('keydown', this.escListener);
    }

    private render(state: string, label: string, disabled: boolean): void {
        this.wrapper.dataset.state = state;
        this.button.disabled = disabled;
        this.label.textContent = label;
        this.button.innerHTML = this.getIconMarkup(state);
    }

    private getIconMarkup(state: string): string {
        if (state === 'success') return SUCCESS_ICON;
        if (state === 'error') return ERROR_ICON;
        if (state === 'capturing') return DOWNLOAD_ICON;
        return MENU_ICON;
    }

    private clearResetTimer(): void {
        if (this.resetTimer !== null) {
            window.clearTimeout(this.resetTimer);
            this.resetTimer = null;
        }
    }
}
