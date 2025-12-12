export function escapeXml(unsafe: string): string {
    if (unsafe === undefined || unsafe === null) return '';
    const str = String(unsafe);
    return str.replace(/[<>&'\\"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

export function sanitizeId(id: string): string {
    if (!id) return 'unknown_id';
    // ID must begin with a letter
    // Allowed: A-Z, a-z, 0-9, -, _, .
    let sanitized = id.replace(/[^a-zA-Z0-9\-_.]/g, '_');
    if (!/^[a-zA-Z]/.test(sanitized)) {
        sanitized = 'id_' + sanitized;
    }
    return sanitized;
}

export function calculateProgress(current: number, total: number): number {
    if (total === 0) return 0;
    return Math.min(100, Math.round((current / total) * 100));
}

/**
 * Returns the standardized relative path that chapters should use to include the shared stylesheet.
 */
export function cssRelativePath(): string {
    return '../css/cover.css';
}

export function cssResourcePath(): string {
    return 'css/cover.css';
}

/**
 * Returns the directory where chapter XHTML files are stored.
 */
export function chapterDirectory(): string {
    return 'EPUB/xhtml';
}

/**
 * Formats image resources using the `image_XXX.ext` naming convention.
 */
export function formatImageResourceFileName(index: number, extension: string): string {
    const sanitizedExt = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'png';
    const normalizedExt = sanitizedExt === 'jpeg' ? 'jpg' : sanitizedExt;
    const padded = `${index}`.padStart(3, '0');
    return `image_${padded}.${normalizedExt}`;
}
