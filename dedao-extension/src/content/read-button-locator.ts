export interface ReadButtonLocation {
    readButton: HTMLElement;
    container: HTMLElement;
}

const READ_TEXT_TOKENS = ['开始阅读', '继续阅读', '立即阅读', '去阅读', '试读'];

function matchesReadText(text: string | null | undefined): boolean {
    if (!text) return false;
    const normalized = text.replace(/\s+/g, '').trim();
    return READ_TEXT_TOKENS.some((token) => normalized.includes(token));
}

function isVisible(el: HTMLElement): boolean {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function resolveContainer(button: HTMLElement): HTMLElement {
    // 优先找有语义的容器 class，否则退化到 parentElement
    const semantic = button.closest<HTMLElement>(
        '[class*="action"],[class*="operate"],[class*="button-group"],[class*="btn-group"],[class*="footer"],[class*="tool"]'
    );
    if (semantic && semantic !== document.body && semantic !== document.documentElement) {
        return semantic;
    }
    return button.parentElement ?? button;
}

/**
 * 策略1：找 href 包含 /ebook/reader 的可见链接，且文案含"阅读"关键词。
 */
function findByReaderLink(doc: Document): ReadButtonLocation | null {
    const links = doc.querySelectorAll<HTMLAnchorElement>('a[href*="/ebook/reader"],a[href*="/reader"]');
    for (const link of links) {
        if (!isVisible(link)) continue;
        if (!matchesReadText(link.textContent) && !matchesReadText(link.getAttribute('aria-label'))) continue;
        return { readButton: link, container: resolveContainer(link) };
    }
    return null;
}

/**
 * 策略2：按文案匹配，在所有可点击元素中找"开始阅读"等。
 */
function findByTextMatch(doc: Document): ReadButtonLocation | null {
    const clickables = doc.querySelectorAll<HTMLElement>(
        'a,button,[role="button"],[class*="btn"],[class*="button"]'
    );
    for (const el of clickables) {
        if (!isVisible(el)) continue;
        if (matchesReadText(el.textContent) || matchesReadText(el.getAttribute('aria-label'))) {
            return { readButton: el, container: resolveContainer(el) };
        }
    }
    return null;
}

/**
 * 定位"开始阅读"按钮及其容器。返回 null 表示页面尚未渲染完毕，调用方应等 DOM 变化后重试。
 */
export function locateReadButton(doc: Document = document): ReadButtonLocation | null {
    return findByReaderLink(doc) ?? findByTextMatch(doc);
}
