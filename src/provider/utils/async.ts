/**
 * Creates a deferred promise and returns it along with handlers to resolve/reject it imperatively
 * @returns a tuple with the promise and its resolve/reject handlers
 */
export function deferredPromise<T = void>(): [Promise<T>, (value?: T) => void, (reason?: any) => void] {
    let res: (value?: T) => void;
    let rej: (reason?: any) => void;
    const p = new Promise<T>((r, rj) => {
        res = r;
        rej = rj;
    });
    return [p, res!, rej!];
}

type PromiseResolution<T> = (T | PromiseLike<T> | undefined);
type ResolveFunction<T> = (value?: PromiseResolution<T>) => void;
type RejectFunction = (reason?: any) => void;
type PromiseFunctionPair<T> = (resolve: ResolveFunction<T>, reject: RejectFunction) => void

/**
 * Similar to creating a promise with `new Promise()`, but takes an additional fuction, taking a second
 * resolve/reject pair, that will be called when the specified timeout expires
 * @param func The function to be called immediately with the resolve/reject pair of the new Promise
 * @param timeout The function to be called after the timeout with the resolve/reject pair of the new Promise
 * @param duration The duration of the timeout
 */
export function withTimeout<T>(func: PromiseFunctionPair<T>, timeout: PromiseFunctionPair<T>, duration: number): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
        func(resolve, reject);

        setTimeout(() => {
            timeout(resolve, reject);
        }, duration);
    });
}
