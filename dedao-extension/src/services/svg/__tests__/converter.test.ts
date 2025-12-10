/**
 * @jest-environment jsdom
 */
import { SvgConverter } from '../converter.ts';

describe('SvgConverter', () => {
    let converter: SvgConverter;

    beforeEach(() => {
        converter = new SvgConverter();
    });

    it('should extract text and images', () => {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <text x="10" y="20">Hello World</text>
                <image xlink:href="http://example.com/image.jpg" x="0" y="0" width="100" height="100"/>
                <text>Paragraph 2</text>
            </svg>
        `;

        const result = converter.convert(svg);
        
        expect(result.html).toContain('<p>Hello World</p>');
        expect(result.html).toContain('<p>Paragraph 2</p>');
        expect(result.html).toContain('<img src="http://example.com/image.jpg"');
        expect(result.images).toContain('http://example.com/image.jpg');
    });

    it('should handle empty content', () => {
        const result = converter.convert('<svg></svg>');
        expect(result.html).toContain('class="page-content"');
        expect(result.images).toHaveLength(0);
    });
});
