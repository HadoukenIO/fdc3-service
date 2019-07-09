/**
 * @module Errors
 */

/**
  * Error codes returned by actions involving creating applications.
  */
export enum OpenError {
    /**
     * Indicates that an application is unable to be found in the AppDir.
     */
    AppNotFound = 'AppNotFound',
    /**
     * Indicates that an application cannot be started from an OF manifest.
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
 * Error codes returned by attempts firing intents to applications.
 */
export enum ResolveError {
    /**
     * Indicates that no apps could be found for a particular intent.
     */
    NoAppsFound = 'NoAppsFound',
    /**
     * Indicates that, in the case when a 'target' argument is passed to [[raiseIntent]], no such app either exists in the AppDir or is currently running.
     */
    TargetAppNotAvailable = 'TargetAppNotAvailable',
    /**
     * Indicates that, in the case when a 'target' argument is passed to [[raiseIntent]], the app is not able to handle this intent.
     */
    TargetAppDoesNotHandleIntent = 'TargetAppDoesNotHandleIntent',
    /**
     * Indicates that the provider has started an app to receive an intent, and that it has timed out waiting that app.
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
     * Indicates that [[getChannelById]] has failed because no such channel exists to broadcast on.
     */
    ChannelDoesNotExist = 'ChannelDoesNotExist'
}

/**
 * Error codes returned when attempting to find specific OF windows.
 */
export enum IdentityError {
    /**
     * Indicates that a window with a particular OF Identity cannot be found.
     */
    WindowWithIdentityNotFound = 'WindowWithIdentityNotFound'
}

/**
 * Class used to hold errors returned by the FDC3 provider.
 */
export class FDC3Error extends Error {
    /**
     * A string from one of [[OpenError]], [[ResolveError]], [[ChannelError]] or [[IdentityError]].
     */
    public code: string;
    public constructor(code: string, message: string) {
        super(message);
        this.name = 'FDC3Error';
        this.code = code;
    }
}
