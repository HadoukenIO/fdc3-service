import {Identity} from 'openfin/_v2/main';

import {Channel, DefaultChannel, SystemChannel, Context, AppChannel} from '../../../src/client/main';
import {ChannelEvents} from '../../../src/client/internal';

import {RemoteContextListener, ofBrowser, handlePuppeteerError, createRemoteContextListener} from './fdc3RemoteExecution';
import {TestChannelTransport, TestWindowContext} from './ofPuppeteer';
import {delay, Duration} from './delay';

export interface RemoteChannelEventListener {
    remoteIdentity: Identity;
    id: number;
    getReceivedEvents: () => Promise<ChannelEvents[]>;
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
            case 'SystemChannel':
                Object.setPrototypeOf(this.channel, SystemChannel);
                break;
            case 'AppChannel':
                Object.setPrototypeOf(this.channel, AppChannel);
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
            function(this: TestWindowContext, channelInstanceId: string, context: Context): void {
                try {
                    return this.channelTransports[channelInstanceId].channel.broadcast(context);
                } catch (error) {
                    this.errorHandler(error);
                }
            },
            this.id,
            context
        ).then(() => new Promise<void>(res => setTimeout(res, 100))) // Broadcast is fire-and-forget. Slight delay to allow for service to handle
            .catch(handlePuppeteerError);
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

        await delay(Duration.LISTENER_HANDSHAKE);

        return createRemoteContextListener(this.executionTarget, id);
    }

    public async addEventListener(eventType: ChannelEvents['type']): Promise<RemoteChannelEventListener> {
        const id = await ofBrowser.executeOnWindow(
            this.executionTarget,
            function(this: TestWindowContext, channelInstanceId: string, eventType: ChannelEvents['type']): number {
                const listenerID = this.channelEventListeners.length;
                const channel = this.channelTransports[channelInstanceId].channel;

                const handler = (payload: ChannelEvents) => {
                    this.receivedChannelEvents.push({listenerID, payload});
                };

                const unsubscribe = () => {
                    channel.removeEventListener(eventType as any, handler as any);
                };

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
            getReceivedEvents: async (): Promise<ChannelEvents[]> => {
                return ofBrowser.executeOnWindow(this.executionTarget, function(this: TestWindowContext, id: number): ChannelEvents[] {
                    return this.receivedChannelEvents.filter(entry => entry.listenerID === id).map(entry => entry.payload);
                }, id);
            }
        };
    }
}
