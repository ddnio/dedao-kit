export async function copyTextToClipboard(text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch {
            // 退到 execCommand
        }
    }

    if (typeof document === 'undefined') {
        throw new Error('clipboard unavailable');
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch {
        ok = false;
    } finally {
        textarea.remove();
    }
    if (!ok) {
        throw new Error('clipboard copy failed');
    }
}
