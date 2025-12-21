import { ebookApi } from '../api/ebook.ts';
import { AESCrypto } from '../crypto/aes.ts';
import { ComplexSvgConverter } from '../svg/complex-converter.ts';
import { EpubGenerator } from '../epub/generator.ts';
import { DownloadTask, TaskStatus, ProgressInfo, TaskError } from '../../types/download.ts';
import { EpubPackage, ManifestItem, SpineItem, EpubResource, NavPoint } from '../../types/epub.ts';
import { EbookMetadata, Chapter } from '../../types/ebook.ts';
import { sanitizeId, escapeXml, calculateProgress, cssRelativePath, cssResourcePath, formatImageResourceFileName } from '../epub/utils.ts';
import { logger } from '../../utils/logger.ts';
import fs from 'fs';
import path from 'path';

export class DownloadManager {
    private converter: ComplexSvgConverter;
    private generator = new EpubGenerator();
    private imageCounter = 0; 
    private tocIdCounter = 0; 
    private urlToIdMap = new Map<string, { id: string, href: string }>(); 
    private footnoteIconUrl: string | undefined; 
    private footnoteIconId: string | undefined; 
    private chapterIdMap = new Map<string, string>(); 
    private catalogMap = new Map<string, string>(); 
    private autoChapterCounter = 1; 
    private tocLevel = new Map<string, number>(); 

    public pkgTitle: string = ''; // Store title for filename generation

    constructor() {
        this.converter = new ComplexSvgConverter();
    }

    async startDownload(
        bookId: string,
        enid: string,
        onProgress?: (info: ProgressInfo) => void
    ): Promise<Blob> {
        // Reset state for new download
        this.imageCounter = 1; 
        this.tocIdCounter = 0;
        this.urlToIdMap.clear();
        this.chapterIdMap.clear();
        this.catalogMap.clear();
        this.tocLevel.clear();
        this.footnoteIconUrl = undefined;
        this.footnoteIconId = undefined;
        this.autoChapterCounter = 1;
        this.pkgTitle = '';

        const task: DownloadTask = {
            bookId,
            enid,
            status: TaskStatus.PENDING,
            progress: { current: 0, total: 0, message: 'Starting...', percentage: 0 },
            startTime: Date.now()
        };

        const updateProgress = (message: string, current: number, total: number) => {
            task.progress = {
                message,
                current,
                total,
                percentage: calculateProgress(current, total)
            };
            if (onProgress) onProgress(task.progress);
        };

        try {
            updateProgress('Fetching ebook detail...', 0, 100);
            const detail = await ebookApi.getEbookDetail(enid);
            this.buildCatalogMap((detail as any).catalog_list || []);

            updateProgress('Fetching token...', 2, 100);
            const token = await ebookApi.getReadToken(enid);

            updateProgress('Fetching book info...', 5, 100);
            const bookInfo = await ebookApi.getBookInfo(token);
            this.initializeChapterIdMapping(bookInfo.chapters || []);

            // Initialize EpubPackage
            this.pkgTitle = `${detail.id}_${detail.title || detail.operating_title || ''}_${detail.book_author || ''}`;
            const pkgAuthor = detail.book_author || '';
            const pkg: EpubPackage = {
                metadata: {
                    title: this.pkgTitle,
                    creator: pkgAuthor,
                    language: 'en',
                    identifier: `urn:dedao:${detail.id || enid}`,
                    description: detail.book_intro || ''
                },
                manifest: [],
                spine: [],
                resources: [],
                toc: []
            };

            // ... rest of the code ...
            // Fix mediaType logic in image loop later

            // 1. Prepare Cover
            let coverHtml = '';
            const coverUrl = detail.cover || bookInfo.coverUrl; 
            if (coverUrl) {
                try {
                    const coverBlob = await this.downloadImage(coverUrl);
                    if (coverBlob) {
                        let coverImageExt = (coverBlob.type && coverBlob.type.split('/')[1]) || 'jpg';
                        if (coverImageExt === 'svg+xml') coverImageExt = 'svg';
                        if (coverImageExt === 'jpeg') coverImageExt = 'jpg';

                        const coverImageFilename = `cover.${coverImageExt}`;
                        pkg.metadata.coverId = coverImageFilename;
                        const coverImgPath = `../images/${coverImageFilename}`;
                        coverHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>${escapeXml(pkg.metadata.title || 'Cover')}</title>
  </head>
  <body>
<img src="${coverImgPath}" alt="Cover Image" />
  </body>
</html>`;
                    }
                } catch (e) {
                    logger.warn('Failed to prepare cover', e);
                }
            }

            // 2. Prepare Copyright page
            const copyrightHtml = this.buildCopyrightPage(detail, pkg);

            // 3. Build TOC structure
            pkg.toc = this.buildNavPoints(bookInfo.toc || []);

            // 4. Add CSS
            const cssContent = `body {
  background-color: #FFFFFF;
  margin-bottom: 0px;
  margin-left: 0px;
  margin-right: 0px;
  margin-top: 0px;
  text-align: center;
}
img {
  max-height: 100%;
  max-width: 100%;
}
`;
            pkg.resources.push({ id: 'cover.css', href: 'css/cover.css', mediaType: 'text/css', content: cssContent });
            pkg.manifest.push({ id: 'cover.css', href: 'css/cover.css', mediaType: 'text/css' });

            // 5. Parse footnote delimiters
            const { fnA, fnB } = await this.parseBookFnDelimiters(bookInfo.chapters || [], token);
            this.converter.setFnDelimiters(fnA, fnB);

            // 6. Process Chapters into fragments
            const chaptersToProcess = (bookInfo.chapters || []).filter(c => {
                const id = this.buildChapterIdentifier(c);
                return id !== 'cover.xhtml' && id !== 'Copyright.xhtml';
            });
            const totalChapters = chaptersToProcess.length;
            const chapterFragments: { id: string, content: string, imageUrls: string[] }[] = [];
            
            for (let i = 0; i < totalChapters; i++) {
                const chapter = chaptersToProcess[i];
                const chapterIdentifier = this.buildChapterIdentifier(chapter);
                const title = this.resolveChapterTitle(chapterIdentifier, chapter.title);
                updateProgress(`Downloading chapter ${i + 1}/${totalChapters}: ${title}`, i, totalChapters);

                const pagesResponse = await this.fetchAllPages(chapter.id, token);
                this.converter.setChapterIndex(i + 2); // cover=0, copyright=1, chapters start at 2

                let chapterHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>${escapeXml(title)}</title>
  </head>
  <body>

`;

                const chapterImageUrls: string[] = [];
                for (const page of pagesResponse) {
                    let pageDivId = chapterIdentifier;
                    if (/_0001/i.test(chapterIdentifier) && !pageDivId.endsWith('.xhtml')) {
                        pageDivId += '.xhtml';
                    }
                    chapterHtml += `<div id="${pageDivId}">`;

                    const decryptedSvg = AESCrypto.decrypt(page.content); 
                    const { html: convertedHtml, images: pageImageUrls, footnoteIconUrl: pageFootnoteIconUrl } = this.converter.convert(decryptedSvg, chapter.id);

                    if (pageFootnoteIconUrl && !this.footnoteIconUrl) {
                        this.footnoteIconUrl = pageFootnoteIconUrl;
                    }

                    chapterImageUrls.push(...pageImageUrls);
                    chapterHtml += convertedHtml;
                    chapterHtml += `</div>`;
                }

                chapterHtml += `\n\n\n</body>\n</html>`;
                chapterFragments.push({ id: chapterIdentifier, content: chapterHtml, imageUrls: chapterImageUrls });
            }

            // 7. Global Image Processing and Placeholder replacement
            const globalUrlToInfo = new Map<string, { id: string, href: string }>();
            this.imageCounter = 1; // Start from 001 (000 is reserved for footnote icon)

            const allFragments = [
                { id: 'cover.xhtml', content: coverHtml, imageUrls: coverUrl ? [coverUrl] : [] },
                { id: 'Copyright.xhtml', content: copyrightHtml, imageUrls: [] },
                ...chapterFragments
            ];

            for (const frag of allFragments) {
                if (!frag.content) continue;
                let updatedContent = frag.content;
                const uniqueUrlsInFrag = frag.imageUrls; // Preserve order, no Set yet

                for (const imgUrl of uniqueUrlsInFrag) {
                    let imgInfo = globalUrlToInfo.get(imgUrl);
                    
                    const isFootnoteIcon = this.footnoteIconUrl && imgUrl === this.footnoteIconUrl;
                    const isCover = coverUrl && imgUrl === coverUrl;

                    if (!imgInfo) {
                        if (isFootnoteIcon) {
                            imgInfo = { id: 'image_000.png', href: 'images/image_000.png' };
                        } else if (isCover) {
                            let ext = 'jpg';
                            if (imgUrl.includes('.png')) ext = 'png';
                            imgInfo = { id: 'cover.jpg', href: `images/cover.${ext}` };
                        } else {
                            const imgBlob = await this.downloadImage(imgUrl);
                            if (imgBlob) {
                                let imgExt = (imgBlob.type && imgBlob.type.split('/')[1]) || 'jpg';
                                if (imgExt === 'svg+xml') imgExt = 'svg';
                                if (imgExt === 'jpeg') imgExt = 'jpg';

                                const currentImageIndex = this.imageCounter++;
                                const filename = formatImageResourceFileName(currentImageIndex, imgExt);
                                imgInfo = { id: filename, href: `images/${filename}` };

                                let mediaType = imgBlob.type || 'image/jpeg';
                                if (imgExt === 'svg') mediaType = 'image/svg+xml';

                                pkg.resources.push({
                                    id: imgInfo.id,
                                    href: imgInfo.href,
                                    mediaType: mediaType,
                                    content: imgBlob
                                });
                                pkg.manifest.push({
                                    id: imgInfo.id,
                                    href: imgInfo.href,
                                    mediaType: mediaType
                                });
                            }
                        }

                        if (imgInfo) {
                            globalUrlToInfo.set(imgUrl, imgInfo);
                            if ((isFootnoteIcon || isCover) && !pkg.resources.some(r => r.id === imgInfo!.id)) {
                                const imgBlob = await this.downloadImage(imgUrl);
                                if (imgBlob) {
                                    let mediaType = imgBlob.type || (isFootnoteIcon ? 'image/png' : 'image/jpeg');
                                    if (imgInfo.href.endsWith('.svg')) mediaType = 'image/svg+xml';

                                    pkg.resources.push({
                                        id: imgInfo.id,
                                        href: imgInfo.href,
                                        mediaType: mediaType,
                                        content: imgBlob
                                    });
                                    pkg.manifest.push({
                                        id: imgInfo.id,
                                        href: imgInfo.href,
                                        mediaType: mediaType,
                                        properties: isCover ? 'cover-image' : undefined
                                    });
                                }
                            }
                        }
                    }

                    if (imgInfo) {
                        const placeholder = `__IMG_PLACEHOLDER_${encodeURIComponent(imgUrl)}__`;
                        const imagePath = `../${imgInfo.href}`; 
                        updatedContent = updatedContent.replace(new RegExp(this.escapeRegExp(placeholder), 'g'), imagePath);
                    }
                }

                // Add document to package
                pkg.resources.push({
                    id: frag.id,
                    href: frag.id,
                    mediaType: 'application/xhtml+xml',
                    content: updatedContent
                });

                pkg.manifest.push({
                    id: frag.id,
                    href: frag.id,
                    mediaType: 'application/xhtml+xml'
                });

                pkg.spine.push({ idref: frag.id });
            }

            this.fixTocHrefs(pkg.toc);

            pkg.manifest.push({ id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' });
            pkg.manifest.push({ id: 'ncx', href: 'toc.ncx', mediaType: 'application/x-dtbncx+xml' });

            updateProgress('Generating EPUB...', 100, 100);
            return await this.generator.generate(pkg);

        } catch (error: any) {
            task.status = TaskStatus.FAILED;
            task.error = {
                code: error.name || 'UNKNOWN',
                message: error.message,
                timestamp: Date.now()
            };
            throw error;
        }
    }

    private async fetchAllPages(chapterId: string, token: string) {
        let allPages: any[] = [];
        let index = 0;
        let isEnd = false;

        while (!isEnd) {
            const response = await ebookApi.getChapterPages(chapterId, token, index);
            if (response.pages && response.pages.length > 0) {
                 allPages.push(...response.pages.map(p => ({
                     content: p.svg
                 })));
                 
                 const lastPage = response.pages[response.pages.length - 1];
                 if (response.is_end !== undefined) {
                     isEnd = response.is_end;
                 } else if (lastPage.is_last) {
                     isEnd = true;
                 }
            } else {
                isEnd = true;
            }
            index++;
        }
        return allPages;
    }

    private async parseBookFnDelimiters(chapters: Chapter[], token: string): Promise<{ fnA: string, fnB: string }> {
        const delimiters = new Set<string>();
        for (const chapter of chapters.slice(0, 5)) {
            const pages = await this.fetchAllPages(chapter.id, token);
            for (const page of pages) {
                const decryptedSvg = AESCrypto.decrypt(page.content);
                const doc = this.converter.parseSvg(decryptedSvg);
                const aTags = doc.getElementsByTagName('a');
                for (let i = 0; i < aTags.length; i++) {
                    const text = aTags[i].textContent || "";
                    if (text === '[' || text === ']') delimiters.add(text);
                    if (delimiters.size >= 2) break;
                }
                if (delimiters.size >= 2) break;
            }
            if (delimiters.size >= 2) break;
        }
        
        const keys = Array.from(delimiters);
        return {
            fnA: keys[0] || "",
            fnB: keys[1] || ""
        };
    }

    private async downloadImage(url: string): Promise<Blob | null> {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            return await response.blob();
        } catch (e) {
            return null;
        }
    }

    private buildNavPoints(tocItems: any[]): NavPoint[] {
        return tocItems.map((item, index) => ({
            id: `nav_${index}_${sanitizeId(item.href || item.text)}`,
            playOrder: item.playOrder || index,
            label: item.text,
            contentSrc: '', 
            children: item.children ? this.buildNavPoints(item.children) : [],
            originalHref: item.href 
        } as any)); 
    }

    private fixTocHrefs(navPoints: NavPoint[]) {
        for (const np of navPoints) {
            const originalHref = (np as any).originalHref;
            if (originalHref) {
                const baseHref = originalHref.split('#')[0];
                np.contentSrc = baseHref || sanitizeId(originalHref);
            }
            if (np.children) {
                this.fixTocHrefs(np.children);
            }
        }
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
    }

    private initializeChapterIdMapping(chapters: Chapter[]): void {
        this.chapterIdMap.clear();
        this.autoChapterCounter = 1;

        chapters.forEach((chapter, index) => {
            const baseId = chapter.id ? sanitizeId(String(chapter.id)) : `Chapter_${index + 1}`;
            if (chapter.id) {
                this.chapterIdMap.set(String(chapter.id), baseId);
            } else {
                this.chapterIdMap.set(`__auto_${index}`, baseId);
            }
        });
    }

    private buildCatalogMap(catalogList: any[]): void {
        for (const item of catalogList) {
            if (item.text) {
                const level = item.level || 0;
                this.tocLevel.set(item.text, level);
            }
            if (item.href && item.text) {
                const hrefPart = item.href.split('#')[0]; 
                const chapterId = hrefPart.replace(/\.xhtml?$/i, ''); 
                const candidates = [
                    chapterId,
                    hrefPart,
                    sanitizeId(chapterId),
                    sanitizeId(hrefPart)
                ].filter(Boolean);
                candidates.forEach(key => this.catalogMap.set(key, item.text));
            }
        }
        this.converter.setTocLevel(this.tocLevel);
    }

    private buildChapterIdentifier(chapter: Chapter): string {
        if (chapter.id && this.chapterIdMap.has(chapter.id)) {
            return this.chapterIdMap.get(chapter.id)!;
        }
        if (chapter.id) {
            return sanitizeId(String(chapter.id));
        }
        return `Chapter_${this.autoChapterCounter++}`;
    }

    private resolveChapterTitle(chapterIdentifier: string, rawTitle?: string): string {
        const candidates = [
            chapterIdentifier,
            chapterIdentifier.replace(/\.xhtml$/i, ''),
            sanitizeId(chapterIdentifier),
            sanitizeId(chapterIdentifier.replace(/\.xhtml$/i, '')),
            rawTitle?.trim()
        ].filter(Boolean) as string[];

        for (const key of candidates) {
            const hit = this.catalogMap.get(key);
            if (hit) return hit;
        }

        return rawTitle?.trim() || chapterIdentifier;
    }

    private buildCopyrightPage(detail: any, pkg: EpubPackage): string {
        const bookName = escapeXml(detail?.title || detail?.operating_title || pkg.metadata.title || '');
        const author = escapeXml(detail?.book_author || pkg.metadata.creator || '');
        const pressRaw = detail?.press || detail?.publisher || detail?.pressName || '';
        const press = escapeXml(typeof pressRaw === 'object' ? (pressRaw.name || JSON.stringify(pressRaw)) : String(pressRaw));
        const publication = escapeXml(detail?.publish_time || detail?.publication_date || detail?.publishDate || detail?.publish || '');
        const isbn = escapeXml(detail?.isbn || detail?.book_isbn || '');
        const wordCountRaw = detail?.word || detail?.word_count || detail?.count || '';
        let wordCount = '';
        if (wordCountRaw) {
            if (typeof wordCountRaw === 'number') {
                wordCount = wordCountRaw > 1000 ? `${Math.floor(wordCountRaw / 1000)}千字` : `${wordCountRaw}字`;
            } else {
                wordCount = String(wordCountRaw);
            }
        }
        wordCount = escapeXml(wordCount);
        const comment = escapeXml(detail?.copyright || detail?.copyright_info || detail?.comment || '本书由得到授权制作电子版发行');
        const comment2 = escapeXml(detail?.comment2 || detail?.copyright2 || '版权所有·侵权必究');

        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>版权信息</title>
  </head>
  <body>

<div id="Copyright.xhtml">
</div><div class="header0"><h1><span id="magic_copyright_title" style="font-size:22px;font-weight: bold;color:rgb(0, 0, 0);font-family:&#39;PingFang SC&#39;;display: block;text-align:center;"><b>版</b><b>权</b><b>信</b><b>息</b></span></h1></div>
<div class="part">
	<p><span id="magic_copyright_entitle" style="font-size:9px;font-weight: bold;color:rgb(120, 120, 120);font-family:&#39;PingFang SC&#39;;display: block;text-align:center;"><b>C</b><b>O</b><b>P</b><b>Y</b><b>R</b><b>I</b><b>G</b><b>H</b><b>T</b></span></p>
	<p><span id="bookname" style="font-size:16px;font-family:&#39;PingFang SC&#39;;">书名：${bookName}</span></p>
	<p><span id="author" style="font-size:16px;font-family:&#39;PingFang SC&#39;;">作者：${author}</span></p>
	<p><span id="press" style="font-size:16px;font-family:&#39;PingFang SC&#39;;">出版社：${press}</span></p>
	<p><span id="publicationdate" style="font-size:16px;font-family:&#39;PingFang SC&#39;;">出版时间：${publication}</span></p>
	<p><span id="isbn" style="font-size:16px;font-family:&#39;PingFang SC&#39;;">ISBN：${isbn}</span></p>
	<p><span id="word" style="font-size:16px;font-family:&#39;PingFang SC&#39;;">字数：${wordCount}</span></p>
	<p><span id="comment" style="font-size:16px;font-family:&#39;PingFang SC&#39;;">${comment}</span></p>
	<p><span id="comment2" style="font-size:16px;font-family:&#39;PingFang SC&#39;;">${comment2}</span></p></div>


</body>
</html>`;
    }

    private normalizeUrl(url: string): string {
        try {
            const u = new URL(url);
            return `${u.origin}${u.pathname}`;
        } catch (e) {
            return url;
        }
    }
}
