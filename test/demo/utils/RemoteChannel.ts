import {Identity} from 'openfin/_v2/main';

import {Channel, DefaultChannel, DesktopChannel, Context, ChannelEventType, ChannelEvent} from '../../../src/client/main';

import {RemoteContextListener, ofBrowser, handlePuppeteerError, createRemoteContextListener} from './fdc3RemoteExecution';
import {TestChannelTransport, TestWindowContext} from './ofPuppeteer';

export interface RemoteChannelEventListener {
    remoteIdentity: Identity;
    id: number;
    getReceivedEvents: () => Promise<ChannelEvent[]>;
    unsubscribe: () => Promise<void>;
}

export class RemoteChannel {
    public readonly executionTarget: Identity;
    public readonly id: string;

    public readonly channel: Channel;

    constructor(executionTarget: Identity, transport: TestChannelTransport) {
        this.executionTarget = executionTarget;
        this.id = transport.id;

        this.channel = transport.channel;

        switch (transport.constructor) {
            case 'DefaultChannel':
                Object.setPrototypeOf(this.channel, DefaultChannel);
                break;
            case 'DesktopChannel':
                Object.setPrototypeOf(this.channel, DesktopChannel);
                break;
            default:
                throw new Error(`Unexpected channel constructor received: ${transport.constructor}`);
        }
    }

    public async getMembers(): Promise<Identity[]> {
        return ofBrowser.executeOnWindow(this.executionTarget, async function(this: TestWindowContext, channelInstanceId: string): Promise<Identity[]> {
            return this.channelTransports[channelInstanceId].channel.getMembers().catch(this.errorHandler);
        }, this.id).catch(handlePuppeteerError);
    }

    public async getCurrentContext(): Promise<Context|null> {
        return ofBrowser.executeOnWindow(this.executionTarget, async function(this: TestWindowContext, channelInstanceId: string): Promise<Context|null> {
            return this.channelTransports[channelInstanceId].channel.getCurrentContext().catch(this.errorHandler);
        }, this.id).catch(handlePuppeteerError);
    }

    public async join(identity?: Identity): Promise<void> {
        return ofBrowser.executeOnWindow(
            this.executionTarget,
            async function(this: TestWindowContext, channelInstanceId: string, identity?: Identity): Promise<void> {
                return this.channelTransports[channelInstanceId].channel.join(identity).catch(this.errorHandler);
            },
            this.id,
            identity
        ).catch(handlePuppeteerError);
    }

    public async broadcast(context: Context): Promise<void> {
        return ofBrowser.executeOnWindow(
            this.executionTarget,
            async function(this: TestWindowContext, channelInstanceId: string, context: Context): Promise<void> {
                return this.channelTransports[channelInstanceId].channel.broadcast(context).catch(this.errorHandler);
            },
            this.id,
            context
        ).catch(handlePuppeteerError);
    }

    public async addContextListener(): Promise<RemoteContextListener> {
        const id = await ofBrowser.executeOnWindow(
            this.executionTarget,
            async function(this:TestWindowContext, channelInstanceId: string): Promise<number> {
                const listenerID = this.contextListeners.length;
                this.contextListeners[listenerID] = await this.channelTransports[channelInstanceId].channel.addContextListener((context) => {
                    this.receivedContexts.push({listenerID, context});
                });
                return listenerID;
            }, this.id
        );

        return createRemoteContextListener(this.executionTarget, id);
    }

    public async addEventListener(eventType: ChannelEventType): Promise<RemoteChannelEventListener> {
        const id = await ofBrowser.executeOnWindow(
            this.executionTarget,
            function(this: TestWindowContext, channelInstanceId: string, eventType: ChannelEventType): number {
                const listenerID = this.channelEventListeners.length;
                const channel = this.channelTransports[channelInstanceId].channel;

                const handler = (payload: ChannelEvent) => {
                    this.receivedChannelEvents.push({listenerID, payload});
                };

                const unsubscribe = () => {
                    // TODO: Type magic to make this not necessary
                    channel.removeEventListener(eventType as any, handler as any);
                };

                // TODO: Type magic to make this not necessary
                channel.addEventListener(eventType as any, handler as any);
                this.channelEventListeners[listenerID] = {handler, unsubscribe};
                return listenerID;
            },
            this.id,
            eventType
        );

        return {
            remoteIdentity: this.executionTarget,
            id,
            unsubscribe: async () => {
                return ofBrowser.executeOnWindow(this.executionTarget, function(this: TestWindowContext, id: number): void {
                    this.channelEventListeners[id].unsubscribe();
                }, id);
            },
            getReceivedEvents: async (): Promise<ChannelEvent[]> => {
                return ofBrowser.executeOnWindow(this.executionTarget, function(this: TestWindowContext, id: number): ChannelEvent[] {
                    return this.receivedChannelEvents.filter(entry => entry.listenerID === id).map(entry => entry.payload);
                }, id);
            }
        };
    }
}
