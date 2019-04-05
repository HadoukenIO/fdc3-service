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

import {Application, Context, IntentType, ChannelId, Channel, EventPayload, Event} from '../../../src/client/main';

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

export interface RemoteContextListener {
    type: 'context';
    remoteIdentity: Identity;
    id: number;
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
        type: 'context',
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

export async function getRemoteContextListener(executionTarget: Identity, listenerID: number = 0): Promise<RemoteContextListener> {
    // Check that the ID maps to a listener
    const exists = await ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): boolean {
        return typeof this.contextListeners[id] !== 'undefined';
    }, listenerID);

    if (!exists) {
        throw new Error('Could not get remoteListener: No listener found with ID ' + listenerID + ' on window ' + JSON.stringify(executionTarget));
    }
    return {
        type: 'context',
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

export interface RemoteEventListener {
    type: 'event';
    event: Event;
    remoteIdentity: Identity;
    id: number;
    getReceivedEventPayload: () => Promise<EventPayload[]>;
    unsubscribe: () => Promise<void>;
}

export async function addEventListener(executionTarget: Identity, event: Event): Promise<RemoteEventListener> {
    const id = await ofBrowser.executeOnWindow(executionTarget, function(this:TestWindowContext, event: Event): number {
        const listenerID = this.eventListeners.length;
        this.eventListeners[listenerID] = this.fdc3.addEventListener(event, (payload) => {
            this.receivedEvents.push({listenerID, payload});
        },);
        return listenerID;
    }, event);

    return {
        type: 'event',
        event: event,
        remoteIdentity: executionTarget,
        id,
        unsubscribe: async () => {
            return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): void {
                this.eventListeners[id].unsubscribe();
            }, id);
        },
        getReceivedEventPayload: async (): Promise<EventPayload[]> => {
            return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): EventPayload[] {
                return this.receivedEvents.filter(entry => entry.listenerID === id).map(entry => entry.payload);
            }, id);
        }
    };
}

export async function getRemoteEventListener(executionTarget: Identity, listenerID: number = 0): Promise<RemoteEventListener> {
    // Check that the ID maps to a listener
    const {exists, event} = await ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): {exists: boolean, event?: Event} {
        const exists = typeof this.eventListeners[id] !== 'undefined';
        const event = exists ? this.eventListeners[id].event : undefined;
        return {exists, event};
    }, listenerID);

    if (!exists) {
        throw new Error('Could not get remoteListener: No listener found with ID ' + listenerID + ' on window ' + JSON.stringify(executionTarget));
    } else {
        return {
            type: 'event',
            event: event!,
            remoteIdentity: executionTarget,
            id: listenerID,
            unsubscribe: async () => {
                return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): void {
                    this.eventListeners[id].unsubscribe();
                    delete this.eventListeners[id];
                }, listenerID);
            },
            getReceivedEventPayload: async (): Promise<EventPayload[]> => {
                return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, id: number): EventPayload[] {
                    return this.receivedEvents.filter(entry => entry.listenerID === id).map(entry => entry.payload);
                }, listenerID);
            }
        };
    }
}
