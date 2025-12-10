import { EbookAPI } from '../ebook.ts';
import { httpClient } from '../http.ts';

jest.mock('../http');

describe('EbookAPI', () => {
    let api: EbookAPI;

    beforeEach(() => {
        api = new EbookAPI();
        (httpClient.post as jest.Mock).mockClear();
        (httpClient.get as jest.Mock).mockClear();
    });

    it('should get read token', async () => {
        (httpClient.post as jest.Mock).mockResolvedValue({
            h: { c: 0 },
            c: { token: 'mock_token' }
        });

        const token = await api.getReadToken('book_123');
        expect(token).toBe('mock_token');
        expect(httpClient.post).toHaveBeenCalledWith(
            expect.stringContaining('/token'),
            { id: 'book_123' }
        );
    });

    it('should get book info', async () => {
        (httpClient.get as jest.Mock).mockResolvedValue({
            h: { c: 0 },
            c: {
                bookInfo: {
                    title: 'Test Book',
                    orders: [],
                    toc: []
                }
            }
        });

        const info = await api.getBookInfo('mock_token');
        expect(info.title).toBe('Test Book');
        expect(httpClient.get).toHaveBeenCalledWith(
            expect.stringContaining('token=mock_token')
        );
    });
});
