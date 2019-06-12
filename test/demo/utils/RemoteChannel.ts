import {Identity} from 'openfin/_v2/main';

import {Channel, DefaultChannel, DesktopChannel, Context} from '../../../src/client/main';

import {RemoteContextListener, ofBrowser, handlePuppeteerError, createRemoteContextListener} from './fdc3RemoteExecution';
import {TestChannelTransport, TestWindowContext} from './ofPuppeteer';

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
}
