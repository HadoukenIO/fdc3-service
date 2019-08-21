import {Signal} from 'openfin-service-signal';

import {DeferredPromise} from '../common/DeferredPromise';

/**
 * Races a given promise against a timeout, and resolves to a `[didTimeout, value?]` tuple indicating
 * whether the timeout occurred, and the value the promise resolved to (if timeout didn't occur)
 * @param timeoutMs Timeout period in ms
 * @param promise Promise to race against the timeout
 */
export function withTimeout<T>(timeoutMs: number, promise: Promise<T>): Promise<[boolean, T | undefined]> {
    const timeout = new Promise<[boolean, undefined]>(res => setTimeout(() => res([true, undefined]), timeoutMs));
    const p = promise.then(value => ([false, value] as [boolean, T]));
    return Promise.race([timeout, p]);
}

/**
 * Races a given promise against a timeout, and either resolves to the value the the promise resolved it, if it resolved before the
 * timeout, or rejects
 * @param timeoutMs Timeout period in ms
 * @param promise Promise to race against the timeout
 */
export function withStrictTimeout<T>(timeoutMs: number, promise: Promise<T>, rejectMessage: string): Promise<T> {
    const timeout = new Promise<T>((res, rej) => setTimeout(() => rej(new Error(rejectMessage)), timeoutMs));
    return Promise.race([timeout, promise]);
}

/**
 * Returns a promise that resolves when the give predicate is true, evaluated immediately and each time the provided signal is fired
 *
 * @param predicate The predicate to evaluate. Provided either zero parameters, or an array of the parameters emitted by the signal
 * @param signal When this signal is fired, the predicate is revaluated
 */
export function untilTrue<A extends any[], T extends Signal<A>>(predicate: (args?: A) => boolean, signal: T): Promise<void> {
    if (predicate()) {
        return Promise.resolve();
    }

    const promise = new DeferredPromise();
    const slot = signal.add((...args: A) => {
        if (predicate(args)) {
            slot.remove();
            promise.resolve();
        }
    });

    return promise.promise;
}

