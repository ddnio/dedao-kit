export const TaskStatus = {
    PENDING: 'pending',
    FETCHING_METADATA: 'fetching_metadata',
    DOWNLOADING_CHAPTERS: 'downloading_chapters',
    GENERATING_EPUB: 'generating_epub',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export interface ProgressInfo {
    current: number;
    total: number;
    message: string;
    percentage: number;
}

export interface TaskError {
    code: string;
    message: string;
    timestamp: number;
}

export interface DownloadTask {
    bookId: string;
    enid: string;
    status: TaskStatus;
    progress: ProgressInfo;
    error?: TaskError;
    startTime: number;
    endTime?: number;
}
