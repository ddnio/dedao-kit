export interface BookContext {
    enid: string;
}

/**
 * 从页面 URL 提取电子书 enid。
 *
 * 得到详情页 URL 形式：/ebook/detail?id=<enid>
 * enid 是长 Base64 字符串，等同于 DownloadManager.startDownload 的两个参数。
 */
export function getBookContextFromPage(location: Location = window.location): BookContext | null {
    if (!location.pathname.startsWith('/ebook/detail')) {
        return null;
    }

    const params = new URLSearchParams(location.search);
    const enid = params.get('id');
    if (!enid || !enid.trim()) {
        return null;
    }

    return { enid: enid.trim() };
}
