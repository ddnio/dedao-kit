import { HttpClient } from '../http.ts';
import { NetworkError, TimeoutError, UnauthorizedError } from '../../../utils/errors.ts';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('HttpClient', () => {
    let client: HttpClient;

    beforeEach(() => {
        client = new HttpClient();
        mockFetch.mockClear();
    });

    it('should perform GET request successfully', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: 'test' }),
        });

        const result = await client.get('http://test.com');
        expect(result).toEqual({ data: 'test' });
        expect(mockFetch).toHaveBeenCalledWith('http://test.com', expect.objectContaining({ method: 'GET' }));
    });

    it('should retry on failure', async () => {
        // Fail twice, succeed third time
        mockFetch
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

        const result = await client.get('http://test.com', { retries: 2, retryDelay: 10 });
        expect(result).toEqual({ success: true });
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw UnauthorizedError on 401', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
        });

        await expect(client.get('http://test.com')).rejects.toThrow(UnauthorizedError);
        expect(mockFetch).toHaveBeenCalledTimes(1); // Should not retry 401
    });

    it('should throw NetworkError after retries exhausted', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        await expect(client.get('http://test.com', { retries: 1, retryDelay: 10 }))
            .rejects.toThrow();
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
