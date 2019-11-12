/**
 * @module Errors
 */

/**
 * Error codes specific to the [[open]] function.
 */
export enum OpenError {
    /**
     * Indicates that the an application of the provided name cannot be found in the application directory.
     */
    AppNotFound = 'AppNotFound',

    /**
     * In the case where the optional `context` argument is provided, indicates that the provided application was started, but threw an
     * error when attempting to handle the provided context.
     */
    SendContextError = 'SendContextError',

    /**
     * In the case where the optional `context` argument is provided, indicates that the given application was started, but a timeout was
     * reached waiting for it to handle the provided context.
     */
    SendContextTimeout = 'SendContextTimeout',

    /**
     * In the case where the optional `context` argument is provided, indicates that the given application was started, but did not add a
     * context handler.
     */
    SendContextNoHandler = 'SendContextNoHandler'
}

/**
 * Error codes specific to the [[raiseIntent]] function.
 */
export enum RaiseIntentError {
    /**
     * Indicates that no apps could be found to handle the provided intent and context.
     */
    NoAppsFound = 'NoAppsFound',
    /**
     * In the case when a the optional 'target' argument is provided, no such app either exists in the application directory or is
     * currently running.
     */
    TargetAppNotAvailable = 'TargetAppNotAvailable',
    /**
     * In the case when a the optional 'target' argument is provided, indicates that the app is not able to handle this intent and context.
     */
    TargetAppDoesNotHandleIntent = 'TargetAppDoesNotHandleIntent',
    /**
     * The intent resolver UI was dismissed by the user, so the intent has been cancelled.
     */
    ResolverClosedOrCancelled = 'ResolverClosedOrCancelled',
    /**
     * Indicates that an application was started, but threw an error when attempting to handle the provided intent and context.
     */
    SendIntentError = 'SendIntentError',
    /**
     * Indicates that an application was started, but a timeout was reached waiting for it to handle the provided intent and context.
     */
    SendIntentTimeout = 'SendIntentTimeout',
    /**
     * Indicates that an application was started, but did not add a handler for the provided intent.
     */
    SendIntentNoHandler = 'SendIntentNoHandler'
}

/**
 * Error codes relating to launching applications.
 */
export enum ApplicationError {
    /**
     * Indicates that an application cannot be started from an OpenFin manifest.
     */
    ErrorOnLaunch = 'ErrorOnLaunch',
    /**
     * Indicates that an application was not created in a timely manner, and the provider timed out.
     */
    AppTimeout = 'AppTimeout'
}

/**
 * Error codes relating to the context channel system.
 */
export enum ChannelError {
    /**
     * Indicates that a channel of a provided ID does not exist.
     */
    ChannelWithIdDoesNotExist = 'ChannelWithIdDoesNotExist'
}

/**
 * Error codes relating to OpenFin windows.
 */
export enum IdentityError {
    /**
     * Indicates that a window with a provided OpenFin Identity cannot be found.
     */
    WindowWithIdentityNotFound = 'WindowWithIdentityNotFound'
}

/**
 * Class used to hold errors returned by the FDC3 provider. Inherits from the built-in
 * [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) type.
 *
 * Note that not all errors raised by the service will be of type `FDC3Error`. Standard JavaScript error types such as
 * `TypeError` and `Error` can also be thrown by the API.
 */
export class FDC3Error extends Error {
    /**
     * A string from one of [[OpenError]], [[ResolveError]], [[ChannelError]] or [[IdentityError]].
     *
     * Future versions of the service may add additional error codes. Applications should allow for the possibility of
     * error codes that do not exist in the above enumerations.
     */
    public code: string;

    /**
     * Always `'FDC3Error'`.
     */
    public name: string;

    /**
     * Description of the error that occurred.
     *
     * These messages are not intended to be user-friendly, we do not advise displaying them to end users. If
     * error-specific user messaging is required, use [[code]] to determine what message should be displayed.
     */
    public message!: string;

    public constructor(code: string, message: string) {
        super(message);
        this.name = 'FDC3Error';
        this.code = code;
    }
}
