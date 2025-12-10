
console.log('Dedao Downloader Content Script Loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_BOOK_ID') {
        const bookId = getBookIdFromPage();
        sendResponse({ bookId });
    }
    return true; // Keep channel open for async response if needed
});

function getBookIdFromPage(): string | null {
    // 1. Try URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('id')) {
        return urlParams.get('id');
    }
    
    // 2. Try URL path (e.g. /ebook/detail/12345)
    // Adjust regex based on actual URL structure if needed
    const match = window.location.pathname.match(/\/ebook\/detail\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
        return match[1];
    }

    return null;
}
