import { EpubGenerator } from '../generator.ts';
import { EpubPackage } from '../../../types/epub.ts';
import JSZip from 'jszip';

describe('EpubGenerator', () => {
    it('should generate valid zip structure', async () => {
        const pkg: EpubPackage = {
            metadata: { 
                title: 'Test Book', 
                creator: 'Test Author', 
                language: 'zh', 
                identifier: 'urn:uuid:12345' 
            },
            manifest: [
                { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' },
                { id: 'ncx', href: 'toc.ncx', mediaType: 'application/x-dtbncx+xml' },
                { id: 'ch1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' }
            ],
            spine: [
                { idref: 'nav' },
                { idref: 'ch1' }
            ],
            resources: [
                { id: 'ch1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml', content: '<html></html>' }
            ],
            toc: [
                { id: 'nav-1', playOrder: 1, label: 'Chapter 1', contentSrc: 'chapter1.xhtml' }
            ]
        };

        const generator = new EpubGenerator();
        const blob = await generator.generate(pkg);
        
        expect(blob).toBeInstanceOf(Blob);
        
        // Verify ZIP content
        const buf = await blob.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);
        
        // Check mimetype (must be first)
        const mimetype = await zip.file('mimetype')?.async('string');
        expect(mimetype).toBe('application/epub+zip');
        
        // Check structure
        expect(zip.file('META-INF/container.xml')).not.toBeNull();
        expect(zip.file('EPUB/package.opf')).not.toBeNull();
        expect(zip.file('EPUB/nav.xhtml')).not.toBeNull();
        expect(zip.file('EPUB/toc.ncx')).not.toBeNull();
        // The generator places normal chapters in EPUB/xhtml/
        expect(zip.file('EPUB/xhtml/chapter1.xhtml')).not.toBeNull();
    });
});
