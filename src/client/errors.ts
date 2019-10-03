/**
 * @module Errors
 */

export enum OpenError {
    AppNotFound = 'AppNotFound',
    ErrorOnLaunch = 'ErrorOnLaunch',
    AppTimeout = 'AppTimeout',
    ResolverUnavailable = 'ResolverUnavailable',
}

export enum ResolveError {
    NoAppsFound = 'NoAppsFound',
    TargetAppNotAvailable = 'TargetAppNotAvailable',
    TargetAppDoesNotHandleIntent = 'TargetAppDoesNotHandleIntent',
    IntentTimeout = 'IntentTimeout',
    ResolverUnavailable = 'ResolverUnavailable',
    ResolverTimeout = 'ResolverTimeout',
    ResolverClosedOrCancelled = 'ResolverClosedOrCancelled',
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
