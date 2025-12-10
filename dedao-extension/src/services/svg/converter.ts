export interface ConvertedPage {
    html: string;
    images: string[];
}

export class SvgConverter {
    convert(svgString: string): ConvertedPage {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        
        let html = '<div class="page-content">';
        const images: string[] = [];
        
        // Process elements in order of appearance in DOM (usually correct Z-order/reading order)
        // xmldom doesn't support querySelectorAll, so we use getElementsByTagName('*') and filter
        
        const allElements = doc.getElementsByTagName('*');
        
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            
            if (el.tagName === 'image') {
                const href = el.getAttribute('xlink:href') || el.getAttribute('href');
                if (href) {
                    images.push(href);
                    html += `<div class="image-wrapper"><img src="${href}" alt="" /></div>\n`;
                }
            } else if (el.tagName === 'text') {
                const content = el.textContent?.trim();
                if (content) {
                    html += `<p>${content}</p>\n`;
                }
            }
        }

        html += '</div>';
        return { html, images };
    }
}
