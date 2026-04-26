export type DownloadState = 'idle' | 'downloading' | 'success' | 'error';

export interface DownloadButtonUIOptions {
    onClick: () => void;
}

const STYLE_ID = 'dd-epub-dl-style';
export const BUTTON_ID = 'dd-epub-dl-btn';
const READ_TEXT_TOKENS = ['开始阅读', '继续阅读', '立即阅读', '去阅读', '试读'];
const VIP_TEXT_TOKENS = ['vip', '会员'];

const CSS = `
    #${BUTTON_ID} {
        --dd-progress: 0%;
        --dd-btn-height: 38px;
        --dd-btn-padding: 0 18px;
        --dd-btn-margin-left: 10px;
        --dd-btn-radius: 999px;
        --dd-btn-border: 1px solid #f87c36;
        --dd-btn-bg: #f87c36;
        --dd-btn-color: #fff;
        --dd-btn-font-size: 14px;
        --dd-btn-font-weight: 600;
        --dd-btn-line-height: 1;
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 120px;
        height: var(--dd-btn-height);
        padding: var(--dd-btn-padding);
        margin-left: var(--dd-btn-margin-left);
        border: var(--dd-btn-border);
        border-radius: var(--dd-btn-radius);
        background: var(--dd-btn-bg);
        color: var(--dd-btn-color);
        font-size: var(--dd-btn-font-size);
        font-weight: var(--dd-btn-font-weight);
        line-height: var(--dd-btn-line-height);
        cursor: pointer;
        transition: background 0.3s, color 0.2s, border-color 0.2s, transform 0.15s ease;
        white-space: nowrap;
        vertical-align: middle;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
    }
    #${BUTTON_ID}:hover:not(:disabled) {
        transform: translateY(-1px);
    }
    #${BUTTON_ID}:disabled {
        cursor: progress;
        opacity: 0.9;
    }
    #${BUTTON_ID}[data-state="downloading"] {
        background: var(--dd-btn-bg);
    }
    #${BUTTON_ID}[data-state="downloading"]::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        width: var(--dd-progress);
        background: rgba(255,255,255,0.25);
        z-index: 1;
        transition: width 0.2s ease;
    }
    #${BUTTON_ID} .dd-btn-text {
        position: relative;
        z-index: 2;
    }
    #${BUTTON_ID}[data-state="success"] {
        --dd-progress: 100%;
        border-color: #52c41a;
        color: #fff;
        background: #52c41a;
    }
    #${BUTTON_ID}[data-state="error"] {
        border-color: #ff4d4f;
        color: #ff4d4f;
        background: #fff;
    }
    @keyframes dd-dots {
        0%, 20% { content: "."; }
        40%, 60% { content: ".."; }
        80%, 100% { content: "..."; }
    }
    #${BUTTON_ID}[data-state="downloading"] .dd-dots::after {
        content: ".";
        animation: dd-dots 1.5s infinite steps(1);
        display: inline-block;
        width: 1em;
        text-align: left;
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

    /**
     * 将按钮插入到操作区（readButton 所在行）的最右侧。
     * @param readButton  "开始阅读"等阅读按钮
     * @param actionContainer  locateReadButton 返回的语义容器（可选，传入可减少误判）
     */
    mountNextTo(readButton: HTMLElement, actionContainer?: HTMLElement): void {
        this.syncStyleWithReadButton(readButton);

        if (this.btn.isConnected) {
            this.btn.remove();
        }

        this.btn.style.display = 'inline-flex';
        this.btn.style.verticalAlign = 'middle';
        this.btn.style.flexShrink = '0';

        // 优先用传入的 actionContainer，否则向上回溯寻找最佳操作区容器
        const container = actionContainer ?? this.findBestActionContainer(readButton);

        // 在容器内找与 readButton 同行、最靠右的元素，插在它后面
        const anchor = container ? this.findRightmostInRow(container, readButton) : null;
        (anchor ?? readButton).insertAdjacentElement('afterend', this.btn);
    }

    /**
     * 从 readButton 向上回溯，找最像"操作区"的祖先容器。
     * 判断依据：语义 class（action/operate/btn-group 等）+ flex-row 布局 + 紧凑高度。
     */
    private findBestActionContainer(readButton: HTMLElement): HTMLElement | null {
        let best: HTMLElement | null = null;
        let current: HTMLElement | null = readButton.parentElement;

        while (current && current !== document.body && current !== document.documentElement) {
            const style = window.getComputedStyle(current);
            const display = style.display;
            const isFlexRow =
                (display === 'flex' || display === 'inline-flex') &&
                (style.flexDirection === 'row' || style.flexDirection === 'row-reverse');
            const hasSemanticClass = /(action|operate|button.?group|btn.?group|tool|footer)/i.test(
                String(current.className ?? ''),
            );
            const rect = current.getBoundingClientRect();
            const isThin = rect.height > 0 && rect.height <= 200;

            if (isFlexRow || hasSemanticClass) {
                // 优先返回第一个语义命中的，否则取最小的 flex-row 容器
                if (hasSemanticClass && isThin) return current;
                if (isFlexRow && isThin && !best) best = current;
            }

            current = current.parentElement;
        }

        return best;
    }

    /**
     * 在 container 内找到与 readButton 同行且最靠右的元素。
     * 优先从叶级 action 元素（a/button/[role=button]）中找，以避免误选宽容器。
     */
    private findRightmostInRow(container: HTMLElement, readButton: HTMLElement): HTMLElement | null {
        const readRect = readButton.getBoundingClientRect();
        const isSameRowEl = (el: HTMLElement) =>
            el !== this.btn && el !== readButton && this.isElVisible(el) && this.isSameRow(readRect, el.getBoundingClientRect());

        // 优先：叶级 action 元素（不包含其他 action 的 a/button/[role=button]）
        const actionEls = Array.from(container.querySelectorAll<HTMLElement>('a,button,[role="button"]')).filter(
            (el) => !el.querySelector('a,button,[role="button"]') && isSameRowEl(el),
        );
        if (actionEls.length > 0) return this.pickRightmost(actionEls);

        // 兜底：容器直接子级（避免把大容器当锚点）
        const directChildren = Array.from(container.children)
            .filter((n): n is HTMLElement => n instanceof HTMLElement && isSameRowEl(n));
        if (directChildren.length > 0) return this.pickRightmost(directChildren);

        return null;
    }

    private pickRightmost(els: HTMLElement[]): HTMLElement {
        return els.reduce((best, el) => {
            const br = best.getBoundingClientRect();
            const er = el.getBoundingClientRect();
            return er.right > br.right ? el : best;
        });
    }

    private isSameRow(a: DOMRect, b: DOMRect): boolean {
        // 垂直重叠足够大，或中心线足够接近
        const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlap >= Math.max(4, Math.min(a.height, b.height) * 0.3)) return true;
        const centerDist = Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2);
        return centerDist <= Math.max(8, Math.min(a.height, b.height) * 0.5);
    }

    private isElVisible(el: HTMLElement): boolean {
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    setProgress(percentage: number, message: string): void {
        if (this.state !== 'downloading') {
            this.state = 'downloading';
            this.btn.dataset.state = 'downloading';
            this.btn.disabled = true;
        }
        const pct = Math.max(0, Math.min(100, Math.round(percentage)));
        this.btn.style.setProperty('--dd-progress', `${pct}%`);
        this.btn.innerHTML = `<span class="dd-btn-text">下载中<span class="dd-dots"></span></span>`;
        this.btn.title = message;
    }

    setSuccess(): void {
        this.clearSuccessTimer();
        this.state = 'success';
        this.btn.dataset.state = 'success';
        this.btn.disabled = false;
        this.btn.innerHTML = `<span class="dd-btn-text">✓ 下载完成</span>`;
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
        this.btn.innerHTML = `<span class="dd-btn-text">✗ 下载失败，点击重试</span>`;
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
        this.btn.innerHTML = `<span class="dd-btn-text">下载</span>`;
        this.btn.title = '将本书下载为 EPUB 文件';
    }

    /**
     * 读取“开始阅读”按钮的计算样式，尽量保证视觉一致。
     */
    private syncStyleWithReadButton(readButton: HTMLElement): void {
        const visualSource = this.resolveVisualStyleSource(readButton);
        const visualStyle = window.getComputedStyle(visualSource);
        const anchorStyle = window.getComputedStyle(readButton);

        const visualRect = visualSource.getBoundingClientRect();
        const anchorRect = readButton.getBoundingClientRect();
        const resolvedHeight =
            this.safeLength(visualStyle.height) ||
            (visualRect.height > 0 ? `${Math.round(visualRect.height)}px` : '') ||
            (anchorRect.height > 0 ? `${Math.round(anchorRect.height)}px` : '');
        if (resolvedHeight) this.btn.style.setProperty('--dd-btn-height', resolvedHeight);

        if (visualStyle.padding && this.toNumber(visualStyle.paddingLeft) > 0) {
            this.btn.style.setProperty('--dd-btn-padding', visualStyle.padding);
        } else if (anchorStyle.padding && this.toNumber(anchorStyle.paddingLeft) > 0) {
            this.btn.style.setProperty('--dd-btn-padding', anchorStyle.padding);
        }

        if (visualStyle.fontSize) this.btn.style.setProperty('--dd-btn-font-size', visualStyle.fontSize);
        if (visualStyle.fontWeight) this.btn.style.setProperty('--dd-btn-font-weight', visualStyle.fontWeight);
        if (visualStyle.lineHeight && visualStyle.lineHeight !== 'normal') {
            this.btn.style.setProperty('--dd-btn-line-height', visualStyle.lineHeight);
        }

        const radius = this.resolveRadius(visualStyle);
        if (radius && radius !== '0px 0px 0px 0px') {
            this.btn.style.setProperty('--dd-btn-radius', radius);
        } else {
            // 如果都没有提取到有效圆角，给个默认的胶囊圆角，好过方块
            this.btn.style.setProperty('--dd-btn-radius', '999px');
        }

        // 与阅读按钮保持一致的间距（优先读其 marginRight，兜底 12px）
        const marginLeft = this.safeLength(anchorStyle.marginRight) || this.safeLength(anchorStyle.marginLeft) || '12px';
        this.btn.style.setProperty('--dd-btn-margin-left', marginLeft);

        // 同步颜色：让下载按钮与阅读按钮视觉风格一致
        const bg = this.isTransparent(visualStyle.backgroundColor) ? anchorStyle.backgroundColor : visualStyle.backgroundColor;
        if (!this.isTransparent(bg)) this.btn.style.setProperty('--dd-btn-bg', bg);

        const color = visualStyle.color || anchorStyle.color;
        if (color && !this.isTransparent(color) && color !== 'rgb(0, 0, 0)') {
            this.btn.style.setProperty('--dd-btn-color', color);
        }

        if (visualStyle.boxShadow && visualStyle.boxShadow !== 'none') {
            this.btn.style.boxShadow = visualStyle.boxShadow;
        } else {
            this.btn.style.removeProperty('box-shadow');
        }
    }

    /**
     * 当阅读入口是“开始阅读 + VIP”的组合按钮时，优先选择左侧阅读段作为视觉样式来源。
     */
    private resolveVisualStyleSource(readButton: HTMLElement): HTMLElement {
        const descendants = Array.from(readButton.querySelectorAll<HTMLElement>('*'));
        const readParts = descendants.filter((el) => this.isStyleCandidate(el) && this.hasReadText(el) && !this.hasVipText(el));

        const paintedReadPart = readParts.find((el) => {
            const style = window.getComputedStyle(el);
            const hasVisibleBg = !this.isTransparent(style.backgroundColor);
            const hasVisibleBorder = style.borderTopStyle !== 'none' && this.toNumber(style.borderTopWidth) > 0;
            const hasUsefulPadding = this.toNumber(style.paddingLeft) > 0 || this.toNumber(style.paddingRight) > 0;
            return hasVisibleBg || hasVisibleBorder || hasUsefulPadding;
        });

        if (paintedReadPart) return paintedReadPart;
        if (readParts.length > 0) return readParts[0];
        return readButton;
    }

    private hasReadText(el: HTMLElement): boolean {
        const normalized = this.normalizeText(el.textContent);
        return READ_TEXT_TOKENS.some((token) => normalized.includes(this.normalizeText(token)));
    }

    private hasVipText(el: HTMLElement): boolean {
        const normalized = this.normalizeText(el.textContent);
        return VIP_TEXT_TOKENS.some((token) => normalized.includes(token));
    }

    private normalizeText(text: string | null | undefined): string {
        return (text ?? '').replace(/\s+/g, '').trim().toLowerCase();
    }

    private isStyleCandidate(el: HTMLElement): boolean {
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    }

    private resolveRadius(style: CSSStyleDeclaration): string {
        const topLeft = style.borderTopLeftRadius;
        const topRight = style.borderTopRightRadius;
        const bottomRight = style.borderBottomRightRadius;
        const bottomLeft = style.borderBottomLeftRadius;

        const rightFlat = this.toNumber(topRight) === 0 && this.toNumber(bottomRight) === 0;
        if (rightFlat && (this.toNumber(topLeft) > 0 || this.toNumber(bottomLeft) > 0)) {
            const r = this.toNumber(topLeft) > 0 ? topLeft : bottomLeft;
            return `${r} ${r} ${r} ${r}`;
        }
        return `${topLeft} ${topRight} ${bottomRight} ${bottomLeft}`;
    }

    private safeLength(value: string): string {
        if (!value || value === 'auto') return '';
        return this.toNumber(value) > 0 ? value : '';
    }

    private isTransparent(color: string): boolean {
        const normalized = color.replace(/\s+/g, '').toLowerCase();
        return normalized === 'transparent' || normalized === 'rgba(0,0,0,0)' || normalized === 'rgba(0,0,0,0.0)';
    }

    private toNumber(value: string): number {
        const n = Number.parseFloat(value);
        return Number.isFinite(n) ? n : 0;
    }

    private clearSuccessTimer(): void {
        if (this.successTimer !== null) {
            window.clearTimeout(this.successTimer);
            this.successTimer = null;
        }
    }
}
