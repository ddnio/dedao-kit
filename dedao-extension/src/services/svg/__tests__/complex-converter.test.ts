/**
 * @jest-environment node
 */
import { ComplexSvgConverter } from '../complex-converter';

describe('ComplexSvgConverter', () => {
    let converter: ComplexSvgConverter;

    beforeEach(() => {
        converter = new ComplexSvgConverter();
    });

    describe('footnote placement (T009)', () => {
        it('should place <aside> inside div.part when a heading precedes the footnote', () => {
            converter.setTocLevel(new Map<string, number>([['逍遥游', 0]]));
            // heading text appears at y=10, footnote image at y=50 (after heading)
            const svg = `<svg xmlns="http://www.w3.org/2000/svg">
                <text x="10" y="10">逍遥游</text>
                <image href="https://example.com/fn.png" x="5" y="50" width="15" height="15" class="epub-footnote" alt="冥：冥暗苍茫"/>
            </svg>`;
            const { html } = converter.convert(svg, 'Chapter_1_1');
            // Verify the structural ordering: div.part must open before <aside>
            const partOpenIndex = html.indexOf('<div class="part">');
            const asideIndex = html.indexOf('<aside');
            expect(partOpenIndex).toBeGreaterThan(-1);
            expect(asideIndex).toBeGreaterThan(-1);
            // <aside> must appear after the opening of div.part
            expect(asideIndex).toBeGreaterThan(partOpenIndex);
            // And <aside> must appear before the closing </div> that ends the part
            const partCloseIndex = html.indexOf('</div>', partOpenIndex);
            expect(asideIndex).toBeLessThan(partCloseIndex);
        });

        it('should still emit <aside> when no heading exists (no div.part opened)', () => {
            // Page without any TOC heading — footnotes should still be present (not silently dropped)
            const svg = `<svg xmlns="http://www.w3.org/2000/svg">
                <text x="10" y="10">正文段落</text>
                <image href="https://example.com/fn.png" x="5" y="10" width="15" height="15" class="epub-footnote" alt="注释内容"/>
            </svg>`;
            const { html } = converter.convert(svg, 'Chapter_1_2');
            expect(html).toContain('<aside');
            expect(html).toContain('注释内容');
        });

        it('should include footnote content in <aside> li element', () => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg">
                <text x="10" y="10">标题</text>
                <image href="https://example.com/fn.png" x="5" y="10" width="10" height="10" class="epub-footnote" alt="这是脚注"/>
            </svg>`;
            const { html } = converter.convert(svg, 'Chapter_1_3');
            expect(html).toContain('class="duokan-footnote-content"');
            expect(html).toContain('class="duokan-footnote-item"');
            expect(html).toContain('这是脚注');
        });
    });

    describe('basic text conversion', () => {
        it('should extract plain text into paragraph elements', () => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg">
                <text x="10" y="20">Hello World</text>
                <text x="10" y="40">Paragraph Two</text>
            </svg>`;
            const { html } = converter.convert(svg, 'Chapter_1_1');
            expect(html).toContain('Hello World');
            expect(html).toContain('Paragraph Two');
        });

        it('should wrap output in a div with the given chapterId', () => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text x="0" y="0">text</text></svg>`;
            const { html } = converter.convert(svg, 'Chapter_2_1');
            expect(html).toContain('id="Chapter_2_1"');
        });
    });

    describe('empty and edge cases', () => {
        it('should not throw on an empty SVG', () => {
            expect(() => converter.convert('<svg></svg>', 'Chapter_empty')).not.toThrow();
        });

        it('should return empty images array when no image elements are present', () => {
            const { images } = converter.convert('<svg></svg>', 'Chapter_empty');
            expect(images).toHaveLength(0);
        });
    });

    describe('setChapterIndex', () => {
        it('should use chapter index in footnote IDs', () => {
            converter.setChapterIndex(5);
            const svg = `<svg xmlns="http://www.w3.org/2000/svg">
                <image href="https://example.com/fn.png" x="5" y="10" width="10" height="10" class="epub-footnote" alt="注"/>
            </svg>`;
            const { html } = converter.convert(svg, 'Chapter_5_1');
            expect(html).toContain('footnote-5-');
        });

        it('should reset per-page state when setChapterIndex is called', () => {
            // First chapter produces some state
            converter.setChapterIndex(2);
            converter.convert('<svg><text x="0" y="0">text</text></svg>', 'ch2');
            // Switching chapter should reset cross-page layout tracking
            converter.setChapterIndex(3);
            const { html } = converter.convert('<svg><text x="0" y="0">new</text></svg>', 'ch3');
            expect(html).toContain('id="ch3"');
        });
    });

    describe('large image handling', () => {
        it('should add large images (width >= 20) directly to result, not as footnotes', () => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg">
                <image href="https://example.com/big.png" x="0" y="0" width="100" height="100" alt="big image"/>
            </svg>`;
            const { html, images } = converter.convert(svg, 'Chapter_1_1');
            // Large image: present in html but NOT wrapped in <aside>
            expect(html).not.toContain('<aside');
            expect(images).toContain('https://example.com/big.png');
        });
    });
});
