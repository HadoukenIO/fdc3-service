/**
 * @module Errors
 */

/**
 * Error codes returned by actions involving creating applications.
 */
export enum OpenError {
    /**
     * Indicates that an application cannot be found in the application directory.
     */
    AppNotFound = 'AppNotFound',
    /**
     * Indicates that an application cannot be started from an OpenFin manifest.
     */
    ErrorOnLaunch = 'ErrorOnLaunch',
    /**
     * Indicates that an application was not created in a timely manner, and the provider timed out.
     */
    AppTimeout = 'AppTimeout',
    /**
     * Currently unused.
     */
    ResolverUnavailable = 'ResolverUnavailable',
}

/**
 * Error codes returned after failure to fire intents to applications.
 */
export enum ResolveError {
    /**
     * Indicates that no apps could be found for a particular intent.
     */
    NoAppsFound = 'NoAppsFound',
    /**
     * Indicates that, in the case when a 'target' argument is passed to [[raiseIntent]], no
     * such app either exists in the application directory or is currently running.
     */
    TargetAppNotAvailable = 'TargetAppNotAvailable',
    /**
     * Indicates that, in the case when a 'target' argument is passed to [[raiseIntent]], the app is not able to handle this intent.
     */
    TargetAppDoesNotHandleIntent = 'TargetAppDoesNotHandleIntent',
    /**
     * Indicates that the provider has started an app to receive an intent, and that it has timed out whilst waiting
     * for that app to handle the intent.
     */
    IntentTimeout = 'IntentTimeout',
    /**
     * Currently unused.
     */
    ResolverUnavailable = 'ResolverUnavailable',
    /**
     * Currently unused.
     */
    ResolverTimeout = 'ResolverTimeout',
    /**
     * The intent resolver UI was dismissed by the user, so the intent has been cancelled.
     */
    ResolverClosedOrCancelled = 'ResolverClosedOrCancelled',
}

/**
 * Error codes returned by the context channel system.
 */
export enum ChannelError {
    /**
     * Indicates that [[getChannelById]] has failed because no such channel exists to with the given ID.
     */
    ChannelDoesNotExist = 'ChannelDoesNotExist'
}

/**
 * Error codes returned when attempting to find specific OpenFin windows.
 */
export enum IdentityError {
    /**
     * Indicates that a window with a particular OpenFin Identity cannot be found.
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
