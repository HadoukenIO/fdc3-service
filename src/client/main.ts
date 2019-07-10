/**
 * @module Index
 */

import {EventEmitter} from 'events';

import {Identity} from 'openfin/_v2/main';

import {tryServiceDispatch, getServicePromise} from './connection';
import {Context} from './context';
import {Application} from './directory';
import {APIFromClientTopic, APIToClientTopic, RaiseIntentPayload, EventTransport} from './internal';
import {ChannelChangedEvent, getChannelObject, FDC3ChannelEvent, FDC3ChannelEventType} from './contextChannels';
import {parseContext, validateEnvironment} from './validation';
import {getEventRouter} from './EventRouter';

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
 * Intent descriptor
 */
export interface IntentMetadata {
    name: string;
    displayName: string;
}

/**
 * An interface that relates an intent to apps
 */
export interface AppIntent {
    intent: IntentMetadata;
    apps: Application[];
}

/**
 * IntentResolution provides a standard format for data returned upon resolving an intent.
 * ```javascript
 * //resolve a "Chain" export type intent
 * var intentR = await agent.raiseIntent("intentName", context);
 * //resolve a "Client-Service" export type intent with data response
 * var intentR = await agent.raiseIntent("intentName", context);
 * var dataR = intentR.data;
 * ```
 */
export interface IntentResolution {
    source: string;
    data?: unknown;
    version: string;
}

export type Listener = ContextListener | IntentListener;

export interface ContextListener {
    handler: (context: Context) => void;
    /**
     * Unsubscribe the listener object.
     */
    unsubscribe: () => void;
}

export interface IntentListener {
    intent: string;
    handler: (context: Context) => void;
    /**
     * Unsubscribe the listener object.
     */
    unsubscribe: () => void;
}

/**
 * Defines all events that are fired by the service
 */
export type FDC3Event = FDC3MainEvent | FDC3ChannelEvent;
export type FDC3EventType = FDC3MainEventType | FDC3ChannelEventType;

export type FDC3MainEvent = ChannelChangedEvent;
export type FDC3MainEventType = FDC3MainEvent['type'];

/**
 * The event emitter to emit events received from the service. All addEventListeners will tap into this.
 */
const eventEmitter = new EventEmitter();

const intentListeners: IntentListener[] = [];
const contextListeners: ContextListener[] = [];

/**
 * A Desktop Agent is a desktop component (or aggregate of components) that serves as a
 * launcher and message router (broker) for applications in its domain.
 *
 * A Desktop Agent can be connected to one or more App Directories and will use directories for application
 * identity and discovery. Typically, a Desktop Agent will contain the proprietary logic of
 * a given platform, handling functionality like explicit application interop workflows where
 * security, consistency, and implementation requirements are proprietary.
 */


/**
 * Launches/links to an app by name.
 *
 * If a Context object is passed in, this object will be provided to the opened application via a contextListener.
 * The Context argument is functionally equivalent to opening the target app with no context and broadcasting the
 * context directly to it.
 *
 * If opening errors, it returns an `Error` with a string from the `OpenError` export enumeration.
 *
 *  ```javascript
 *     //no context
 *     agent.open('myApp');
 *     //with context
 *     agent.open('myApp', context);
 * ```
 */
export async function open(name: string, context?: Context): Promise<void> {
    return tryServiceDispatch(APIFromClientTopic.OPEN, {name, context: context && parseContext(context)});
}

/**
 * Find out more information about a particular intent by passing its name, and optionally its context.
 *
 * findIntent is effectively granting programmatic access to the Desktop Agent's resolver.
 * A promise resolving to the intent, its metadata and metadata about the apps that registered it is returned.
 * This can be used to raise the intent against a specific app.
 *
 * If the resolution fails, the promise will return an `Error` with a string from the `ResolveError` export enumeration.
 *
 * ```javascript
 * // I know 'StartChat' exists as a concept, and want to know more about it ...
 * const appIntent = await agent.findIntent("StartChat");
 *
 * // returns a single AppIntent:
 * // {
 * //     intent: { name: "StartChat", displayName: "Chat" },
 * //     apps: [{ name: "Skype" }, { name: "Symphony" }, { name: "Slack" }]
 * // }
 *
 * // raise the intent against a particular app
 * await agent.raiseIntent(appIntent.intent.name, context, appIntent.apps[0].name);
 * ```
 */
export async function findIntent(intent: string, context?: Context): Promise<AppIntent> {
    return tryServiceDispatch(APIFromClientTopic.FIND_INTENT, {intent, context: context && parseContext(context)});
}

/**
 * Find all the available intents for a particular context.
 *
 * findIntentsByContext is effectively granting programmatic access to the Desktop Agent's resolver.
 * A promise resolving to all the intents, their metadata and metadata about the apps that registered it is returned,
 * based on the context export types the intents have registered.
 *
 * If the resolution fails, the promise will return an `Error` with a string from the `ResolveError` export enumeration.
 *
 * ```javascript
 * // I have a context object, and I want to know what I can do with it, hence, I look for intents...
 * const appIntents = await agent.findIntentsByContext(context);
 *
 * // returns for example:
 * // [{
 * //     intent: { name: "StartCall", displayName: "Call" },
 * //     apps: [{ name: "Skype" }]
 * // },
 * // {
 * //     intent: { name: "StartChat", displayName: "Chat" },
 * //     apps: [{ name: "Skype" }, { name: "Symphony" }, { name: "Slack" }]
 * // }];
 *
 * // select a particular intent to raise
 * const startChat = appIntents[1];
 *
 * // target a particular app
 * const selectedApp = startChat.apps[0];
 *
 * // raise the intent, passing the given context, targeting the app
 * await agent.raiseIntent(startChat.intent.name, context, selectedApp.name);
 * ```
 */
export async function findIntentsByContext(context: Context): Promise<AppIntent[]> {
    return tryServiceDispatch(APIFromClientTopic.FIND_INTENTS_BY_CONTEXT, {context: parseContext(context)});
}

/**
 * Publishes context to other apps on the desktop.
 * ```javascript
 *  agent.broadcast(context);
 * ```
 *
 * @throws `TypeError`: If `context` is not a valid Context
 */
export function broadcast(context: Context): void {
    tryServiceDispatch(APIFromClientTopic.BROADCAST, {context: parseContext(context)});
}

/**
 * Raises an intent to the desktop agent to resolve.
 * ```javascript
 * //raise an intent to start a chat with a given contact
 * const intentR = await agent.findIntent("StartChat", context);
 * //use the IntentResolution object to target the same chat app with a new context
 * agent.raiseIntent("StartChat", newContext, intentR.source);
 * ```
 */
export async function raiseIntent(intent: string, context: Context, target?: string): Promise<IntentResolution> {
    return tryServiceDispatch(APIFromClientTopic.RAISE_INTENT, {intent, context: parseContext(context), target});
}

/**
 * Adds a listener for incoming Intents from the Agent.
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
 * Adds a listener for incoming context broadcast from the Desktop Agent.
 */
export function addContextListener(handler: (context: Context) => void): ContextListener {
    validateEnvironment();

    const listener: ContextListener = {
        handler,
        unsubscribe: () => {
            const index: number = contextListeners.indexOf(listener);

            if (index >= 0) {
                contextListeners.splice(index, 1);
            }

            return index >= 0;
        }
    };

    // TODO: Add a handshake with the provider, similar to for intents, so provider is aware we are listening for contexts here (SERVICE-553)
    contextListeners.push(listener);
    return listener;
}

/**
 * Event that is fired whenever a window changes from one channel to another.
 *
 * This includes switching to/from the global channel. The `channel` and
 * `previousChannel` fields use the same conventions for denoting the global channel as `getChannel`.
 */
export function addEventListener(eventType: 'channel-changed', handler: (event: ChannelChangedEvent) => void): void;

export function addEventListener(eventType: FDC3MainEventType, handler: (event: FDC3MainEvent) => void, identity?: Identity): void {
    validateEnvironment();

    eventEmitter.addListener(eventType, handler);
}

export function removeEventListener(eventType: FDC3MainEventType, handler: (event: FDC3MainEvent) => void): void {
    validateEnvironment();

    eventEmitter.removeListener(eventType, handler);
}

function hasIntentListener(intent: string): boolean {
    return intentListeners.some(intentListener => intentListener.intent === intent);
}

function deserializeChannelChangedEvent(eventTransport: EventTransport<ChannelChangedEvent>): ChannelChangedEvent {
    const type = eventTransport.type;
    const identity = eventTransport.identity;
    const channel = eventTransport.channel ? getChannelObject(eventTransport.channel) : null;
    const previousChannel = eventTransport.previousChannel ? getChannelObject(eventTransport.previousChannel) : null;

    return {type, identity, channel, previousChannel};
}

if (typeof fin !== 'undefined') {
    getServicePromise().then(channelClient => {
        channelClient.register(APIToClientTopic.INTENT, (payload: RaiseIntentPayload) => {
            intentListeners.forEach((listener: IntentListener) => {
                if (payload.intent === listener.intent) {
                    listener.handler(payload.context);
                }
            });
        });

        // TODO: When we're ready to make a breaking change, change `payload: Context` to `payload: ContextPayload` (SERVICE-533)
        channelClient.register(APIToClientTopic.CONTEXT, (payload: Context) => {
            contextListeners.forEach((listener: ContextListener) => {
                listener.handler(payload);
            });
        });

        const eventHandler = getEventRouter();

        channelClient.register('event', (eventTransport: EventTransport<FDC3Event>) => {
            eventHandler.dispatchEvent(eventTransport);
        });

        eventHandler.registerEmitterProvider('main', () => eventEmitter);
        eventHandler.registerDeserializer('channel-changed', deserializeChannelChangedEvent);
    }, reason => {
        console.warn('Unable to register client Context and Intent handlers. getServicePromise() rejected with reason:', reason);
    });
}
