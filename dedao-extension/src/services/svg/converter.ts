export interface ConvertedPage {
    html: string;
    images: string[];
}

export interface SvgConverterOptions {
    chapterId?: string;
    title?: string;
    headerLevel?: number;
}

export class SvgConverter {
    convert(svgString: string, options: SvgConverterOptions = {}): ConvertedPage {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        
        const chapterId = options.chapterId || 'Chapter_unknown';
        const headerLevel = options.headerLevel !== undefined ? options.headerLevel : 0;
        const headerClass = `header${headerLevel}`;
        const title = options.title || '章节';

        let htmlBody = '<div class="page-content">';
        const images: string[] = [];
        
        const allElements = doc.getElementsByTagName('*');

        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            if (el.tagName === 'image') {
                const href = el.getAttribute('xlink:href') || el.getAttribute('href');
                if (href) {
                    images.push(href);
                    htmlBody += `<div class="image-wrapper"><img src="${href}" alt="" /></div>\n`;
                }
            } else if (el.tagName === 'text') {
                const content = el.textContent?.trim();
                if (content) {
                    htmlBody += `<p>${content}</p>\n`;
                }
            }
        }

        htmlBody += '</div>';
        const html = `<div id="${chapterId}"></div><div class="${headerClass}"><h1>${title}</h1></div><div class="part">${htmlBody}</div>`;
        return { html, images };
    }
}
