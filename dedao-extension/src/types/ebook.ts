export interface SvgPage {
    encryptedSvg: string;
    decryptedHtml?: string;
    pageIndex: number;
    isLastPage: boolean;
}

export interface Chapter {
    id: string;
    orderIndex: number;
    title: string;
    content: SvgPage[];
    level: number;
    parentId?: string;
}

export interface TableOfContent {
    href: string;
    level: number;
    text: string;
    playOrder: number;
    id: string; // usually generated or from source
}

export interface EbookMetadata {
    id: string;
    enid: string;
    title: string;
    author: string;
    description: string;
    coverUrl: string;
    chapters: Chapter[];
    toc: TableOfContent[];
}
