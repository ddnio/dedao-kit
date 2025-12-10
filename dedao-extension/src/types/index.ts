// Global types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export interface KeyValuePair<T = any> {
    [key: string]: T;
}
