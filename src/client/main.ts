/**
 * @module Index
 */

/**
 * Main entry point
 */
import {tryServiceDispatch, getServicePromise, getEventRouter, eventEmitter} from './connection';
import {Context} from './context';
import {Application, AppName} from './directory';
import {APIFromClientTopic, APIToClientTopic, RaiseIntentPayload, ReceiveContextPayload, MainEvents, Events} from './internal';
import {ChannelChangedEvent, getChannelObject, ChannelContextListener} from './contextChannels';
import {parseContext, validateEnvironment} from './validation';
import {Transport, Targeted} from './EventRouter';

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
 * //You might fire and forget an intent
 * await agent.raiseIntent("intentName", context);
 *
 * //Or you might want some data to come back
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
     * The callback for when this listener receives an intent.
     */
    handler: (context: Context) => void;
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
 * If opening errors, it returns an [[FDC3Error]] with a string from the [[OpenError]] export enumeration.
 *
 *  ```javascript
 *     //no context
 *     agent.open('myApp');
 *     //with context
 *     agent.open('myApp', context);
 * ```
 * @param name The [[AppName]] to launch.
 * @param context A context to pass to the app post-launch.
 */
export async function open(name: AppName, context?: Context): Promise<void> {
    return tryServiceDispatch(APIFromClientTopic.OPEN, {name, context: context && parseContext(context)});
}

/**
 * Find out more information about a particular intent by passing its name, and optionally its context.
 *
 * `findIntent` is effectively granting programmatic access to the desktop agent's resolver.
 * A promise resolving to the intent, its metadata and metadata about the apps that registered it is returned.
 * This can be used to raise the intent against a specific app.
 *
 * If the resolution fails, the promise will return an [[FDC3Error]] with a string from the [[ResolveError]] export enumeration.
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
 */
export async function findIntent(intent: string, context?: Context): Promise<AppIntent> {
    return tryServiceDispatch(APIFromClientTopic.FIND_INTENT, {intent, context: context && parseContext(context)});
}

/**
 * Find all the available intents for a particular context.
 *
 * `findIntentsByContext` is effectively granting programmatic access to the desktop agent's resolver.
 * A promise resolving to all the intents, their metadata and metadata about the apps that registered it is returned,
 * based on the context export types the intents have registered.
 *
 * If the resolution fails, the promise will return an [[FDC3Error]] with a string from the `ResolveError` export
 * enumeration.
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
 * // select a particular intent to raise
 * const selectedIntent = appIntents[1];
 *
 * // raise the intent, passing the given context, letting the user select which app to use
 * await agent.raiseIntent(selectedIntent.intent.name, context);
 *
 * // raise the intent, passing the given context, targeting a particular app
 * const selectedApp = selectedIntent.apps[0];
 * await agent.raiseIntent(selectedIntent.intent.name, context, selectedApp.name);
 * ```
 * @param context Returned intents must support this context.
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
 * @throws `TypeError` if `context` is not a valid [[Context]]
 * @param context The context to broadcast.
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
 * //raise an intent to start a chat with a given contact
 * const intentR = await agent.raiseIntent("StartChat", context);
 * //use the IntentResolution object to target the same chat app with a new context
 * agent.raiseIntent("StartChat", newContext, intentR.source);
 * ```
 * @param intent The intent name to raise.
 * @param context The context that will be sent with this intent.
 * @param target An optional [[AppName]] to send the intent to.
 * @throws [[FDC3Error]]. Also see [[ResolveError]].
 */
export async function raiseIntent(intent: string, context: Context, target?: AppName): Promise<IntentResolution> {
    return tryServiceDispatch(APIFromClientTopic.RAISE_INTENT, {intent, context: parseContext(context), target});
}

/**
 * Adds a listener for incoming Intents from the Agent.
 *
 * To unsubscribe, use the returned [[IntentListener]].
 * @param intent The name of the intent to listen for.
 * @param handler The handler to call when we get sent an intent.
 */
export function addIntentListener(intent: string, handler: (context: Context) => void): IntentListener {
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
 * Adds a listener for incoming context broadcast from the desktop agent.
 *
 * To unsubscribe, use the returned [[ContextListener]].
 * @param handler The callback function to call when we receive a broadcast context.
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
 * Has no effect if `eventType` isn't a valid event, or `listener` isn't a callback registered against `eventType`.
 *
 * @param eventType The type of the event to remove.
 * @param handler The handler previously passed into [[addEventListener]].
 */
export function removeEventListener(eventType: MainEvents['type'], handler: (event: MainEvents) => void): void {
    validateEnvironment();

    eventEmitter.removeListener(eventType, handler);
}

/**
 * Whether we are listening to a particular intent.
 * @param intent The intent.
 */
function hasIntentListener(intent: string): boolean {
    return intentListeners.some(intentListener => intentListener.intent === intent);
}

function deserializeChannelChangedEvent(eventTransport: Transport<ChannelChangedEvent>): ChannelChangedEvent {
    const type = eventTransport.type;
    const identity = eventTransport.identity;
    const channel = eventTransport.channel ? getChannelObject(eventTransport.channel) : null;
    const previousChannel = eventTransport.previousChannel ? getChannelObject(eventTransport.previousChannel) : null;

    return {type, identity, channel, previousChannel};
}

if (typeof fin !== 'undefined') {
    getServicePromise().then(channelClient => {
        channelClient.register(APIToClientTopic.RECEIVE_INTENT, (payload: RaiseIntentPayload) => {
            intentListeners.forEach((listener: IntentListener) => {
                if (payload.intent === listener.intent) {
                    listener.handler(payload.context);
                }
            });
        });

        channelClient.register(APIToClientTopic.RECEIVE_CONTEXT, (payload: ReceiveContextPayload) => {
            contextListeners.forEach((listener: ContextListener) => {
                listener.handler(payload.context);
            });
        });

        const eventHandler = getEventRouter();

        channelClient.register('event', (eventTransport: Targeted<Transport<Events>>) => {
            eventHandler.dispatchEvent(eventTransport);
        });

        eventHandler.registerEmitterProvider('main', () => eventEmitter);
        eventHandler.registerDeserializer('channel-changed', deserializeChannelChangedEvent);
    }, reason => {
        console.warn('Unable to register client Context and Intent handlers. getServicePromise() rejected with reason:', reason);
    });
}
