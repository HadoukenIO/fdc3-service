import {Payload} from './context';
import {AppIdentifier, IApplication} from './directory';
import {IntentType} from './intents';

export * from './context';
export * from './directory';
export * from './intents';

export type Context = Payload;

console.log('the client has landed, connecting to provider...');

/**
 * Launches/links to an app by name.
 *
 * If opening errors, it returns an `Error` with a string from the `OpenError` enumeration.
 *
 * @todo Enumerate all possible errors, create custom error type and constants, and document within the spec
 *
 * @param name Name of the application to open - must be the ID of an application within the App Directory
 * @param context Optional context to pass to the application once opened
 */
export async function open(name: string, context?: Context): Promise<void> {
    const service: fin.OpenFinServiceClient = await servicePromise;

    return service.dispatch('FDC3.Open', {name, context}).catch(errorHandler);
}

/**
 * Resolves a intent & context pair to a list of App names/metadata.
 *
 * Resolve is effectively granting programmatic access to the Desktop Agent's resolver.
 * Returns a promise that resolves to an Array. The resolved dataset & metadata is Desktop Agent-specific.
 * If the resolution errors, it returns an `Error` with a string from the `ResolveError` enumeration.
 *
 * @todo Enumerate all possible errors, create custom error type and constants, and document within the spec
 *
 * @param intent The intent to query the application directory for
 * @param context The context you intend to attach to the intent
 */
export async function resolve(intent: IntentType, context?: Context): Promise<IApplication[]> {
    const service: fin.OpenFinServiceClient = await servicePromise;

    return service.dispatch('FDC3.Resolve', {intent, context}).catch(errorHandler);
}

/**
 * Publishes context to other apps on the desktop
 *
 * @todo Enumerate all possible errors, create custom error type and constants, and document within the spec
 *
 * @param context The context of the active application, that will be broadcast to other open applications
 */
export async function broadcast(context: Context): Promise<void> {
    const service: fin.OpenFinServiceClient = await servicePromise;

    return service.dispatch('FDC3.Broadcast', context).catch(errorHandler);
}

export class Intent {
    /**
     * Defines the type of this intent.
     *
     * Can be one of the intent types defined by the FDC3 specification, or a custom/app-specific intent type.
     */
    public intent: IntentType;

    /**
     * Name of app to target for the Intent. Use if creating an explicit intent
     * that bypasses resolver and goes directly to an app.
     */
    public context: Context;

    /**
     * Name of app to target for the Intent. Use if creating an explicit intent that bypasses resolver and goes directly to an app.
     */
    public target: AppIdentifier;

    constructor(intent?: IntentType, context?: Context, target?: AppIdentifier) {
        this.intent = intent;
        this.context = context;
        this.target = target;
    }

    /**
     * Dispatches the intent with the Desktop Agent.
     *
     * Accepts context data and target (if an explicit Intent) as optional args.
     * Returns a Promise - resolving if the intent successfully results in launching an App.
     * If the resolution errors, it returns an `Error` with a string from the `ResolveError` enumeration.
     *
     * @param context Can optionally override the context on this intent. The context on the intent will remain un-modified.
     * @param target Can optionally override the target on this intent. The target on the intent will remain un-modified.
     */
    public async send(context?: Context, target?: AppIdentifier): Promise<void> {
        const service: fin.OpenFinServiceClient = await servicePromise;

        if (arguments.length === 0) {
            return service.dispatch('FDC3.Intent', this).catch(errorHandler);
        } else {
            const intentData = {context: context || this.context || null, target: target || this.target || null};

            return service.dispatch('FDC3.Intent', intentData).catch(errorHandler);
        }
    }
}

/**
 * Listens to incoming Intents from the Agent.
 */
export class IntentListener {
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
export class ContextListener {
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


// Code above here defines the API that is exposed to applications
// ------------------------------------------------------------------------------------
// Code below here initialises/manages the connection between the application and the OpenFin Desktop Agent

const servicePromise: Promise<fin.OpenFinServiceClient> = fin.desktop.Service.connect({uuid: 'fdc3-service', name: 'FDC3 Service'});
const intentListeners: IntentListener[] = [];
const contextListeners: ContextListener[] = [];


fin.desktop.InterApplicationBus.subscribe('fdc3-service', 'intent', (payload: Intent, uuid: string, name: string) => {
    intentListeners.forEach((listener: IntentListener) => {
        if (payload.intent === listener.intent) {
            listener.handler(payload.context);
        }
    });
});

fin.desktop.InterApplicationBus.subscribe('fdc3-service', 'context', (payload: Context, uuid: string, name: string) => {
    contextListeners.forEach((listener: ContextListener) => {
        listener.handler(payload);
    });
});

/**
 * Wrapper around any objects coming back from the API.
 *
 * Error handling is still WIP.
 *
 * @param reason Error object or description
 */
function errorHandler(reason: string): never {
    // Re-throw error from service
    throw new Error(reason);
}
