import { ebookApi } from '../api/ebook';
import { AESCrypto } from '../crypto/aes';
import { ComplexSvgConverter } from '../svg/complex-converter';
import { EpubGenerator } from '../epub/generator';
import { DownloadTask, TaskStatus, ProgressInfo, TaskError } from '../../types/download';
import { EpubPackage, ManifestItem, SpineItem, EpubResource, NavPoint } from '../../types/epub';
import { EbookMetadata, Chapter } from '../../types/ebook';
import { sanitizeId, escapeXml, calculateProgress } from '../epub/utils';
import { logger } from '../../utils/logger';

export class DownloadManager {
    private converter = new ComplexSvgConverter();
    private generator = new EpubGenerator();
    private imageCounter = 0; // New counter for sequential image naming
    private urlToIdMap = new Map<string, { id: string, href: string }>(); // Cache for image deduplication

    async startDownload(
        bookId: string, 
        enid: string, 
        onProgress?: (info: ProgressInfo) => void
    ): Promise<Blob> {
        // Reset state for new download
        this.imageCounter = 0;
        this.urlToIdMap.clear();

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
            // Get metadata (title, author, description, cover) from detail endpoint
            const detail = await ebookApi.getEbookDetail(enid);

            updateProgress('Fetching token...', 2, 100);
            const token = await ebookApi.getReadToken(enid);

            updateProgress('Fetching book info...', 5, 100);
            const bookInfo = await ebookApi.getBookInfo(token);

            // Initialize EpubPackage with detailed metadata from both endpoints
            const pkg: EpubPackage = {
                metadata: {
                    title: detail.title || detail.operating_title || '',
                    creator: detail.book_author || '',
                    language: 'zh',
                    identifier: `urn:dedao:${detail.id || enid}`,
                    description: detail.book_intro || ''
                },
                manifest: [],
                spine: [],
                resources: [],
                toc: []
            };

            // Add Cover
            const coverUrl = detail.cover || bookInfo.coverUrl;  // cover from detail or bookInfo
            if (coverUrl) {
                try {
                    let coverInfo = this.urlToIdMap.get(coverUrl);
                    let coverBlob: Blob | null = null;

                    if (!coverInfo) {
                        coverBlob = await this.downloadImage(coverUrl);
                        if (coverBlob) {
                            let coverImageExt = (coverBlob.type && coverBlob.type.split('/')[1]) || 'jpg';
                            // Normalize svg+xml to svg
                            if (coverImageExt === 'svg+xml') coverImageExt = 'svg';

                            const currentImageIndex = this.imageCounter;
                            const coverImageFilename = `image_${String(currentImageIndex).padStart(3, '0')}.${coverImageExt}`;
                            const coverImageId = `image_${String(currentImageIndex).padStart(3, '0')}`;

                            this.imageCounter++; // Increment after using
                            
                            coverInfo = { id: coverImageId, href: `images/${coverImageFilename}` };
                            this.urlToIdMap.set(coverUrl, coverInfo);

                            pkg.resources.push({
                                id: coverInfo.id,
                                href: coverInfo.href,
                                mediaType: coverBlob.type || 'image/jpeg',
                                content: coverBlob
                            });
                            pkg.manifest.push({
                                id: coverInfo.id,
                                href: coverInfo.href,
                                mediaType: coverBlob.type || 'image/jpeg',
                                properties: 'cover-image'
                            });
                        }
                    }

                    if (coverInfo) {
                        pkg.metadata.coverId = coverInfo.id;

                        // Add cover.xhtml - matching Go version format for simplicity
                        // Cover page should be simple and clean
                        const coverHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>${escapeXml(pkg.metadata.title || 'Cover')}</title>
    <link rel="stylesheet" type="text/css" href="style.css"></link>
  </head>
  <body>
<img src="${coverInfo.href}" alt="Cover Image" />
  </body>
</html>`;
                        // Note: coverInfo.href is relative to EPUB root (images/...)
                        // cover.xhtml is also at EPUB root, so no path adjustment needed
                        
                        pkg.resources.push({
                            id: 'cover-page',
                            href: 'cover.xhtml',
                            mediaType: 'application/xhtml+xml',
                            content: coverHtml
                        });
                        pkg.manifest.push({
                            id: 'cover-page',
                            href: 'cover.xhtml',
                            mediaType: 'application/xhtml+xml'
                        });
                        // Add to spine start
                        pkg.spine.unshift({ idref: 'cover-page' });
                    }
                } catch (e) {
                    logger.warn('Failed to download cover', e);
                }
            }

            // Build TOC structure for EPUB (NavPoints)
            pkg.toc = this.buildNavPoints(bookInfo.toc || []);

            // Add CSS with font definitions (external CSS to reduce file size)
            const cssContent = `/* Zhuangzi eBook CSS */

/* Font definitions */
@font-face { font-family: "FZFangSong-Z02"; src: local("FZFangSong-Z02"), url("https://imgcdn.umiwi.com/ttf/fangzhengfangsong_gbk.ttf"); }
@font-face { font-family: "FZKai-Z03"; src: local("FZKai-Z03"), url("https://imgcdn.umiwi.com/ttf/fangzhengkaiti_gbk.ttf"); }
@font-face { font-family: "DeDaoJinKai"; src: local("DeDaoJinKai"), url("https://imgcdn.umiwi.com/ttf/dedaojinkaiw03.ttf"); }
@font-face { font-family: "Source Code Pro"; src: local("Source Code Pro"), url("https://imgcdn.umiwi.com/ttf/0315911806889993935644188722660020367983.ttf"); }

/* Body and text styles */
body {
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
    line-height: 1.6;
    margin: 0;
    padding: 0 1em;
    color: #333;
}

h1, h2, h3, h4, h5, h6 {
    margin-top: 1em;
    margin-bottom: 0.5em;
    font-weight: bold;
}

p {
    text-indent: 2em;
    margin-bottom: 1em;
    text-align: justify;
}

/* Image styles */
img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em auto;
    page-break-inside: avoid;
}

.image-wrapper {
    text-align: center;
}

/* Footnote styles */
sup {
    font-size: 0.8em;
    vertical-align: super;
}

.duokan-footnote {
    font-size: 0.8em;
}

img.epub-footnote {
    display: inline;
    margin-right: 5px;
    font-size: 12px;
    width: 10px;
    height: 10px;
}

aside[epub:type="footnote"] {
    font-size: 0.9em;
    margin: 1em 0;
    padding: 0.5em 1em;
    border-left: 2px solid #ccc;
}

.duokan-footnote-content {
    list-style: none;
    padding: 0;
    margin: 0;
}

/* Table styles */
table, tr, td, th, tbody, thead, tfoot {
    page-break-inside: avoid !important;
}

/* Links */
a {
    color: #0066cc;
    text-decoration: none;
}

a:visited {
    color: #800080;
}
`;
            pkg.resources.push({ id: 'css', href: 'style.css', mediaType: 'text/css', content: cssContent });
            pkg.manifest.push({ id: 'css', href: 'style.css', mediaType: 'text/css' });

            // Process Chapters
            const chapters = bookInfo.chapters || [];
            const totalChapters = chapters.length;
            
            for (let i = 0; i < totalChapters; i++) {
                const chapter = chapters[i];
                updateProgress(`Downloading chapter ${i + 1}/${totalChapters}: ${chapter.title}`, i, totalChapters);

                // Fetch pages
                const pagesResponse = await this.fetchAllPages(chapter.id, token);
                
                                // Process content
                // Note: CSS link uses relative path - XHTML files are in EPUB/xhtml/, CSS is at EPUB/ root
                // So we need ../style.css to go up one level
                let chapterHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <title>${escapeXml(chapter.title)}</title>
    <link rel="stylesheet" type="text/css" href="../style.css"/>
</head>
<body>
    <h1>${escapeXml(chapter.title)}</h1>
    <div class="chapter-content">
`;
                                
                                for (const page of pagesResponse) {                
                                                        const decryptedSvg = AESCrypto.decrypt(page.content); // page.content is encrypted string
                                                        // Use new converter with chapterId, it now returns HTML with placeholders and footnotes
                                                        const { html: convertedHtml, images: remoteImageUrls, footnotes: pageFootnotes } = this.converter.convert(decryptedSvg, chapter.id);
                                                        
                                                        let processedChapterHtml = convertedHtml; // Work on a mutable copy of the HTML fragment
                                    
                                                        // Download and deduplicate images, then replace placeholders in the HTML fragment
                                                        for (const imgUrl of remoteImageUrls) {
                                                            try {
                                                                let imgInfo = this.urlToIdMap.get(imgUrl);
                                    
                                                                if (!imgInfo) {
                                                                    // New image, download it
                                                                    const imgBlob = await this.downloadImage(imgUrl);
                                                                    if (imgBlob) {
                                                                        let imgExt = (imgBlob.type && imgBlob.type.split('/')[1]) || 'jpg';
                                    if (imgExt === 'svg+xml') imgExt = 'svg';
                                if (imgExt === 'svg+xml') imgExt = 'svg';
                                                                        
                                                                        // imageCounter will be the current count, imgId will be based on that.
                                                                        // Then increment imageCounter for the next unique image.
                                                                        const currentImageIndex = this.imageCounter;
                                                                        this.imageCounter++; // Increment for the next unique image
                                    
                                                                        const imgFilename = `image_${String(currentImageIndex).padStart(3, '0')}.${imgExt}`;
                                                                        const imgId = `image_${String(currentImageIndex).padStart(3, '0')}`;
                                                                        
                                                                        imgInfo = { id: imgId, href: `images/${imgFilename}` };
                                                                        this.urlToIdMap.set(imgUrl, imgInfo);
                                    
                                                                        pkg.resources.push({
                                                                            id: imgInfo.id,
                                                                            href: imgInfo.href,
                                                                            mediaType: imgBlob.type || 'image/jpeg',
                                                                            content: imgBlob
                                                                        });
                                                                        pkg.manifest.push({
                                                                            id: imgInfo.id,
                                                                            href: imgInfo.href,
                                                                            mediaType: imgBlob.type || 'image/jpeg'
                                                                        });
                                                                    }
                                                                }
                                    
                                                                if (imgInfo) {
                                                                    // Replace placeholder in the convertedHtml with local path
                                                                    const placeholder = `__IMG_PLACEHOLDER_${encodeURIComponent(imgUrl)}__`;
                                                                    // Images are at EPUB/images/, XHTML is at EPUB/xhtml/, so use ../images/...
                                                                    const imagePath = imgInfo.href.startsWith('images/')
                                                                        ? '../' + imgInfo.href
                                                                        : imgInfo.href;
                                                                    // Use RegExp to replace all occurrences of the placeholder
                                                                    processedChapterHtml = processedChapterHtml.replace(new RegExp(this.escapeRegExp(placeholder), 'g'), imagePath);
                                                                }
                                                            } catch (e) {
                                                                logger.warn(`Failed to process image ${imgUrl}: ${e}`, e);
                                                            }
                                                        }
                                                        chapterHtml += processedChapterHtml;
                                    
                                                        // Append footnotes collected from this page
                                                        for (const fn of pageFootnotes) {
                                                            chapterHtml += `<aside epub:type="footnote" id="${fn.id}"><ol class="duokan-footnote-content" style="list-style:none;padding:0px;margin:0px;"><li class="duokan-footnote-item" id="${fn.id}">${fn.text}</li></ol></aside>`;
                                                        }
                                                    }
                                    
                                    chapterHtml += `
    </div>
</body>
</html>`;

                const cleanedChapterId = chapter.id.replace(/\.xhtml$/i, ''); // Remove .xhtml if already present
                const filename = `${sanitizeId(cleanedChapterId)}.xhtml`; // Removed 'chapter_' prefix
                const resourceId = sanitizeId(cleanedChapterId); 

                pkg.resources.push({
                    id: resourceId,
                    href: filename,
                    mediaType: 'application/xhtml+xml',
                    content: chapterHtml
                });

                pkg.manifest.push({
                    id: resourceId,
                    href: filename,
                    mediaType: 'application/xhtml+xml'
                });

                pkg.spine.push({ idref: resourceId });
            }

            // Ensure TOC NavPoints point to correct hrefs
            this.fixTocHrefs(pkg.toc);

            // Add Navigation Docs to manifest (required by Generator?)
            pkg.manifest.push({ id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' });
            pkg.manifest.push({ id: 'ncx', href: 'toc.ncx', mediaType: 'application/x-dtbncx+xml' });
            // Add nav to spine after cover-page, if cover-page exists
            // Or add it after any default items that are meant to be first.
            // Go places nav (toc.ncx) after cover.xhtml and Copyright.xhtml, as the toc="ncx" in spine handles it.
            // So we don't need to put 'nav' in the spine explicitly.
            // Let's remove this: pkg.spine.unshift({ idref: 'nav', linear: 'no' });
            // The Go version's package.opf does not have <itemref idref="nav" linear="no"/>
            // It just has <spine toc="ncx"> and then references the actual chapters.
            // The nav.xhtml is linked in the manifest and implicit from toc="ncx".
            // So, remove nav from spine.

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
                 
                 // Fallback if is_end is missing (rare)
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
        // Recursively build NavPoints
        return tocItems.map((item, index) => ({
            id: `nav_${index}_${sanitizeId(item.href || item.text)}`,
            playOrder: item.playOrder || index,
            label: item.text,
            contentSrc: '', // Placeholder, fixed later
            children: item.children ? this.buildNavPoints(item.children) : [],
            // Keep original href to map later
            originalHref: item.href 
        } as any)); 
    }

    private fixTocHrefs(navPoints: NavPoint[]) {
        for (const np of navPoints) {
            // Assuming originalHref is chapterId
            const originalHref = (np as any).originalHref;
            if (originalHref) {
                // If originalHref contains .xhtml, maybe it's already correct?
                // Usually it's just ID.
                // We mapped chapter files to `chapter_${sanitizeId(id)}.xhtml`.
                // So if originalHref is `ch_001`, target is `chapter_ch_001.xhtml`.
                np.contentSrc = `${sanitizeId(originalHref)}.xhtml`; // Removed 'chapter_' prefix
            }
            if (np.children) {
                this.fixTocHrefs(np.children);
            }
        }
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }
}
