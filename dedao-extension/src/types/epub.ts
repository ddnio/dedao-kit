export interface EpubResource {
    id: string;
    href: string;
    mediaType: string;
    content: Blob | string | ArrayBuffer;
}

export interface ManifestItem {
    id: string;
    href: string;
    mediaType: string;
    properties?: string;
}

export interface SpineItem {
    idref: string;
    linear?: 'yes' | 'no';
}

export interface NavPoint {
    id: string;
    playOrder: number;
    label: string;
    contentSrc: string;
    children?: NavPoint[];
}

export interface EpubPackage {
    metadata: {
        title: string;
        creator: string;
        language: string;
        identifier: string;
        description?: string;
        coverId?: string;
    };
    manifest: ManifestItem[];
    spine: SpineItem[];
    resources: EpubResource[];
    toc: NavPoint[];
}
