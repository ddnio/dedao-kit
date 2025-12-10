/**
 * @jest-environment jsdom
 */
import { PopupController } from '../popup.ts';
import { DownloadManager } from '../../services/download/manager.ts';

// Mock Chrome API
const mockQuery = jest.fn();
const mockSendMessage = jest.fn();
global.chrome = {
    tabs: {
        query: mockQuery,
        sendMessage: mockSendMessage
    },
    runtime: {
        lastError: null
    }
} as any;

// Mock DownloadManager
jest.mock('../../services/download/manager');

describe('PopupController', () => {
    let mockStartDownload: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup DownloadManager mock instance
        mockStartDownload = jest.fn().mockResolvedValue(new Blob([]));
        (DownloadManager as jest.Mock).mockImplementation(() => ({
            startDownload: mockStartDownload
        }));

        document.body.innerHTML = `
            <div id="book-title"></div>
            <button id="download-btn"></button>
            <div id="progress-section" class="hidden"></div>
            <div id="progress-bar"></div>
            <p id="status-text"></p>
            <div id="error-message" class="hidden"></div>
        `;

        // Mock URL
        global.URL.createObjectURL = jest.fn();
        global.URL.revokeObjectURL = jest.fn();
    });

    it('should detect book id on init', async () => {
        mockQuery.mockResolvedValue([{ id: 1, url: 'https://www.dedao.cn/ebook/detail?id=123' }]);
        mockSendMessage.mockImplementation((tabId, msg, cb) => cb({ bookId: '123' }));

        const ctrl = new PopupController();
        // Init is called in constructor if DOM loaded, or listener added.
        // In jsdom, document.readyState might be 'complete'.
        // Let's manually call init to be sure or await if async.
        await ctrl.init();

        const title = document.getElementById('book-title');
        expect(title?.textContent).toBe('Ready to download');
        const btn = document.getElementById('download-btn') as HTMLButtonElement;
        expect(btn.disabled).toBe(false);
    });

    it('should start download on click', async () => {
        mockQuery.mockResolvedValue([{ id: 1, url: 'https://www.dedao.cn/ebook/detail?id=123' }]);
        mockSendMessage.mockImplementation((tabId, msg, cb) => cb({ bookId: '123' }));
        
        const ctrl = new PopupController();
        await ctrl.init();

        const btn = document.getElementById('download-btn') as HTMLButtonElement;
        btn.click();

        expect(mockStartDownload).toHaveBeenCalled();
    });
});
