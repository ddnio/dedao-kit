import { EpubPackage } from '../../types/epub.ts';
import { escapeXml } from './utils.ts';

export class ManifestGenerator {
    generate(pkg: EpubPackage): string {
        // Find NCX ID for spine toc attribute
        const ncxItem = pkg.manifest.find(item => item.mediaType === 'application/x-dtbncx+xml');
        const ncxId = ncxItem ? ncxItem.id : 'ncx';

        return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeXml(pkg.metadata.identifier)}</dc:identifier>
    <dc:title>${escapeXml(pkg.metadata.title)}</dc:title>
    <dc:language>${escapeXml(pkg.metadata.language)}</dc:language>
    <dc:creator>${escapeXml(pkg.metadata.creator)}</dc:creator>
    ${pkg.metadata.description ? `<dc:description>${escapeXml(pkg.metadata.description)}</dc:description>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
    ${pkg.metadata.coverId ? `<meta name="cover" content="${pkg.metadata.coverId}" />` : ''}
  </metadata>
  <manifest>
    ${pkg.manifest.map(item => {
        // Normalize href: chapter XHTML files should have xhtml/ prefix
        let href = item.href;
        if (item.mediaType === 'application/xhtml+xml' &&
            !href.startsWith('xhtml/') &&
            href !== 'cover.xhtml' &&
            href !== 'Copyright.xhtml' &&
            href !== 'nav.xhtml') {
            href = 'xhtml/' + href;
        }
        const properties = item.properties ? ` properties="${escapeXml(item.properties)}"` : '';
        return `<item id="${escapeXml(item.id)}" href="${escapeXml(href)}" media-type="${item.mediaType}"${properties}/>`;
    }).join('\n    ')}
  </manifest>
  <spine toc="${ncxId}">
    ${pkg.spine.map(item =>
        `<itemref idref="${escapeXml(item.idref)}"${item.linear === 'no' ? ' linear="no"' : ''}/>`
    ).join('\n    ')}
  </spine>
</package>`;
    }
}
