import { tryServiceDispatch, channelPromise } from "./connection";
import { APITopic, SERVICE_IDENTITY } from "./internal";
import { Context } from './context';
import { IntentType } from "./intents";

/**
 * This file was copied from the FDC3 v1 specification.
 * 
 * Original file: https://github.com/FDC3/FDC3/blob/master/src/api/interface.ts
 */

// Re-export types/enums at top-level
export * from './context';
export * from './directory';
export * from './intents';
 
export enum OpenError {
    AppNotFound = "AppNotFound",
    ErrorOnLaunch = "ErrorOnLaunch",
    AppTimeout = "AppTimeout",
    ResolverUnavailable = "ResolverUnavailable"
}

export enum ResolveError {
    NoAppsFound = "NoAppsFound",
    ResolverUnavailable = "ResolverUnavailable",
    ResolverTimeout = "ResolverTimeout"
}

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
    apps: AppMetadata[];
}

/**
 * App metadata is Desktop Agent specific - but should support a name property.
 */
export interface AppMetadata {
    id: number;
    name: string;
    title: string;
    manifest_url: string;
    description: string;
    contact_email: string;
    support_email: string;
    signature: string;
    publisher: string;
    icon: string;
    appPage: string;
    images: {url: string}[];
    /**
     * A list of the intents supported by this application.
     *
     * Some intents are defined as part of the FDC3 spec, and applications may also define their own intents.
     */
    intents: string[];
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

export interface Listener {
    handler: (context: Context) => void;
    /**
     * Unsubscribe the listener object.
     */
    unsubscribe: () => void;
}

export class Intent {
    /**
     * Defines the type of this intent.
     *
     * Can be one of the intent types defined by the FDC3 specification, or a custom/app-specific intent type.
     */
    public intent: IntentType;

    /**
     * Name of app to target for the Intent. Use if creating an explicit intent that bypasses resolver and goes directly to an app.
     */
    public context: Context;

    /**
     * Name of app to target for the Intent. Use if creating an explicit intent that bypasses resolver and goes directly to an app.
     */
    public target: string|null;

    constructor(intent: IntentType, context: Context, target?: string) {
        this.intent = intent;
        this.context = context;
        this.target = target || null;
    }

    /**
     * Dispatches the intent with the Desktop Agent.
     *
     * Returns a Promise - resolving if the intent successfully results in launching an App.
     * If the resolution errors, it returns an `Error` with a string from the `ResolveError` enumeration.
     *
     * @param context Can optionally override the context on this intent. The context on the intent will remain un-modified.
     * @param target Can optionally override the target on this intent. The target on the intent will remain un-modified.
     */
    public async send(context?: Context, target?: string): Promise<void> {

        if (arguments.length === 0) {
            console.log('Sending intent with payload: ', {intent: this.intent, context: this.context, target: this.target || undefined});
            return tryServiceDispatch(APITopic.RAISE_INTENT, {intent: this.intent, context: this.context, target: this.target || undefined});
        } else {
            const intentData = {intent: this.intent, context: context || this.context, target: target || this.target || undefined};
            
            return tryServiceDispatch(APITopic.RAISE_INTENT, intentData);
        }
    }
}

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
 * The Context argument is functionally equivalent to opening the target app with no context and broadcasting the context directly to it.
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
    return tryServiceDispatch(APITopic.OPEN, {name, context});
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
    return tryServiceDispatch(APITopic.FIND_INTENT, {intent, context});
}

/**
 * Find all the avalable intents for a particular context.
 *
 * findIntents is effectively granting programmatic access to the Desktop Agent's resolver. 
 * A promise resolving to all the intents, their metadata and metadata about the apps that registered it is returned,
 * based on the context export types the intents have registered.
 * 
 * If the resolution fails, the promise will return an `Error` with a string from the `ResolveError` export enumeration.
 *
 * ```javascript
 * // I have a context object, and I want to know what I can do with it, hence, I look for for intents...
 * const appIntents = await agent.findIntentsForContext(context);
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
    return tryServiceDispatch(APITopic.FIND_INTENTS_BY_CONTEXT, {context});
}

/**
 * Publishes context to other apps on the desktop.
 * ```javascript
 *  agent.broadcast(context);
 * ```
 */
export function broadcast(context: Context): void {
    tryServiceDispatch(APITopic.BROADCAST, {context});
}

/**
 * Raises an intent to the desktop agent to resolve.
 * ```javascript
 * //raise an intent to start a chat with a given contact
 * const intentR = await agent.findIntents("StartChat", context);
 * //use the IntentResolution object to target the same chat app with a new context
 * agent.raiseIntent("StartChat", newContext, intentR.source);
 * ```
 */
export async function raiseIntent(intent: string, context: Context, target?: string): Promise<void> {
    return tryServiceDispatch(APITopic.RAISE_INTENT, {intent, context, target});
}

class IntentListener implements Listener{
    public readonly intent: IntentType;
    public readonly handler: (context: Context) => void;

    constructor(intent: IntentType, handler: (context: Context) => void) {
        this.intent = intent;
        this.handler = handler;

        intentListeners.push(this);
    }

    /**
     * Unsubscribe the listener object.
     */
    public unsubscribe(): boolean {
        const index: number = intentListeners.indexOf(this);

        if (index >= 0) {
            intentListeners.splice(index, 1);
        }

        return index >= 0;
    }
}

/**
 * Listens to incoming context broadcast from the Desktop Agent.
 */
class ContextListener implements Listener {
    public readonly handler: (context: Context) => void;

    constructor(handler: (context: Context) => void) {
        this.handler = handler;

        contextListeners.push(this);
    }

    /**
     * Unsubscribe the listener object.
     */
    public unsubscribe(): boolean {
        const index: number = contextListeners.indexOf(this);

        if (index >= 0) {
            contextListeners.splice(index, 1);
        }

        return index >= 0;
    }
}
const intentListeners: IntentListener[] = [];
const contextListeners: ContextListener[] = [];

if (channelPromise) {
    fin.InterApplicationBus.subscribe(SERVICE_IDENTITY, 'intent', (payload: Intent, uuid: string, name: string) => {
        intentListeners.forEach((listener: IntentListener) => {
            if (payload.intent === listener.intent) {
                listener.handler(payload.context);
            }
        });
    });

    fin.InterApplicationBus.subscribe(SERVICE_IDENTITY, 'context', (payload: Context, uuid: string, name: string) => {
        contextListeners.forEach((listener: ContextListener) => {
            listener.handler(payload);
        });
    });
}

/**
 * Adds a listener for incoming Intents from the Agent.
 */
export function addIntentListener(intent: string, handler: (context: Context) => void): Listener {
    // TODO: Implementation
    return new IntentListener(intent, handler);
}

/**
 * Adds a listener for incoming context broadcast from the Desktop Agent.
 */
export function addContextListener(handler: (context: Context) => void): Listener {
    // TODO: Implementation
    return new ContextListener(handler);
}
