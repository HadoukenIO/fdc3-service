export enum OpenError {
    AppNotFound = 'AppNotFound',
    ErrorOnLaunch = 'ErrorOnLaunch',
    AppTimeout = 'AppTimeout',
    ResolverUnavailable = 'ResolverUnavailable',
    InvalidContext = 'InvalidContext'
}

export enum ResolveError {
    NoAppsFound = 'NoAppsFound',
    ResolverUnavailable = 'ResolverUnavailable',
    ResolverTimeout = 'ResolverTimeout',
    InvalidContext = 'InvalidContext'
}

export class FDC3Error extends Error {
    /**
     * If error is FDC3 specific, serialize it as { code, message } so it can be identified as an `FDC3Error` at the client's end.
     * Otherwise return the error itself
     * @param error The error
     */
    public static serialize(error: Error | FDC3Error): Error {
        // TODO: is use of `instanceof` OK? or should use `if (error && error.code && error.message)` ?
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
