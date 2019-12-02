/**
 * @module Index
 */

/**
 * Main entry point
 */
import {tryServiceDispatch, getServicePromise, getEventRouter, eventEmitter} from './connection';
import {Context} from './context';
import {Application, AppName} from './directory';
import {APIFromClientTopic, APIToClientTopic, RaiseIntentPayload, ReceiveContextPayload, MainEvents, Events, invokeListeners, APP_DIRECTORY_STORAGE_TAG} from './internal';
import {ChannelChangedEvent, getChannelObject, ChannelContextListener} from './contextChannels';
import {parseContext, validateEnvironment, parseAppDirectoryData, parseInteger} from './validation';
import {Transport, Targeted} from './EventRouter';

// TODO: Remove once Storage API is in published runtime and types are updated [SERVICE-840]
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace fin {
    const Storage: any;
}

/**
 * This file was copied from the FDC3 v1 specification.
 *
 * Original file: https://github.com/FDC3/FDC3/blob/master/src/api/interface.ts
 */

// Re-export context channel API at top-level
export * from './contextChannels';

// Re-export types/enums at top-level
export * from './context';
export * from './directory';
export * from './intents';
export * from './errors';

/**
 * Describes an intent.
 */
export interface IntentMetadata {
    /**
     * The machine readable name of the intent.
     */
    name: string;
    /**
     * The human-readable name of the intent.
     */
    displayName: string;
}

/**
 * An interface that relates an intent to apps. This is returned by [[findIntent]] and [[findIntentsByContext]], which gives
 * you a set of apps that can execute a particular intent.
 */
export interface AppIntent {
    /**
     * Descriptor of this intent.
     */
    intent: IntentMetadata;
    /**
     * An array of applications that are associated with this intent.
     */
    apps: Application[];
}

/**
 * Provides a standard format for data returned upon resolving an intent.
 *
 * ```javascript
 * // You might fire and forget an intent
 * await agent.raiseIntent("intentName", context);
 *
 * // Or you might want some data to come back
 * const result = await agent.raiseIntent("intentName", context);
 * const data = result.data;
 * ```
 */
export interface IntentResolution {
    /**
     * The machine-readable name of the app that resolved this intent.
     */
    source: AppName;
    /**
     * Any data returned by the target application's intent listener.
     *
     * If the target application registered multiple listeners, this will be the first non-`undefined` value returned
     * by a listener.
     */
    data?: unknown;
    /**
     * For future use. Right now always the string `'1.0.0'`.
     */
    version: string;
}

/**
 * Listener type alias, generic type that can be used to refer any context or intent listener.
 */
export type Listener = ContextListener | IntentListener | ChannelContextListener;

/**
 * Listener for context broadcasts. Generated by [[addContextListener]].
 */
export interface ContextListener {
    /**
     * The handler for when this listener receives a context broadcast.
     */
    handler: (context: Context) => void;
    /**
     * Unsubscribe the listener object. We will no longer receive context messages on this handler.
     *
     * Calling this method has no effect if the listener has already been unsubscribed. To re-subscribe, call
     * [[addContextListener]] again to create a new listener object.
     */
    unsubscribe: () => void;
}

/**
 * Listener for intent sending. Generated by [[addIntentListener]].
 */
export interface IntentListener {
    /**
     * The intent name that we are listening to. Is whatever is passed into [[addIntentListener]].
     */
    intent: string;
    /**
     * The handler for when this listener receives an intent.
     */
    handler: (context: Context) => unknown | Promise<unknown>;
    /**
     * Unsubscribe the listener object. We will no longer receive intent messages on this handler.
     *
     * Calling this method has no effect if the listener has already been unsubscribed. To re-subscribe, call
     * [[addIntentListener]] again to create a new listener object.
     */
    unsubscribe: () => void;
}

const intentListeners: IntentListener[] = [];
const contextListeners: ContextListener[] = [];

/**
 * A desktop agent is a desktop component (or aggregate of components) that serves as a
 * launcher and message router (broker) for applications in its domain.
 *
 * A desktop agent can be connected to one or more App Directories and will use directories for application
 * identity and discovery. Typically, a desktop agent will contain the proprietary logic of
 * a given platform, handling functionality like explicit application interop workflows where
 * security, consistency, and implementation requirements are proprietary.
 */

/**
 * Launches/links to an app by name. The application will be started if it is not already running.
 *
 * If a [[Context]] object is passed in, this object will be provided to the opened application via a [[ContextListener]].
 *
 * If opening errors, it returns an [[FDC3Error]] with a string from the [[ApplicationError]] export enumeration.
 *
 *  ```javascript
 *     // No context
 *     agent.open('myApp');
 *     // With context
 *     agent.open('myApp', context);
 * ```
 * @param name The [[AppName]] to launch.
 * @param context A context to pass to the app post-launch.
 * @throws [[FDC3Error]] with an [[ApplicationError]] code.
 * @throws If `context` is passed, [[FDC3Error]] with a [[SendContextError]] code.
 * @throws If `context` is passed, `TypeError` if `context` is not a valid [[Context]].
 */
export async function open(name: AppName, context?: Context): Promise<void> {
    return tryServiceDispatch(APIFromClientTopic.OPEN, {name, context: context && parseContext(context)});
}

/**
 * Find out more information about a particular intent by passing its name, and optionally its context.
 *
 * `findIntent` is effectively granting programmatic access to the desktop agent's resolver.
 * A promise resolving to the intent, its metadata and metadata about the apps registered to handle it is returned.
 * This can be used to raise the intent against a specific app.
 *
 * For example, I know `'StartChat'` exists as a concept, and want to know more about it.
 * ```javascript
 * const appIntent = await agent.findIntent("StartChat");
 * ```
 *
 * This returns a single [[AppIntent]] (some fields omitted for brevity, see [[Application]] for full list of `apps` fields):
 * ```ts
 * {
 *      intent: { name: "StartChat", displayName: "Chat" },
 *      apps: [{ name: "Skype" }, { name: "Symphony" }, { name: "Slack" }]
 * }
 * ```
 *
 * We can then raise the intent against a particular app
 * ```javascript
 * await agent.raiseIntent(appIntent.intent.name, context, appIntent.apps[0].name);
 * ```
 * @param intent The intent name to find.
 * @param context An optional context to send to find the intent.
 * @throws If `context` is passed, an [[FDC3Error]] with a [[SendContextError]] code.
 * @throws If `context` is passed, `TypeError` if `context` is not a valid [[Context]].
 */
export async function findIntent(intent: string, context?: Context): Promise<AppIntent> {
    return tryServiceDispatch(APIFromClientTopic.FIND_INTENT, {intent, context: context && parseContext(context)});
}

/**
 * Find all the available intents for a particular context.
 *
 * `findIntentsByContext` is effectively granting programmatic access to the desktop agent's resolver.
 * A promise resolving to all the intents, their metadata and metadata about the apps registered to handle it is
 * returned, based on the context export types the intents have registered.
 *
 * An empty array will be returned if there are no available intents for the given context.
 *
 * For example, I have a context object and I want to know what I can do with it, so I look for intents...
 * ```javascript
 * const appIntents = await agent.findIntentsByContext(context);
 * ```
 * This returns an array of [[AppIntent]] objects such as the following (some fields omitted for brevity, see
 * [[Application]] for full list of `apps` fields):
 * ```ts
 * [
 *    {
 *       intent: { name: "StartCall", displayName: "Call" },
 *       apps: [{ name: "Skype" }]
 *   },
 *   {
 *       intent: { name: "StartChat", displayName: "Chat" },
 *       apps: [{ name: "Skype" }, { name: "Symphony" }, { name: "Slack" }]
 *   }
 * ]
 * ```
 *
 * We could now use this by taking one of the intents, and raising it.
 *```javascript
 * // Select a particular intent to raise
 * const selectedIntent = appIntents[1];
 *
 * // Raise the intent, passing the given context, letting the user select which app to use
 * await agent.raiseIntent(selectedIntent.intent.name, context);
 *
 * // Raise the intent, passing the given context, targeting a particular app
 * const selectedApp = selectedIntent.apps[0];
 * await agent.raiseIntent(selectedIntent.intent.name, context, selectedApp.name);
 * ```
 * @param context Returned intents must support this context.
 * @throws [[FDC3Error]] with a [[SendContextError]] code.
 * @throws `TypeError` if `context` is not a valid [[Context]].
 */
export async function findIntentsByContext(context: Context): Promise<AppIntent[]> {
    return tryServiceDispatch(APIFromClientTopic.FIND_INTENTS_BY_CONTEXT, {context: parseContext(context)});
}

/**
 * Publishes context to other apps on the desktop. Any apps using [[addContextListener]] will receive this.
 * ```javascript
 *  agent.broadcast(context);
 * ```
 *
 * Only windows in the same [[ChannelBase|channel]] as the broadcasting window will receive the context. All windows
 * will initially be in the same channel (referred to as the [[defaultChannel|default channel]]). See
 * [[ContextChannels]] for more details.
 *
 * Note that windows do not receive their own broadcasts. If the window calling `broadcast` has also added one or more
 * [[addContextListener|context listeners]], then those listeners will not fire as a result of this broadcast.
 *
 * @param context The context to broadcast.
 * @throws `TypeError` if `context` is not a valid [[Context]].
 */
export async function broadcast(context: Context): Promise<void> {
    await tryServiceDispatch(APIFromClientTopic.BROADCAST, {context: parseContext(context)});
}

/**
 * Raises an intent to the desktop agent to resolve. Intents can be either targeted or non-targeted, determined by the
 * presence or absense of the `target` argument. For non-targeted intents, the service will search the directory and
 * any running applications to find an application that can handle the given intent and context. If there are multiple
 * such applications, the end user will be asked to select which application they wish to use.
 *
 * If the application isn't already running, it will be started by the service. The intent data will then be passed to
 * the target application's intent listener. The promise returned by this function resolves when the service has
 * confirmed that the target application has been started its intent listener has completed successfully.
 *
 * The returned [[IntentResolution]] object indicates which application handled the intent (if the intent is a targeted
 * intent, this will always be the value passed as `target`), and contains the data returned by the target applications
 * intent listener (if any).
 *
 * ```javascript
 * // Raise an intent to start a chat with a given contact
 * const intentR = await agent.raiseIntent("StartChat", context);
 * // Use the IntentResolution object to target the same chat app with a new context
 * agent.raiseIntent("StartChat", newContext, intentR.source);
 * ```
 * @param intent The intent name to raise.
 * @param context The context that will be sent with this intent.
 * @param target An optional [[AppName]] to send the intent to.
 * @throws [[FDC3Error]] with a [[ResolveError]] code.
 * @throws [[FDC3Error]] with an [[ApplicationError]] code.
 * @throws [[FDC3Error]] with a [[SendContextError]] code.
 * @throws `TypeError` if `context` is not a valid [[Context]].
 **/
export async function raiseIntent(intent: string, context: Context, target?: AppName): Promise<IntentResolution> {
    return tryServiceDispatch(APIFromClientTopic.RAISE_INTENT, {intent, context: parseContext(context), target});
}

/**
 * Adds a listener for incoming intents from the Agent.
 *
 * To unsubscribe, use the returned [[IntentListener]].
 * @param intent The name of the intent to listen for.
 * @param handler The handler to call when we get sent an intent.
 */
export function addIntentListener(intent: string, handler: (context: Context) => any | Promise<any>): IntentListener {
    validateEnvironment();

    const listener: IntentListener = {
        intent,
        handler,
        unsubscribe: () => {
            const index: number = intentListeners.indexOf(listener);

            if (index >= 0) {
                intentListeners.splice(index, 1);

                if (!hasIntentListener(intent)) {
                    tryServiceDispatch(APIFromClientTopic.REMOVE_INTENT_LISTENER, {intent});
                }
            }

            return index >= 0;
        }
    };

    const hasIntentListenerBefore = hasIntentListener(intent);
    intentListeners.push(listener);

    if (!hasIntentListenerBefore) {
        tryServiceDispatch(APIFromClientTopic.ADD_INTENT_LISTENER, {intent});
    }
    return listener;
}

/**
 * Adds a listener for incoming context broadcasts from the desktop agent.
 *
 * To unsubscribe, use the returned [[ContextListener]].
 * @param handler The handler function to call when we receive a broadcast context.
 */
export function addContextListener(handler: (context: Context) => void): ContextListener {
    validateEnvironment();

    const listener: ContextListener = {
        handler,
        unsubscribe: () => {
            const index: number = contextListeners.indexOf(listener);

            if (index >= 0) {
                contextListeners.splice(index, 1);

                if (contextListeners.length === 0) {
                    tryServiceDispatch(APIFromClientTopic.REMOVE_CONTEXT_LISTENER, {});
                }
            }

            return index >= 0;
        }
    };

    const hasContextListenerBefore = contextListeners.length > 0;
    contextListeners.push(listener);

    if (!hasContextListenerBefore) {
        tryServiceDispatch(APIFromClientTopic.ADD_CONTEXT_LISTENER, {});
    }
    return listener;
}

/**
 * Event that is fired whenever a window changes from one channel to another. This captures events from all channels (including the default channel).
 */
export function addEventListener(eventType: 'channel-changed', handler: (event: ChannelChangedEvent) => void): void;

/**
 * Subscribes to a particular event. This is not for intent or context subscription: use [[addIntentListener]] and [[addContextListener]], respectively.
 * This is used for events that are global to the service, rather than limited to an intent or a context. Currently only takes the
 * channel change event.
 *
 * See also [[ChannelBase.addEventListener]], for subscribing to events of a particular context channel.
 *
 * @param eventType The event type.
 * @param handler The handler to call when the event is fired.
 */
export function addEventListener(eventType: MainEvents['type'], handler: (event: MainEvents) => void): void {
    validateEnvironment();

    eventEmitter.addListener(eventType, handler);
}

export function removeEventListener(eventType: 'channel-changed', handler: (event: ChannelChangedEvent) => void): void;

/**
 * Unsubscribes from a particular event.
 *
 * Has no effect if `eventType` isn't a valid event, or `listener` isn't a handler registered against `eventType`.
 *
 * @param eventType The type of the event to remove.
 * @param handler The handler previously passed into [[addEventListener]].
 */
export function removeEventListener(eventType: MainEvents['type'], handler: (event: MainEvents) => void): void {
    validateEnvironment();

    eventEmitter.removeListener(eventType, handler);
}

// TODO: Revise client-facing API [SERVICE-820]
/**
 * Registers an app directory for the current application's domain. This may be in the form of a URL or an app
 * directory.
 *
 * The app directory data should be versioned as an integer using the passed in parameter, `version`. If the version is
 * lower the last registration, this call does nothing, otherwise, the entire app directory is replaced with the new
 * provided data
 *
 * @param data Either a URL containing the location of a JSON app directory, or an array of [Application]s.
 * @param version The version of the provided app directory data.
 */
export async function registerAppDirectory(data: Application[] | string, version: number = 0): Promise<void> {
    version = parseInteger(version);
    data = parseAppDirectoryData(data);

    const urls = (typeof data === 'string') ? [data] as string[] : [];
    const applications = (typeof data === 'string') ? [] : data as Application[];

    let current;

    try {
        // We expect this to throw if no directory shard has been written
        current = await fin.Storage.getItem(APP_DIRECTORY_STORAGE_TAG);
    } catch (e) {
        current = undefined;
    }

    if (!current || current.version <= version) {
        await fin.Storage.setItem(APP_DIRECTORY_STORAGE_TAG, JSON.stringify({version, urls, applications}));
    }
}

/**
 * Whether we are listening to a particular intent.
 * @param intent The intent.
 */
function hasIntentListener(intent: string): boolean {
    return intentListeners.some((intentListener) => intentListener.intent === intent);
}

function deserializeChannelChangedEvent(eventTransport: Transport<ChannelChangedEvent>): ChannelChangedEvent {
    const type = eventTransport.type;
    const identity = eventTransport.identity;
    const channel = eventTransport.channel ? getChannelObject(eventTransport.channel) : null;
    const previousChannel = eventTransport.previousChannel ? getChannelObject(eventTransport.previousChannel) : null;

    return {type, identity, channel, previousChannel};
}

if (typeof fin !== 'undefined') {
    getServicePromise().then((channelClient) => {
        channelClient.register(APIToClientTopic.RECEIVE_INTENT, async (payload: RaiseIntentPayload) => {
            const result = await invokeListeners(
                intentListeners.filter((listener) => payload.intent === listener.intent),
                payload.context,
                (e) => console.warn(`Error thrown by ${payload.intent} intent handler, swallowing error. Error message: ${e.message}`),
                () => new Error(`All ${payload.intent} intent handlers failed`)
            );
            return result;
        });

        channelClient.register(APIToClientTopic.RECEIVE_CONTEXT, async (payload: ReceiveContextPayload) => {
            await invokeListeners(
                contextListeners,
                payload.context,
                (e) => console.warn(`Error thrown by context handler, swallowing error. Error message: ${e.message}`),
                () => new Error('All context handlers failed')
            );
        });

        const eventHandler = getEventRouter();

        channelClient.register('event', (eventTransport: Targeted<Transport<Events>>) => {
            try {
                eventHandler.dispatchEvent(eventTransport);
            } catch (e) {
                console.warn(`Error thrown dispatching ${eventTransport.type} event, rethrowing error. Error message: ${e.message}`);
                throw e;
            }
        });

        eventHandler.registerEmitterProvider('main', () => eventEmitter);
        eventHandler.registerDeserializer('channel-changed', deserializeChannelChangedEvent);
    }, (reason) => {
        console.warn('Unable to register client Context and Intent handlers. getServicePromise() rejected with reason:', reason);
    });
}
