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

import {IntentType} from '../../../src/provider/intents';
import {Context, AppIntent, ChannelId} from '../../../src/client/main';
import {RaiseIntentPayload, deserializeError, Events, MainEvents, FindIntentPayload, OpenPayload, BroadcastPayload} from '../../../src/client/internal';

import {OFPuppeteerBrowser, TestWindowContext, TestChannelTransport} from './ofPuppeteer';
import {RemoteChannel} from './RemoteChannel';

export const ofBrowser = new OFPuppeteerBrowser();

const remoteChannels: {[id: string]: RemoteChannel} = {};

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
    getReceivedEvents: () => Promise<Events[]>;
    unsubscribe: () => Promise<void>;
}

export async function open(executionTarget: Identity, name: string, context?: Context): Promise<void> {
    return ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, payload: OpenPayload): Promise<void> {
        return this.fdc3.open(payload.name, payload.context).catch(this.errorHandler);
    }, {name, context}).catch(handlePuppeteerError);
}

export async function findIntent(executionTarget: Identity, intent: IntentType, context?: Context): Promise<AppIntent> {
    return ofBrowser.executeOnWindow(executionTarget, async function (this: TestWindowContext, payload: FindIntentPayload): Promise<AppIntent> {
        return this.fdc3.findIntent(payload.intent, payload.context).catch(this.errorHandler);
    }, {intent, context}).catch(handlePuppeteerError);
}

export async function broadcast(executionTarget: Identity, context: Context): Promise<void> {
    return ofBrowser
        .executeOnWindow(
            executionTarget,
            async function (this: TestWindowContext, payload: BroadcastPayload): Promise<void> {
                return this.fdc3.broadcast(payload.context);
            },
            {context}
        )
        .then(() => new Promise<void>((res) => setTimeout(res, 100))); // Broadcast is fire-and-forget. Slight delay to allow for service to handle
}

export async function raiseIntent(executionTarget: Identity, intent: IntentType, context: Context, target?: string): Promise<void> {
    return ofBrowser.executeOnWindow(executionTarget, async function (this: TestWindowContext, payload: RaiseIntentPayload): Promise<void> {
        await this.fdc3.raiseIntent(payload.intent, payload.context, payload.target).catch(this.errorHandler);
    }, {intent, context, target}).catch(handlePuppeteerError);
}

/**
 * Create an OpenFin window under the same app as the `executionTarget`
 * @param executionTarget Identity of the app/window on which to run the command
 * @param windowOptions standard `fin.Window.create` options
 */
export async function createFinWindow(executionTarget: Identity, windowOptions: WindowOption): Promise<Identity> {
    return ofBrowser.executeOnWindow(executionTarget, async function (this: TestWindowContext, payload: WindowOption): Promise<Identity> {
        const window = await this.fin.Window.create(payload);
        return window.identity;
    }, windowOptions);
}

export async function addContextListener(executionTarget: Identity): Promise<RemoteContextListener> {
    const id = await ofBrowser.executeOnWindow(executionTarget, async function (this: TestWindowContext): Promise<number> {
        const listenerID = this.contextListeners.length;
        this.contextListeners[listenerID] = await this.fdc3.addContextListener((context) => {
            this.receivedContexts.push({listenerID, context});
        });
        return listenerID;
    });

    return createRemoteContextListener(executionTarget, id);
}

export async function addIntentListener(executionTarget: Identity, intent: IntentType): Promise<RemoteIntentListener> {
    const id = await ofBrowser.executeOnWindow(executionTarget, async function (this: TestWindowContext, intentRemote: IntentType): Promise<number> {
        if (this.intentListeners[intentRemote] === undefined) {
            this.intentListeners[intentRemote] = [];
        }
        const listenerID = this.intentListeners[intentRemote].length;
        this.intentListeners[intentRemote][listenerID] = await this.fdc3.addIntentListener(intentRemote, (context) => {
            this.receivedIntents.push({listenerID, intent: intentRemote, context});
        });
        return listenerID;
    }, intent);

    return createRemoteIntentListener(executionTarget, id, intent);
}

export async function getRemoteContextListener(executionTarget: Identity, listenerID: number = 0): Promise<RemoteContextListener> {
    // Check that the ID maps to a listener
    const exists = await ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, id: number): boolean {
        return typeof this.contextListeners[id] !== 'undefined';
    }, listenerID);

    if (!exists) {
        throw new Error(`Could not get remoteListener: No listener found with ID ${listenerID} on window ${JSON.stringify(executionTarget)}`);
    }
    return createRemoteContextListener(executionTarget, listenerID);
}

interface GetRemoteIntentListenerPayload {intent: IntentType; listenerID: number}
export async function getRemoteIntentListener(executionTarget: Identity, intent: IntentType, listenerID: number = 0): Promise<RemoteIntentListener> {
    // Check that the intent/ID pair maps to a listener
    const exists = await ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, payload: GetRemoteIntentListenerPayload): boolean {
        return typeof this.intentListeners[payload.intent] !== 'undefined' && typeof this.intentListeners[payload.intent][payload.listenerID] !== 'undefined';
    }, {intent, listenerID});

    if (!exists) {
        throw new Error(`Could not get remoteListener: No listener found for intent "${intent}" with ID "${listenerID}" \
            on window "${executionTarget.uuid}/${executionTarget.name}"`);
    }
    return createRemoteIntentListener(executionTarget, listenerID, intent);
}

export async function addEventListener(executionTarget: Identity, eventType: MainEvents['type']): Promise<RemoteEventListener> {
    const id = await ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, eventTypeRemote: MainEvents['type']): number {
        const listenerID = this.eventListeners.length;

        const handler = (payload: Events) => {
            this.receivedEvents.push({listenerID, payload});
        };

        const unsubscribe = () => {
            this.fdc3.removeEventListener(eventTypeRemote, handler);
        };

        this.fdc3.addEventListener(eventTypeRemote, handler);
        this.eventListeners[listenerID] = {handler, unsubscribe};
        return listenerID;
    }, eventType);

    return {
        remoteIdentity: executionTarget,
        id,
        unsubscribe: () => {
            return ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, idRemote: number): void {
                this.eventListeners[idRemote].unsubscribe();
            }, id);
        },
        getReceivedEvents: (): Promise<Events[]> => {
            return ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, idRemote: number): Events[] {
                return this.receivedEvents.filter((entry) => entry.listenerID === idRemote).map((entry) => entry.payload);
            }, id);
        }
    };
}

export async function getRemoteEventListener(executionTarget: Identity, listenerID: number = 0): Promise<RemoteEventListener> {
    // Check that the ID maps to a listener
    const exists = await ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, id: number): boolean {
        return typeof this.eventListeners[id] !== 'undefined';
    }, listenerID);

    if (!exists) {
        throw new Error(`Could not get remoteListener: No listener found with ID ${listenerID} on window ${JSON.stringify(executionTarget)}`);
    } else {
        return {
            remoteIdentity: executionTarget,
            id: listenerID,
            unsubscribe: () => {
                return ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, id: number): void {
                    this.eventListeners[id].unsubscribe();
                    delete this.eventListeners[id];
                }, listenerID);
            },
            getReceivedEvents: (): Promise<Events[]> => {
                return ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, id: number): Events[] {
                    return this.receivedEvents.filter((entry) => entry.listenerID === id).map((entry) => entry.payload);
                }, listenerID);
            }
        };
    }
}

export async function findIntentsByContext(executionTarget: Identity, context: Context): Promise<AppIntent[]> {
    return ofBrowser.executeOnWindow(executionTarget, async function (this: TestWindowContext, contextRemote: Context): Promise<AppIntent[]> {
        return this.fdc3.findIntentsByContext(contextRemote).catch(this.errorHandler);
    }, context).catch(handlePuppeteerError);
}

export function clickHTMLElement(executionTarget: Identity, elementSelector: string): Promise<boolean> {
    return ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, elementSelectorRemote: string): boolean {
        const element = this.document.querySelector(elementSelectorRemote) as HTMLElement;
        if (!element) {
            return false;
        }
        element.click();
        return true;
    }, elementSelector);
}

export async function getSystemChannels(executionTarget: Identity): Promise<RemoteChannel[]> {
    const channels = await ofBrowser.executeOnWindow(executionTarget, async function (this: TestWindowContext): Promise<TestChannelTransport[]> {
        const channelsRemote = await this.fdc3.getSystemChannels().catch(this.errorHandler);

        return channelsRemote.map(this.serializeChannel);
    }).catch(handlePuppeteerError);

    return channels.map((channel) => deserializeChannel(executionTarget, channel));
}

export async function getChannelById(executionTarget: Identity, id: ChannelId): Promise<RemoteChannel> {
    const testChannelTransport = await ofBrowser.executeOnWindow(
        executionTarget,
        async function (this: TestWindowContext, idRemote: ChannelId): Promise<TestChannelTransport> {
            const channel = await this.fdc3.getChannelById(idRemote).catch(this.errorHandler);

            return this.serializeChannel(channel);
        },
        id
    ).catch(handlePuppeteerError);

    return deserializeChannel(executionTarget, testChannelTransport);
}

export async function getCurrentChannel(executionTarget: Identity, identity?: Identity): Promise<RemoteChannel> {
    const testChannelTransport = await ofBrowser.executeOnWindow(
        executionTarget,
        async function (this: TestWindowContext, identityRemote?: Identity): Promise<TestChannelTransport> {
            const channel = await this.fdc3.getCurrentChannel(identityRemote).catch(this.errorHandler);

            return this.serializeChannel(channel);
        },
        identity
    ).catch(handlePuppeteerError);

    return deserializeChannel(executionTarget, testChannelTransport);
}

export async function getOrCreateAppChannel(executionTarget: Identity, name: string): Promise<RemoteChannel> {
    const testChannelTransport = await ofBrowser.executeOnWindow(
        executionTarget,
        async function (this: TestWindowContext, nameRemote: string): Promise<TestChannelTransport> {
            const channel = await this.fdc3.getOrCreateAppChannel(nameRemote).catch(this.errorHandler);

            return this.serializeChannel(channel);
        },
        name
    ).catch(handlePuppeteerError);

    return deserializeChannel(executionTarget, testChannelTransport);
}

/**
 * Puppeteer catches and rethrows errors its own way, losing information on extra fields (e.g. `code` for FDC3Error objects).
 * So what we do is serialize all these fields into the single `message` from the client apps, then from here strip back whatever puppeteer
 * added (Evaluation failed...) and parse the actual error object so we can check for the right info in our integration tests.
 * @param error Error returned by puppeteer
 */
export function handlePuppeteerError(error: Error): never {
    try {
        // Strip-away boilerplate added by puppeteer when returning errors from client apps
        error.message = error.message.replace('Evaluation failed: Error: ', '').split('\n')[0];

        error = deserializeError(error);
    } catch (e) {
        // Not an error type we explicitly handle, continue as normal
    }
    throw error;
}

export function createRemoteContextListener(executionTarget: Identity, id: number): RemoteContextListener {
    return {
        remoteIdentity: executionTarget,
        id,
        unsubscribe: async () => {
            await ofBrowser.executeOnWindow(executionTarget, async function (this: TestWindowContext, remoteId: number): Promise<void> {
                await this.contextListeners[remoteId].unsubscribe();
                delete this.contextListeners[remoteId];
            }, id);
        },
        getReceivedContexts: (): Promise<Context[]> => {
            return ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, idRemote: number): Context[] {
                return this.receivedContexts.filter((entry) => entry.listenerID === idRemote).map((entry) => entry.context);
            }, id);
        }
    };
}

function deserializeChannel(executionTarget: Identity, transport: TestChannelTransport): RemoteChannel {
    let remoteChannel = remoteChannels[transport.id];

    if (!remoteChannel) {
        remoteChannel = new RemoteChannel(executionTarget, transport);
        remoteChannels[transport.id] = remoteChannel;
    }

    return remoteChannel;
}

function createRemoteIntentListener(executionTarget: Identity, id: number, intent: string) {
    return {
        remoteIdentity: executionTarget,
        id,
        intent,
        unsubscribe: async () => {
            await ofBrowser.executeOnWindow(
                executionTarget,
                async function (this: TestWindowContext, remoteIntent: IntentType, remoteId: number): Promise<void> {
                    await this.intentListeners[remoteIntent][remoteId].unsubscribe();
                    delete this.intentListeners[remoteIntent][remoteId];
                }, intent, id
            );
        },
        getReceivedContexts: (): Promise<Context[]> => {
            return ofBrowser.executeOnWindow(executionTarget, function (this: TestWindowContext, intentRemote: IntentType, idRemote: number): Context[] {
                return this.receivedIntents.filter((entry) => entry.listenerID === idRemote && entry.intent === intentRemote).map((entry) => entry.context);
            }, intent, id);
        }
    };
}
