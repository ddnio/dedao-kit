import { DownloadManager } from '../../src/services/download/manager.ts';
import { ebookApi } from '../../src/services/api/ebook.ts';
import { AESCrypto } from '../../src/services/crypto/aes.ts';
import { SvgConverter } from '../../src/services/svg/converter.ts';
import { EpubGenerator } from '../../src/services/epub/generator.ts';
import { TaskStatus } from '../../src/types/download.ts';

// Mock dependencies
jest.mock('../../src/services/api/ebook');
jest.mock('../../src/services/crypto/aes');

describe('Download Integration Test', () => {
    let manager: DownloadManager;

    beforeEach(() => {
        manager = new DownloadManager();
        jest.clearAllMocks();
    });

    it('should complete full download flow successfully', async () => {
        // 1. Mock API responses
        (ebookApi.getReadToken as jest.Mock).mockResolvedValue('test_token');
        
        (ebookApi.getEbookDetail as jest.Mock).mockResolvedValue({
            title: 'Integration Test Book',
            book_author: 'Test Author',
            book_intro: 'Test Description',
            cover: 'http://test.com/cover.jpg'
        });

        (ebookApi.getBookInfo as jest.Mock).mockResolvedValue({
            title: 'Integration Test Book',
            chapters: [
                { id: 'ch1', title: 'Chapter 1' },
                { id: 'ch2', title: 'Chapter 2' }
            ],
            toc: [
                { href: 'ch1', text: 'Chapter 1', level: 1, playOrder: 1 },
                { href: 'ch2', text: 'Chapter 2', level: 1, playOrder: 2 }
            ]
        });

        (ebookApi.getChapterPages as jest.Mock).mockResolvedValue({
            pages: [
                { svg: 'encrypted_content_1' },
                { svg: 'encrypted_content_2', is_last: true }
            ],
            is_end: true
        });

        // 2. Mock Crypto
        (AESCrypto.decrypt as jest.Mock).mockReturnValue('<svg>Decrypted Content</svg>');

        // 3. Mock Fetch for images (cover)
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            blob: async () => new Blob(['image data'], { type: 'image/jpeg' }),
            type: 'image/jpeg'
        } as any);

        // 4. Track progress
        const onProgress = jest.fn();

        // 5. Execute
        const blob = await manager.startDownload('book123', 'enid123', onProgress);

        // 6. Verify Result
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(0);

        // Verify API calls sequence
        expect(ebookApi.getReadToken).toHaveBeenCalledWith('enid123');
        expect(ebookApi.getEbookDetail).toHaveBeenCalledWith('enid123');
        expect(ebookApi.getBookInfo).toHaveBeenCalledWith('test_token');
        
        // parseBookFnDelimiters prefetches pages (2 calls), actual chapter processing reuses cache (0 extra calls)
        expect(ebookApi.getChapterPages).toHaveBeenCalledTimes(2);

        // Verify progress updates
        expect(onProgress).toHaveBeenCalled();
        const lastProgress = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
        expect(lastProgress.percentage).toBe(100);
    });

    it('should handle API errors correctly', async () => {
        // Mock API failure
        (ebookApi.getEbookDetail as jest.Mock).mockRejectedValue(new Error('Network Error'));

        const onProgress = jest.fn();

        await expect(manager.startDownload('book123', 'enid123', onProgress))
            .rejects.toThrow('Network Error');
            
        // Task status should be failed (though startDownload throws, checking internal state requires access to task)
        // Since startDownload creates a local task variable, we can't check it directly here unless we expose it.
        // But we can check that it didn't proceed to get token.
        expect(ebookApi.getReadToken).not.toHaveBeenCalled();
    });
});
