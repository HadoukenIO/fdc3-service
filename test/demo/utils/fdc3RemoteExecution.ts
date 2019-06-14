/**
 * This module contains util functions mirroring those in the client module, but
 * with the additional feature of invoking them on a remote window.
 *
 * Most of call signatures are identical to the client API, but with an
 * additional "executionTarget" parameter as the first argument.
 *
 * The Listner classes have been replaced with functions which will create the
 * listeners and when triggered will invoke the provided callback in the test's
 * context (i.e. in node, not the window);
 */

import {Identity} from 'openfin/_v2/main';
import {WindowOption} from 'openfin/_v2/api/window/windowOption';

import {Application, Context, IntentType, AppIntent, ChannelId, DefaultChannel, DesktopChannel, Channel, deserializeError} from '../../../src/client/main';
import {RaiseIntentPayload} from '../../../src/client/internal';
import {FDC3Event, FDC3EventType} from '../../../src/client/connection';

import {OFPuppeteerBrowser, TestWindowContext, TestChannelTransport} from './ofPuppeteer';

const ofBrowser = new OFPuppeteerBrowser();

const remoteChannels: {[id: string]: RemoteChannel} = {};

export interface RemoteChannel {
    channel: Channel;
    id: string;

    getMembers: () => Promise<Identity[]>;
    join: (identity?: Identity) => Promise<void>;
}

export interface RemoteContextListener {
    remoteIdentity: Identity;
    id: number;
    unsubscribe: () => Promise<void>;
    getReceivedContexts: () => Promise<Context[]>;
}

export interface RemoteIntentListener {
    remoteIdentity: Identity;
    id: number;
    intent: IntentType;
    unsubscribe: () => Promise<void>;
    getReceivedContexts: () => Promise<Context[]>;
}

export interface RemoteEventListener {
    remoteIdentity: Identity;
    id: number;
    getReceivedEvents: () => Promise<FDC3Event[]>;
    unsubscribe: () => Promise<void>;
}

export async function open(executionTarget: Identity, name: string, context?: Context): Promise<void> {
    return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, name: string, context?: Context): Promise<void> {
        return this.fdc3.open(name, context).catch(this.errorHandler);
    }, name, context).catch(handlePuppeteerError);
}

export async function findIntent(executionTarget: Identity, intent: IntentType, context?: Context): Promise<Application[]> {
    return ofBrowser.executeOnWindow(executionTarget, async function(this: TestWindowContext, intent: IntentType, context?: Context): Promise<Application[]> {
        return this.fdc3.findIntent(intent, context).then(appIntent => appIntent.apps);
    }, intent, context);
}

export async function broadcast(executionTarget: Identity, context: Context): Promise<void> {
    return ofBrowser
        .executeOnWindow(
            executionTarget,
            async function(this: TestWindowContext, context: Context):
                Promise<void> {
                return this.fdc3.broadcast(context);
            },
            context
        )
        .then(() => new Promise<void>(res => setTimeout(res, 100)));  // Broadcast is fire-and-forget. Slight delay to allow for service to handle
}

export async function raiseIntent(executionTarget: Identity, intent: IntentType, context: Context, target?: string): Promise<void> {
    return ofBrowser.executeOnWindow(executionTarget, async function(this: TestWindowContext, payload: RaiseIntentPayload): Promise<void> {
        await this.fdc3.raiseIntent(payload.intent, payload.context, payload.target).catch(this.errorHandler);
    }, {intent, context, target}).catch(handlePuppeteerError);
}

/**
 * Create an OpenFin window under the same app as the `executionTarget`
 * @param executionTarget Identity of the app/window on which to run the command
 * @param windowOptions standard `fin.Window.create` options
 */
export async function createFinWindow(executionTarget: Identity, windowOptions: WindowOption): Promise<Identity> {
    return ofBrowser.executeOnWindow(executionTarget, async function(this: TestWindowContext, payload: WindowOption): Promise<Identity> {
        const window = await this.fin.Window.create(payload);
        return window.identity;
    }, windowOptions);
}

export async function addContextListener(executionTarget: Identity): Promise<RemoteContextListener> {
    const id = await ofBrowser.executeOnWindow(executionTarget, function(this:TestWindowContext): number {
        const listenerID = this.contextListeners.length;
        this.contextListeners[listenerID] = this.fdc3.addContextListener((context) => {
            this.receivedContexts.push({listenerID, context});
        });
        return listenerID;
    });

    return {
        remoteIdentity: executionTarget,
        id,
        unsubscribe: async () => {
            return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): void {
                this.contextListeners[id].unsubscribe();
            }, id);
        },
        getReceivedContexts: async (): Promise<Context[]> => {
            return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): Context[] {
                return this.receivedContexts.filter(entry => entry.listenerID === id).map(entry => entry.context);
            }, id);
        }
    };
}

export async function addIntentListener(executionTarget: Identity, intent: IntentType): Promise<RemoteIntentListener> {
    const id = await ofBrowser.executeOnWindow(executionTarget, function(this:TestWindowContext, intentRemote: IntentType): number {
        if (this.intentListeners[intentRemote] === undefined) {
            this.intentListeners[intentRemote] = [];
        }
        const listenerID = this.intentListeners[intentRemote].length;
        this.intentListeners[intentRemote][listenerID] = this.fdc3.addIntentListener(intentRemote, (context) => {
            this.receivedIntents.push({listenerID, intent: intentRemote, context});
        });
        return listenerID;
    }, intent);

    return {
        remoteIdentity: executionTarget,
        id,
        intent,
        unsubscribe: async () => {
            return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, intent: IntentType, id: number): void {
                this.intentListeners[intent][id].unsubscribe();
            }, intent, id);
        },
        getReceivedContexts: async (): Promise<Context[]> => {
            return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, intent: IntentType, id: number): Context[] {
                return this.receivedIntents.filter(entry => entry.listenerID === id && entry.intent === intent).map(entry => entry.context);
            }, intent, id);
        }
    };
}

export async function getRemoteContextListener(executionTarget: Identity, listenerID: number = 0): Promise<RemoteContextListener> {
    // Check that the ID maps to a listener
    const exists = await ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): boolean {
        return typeof this.contextListeners[id] !== 'undefined';
    }, listenerID);

    if (!exists) {
        throw new Error('Could not get remoteListener: No listener found with ID ' + listenerID + ' on window ' + JSON.stringify(executionTarget));
    }
    return {
        remoteIdentity: executionTarget,
        id: listenerID,
        unsubscribe: async () => {
            return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): void {
                this.contextListeners[id].unsubscribe();
                delete this.contextListeners[id];
            }, listenerID);
        },
        getReceivedContexts: async (): Promise<Context[]> => {
            return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): Context[] {
                return this.receivedContexts.filter(entry => entry.listenerID === id).map(entry => entry.context);
            }, listenerID);
        }
    };
}

export async function getRemoteIntentListener(executionTarget: Identity, intent: IntentType, listenerID: number = 0): Promise<RemoteIntentListener> {
    // Check that the intent/ID pair maps to a listener
    const exists = await ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, intent: IntentType, id: number): boolean {
        return typeof this.intentListeners[intent] !== 'undefined' && typeof this.intentListeners[intent][id] !== 'undefined';
    }, intent, listenerID);

    if (!exists) {
        throw new Error(`Could not get remoteListener: No listener found for intent "${intent}" with ID "${listenerID}" \
            on window "${executionTarget.uuid}/${executionTarget.name}"`);
    }
    return {
        remoteIdentity: executionTarget,
        id: listenerID,
        intent,
        unsubscribe: async () => {
            return ofBrowser.executeOnWindow(executionTarget, function(this:TestWindowContext, intent: IntentType, id: number): void {
                this.intentListeners[intent][id].unsubscribe();
                delete this.intentListeners[intent][id];
            }, intent, listenerID);
        },
        getReceivedContexts: async (): Promise<Context[]> => {
            return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, intent: IntentType, id: number): Context[] {
                return this.receivedIntents.filter(entry => entry.listenerID === id && entry.intent === intent).map(entry => entry.context);
            }, intent, listenerID);
        }
    };
}

export async function addEventListener(executionTarget: Identity, eventType: FDC3EventType): Promise<RemoteEventListener> {
    const id = await ofBrowser.executeOnWindow(executionTarget, function(this:TestWindowContext, eventType: FDC3EventType): number {
        const listenerID = this.eventListeners.length;

        const handler = (payload: FDC3Event) => {
            this.receivedEvents.push({listenerID, payload});
        };

        const unsubscribe = () => {
            this.fdc3.removeEventListener(eventType, handler);
        };

        this.fdc3.addEventListener(eventType, handler);
        this.eventListeners[listenerID] = {handler, unsubscribe};
        return listenerID;
    }, eventType);

    return {
        remoteIdentity: executionTarget,
        id,
        unsubscribe: async () => {
            return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): void {
                this.eventListeners[id].unsubscribe();
            }, id);
        },
        getReceivedEvents: async (): Promise<FDC3Event[]> => {
            return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): FDC3Event[] {
                return this.receivedEvents.filter(entry => entry.listenerID === id).map(entry => entry.payload);
            }, id);
        }
    };
}

export async function getRemoteEventListener(executionTarget: Identity, listenerID: number = 0): Promise<RemoteEventListener> {
    // Check that the ID maps to a listener
    const exists = await ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): boolean {
        return typeof this.eventListeners[id] !== 'undefined';
    }, listenerID);

    if (!exists) {
        throw new Error('Could not get remoteListener: No listener found with ID ' + listenerID + ' on window ' + JSON.stringify(executionTarget));
    } else {
        return {
            remoteIdentity: executionTarget,
            id: listenerID,
            unsubscribe: async () => {
                return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): void {
                    this.eventListeners[id].unsubscribe();
                    delete this.eventListeners[id];
                }, listenerID);
            },
            getReceivedEvents: async (): Promise<FDC3Event[]> => {
                return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): FDC3Event[] {
                    return this.receivedEvents.filter(entry => entry.listenerID === id).map(entry => entry.payload);
                }, listenerID);
            }
        };
    }
}

export async function findIntentsByContext(executionTarget: Identity, context: Context): Promise<AppIntent[]> {
    return ofBrowser.executeOnWindow(executionTarget, async function(this: TestWindowContext, context: Context): Promise<AppIntent[]> {
        return this.fdc3.findIntentsByContext(context).catch(this.errorHandler);
    }, context).catch(handlePuppeteerError);
}

export async function getDesktopChannels(executionTarget: Identity): Promise<RemoteChannel[]> {
    const channels = await ofBrowser.executeOnWindow(executionTarget, async function(this: TestWindowContext): Promise<TestChannelTransport[]> {
        const channels = await this.fdc3.getDesktopChannels().catch(this.errorHandler);

        return channels.map(this.serializeChannel);
    }).catch(handlePuppeteerError);

    return channels.map(channel => deserializeChannel(executionTarget, channel));
}

export async function getChannelById(executionTarget: Identity, id: ChannelId): Promise<RemoteChannel> {
    const testChannelTransport = await ofBrowser.executeOnWindow(
        executionTarget,
        async function(this: TestWindowContext, id: ChannelId): Promise<TestChannelTransport> {
            const channel = await this.fdc3.getChannelById(id).catch(this.errorHandler);

            return this.serializeChannel(channel);
        },
        id
    ).catch(handlePuppeteerError);

    return deserializeChannel(executionTarget, testChannelTransport);
}

export async function getCurrentChannel(executionTarget: Identity, identity?: Identity): Promise<RemoteChannel> {
    const testChannelTransport = await ofBrowser.executeOnWindow(
        executionTarget,
        async function(this: TestWindowContext, identity?: Identity): Promise<TestChannelTransport> {
            const channel = await this.fdc3.getCurrentChannel(identity).catch(this.errorHandler);

            return this.serializeChannel(channel);
        },
        identity
    ).catch(handlePuppeteerError);

    return deserializeChannel(executionTarget, testChannelTransport);
}

function deserializeChannel(executionTarget: Identity, transport: TestChannelTransport): RemoteChannel {
    let remoteChannel = remoteChannels[transport.id];

    if (!remoteChannel) {
        remoteChannel = {
            id: transport.id,
            channel: transport.channel as Channel,
            join: async (identity?: Identity) => {
                return ofBrowser.executeOnWindow(executionTarget, async function(channelInstanceId: string, identity?: Identity): Promise<void> {
                    return this.channelTransports[channelInstanceId].channel.join(identity).catch(this.errorHandler);
                }, transport.id, identity).catch(handlePuppeteerError);
            },
            getMembers: async () => {
                return ofBrowser.executeOnWindow(executionTarget, async function(channelInstanceId: string): Promise<Identity[]> {
                    return this.channelTransports[channelInstanceId].channel.getMembers().catch(this.errorHandler);
                }, transport.id).catch(handlePuppeteerError);
            }
        };

        switch (transport.constructor) {
            case 'DefaultChannel':
                Object.setPrototypeOf(transport.channel, DefaultChannel);
                break;
            case 'DesktopChannel':
                Object.setPrototypeOf(transport.channel, DesktopChannel);
                break;
            default:
                throw new Error(`Unexpected channel constructor received: ${transport.constructor}`);
        }

        remoteChannels[transport.id] = remoteChannel;
    }

    return remoteChannel;
}

/**
 * Puppeteer catches and rethrows errors its own way, losing information on extra fields (e.g. `code` for FDC3Error objects).
 * So what we do is serialize all these fields into the single `message` from the client apps, then from here strip back whatever puppeteer
 * added (Evaluation failed...) and parse the actual error object so we can check for the right info in our integration tests.
 * @param error Error returned by puppeteer
 */
function handlePuppeteerError(error: Error): never {
    try {
        // Strip-away boilerplate added by puppeteer when returning errors from client apps
        error.message = error.message.replace('Evaluation failed: Error: ', '').split('\n')[0];

        error = deserializeError(error);
    } catch (e) {
        // Not an error type we explicitly handle, continue as normal
    }
    throw error;
}
