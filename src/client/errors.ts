export enum OpenError {
    AppNotFound = 'AppNotFound',
    ErrorOnLaunch = 'ErrorOnLaunch',
    AppTimeout = 'AppTimeout',
    ResolverUnavailable = 'ResolverUnavailable',
    InvalidContext = 'InvalidContext'
}

export enum ResolveError {
    NoAppsFound = 'NoAppsFound',
    TargetAppNotAvailable = 'TargetAppNotAvailable',
    TargetAppDoesNotHandleIntent = 'TargetAppDoesNotHandleIntent',
    IntentTimeout = 'IntentTimeout',
    ResolverUnavailable = 'ResolverUnavailable',
    ResolverTimeout = 'ResolverTimeout',
    ResolverClosedOrCancelled = 'ResolverClosedOrCancelled',
    InvalidContext = 'InvalidContext'
}

export enum ChannelError {
    ChannelDoesNotExist = 'ChannelDoesNotExist'
}

export enum IdentityError {
    WindowWithIdentityNotFound = 'WindowWithIdentityNotFound'
}

export class FDC3Error extends Error {
    public code: string;
    public constructor(code: string, message: string) {
        super(message);
        this.name = 'FDC3Error';
        this.code = code;
    }
}

/**
 * If error is a type we explicitly handle (e.g., `TypeError`, `FDC3Error`) so it can be identified as the correct type at the client's end
 * Otherwise return the error itself
 * @param error The error
 */
export function serializeError(error: Error | FDC3Error): Error {
    if (error.name === 'FDC3Error') {
        return new Error(JSON.stringify({
            name: 'FDC3Error',
            code: (error as FDC3Error).code,
            message: error.message
        }));
    } else if (error.name === 'TypeError') {
        return new Error(JSON.stringify({
            name: 'TypeError',
            message: error.message
        }));
    }

    return error;
}

/**
 * Check if the error was a serialized error, and if so reconstruct as the correct type
 * Otherwise return the error itself
 * @param error The error
 */
export function deserializeError(error: Error): Error | FDC3Error {
    try {
        const errorData = JSON.parse(error.message);
        if (errorData && errorData.name) {
            if (errorData.name === 'FDC3Error') {
                return new FDC3Error(errorData.code, errorData.message);
            } else if (errorData.name === 'TypeError') {
                return new TypeError(errorData.message);
            }
        }
    } catch (e) {
        // Payload wasn't a serialized JSON object
    }

    return error;
}

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
 * Timeouts, in milliseconds, for the different FDC3 actions
 */
export const Timeouts = {
    /**
     * Time for an app to register a listener after opening
     */
    ADD_INTENT_LISTENER: 5000,
    /**
     * Time for an OpenFin app to start by calling `fin.Application.startFromManifest`
     */
    APP_START_FROM_MANIFEST: 30000
};
