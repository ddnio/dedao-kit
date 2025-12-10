import { httpClient } from './http.ts';
import { EbookMetadata } from '../../types/ebook.ts';
import { TokenResponse, BookInfoResponse, ApiResponse, ChapterPagesResponse } from '../../types/api.ts';
import { logger } from '../../utils/logger.ts';

export class EbookAPI {
    private static readonly BASE_URL = 'https://www.dedao.cn';

    async getEbookDetail(enid: string): Promise<any> {
        const url = `${EbookAPI.BASE_URL}/pc/ebook2/v1/pc/detail?id=${enid}`;
        logger.debug(`Fetching ebook detail for: ${enid}`);

        const response = await httpClient.get<ApiResponse<any>>(url);

        if (response.h?.c !== 0 || !response.c) {
            const errorMsg = response.h?.e || JSON.stringify(response);
            throw new Error(`Failed to get ebook detail: ${errorMsg}`);
        }

        return response.c;
    }

    async getReadToken(enid: string): Promise<string> {
        const url = `${EbookAPI.BASE_URL}/api/pc/ebook2/v1/pc/read/token`;
        logger.debug(`Fetching read token for book: ${enid}`);
        
        const response = await httpClient.post<ApiResponse<TokenResponse>>(url, {
            id: enid
        });

        // Use new structure: h.c is code
        if (response.h?.c !== 0 || !response.c?.token) {
            const errorMsg = response.h?.e || JSON.stringify(response);
            throw new Error(`Failed to get read token: ${errorMsg}`);
        }

        return response.c.token;
    }

    async getBookInfo(token: string): Promise<EbookMetadata> {
        const url = `${EbookAPI.BASE_URL}/ebk_web/v1/get_book_info?token=${token}`;
        logger.debug('Fetching book info');

        const response = await httpClient.get<ApiResponse<{ bookInfo: BookInfoResponse }>>(url);

        if (response.h?.c !== 0 || !response.c?.bookInfo) {
            const errorMsg = response.h?.e || JSON.stringify(response);
            throw new Error(`Failed to get book info: ${errorMsg}`);
        }

        const info = response.c.bookInfo;
        
        // Transform API response to our internal model
        return {
            id: '', 
            enid: '', 
            title: info.title,
            author: info.author,
            description: info.intro,
            coverUrl: info.cover,
            chapters: (info.orders || []).map((order: any) => ({
                id: order.chapterId,
                title: order.text,
                level: order.level,
                parentId: order.parentId,
                orderIndex: 0,
                content: []
            })),
            toc: (info.toc || []).map((item: any) => ({
                href: item.href || '',
                level: item.level,
                text: item.text,
                playOrder: item.playOrder,
                id: ''
            }))
        };
    }

    async getChapterPages(
        chapterId: string, 
        token: string, 
        index: number
    ): Promise<ChapterPagesResponse> {
        const url = `${EbookAPI.BASE_URL}/ebk_web_go/v2/get_pages`;
        
        const config = {
            "density": 2,
            "direction": 0,
            "font_name": "pingfang",
            "font_scale": 1,
            "font_size": 16,
            "height": 200000,
            "line_height": "2em",
            "margin_bottom": 20,
            "margin_left": 20,
            "margin_right": 20,
            "margin_top": 0,
            "paragraph_space": "1em",
            "platform": 1,
            "width": 60000
        };

        const response = await httpClient.post<ApiResponse<ChapterPagesResponse>>(url, {
            chapter_id: chapterId,
            token: token,
            index: index,
            count: 20,
            offset: 0,
            orientation: 0,
            config: config
        });

        if (response.h?.c !== 0) {
            const errorMsg = response.h?.e || JSON.stringify(response);
            throw new Error(`Failed to get chapter pages: ${errorMsg}`);
        }

        return response.c;
    }
}

export const ebookApi = new EbookAPI();