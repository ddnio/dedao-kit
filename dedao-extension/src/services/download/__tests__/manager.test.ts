import { DownloadManager } from '../manager.ts';
import { ebookApi } from '../../api/ebook.ts';
import { AESCrypto } from '../../crypto/aes.ts';
import { SvgConverter } from '../../svg/converter.ts';
import { EpubGenerator } from '../../epub/generator.ts';

jest.mock('../../api/ebook');
jest.mock('../../crypto/aes');
jest.mock('../../svg/converter');
jest.mock('../../epub/generator');

describe('DownloadManager', () => {
    let manager: DownloadManager;

    beforeEach(() => {
        manager = new DownloadManager();
        jest.clearAllMocks();
    });

    it('should download and generate epub', async () => {
        // Mock API
        (ebookApi.getReadToken as jest.Mock).mockResolvedValue('mock_token');
        (ebookApi.getEbookDetail as jest.Mock).mockResolvedValue({
            title: 'Test Book',
            book_author: 'Test Author',
            book_intro: 'Description'
        });
        (ebookApi.getBookInfo as jest.Mock).mockResolvedValue({
            title: 'Test Book',
            chapters: [{ id: 'ch1', title: 'Chapter 1' }],
            toc: []
        });
        (ebookApi.getChapterPages as jest.Mock).mockResolvedValue({
            pages: [{ svg: 'encrypted', is_last: true }],
            is_end: true
        });

        // Mock Crypto
        (AESCrypto.decrypt as jest.Mock).mockReturnValue('<svg>...</svg>');

        // Mock Converter
        (SvgConverter.prototype.convert as jest.Mock).mockReturnValue({
            html: '<p>content</p>',
            images: []
        });

        // Mock Generator
        (EpubGenerator.prototype.generate as jest.Mock).mockResolvedValue(new Blob(['epub']));

        const onProgress = jest.fn();
        const result = await manager.startDownload('book1', 'enid1', onProgress);

        expect(result).toBeInstanceOf(Blob);
        expect(ebookApi.getReadToken).toHaveBeenCalledWith('enid1');
        expect(ebookApi.getBookInfo).toHaveBeenCalledWith('mock_token');
        expect(ebookApi.getChapterPages).toHaveBeenCalled();
        expect(AESCrypto.decrypt).toHaveBeenCalledWith('encrypted');
        expect(EpubGenerator.prototype.generate).toHaveBeenCalled();
        expect(onProgress).toHaveBeenCalled();
    });
});
