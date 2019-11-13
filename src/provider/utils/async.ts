import {Signal} from 'openfin-service-signal';

import {DeferredPromise} from '../common/DeferredPromise';

/**
 * Races a given promise against a timeout, and resolves to a `[didTimeout, value?]` tuple indicating
 * whether the timeout occurred, and the value the promise resolved to (if timeout didn't occur)
 * @param timeoutMs Timeout period in ms
 * @param promise Promise to race against the timeout
 */
export function withTimeout<T>(timeoutMs: number, promise: Promise<T>): Promise<[boolean, T | undefined]> {
    const timeout = new Promise<[boolean, undefined]>((res) => setTimeout(() => res([true, undefined]), timeoutMs));
    const p = promise.then((value) => ([false, value] as [boolean, T]));
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
    return allowReject(Promise.race([timeout, promise]));
}

/**
 * Returns a promise that resolves when the given predicate is true, evaluated immediately and each time the provided signal is fired
 *
 * @param signal When this signal is fired, the predicate is revaluated
 * @param predicate The predicate to evaluate
 * @param guard A promise. If this rejects, give up listening to the signal and reject
 */
// eslint-disable-next-line
export function untilTrue<A extends any[]>(signal: Signal<A>, predicate: () => boolean, guard?: Promise<void>): Promise<void> {
    if (predicate()) {
        return Promise.resolve();
    }

    return untilSignal(signal, predicate, guard);
}

/**
 * Returns a promise that resolves when the given signal is fired, and the given predicate evaluates to true when passed the arguments
 * recevied from the signal
 *
 * @param signal The signal to listen to
 * @param predicate The predicate to evaluate against arguments received from the signal
 * @param guard A promise. If this rejects, give up listening to the signal and reject
 */
// eslint-disable-next-line
export function untilSignal<A extends any[]>(signal: Signal<A>, predicate: (...args: A) => boolean, guard?: Promise<void>): Promise<void> {
    const promise = new DeferredPromise();
    const slot = signal.add((...args: A) => {
        if (predicate(...args)) {
            slot.remove();
            promise.resolve();
        }
    });

    if (guard) {
        guard.catch((e) => {
            slot.remove();
            promise.reject(e);
        });
    }

    return allowReject(promise.promise);
}

/**
 * Attaches an empty `catch` block to a promise, then returns the original promise. This prevents rejection of the promise being logged as
 * a warning during tests, but does not otherwise change behaviour should the promise reject. This should be called for promises we expect
 * to reject under normal circumstances, but would not otherwise have a `catch` block attached
 *
 * @param promise The promise to attach the catch block to
 */
export function allowReject<T>(promise: Promise<T>): Promise<T> {
    promise.catch(() => {});
    return promise;
}

/**
 * Race `items` until one matches the `predicate` given or return undefined if all fail to pass.
 * An error is thrown if all `items` throw exceptions or reject.
 * @param items Promises or values to test against the `predicate`
 * @param predicate Test against `items`
 */
export async function raceUntilTrue<T>(items: T[], predicate: (v?: T) => boolean): Promise<T | undefined> {
    let promisesCompleted: number = 0;
    let errors: number = 0;
    const valueFound = new DeferredPromise<T | undefined>();

    const handleResolve = async (value?: T): Promise<void> => {
        if (predicate(value)) {
            valueFound.resolve(value);
        }
    };

    const handleReject = (): void => {
        errors++;
    };

    const completeCheck = async (): Promise<void> => {
        promisesCompleted++;
        if (items.length === promisesCompleted) {
            if (items.length === errors && items.length !== 0) {
                throw new Error('All promises rejected');
            } else {
                valueFound.resolve(undefined);
            }
        }
        await valueFound.promise;
    };

    // Wrap `item` incase it is not a Promise
    const racePromises: Promise<T | void>[] = items.map(async (item) => {
        return Promise.resolve(item)
            .then(handleResolve, handleReject)
            .then(completeCheck);
    });
    racePromises.push(valueFound.promise);

    await Promise.race(racePromises);
    return valueFound.promise;
}

export async function asyncFilter<T>(arr: T[], callback: (x: T) => Promise<boolean>): Promise<T[]> {
    const result: T[] = [];

    for (const i of arr) {
        if (await callback(i)) {
            result.push(i);
        }
    }

    return result;
}

export async function asyncMap<T, U>(arr: T[], callback: (x: T, i: number, r: T[]) => Promise<U>): Promise<U[]>;
export async function asyncMap<T, U>(arr: T[], callback: (x: T, i: number) => Promise<U>): Promise<U[]>;
export async function asyncMap<T, U>(arr: T[], callback: (x: T) => Promise<U>): Promise<U[]>;
export async function asyncMap<T, U>(arr: T[], callback: () => Promise<U>): Promise<U[]>;
export async function asyncMap<T, U>(arr: T[], callback: (...args: any[]) => any): Promise<U[]> {
    return Promise.all<U>(arr.map(callback));
}
