import { NetworkError, TimeoutError, UnauthorizedError } from '../../utils/errors.ts';
import { logger } from '../../utils/logger.ts';

interface RequestOptions extends RequestInit {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
}

export class HttpClient {
    private static readonly DEFAULT_TIMEOUT = 30000;
    private static readonly DEFAULT_RETRIES = 3;
    private static readonly RETRY_DELAY = 1000;

    async get<T>(url: string, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(url, { ...options, method: 'GET' });
    }

    async post<T>(url: string, body?: any, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(url, {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    private async request<T>(url: string, options: RequestOptions): Promise<T> {
        const {
            timeout = HttpClient.DEFAULT_TIMEOUT,
            retries = HttpClient.DEFAULT_RETRIES,
            retryDelay = HttpClient.RETRY_DELAY,
            ...fetchOptions
        } = options;

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (attempt > 0) {
                    await this.delay(retryDelay * Math.pow(2, attempt - 1)); // Exponential backoff
                    logger.warn(`Retrying request to ${url} (Attempt ${attempt + 1}/${retries + 1})`);
                }

                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal,
                });

                clearTimeout(id);

                if (!response.ok) {
                    if (response.status === 401) throw new UnauthorizedError();
                    if (response.status === 403) throw new Error('Forbidden');
                    throw new NetworkError(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            } catch (error: any) {
                lastError = error;
                if (error.name === 'AbortError') {
                    lastError = new TimeoutError(`Request to ${url} timed out after ${timeout}ms`);
                } else if (error instanceof UnauthorizedError) {
                    throw error; // Don't retry auth errors
                }
                
                logger.error(`Request to ${url} failed: ${error.message}`);
                
                // Don't retry on the last attempt
                if (attempt === retries) break;
            }
        }

        throw lastError || new NetworkError('Request failed after retries');
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const httpClient = new HttpClient();
