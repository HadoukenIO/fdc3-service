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
import {Payload} from 'openfin/_v2/transport/transport';

import {Application, Context, IntentType, ChannelId, Channel, ChannelChangedEvent} from '../../../src/client/main';
import {RaiseIntentPayload} from '../../../src/client/internal';
import {FDC3Event, FDC3EventType} from '../../../src/client/connection';

import {OFPuppeteerBrowser, TestWindowContext} from './ofPuppeteer';

const ofBrowser = new OFPuppeteerBrowser();

export async function open(executionTarget: Identity, name: string, context?: Context): Promise<void> {
    return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, name: string, context?: Context): Promise<void> {
        return this.fdc3.open(name, context);
    }, name, context);
}

export async function resolve(executionTarget: Identity, intent: IntentType, context?: Context): Promise<Application[]> {
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

export async function getAllChannels(executionTarget: Identity): Promise<Channel[]> {
    return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext): Promise<Channel[]> {
        return this.fdc3.getAllChannels();
    });
}

export async function joinChannel(executionTarget: Identity, channelId: ChannelId, identity?: Identity): Promise<void> {
    return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, channelId: ChannelId, identity?: Identity): Promise<void> {
        return this.fdc3.joinChannel(channelId, identity);
    }, channelId, identity);
}

export async function getChannel(executionTarget: Identity, identity?: Identity): Promise<Channel> {
    return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, identity?: Identity): Promise<Channel> {
        return this.fdc3.getChannel(identity);
    }, identity);
}

export async function getChannelMembers(executionTarget: Identity, channelId: ChannelId): Promise<Identity[]> {
    return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, channelId: ChannelId): Promise<Identity[]> {
        return this.fdc3.getChannelMembers(channelId);
    }, channelId);
}

export async function raiseIntent(executionTarget: Identity, intent: IntentType, context: Context, target?: string): Promise<void> {
    return ofBrowser.executeOnWindow(executionTarget, async function(this: TestWindowContext, payload: RaiseIntentPayload): Promise<void> {
        await this.fdc3.raiseIntent(payload.intent, payload.context, payload.target);
    }, {intent, context, target});
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
export interface RemoteEventListener {
    remoteIdentity: Identity;
    id: number;
    getReceivedEvents: () => Promise<FDC3Event[]>;
    unsubscribe: () => Promise<void>;
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
            const allReceivedEvents = await ofBrowser.executeOnWindow(
                executionTarget,
                function(this: TestWindowContext, id: number): {listenerID: number, payload: ChannelChangedEvent}[] {
                    return this.receivedEvents;
                }, id
            );

            console.log('*** getting received events' + allReceivedEvents.length, allReceivedEvents);

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
