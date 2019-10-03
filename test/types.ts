export type Writable<T> = {
    -readonly [K in keyof T]: T[K]
}

export type PartiallyWritable<T, P extends keyof T> = Writable<Pick<T, P>> & Omit<T, P>;
