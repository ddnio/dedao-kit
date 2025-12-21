import JSZip from 'jszip';
import { EpubPackage } from '../../types/epub.ts';
import { ManifestGenerator } from './manifest.ts';
import { NavGenerator } from './nav.ts';
import { logger } from '../../utils/logger.ts';

export class EpubGenerator {
    async generate(pkg: EpubPackage): Promise<Blob> {
        const zip = new JSZip();

        // 1. mimetype (must be first, stored uncompressed)
        zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

        // 2. META-INF/container.xml (fix: use EPUB/package.opf instead of OEBPS/content.opf)
        zip.folder('META-INF')!.file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`);

        // 3. EPUB folder (changed from OEBPS to EPUB to match Go project structure)
        const epub = zip.folder('EPUB')!;

        // 4. Resources (Images, XHTML chapters, CSS)
        // Organize resources into proper subdirectories
        for (const res of pkg.resources) {
            let content = res.content;
            if (content instanceof Blob) {
                content = await content.arrayBuffer();
            }

            // Categorize resources into subdirectories
            if (res.mediaType === 'application/xhtml+xml') {
                if (res.href === 'nav.xhtml') {
                    // These go to EPUB root
                    epub.file(res.href, content);
                } else {
                    const xhtmlFolder = epub.folder('xhtml')!;
                    const filename = res.href.startsWith('xhtml/') ? res.href.replace(/^xhtml\//, '') : res.href;
                    xhtmlFolder.file(filename, content);
                }
            } else if (res.href.startsWith('images/')) {
                // Images go to EPUB/images/
                epub.file(res.href, content);
            } else if (res.href === 'style.css' || res.href === 'css/cover.css' || res.href.endsWith('/cover.css')) {
                if (res.href !== 'css/cover.css') {
                    logger.warn(`CSS resource path mismatch: expected css/cover.css but got ${res.href}`);
                }
                const cssFolder = epub.folder('css')!;
                cssFolder.file('cover.css', content);
            } else {
                // cover.xhtml, Copyright.xhtml, style.css, nav.xhtml go to EPUB root
                epub.file(res.href, content);
            }
        }

        // 5. Navigation Documents
        const navGen = new NavGenerator();
        const navHtml = navGen.generateNav(pkg.toc, pkg.metadata.title);
        const ncx = navGen.generateNcx(pkg.toc, pkg.metadata.identifier, pkg.metadata.title);

        epub.file('nav.xhtml', navHtml);
        epub.file('toc.ncx', ncx);

        // 6. Content OPF (changed from content.opf to package.opf to match Go project)
        const manifestGen = new ManifestGenerator();
        epub.file('package.opf', manifestGen.generate(pkg));

        // Generate Blob with DEFLATE compression to match Go version size
        return await zip.generateAsync({ 
            type: 'blob', 
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });
    }
}
