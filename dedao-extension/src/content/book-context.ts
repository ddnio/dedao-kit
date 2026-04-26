export interface EbookPageContext {
    pageType: 'ebook';
    enid: string;
}

export interface CourseArticlePageContext {
    pageType: 'course-article';
    articleId: string;
    title: string;
    courseTitle: string;
    captureRoot: HTMLElement;
    captureStart: HTMLElement;
    captureEnd: HTMLElement;
}

export type PageContext = EbookPageContext | CourseArticlePageContext;

/**
 * 从页面 URL 提取电子书 enid。
 *
 * 得到详情页 URL 形式：/ebook/detail?id=<enid>
 * enid 是长 Base64 字符串，等同于 DownloadManager.startDownload 的两个参数。
 */
export function getBookContextFromPage(location: Location = window.location): EbookPageContext | null {
    if (!location.pathname.startsWith('/ebook/detail')) {
        return null;
    }

    const params = new URLSearchParams(location.search);
    const enid = params.get('id');
    if (!enid || !enid.trim()) {
        return null;
    }

    return { pageType: 'ebook', enid: enid.trim() };
}

function findCaptureRoot(doc: Document): HTMLElement | null {
    return (
        doc.querySelector<HTMLElement>('.article-body-wrap') ??
        doc.querySelector<HTMLElement>('.article-body') ??
        doc.querySelector<HTMLElement>('.article') ??
        doc.querySelector<HTMLElement>('article') ??
        doc.querySelector<HTMLElement>('main')
    );
}

function findCaptureStart(root: HTMLElement): HTMLElement {
    const firstMeaningfulChild = Array.from(root.children).find((el) => {
        const text = el.textContent?.replace(/\s+/g, '').trim() ?? '';
        return text.length > 0 && !text.includes('展开目录') && !text.includes('设置文本');
    });

    return (
        root.querySelector<HTMLElement>('h1') ??
        firstMeaningfulChild as HTMLElement ??
        root.firstElementChild as HTMLElement ??
        root
    );
}

function findCaptureEnd(root: HTMLElement): HTMLElement {
    const eliteModule = root.querySelector<HTMLElement>('.elite-module');
    if (eliteModule) {
        return eliteModule;
    }

    const all = Array.from(root.querySelectorAll<HTMLElement>('div,p,section,h1,h2,h3'));
    const summary = all.find((el) => el.textContent?.replace(/\s+/g, '').includes('划重点'));
    if (summary) {
        return summary.parentElement instanceof HTMLElement ? summary.parentElement : summary;
    }
    return all.length > 0 ? all[all.length - 1] : root;
}

function extractCourseArticleTitles(root: HTMLElement, doc: Document): { title: string; courseTitle: string } {
    const semanticTitle =
        root.querySelector<HTMLElement>('.article-title')?.textContent?.trim() ??
        root.querySelector<HTMLElement>('h1')?.textContent?.trim() ??
        '';
    const semanticCourseTitle =
        root.querySelector<HTMLElement>('.article-info .author')?.textContent?.trim() ??
        root.querySelector<HTMLElement>('.article-info .course-title')?.textContent?.trim() ??
        root.querySelector<HTMLElement>('.author')?.textContent?.trim() ??
        root.querySelector<HTMLElement>('.course-title')?.textContent?.trim() ??
        '';

    if (semanticTitle) {
        return {
            title: semanticTitle,
            courseTitle: semanticCourseTitle,
        };
    }

    const titleNode = root.querySelector<HTMLElement>('h1');
    const articleTitleFromHeading = titleNode?.textContent?.trim();
    const looksLikeCourseTitle = (text: string): boolean =>
        /[·｜]|课堂|课程|专栏|训练营|锦囊/.test(text) && !/今天|划重点|正文/.test(text);

    if (articleTitleFromHeading) {
        const courseTitle = Array.from(root.querySelectorAll<HTMLElement>('div,span,p'))
            .map((el) => el.textContent?.trim() ?? '')
            .find((text) => Boolean(text) && text !== articleTitleFromHeading && looksLikeCourseTitle(text)) ?? '';
        return { title: articleTitleFromHeading, courseTitle };
    }

    const headerBlock = Array.from(root.children).find((el) => {
        const text = el.textContent?.replace(/\s+/g, '').trim() ?? '';
        return text.length > 0 && !text.includes('展开目录') && !text.includes('设置文本');
    }) as HTMLElement | undefined;

    const candidates = Array.from((headerBlock ?? root).querySelectorAll<HTMLElement>('div,span,p'))
        .map((el) => el.textContent?.trim() ?? '')
        .filter(Boolean)
        .filter((text) => !text.includes('展开目录') && !text.includes('设置文本') && !text.includes('今天'));

    const directBlockText = headerBlock?.textContent?.trim() ?? '';
    const title = candidates[0] ?? directBlockText ?? doc.title.replace(/\s*-\s*得到APP.*$/, '').trim();
    const courseTitle = candidates.find((text) => text !== title && looksLikeCourseTitle(text)) ?? '';
    return { title, courseTitle };
}

export function getPageContextFromPage(
    location: Location = window.location,
    doc: Document = document,
): PageContext | null {
    const ebookCtx = getBookContextFromPage(location);
    if (ebookCtx) return ebookCtx;

    if (!location.pathname.startsWith('/course/article')) {
        return null;
    }

    const params = new URLSearchParams(location.search);
    const articleId = params.get('id')?.trim();
    if (!articleId) {
        return null;
    }

    const captureRoot = findCaptureRoot(doc);
    if (!captureRoot) {
        return null;
    }

    const captureStart = findCaptureStart(captureRoot);
    const captureEnd = findCaptureEnd(captureRoot);
    const titles = extractCourseArticleTitles(captureRoot, doc);
    const title = titles.title || `dedao_course_article_${articleId}`;

    return {
        pageType: 'course-article',
        articleId,
        title,
        courseTitle: titles.courseTitle,
        captureRoot,
        captureStart,
        captureEnd,
    };
}
