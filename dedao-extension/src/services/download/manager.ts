import { ebookApi } from '../api/ebook.ts';
import { AESCrypto } from '../crypto/aes.ts';
import { ComplexSvgConverter } from '../svg/complex-converter.ts';
import { EpubGenerator } from '../epub/generator.ts';
import { DownloadTask, TaskStatus, ProgressInfo, TaskError } from '../../types/download.ts';
import { EpubPackage, ManifestItem, SpineItem, EpubResource, NavPoint } from '../../types/epub.ts';
import { EbookMetadata, Chapter } from '../../types/ebook.ts';
import { sanitizeId, escapeXml, calculateProgress } from '../epub/utils.ts';
import { logger } from '../../utils/logger.ts';

export class DownloadManager {
    private converter: ComplexSvgConverter;
    private generator = new EpubGenerator();
    private imageCounter = 0; // New counter for sequential image naming
    private footnoteCounter = 0; // Counter for sequential footnote IDs
    private urlToIdMap = new Map<string, { id: string, href: string }>(); // Cache for image deduplication
    private footnoteIconUrl: string | undefined; // Global footnote icon URL (reused across whole book)
    private footnoteIconId: string | undefined; // ID of the footnote icon

    constructor() {
        // Pass footnote counter getter to converter
        this.converter = new ComplexSvgConverter(() => this.footnoteCounter++);
    }

    async startDownload(
        bookId: string,
        enid: string,
        onProgress?: (info: ProgressInfo) => void
    ): Promise<Blob> {
        // Reset state for new download
        this.imageCounter = 0;
        this.footnoteCounter = 0;
        this.urlToIdMap.clear();
        this.footnoteIconUrl = undefined;
        this.footnoteIconId = undefined;

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
                    const normalizedCoverUrl = this.normalizeUrl(coverUrl);
                    let coverInfo = this.urlToIdMap.get(normalizedCoverUrl);
                    let coverBlob: Blob | null = null;

                    if (!coverInfo) {
                        coverBlob = await this.downloadImage(coverUrl);
                        if (coverBlob) {
                            let coverImageExt = (coverBlob.type && coverBlob.type.split('/')[1]) || 'jpg';
                            // Normalize svg+xml to svg
                            if (coverImageExt === 'svg+xml') coverImageExt = 'svg';

                            // Cover naming to match reference which likely uses 'cover.jpg' separately
                            // Reference has 'EPUB/images/cover.jpg' and 'EPUB/images/image_000.png' (content)
                            const coverImageFilename = `cover.${coverImageExt}`;
                            const coverImageId = `cover-image`; // Match standard ID often used

                            // Content images start at 000
                            this.imageCounter = 0; 
                            
                            coverInfo = { id: coverImageId, href: `images/${coverImageFilename}` };
                            this.urlToIdMap.set(normalizedCoverUrl, coverInfo);

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
            // Minimal CSS from Reference to avoid style conflicts and file bloat
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
            // Resource href is now css/cover.css to match new structure
            pkg.resources.push({ id: 'css', href: 'style.css', mediaType: 'text/css', content: cssContent });
            // Manifest href should also be updated? 
            // Generator handles 'style.css' href specially to write to 'css/cover.css'.
            // But we should update the link in XHTML.
            pkg.manifest.push({ id: 'css', href: 'css/cover.css', mediaType: 'text/css' });

            // Process Chapters
            const chapters = bookInfo.chapters || [];
            const totalChapters = chapters.length;
            
            for (let i = 0; i < totalChapters; i++) {
                const chapter = chapters[i];
                updateProgress(`Downloading chapter ${i + 1}/${totalChapters}: ${chapter.title}`, i, totalChapters);

                // Fetch pages
                const pagesResponse = await this.fetchAllPages(chapter.id, token);
                
                // Determine header level (Go matches 'header' + level)
                // If level is missing, default to 1. Go might use 0 for intro?
                // Ref Chapter_1_1 (Intro) uses header0. Ref Chapter_1_1_0001 (Article) uses header1.
                // Assuming chapter.level maps to this.
                const headerClass = `header${chapter.level !== undefined ? chapter.level : 1}`;

                // Process content
                // Note: CSS link uses relative path - XHTML files are in EPUB/xhtml/, CSS is at EPUB/css/cover.css
                // So we need ../css/cover.css to go up one level then into css
                // Split title into individual characters and wrap each in <b> tags
                const title = (chapter.title && chapter.title.trim()) || ''; // Ensure title is not just whitespace
                const titleChars = title ? title.split('').map(char => `<b>${escapeXml(char)}</b>`).join('') : '';

                let chapterHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <title>${escapeXml(title || chapter.id)}</title>
    <link rel="stylesheet" type="text/css" href="../css/cover.css"/>
</head>
<body>

<div id="${sanitizeId(chapter.id)}">
</div><div class="${headerClass}"><h2><span style="font-size:19px;font-weight: bold;color:rgb(0, 0, 0);font-family:'PingFang SC';display: block;text-align:center;">${titleChars}</span></h2></div>
<div class="part">`;
                                
                                for (const page of pagesResponse) {
                                                        const decryptedSvg = AESCrypto.decrypt(page.content); // page.content is encrypted string
                                                        // Use new converter with chapterId, it now returns HTML with placeholders and footnotes
                                                        const { html: convertedHtml, images: remoteImageUrls, footnotes: pageFootnotes, footnoteIconUrl: pageFootnoteIconUrl } = this.converter.convert(decryptedSvg, chapter.id);

                                                        // Capture first footnote icon URL for global reuse
                                                        if (pageFootnoteIconUrl && !this.footnoteIconUrl) {
                                                            this.footnoteIconUrl = pageFootnoteIconUrl;
                                                        }

                                                        let processedChapterHtml = convertedHtml; // Work on a mutable copy of the HTML fragment

                                                        // Download and deduplicate images, then replace placeholders in the HTML fragment
                                                        for (const imgUrl of remoteImageUrls) {
                                                            try {
                                                                const normalizedImgUrl = this.normalizeUrl(imgUrl);
                                                                let imgInfo = this.urlToIdMap.get(normalizedImgUrl);

                                                                if (!imgInfo) {
                                                                    // Check if it's a footnote icon
                                                                    const isFootnoteIcon = this.footnoteIconUrl && normalizedImgUrl === this.normalizeUrl(this.footnoteIconUrl);

                                                                    if (isFootnoteIcon && this.footnoteIconId) {
                                                                        // Footnote icon already downloaded, reuse its ID
                                                                        imgInfo = { id: this.footnoteIconId, href: `images/${this.footnoteIconId}.png` };
                                                                        this.urlToIdMap.set(normalizedImgUrl, imgInfo);
                                                                    } else if (isFootnoteIcon) {
                                                                        // First time seeing this footnote icon, download it once
                                                                        const imgBlob = await this.downloadImage(imgUrl);
                                                                        if (imgBlob) {
                                                                            let imgExt = (imgBlob.type && imgBlob.type.split('/')[1]) || 'png';
                                                                            if (imgExt === 'svg+xml') imgExt = 'svg';

                                                                            // Use fixed index 0 for footnote icon (global reuse)
                                                                            const imgId = 'image_000';
                                                                            const imgFilename = `image_000.${imgExt}`;

                                                                            this.footnoteIconId = imgId;
                                                                            imgInfo = { id: imgId, href: `images/${imgFilename}` };
                                                                            this.urlToIdMap.set(normalizedImgUrl, imgInfo);

                                                                            pkg.resources.push({
                                                                                id: imgInfo.id,
                                                                                href: imgInfo.href,
                                                                                mediaType: imgBlob.type || 'image/png',
                                                                                content: imgBlob
                                                                            });
                                                                            pkg.manifest.push({
                                                                                id: imgInfo.id,
                                                                                href: imgInfo.href,
                                                                                mediaType: imgBlob.type || 'image/png'
                                                                            });

                                                                            // Increment counter to skip image_000 for other images
                                                                            if (this.imageCounter === 0) this.imageCounter++;
                                                                        }
                                                                    } else if (coverUrl && normalizedImgUrl === this.normalizeUrl(coverUrl)) {
                                                                        // Handle cover image
                                                                        let ext = 'jpg';
                                                                        if (imgUrl.includes('.png')) ext = 'png';
                                                                        else if (imgUrl.includes('.jpeg') || imgUrl.includes('.jpg')) ext = 'jpeg';

                                                                        const coverFilename = `cover.${ext}`;
                                                                        imgInfo = { id: 'cover-image', href: `images/${coverFilename}` };
                                                                        this.urlToIdMap.set(normalizedImgUrl, imgInfo);
                                                                    } else {
                                                                        // Regular image, download it
                                                                        const imgBlob = await this.downloadImage(imgUrl);
                                                                        if (imgBlob) {
                                                                            let imgExt = (imgBlob.type && imgBlob.type.split('/')[1]) || 'jpg';
                                                                            if (imgExt === 'svg+xml') imgExt = 'svg';

                                                                            // Skip index 0 if it's used for footnote icon
                                                                            const currentImageIndex = this.imageCounter;
                                                                            this.imageCounter++;

                                                                            const imgFilename = `image_${String(currentImageIndex).padStart(3, '0')}.${imgExt}`;
                                                                            const imgId = `image_${String(currentImageIndex).padStart(3, '0')}`;

                                                                            imgInfo = { id: imgId, href: `images/${imgFilename}` };
                                                                            this.urlToIdMap.set(normalizedImgUrl, imgInfo);

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
                                    
                                                        // Append footnotes collected from this page at the BEGINNING of the part (or before content)
                                                        // Reference puts footnotes inside div.part, before <p> tags.
                                                        // Since we iterate pages, we might have multiple sets of footnotes.
                                                        // We should append them to chapterHtml before appending processedChapterHtml.
                                                        for (const fn of pageFootnotes) {
                                                            chapterHtml += `<aside epub:type="footnote" id="${fn.id}"><ol class="duokan-footnote-content" style="list-style:none;padding:0px;margin:0px;"><li class="duokan-footnote-item" id="${fn.id}">${fn.text}</li></ol></aside>`;
                                                        }
                                                        
                                                        chapterHtml += processedChapterHtml;
                                                    }
                                    
                                    chapterHtml += `</div>
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

    private normalizeUrl(url: string): string {
        try {
            // Remove query parameters to deduplicate images (e.g. tokens)
            // dedao image urls: https://.../image.png?token=...
            const u = new URL(url);
            return `${u.origin}${u.pathname}`;
        } catch (e) {
            return url;
        }
    }
}
