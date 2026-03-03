import { PageDownloadController } from './page-download-controller.ts';

console.log('Dedao Downloader Content Script Loaded');

const controller = new PageDownloadController();
controller.start();

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'GET_BOOK_ID') {
        const enid = controller.getEnid();
        // 保持旧协议：popup 通过 bookId 字段读取，实际语义是 enid
        sendResponse({ bookId: enid, enid });
    }
    return true; // Keep channel open for async response
});
