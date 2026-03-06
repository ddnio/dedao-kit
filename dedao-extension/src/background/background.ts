chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== 'CAPTURE_VISIBLE_TAB') {
        return false;
    }

    const windowId = sender.tab?.windowId;
    if (windowId === undefined) {
        sendResponse({ error: '未识别到窗口' });
        return false;
    }

    chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
        .then((dataUrl) => sendResponse({ dataUrl }))
        .catch((error: Error) => sendResponse({ error: error.message || '截图失败' }));

    return true;
});
