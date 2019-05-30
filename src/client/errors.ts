export enum OpenError {
    AppNotFound = 'AppNotFound',
    ErrorOnLaunch = 'ErrorOnLaunch',
    AppTimeout = 'AppTimeout',
    ResolverUnavailable = 'ResolverUnavailable',
    InvalidContext = 'InvalidContext'
}

export enum ResolveError {
    NoAppsFound = 'NoAppsFound',
    TargetAppNotInDirectory = 'TargetAppNotInDirectory',
    TargetAppDoesNotHandleIntent = 'TargetAppDoesNotHandleIntent',
    IntentTimeout = 'IntentTimeout',
    ResolverUnavailable = 'ResolverUnavailable',
    ResolverTimeout = 'ResolverTimeout',
    ResolverClosedOrCancelled = 'ResolverClosedOrCancelled',
    InvalidContext = 'InvalidContext'
}

export enum ChannelError {
    // When getChannel / joinChannel on a non existing channel id
    ChannelDoesNotExist = 'ChannelDoesNotExist',
    // When trying to create a channel that already exists
    ChannelAlreadyExists = 'ChannelAlreadyExists'
}

export class FDC3Error extends Error {
    /**
     * If error is FDC3 specific, serialize it as { code, message } so it can be identified as an `FDC3Error` at the client's end.
     * Otherwise return the error itself
     * @param error The error
     */
    public static serialize(error: Error | FDC3Error): Error {
        if (error instanceof FDC3Error) {
            return new Error(JSON.stringify({
                code: error.code,
                message: error.message
            }));
        }

        return error;
    }

    /**
     * Check if the error was a serialized FDC3 error, and if so reconstruct as a typed FDC3Error
     * Otherwise return the error itself
     * @param error The error
     */
    public static deserialize(error: Error): Error | FDC3Error {
        try {
            const fdc3Error = JSON.parse(error.message);
            if (fdc3Error && fdc3Error.code && fdc3Error.message) {
                return new FDC3Error(fdc3Error.code, fdc3Error.message);
            }
        } catch (e) {
            // Payload wasn't a serialized JSON object
        }

        return error;
    }

    public code: string;
    public constructor(code: string, message: string) {
        super(message);
        this.name = 'FDC3Error';
        this.code = code;
    }
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
