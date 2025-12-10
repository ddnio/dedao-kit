export function escapeXml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'\\"]/g, (c) => {
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

