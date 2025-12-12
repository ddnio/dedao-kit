import { NavPoint } from '../../types/epub.ts';
import { escapeXml } from './utils.ts';

export class NavGenerator {
    generateNav(toc: NavPoint[]): string {
        return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <title>Table of Contents</title>
</head>
<body>
    <nav epub:type="toc" id="toc">
        <h1>Table of Contents</h1>
        <ol>
            ${this.renderNavItems(toc)}
        </ol>
    </nav>
</body>
</html>`;
    }

    private renderNavItems(items: NavPoint[]): string {
        return items.map(item => {
            const normalizedHref = this.normalizeHref(item.contentSrc);
            return `
            <li>
                <a href="${normalizedHref}">${escapeXml(item.label)}</a>
                ${item.children && item.children.length > 0 ? `<ol>${this.renderNavItems(item.children)}</ol>` : ''}
            </li>
        `;
        }).join('');
    }

    /**
     * Normalize href to correct relative path for EPUB structure:
     * - Remove editor-generated markers (_sigil_toc_id_, _magic_)
     * - 保留来源扩展名（不强制追加 .xhtml，以匹配 Go 产物）
     * - 为章节类文件追加 xhtml/ 前缀（nav.xhtml 仍在根目录）
     * - Return path relative to nav.xhtml (which is at EPUB/ root)
     */
    private normalizeHref(href: string): string {
        if (!href) return '#';

        // Step 1: Remove editor-generated temporary markers
        let normalized = href
            .replace(/_sigil_toc_id_\d+/g, '')
            .replace(/_magic_[^/]*/g, '');

        // Step 2: Add xhtml/ prefix for chapter files (nav stays at root)
        if (!normalized.startsWith('xhtml/') &&
            normalized !== 'nav.xhtml') {
            normalized = 'xhtml/' + normalized;
        }

        return normalized;
    }

    generateNcx(toc: NavPoint[], identifier: string, title: string): string {
        let playOrder = 1;
        const navMapContent = this.renderNcxPoints(toc, playOrder);

        return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="${escapeXml(identifier)}"/>
        <meta name="dtb:depth" content="3"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle>
        <text>${escapeXml(title)}</text>
    </docTitle>
    <navMap>
        ${navMapContent.points}
    </navMap>
</ncx>`;
    }

    /**
     * Render NCX points with proper playOrder numbering
     * Returns { points: string, nextPlayOrder: number } to track play order across hierarchy
     */
    private renderNcxPoints(items: NavPoint[], startPlayOrder: number): { points: string, nextPlayOrder: number } {
        let playOrder = startPlayOrder;
        let html = '';

        for (const item of items) {
            const normalizedHref = this.normalizeHref(item.contentSrc);

            html += `
        <navPoint id="${escapeXml(item.id)}" playOrder="${playOrder}">
            <navLabel>
                <text>${escapeXml(item.label)}</text>
            </navLabel>
            <content src="${normalizedHref}"/>
`;

            if (item.children && item.children.length > 0) {
                const childResult = this.renderNcxPoints(item.children, playOrder + 1);
                html += childResult.points;
                playOrder = childResult.nextPlayOrder;
            }

            html += `        </navPoint>\n`;
            playOrder++;
        }

        return { points: html, nextPlayOrder: playOrder };
    }
}
