import { DownloadManager } from '../services/download/manager.ts';
import { ProgressInfo } from '../types/download.ts';

export class PopupController {
    private manager = new DownloadManager();
    private enid: string | null = null;

    constructor() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        const titleEl = document.getElementById('book-title')!;
        const btn = document.getElementById('download-btn') as HTMLButtonElement;
        
        btn.addEventListener('click', () => this.startDownload());

        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs || tabs.length === 0) {
                titleEl.textContent = 'No active tab';
                return;
            }
            
            const tab = tabs[0];
            if (!tab.url || !tab.url.includes('dedao.cn')) {
                titleEl.textContent = 'Please open dedao.cn';
                return;
            }

            if (!tab.id) return;

            // Communicate with content script
            chrome.tabs.sendMessage(tab.id, { action: 'GET_BOOK_ID' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Content script might not be loaded yet (requires refresh)
                    titleEl.textContent = 'Please refresh page';
                    return;
                }
                
                if (response && response.bookId) {
                    this.enid = response.bookId;
                    titleEl.textContent = 'Ready to download';
                    btn.disabled = false;
                } else {
                    titleEl.textContent = 'No book found';
                }
            });

        } catch (e: any) {
            this.showError(e.message);
        }
    }

    async startDownload() {
        if (!this.enid) return;
        
        const btn = document.getElementById('download-btn') as HTMLButtonElement;
        const progressSection = document.getElementById('progress-section')!;
        const progressBar = document.getElementById('progress-bar')!;
        const statusText = document.getElementById('status-text')!;
        const errorEl = document.getElementById('error-message')!;

        btn.disabled = true;
        btn.style.display = 'none';
        progressSection.classList.remove('hidden');
        errorEl.classList.add('hidden');

        try {
            const blob = await this.manager.startDownload(this.enid, this.enid, (progress: ProgressInfo) => {
                progressBar.style.width = `${progress.percentage}%`;
                statusText.textContent = `${progress.message} (${progress.percentage}%)`;
            });

            // Use ID for filename as we don't return metadata yet
            const filename = `dedao_${this.enid}.epub`;
            
            this.downloadFile(blob, filename);
            
            statusText.textContent = 'Download Completed!';
            progressBar.style.width = '100%';
            
            // Re-enable button after a delay?
            setTimeout(() => {
                btn.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Download Again';
                progressSection.classList.add('hidden');
            }, 3000);

        } catch (error: any) {
            console.error(error);
            this.showError(error.message || 'Download failed');
            btn.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Retry Download';
            progressSection.classList.add('hidden');
        }
    }

    showError(msg: string) {
        const el = document.getElementById('error-message')!;
        el.textContent = msg;
        el.classList.remove('hidden');
    }

    downloadFile(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
    new PopupController();
}
