// The root response structure wrapper used by Dedao
export interface ApiResponse<T> {
    h: {
        c: number; // code, 0 is success
        e: string; // error message
        s: number; // timestamp?
        t: number;
    };
    c: T; // content/data
}

// Token response data inside 'c'
export interface TokenResponse {
    token: string;
}

// Book info response data inside 'c'
export interface BookInfoResponse {
    title: string;
    author: string;
    intro: string;
    cover: string;
    orders: any[];
    toc: any[];
}

// Chapter page (inside pages array)
export interface ChapterPage {
    svg: string; // Base64 encrypted SVG
    is_first: boolean;
    is_last: boolean;
    begin_offset: number;
    end_offset: number;
}

// Chapter pages response data inside 'c'
export interface ChapterPagesResponse {
    pages: ChapterPage[];
    is_end: boolean;
}
