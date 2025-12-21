import { EpubPackage } from '../../types/epub.ts';
import { escapeXml } from './utils.ts';

export class ManifestGenerator {
    generate(pkg: EpubPackage): string {
        // Find NCX ID for spine toc attribute
        const ncxItem = pkg.manifest.find(item => item.mediaType === 'application/x-dtbncx+xml');
        const ncxId = ncxItem ? ncxItem.id : 'ncx';

        return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${escapeXml(pkg.metadata.identifier)}</dc:identifier>
    <dc:title>${escapeXml(pkg.metadata.title)}</dc:title>
    <dc:language>en</dc:language>
    ${pkg.metadata.description ? `<dc:description>${escapeXml(pkg.metadata.description)}</dc:description>` : ''}
    <dc:creator id="creator">${escapeXml(pkg.metadata.creator)}</dc:creator>
    <meta refines="#creator" property="role" scheme="marc:relators" id="role">aut</meta>
    ${pkg.metadata.coverId ? `<meta name="cover" content="${pkg.metadata.coverId}"></meta>` : ''}
  </metadata>
  <manifest>
    ${pkg.manifest.map(item => {
        // Normalize href: chapter XHTML files should have xhtml/ prefix
        let href = item.href;
        if (item.mediaType === 'application/xhtml+xml' &&
            !href.startsWith('xhtml/') &&
            href !== 'nav.xhtml') {
            href = 'xhtml/' + href;
        }
        const properties = item.properties ? ` properties="${escapeXml(item.properties)}"` : '';
        return `<item id="${escapeXml(item.id)}" href="${escapeXml(href)}" media-type="${item.mediaType}"${properties}></item>`;
    }).join('\n    ')}
  </manifest>
  <spine toc="${ncxId}">
    ${pkg.spine.map(item =>
        `<itemref idref="${escapeXml(item.idref)}"${item.linear === 'no' ? ' linear="no"' : ''}></itemref>`
    ).join('\n    ')}
  </spine>
</package>`;
    }
}
