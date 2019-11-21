import {injectable, inject} from 'inversify';
import {Signal, Aggregators} from 'openfin-service-signal';

import {Model} from '../model/Model';
import {Inject} from '../common/Injectables';
import {ChannelId, FDC3Error, ChannelError, Context} from '../../client/main';
import {SystemContextChannel, ContextChannel, AppContextChannel} from '../model/ContextChannel';
import {AppConnection} from '../model/AppConnection';
import {ChannelEvents} from '../../client/internal';

@injectable()
export class ChannelHandler {
    /**
     * Channel is adding or removing a window
     *
     * Arguments: (connection: AppConnection, channel: ContextChannel | null, previousChannel: ContextChannel | null)
     */
    public readonly onChannelChanged: Signal<[AppConnection, ContextChannel | null, ContextChannel | null], Promise<void>>;

    private readonly _model: Model;

    constructor(@inject(Inject.MODEL) model: Model) {
        this._model = model;

        this.onChannelChanged = new Signal(Aggregators.AWAIT_VOID);

        this._model.onConnectionAdded.add(this.onModelWindowAdded, this);
        this._model.onConnectionRemoved.add(this.onModelWindowRemoved, this);
    }

    public getSystemChannels(): SystemContextChannel[] {
        return this._model.channels.filter<SystemContextChannel>(this.isSystemChannel);
    }

    public getAppChannelByName(name: string): AppContextChannel {
        const channelId = `app-channel-${name}`;

        let channel = this._model.getChannel(channelId) as AppContextChannel | null;

        if (!channel) {
            channel = new AppContextChannel(channelId, name);
            this._model.setChannel(channel);
        }

        return channel;
    }

    public getChannelById(channelId: ChannelId): ContextChannel {
        this.validateChannelId(channelId);
        return this._model.getChannel(channelId)!;
    }

    public getChannelContext(channel: ContextChannel): Context | null {
        return channel.storedContext;
    }

    public getChannelMembers(channel: ContextChannel): AppConnection[] {
        return this._model.connections.filter((connection) => connection.channel === channel);
    }

    public getWindowsListeningForContextsOnChannel(channel: ContextChannel): AppConnection[] {
        return this._model.connections.filter((connection) => connection.hasChannelContextListener(channel));
    }

    public getWindowsListeningForEventsOnChannel(channel: ContextChannel, eventType: ChannelEvents['type']): AppConnection[] {
        return this._model.connections.filter((connection) => connection.hasChannelEventListener(channel, eventType));
    }

    public async joinChannel(appWindow: AppConnection, channel: ContextChannel): Promise<void> {
        const previousChannel = appWindow.channel;

        if (previousChannel !== channel) {
            appWindow.channel = channel;

            if (this.isChannelEmpty(previousChannel)) {
                previousChannel.clearStoredContext();
            }

            await this.onChannelChanged.emit(appWindow, channel, previousChannel);
        }
    }

    public setLastBroadcastOnChannel(channel: ContextChannel, context: Context): void {
        if (this._model.connections.some((window) => window.channel === channel)) {
            channel.setLastBroadcastContext(context);
        }
    }

    private onModelWindowAdded(window: AppConnection): void {
        this.onChannelChanged.emit(window, window.channel, null);
    }

    private onModelWindowRemoved(window: AppConnection): void {
        if (this.isChannelEmpty(window.channel)) {
            window.channel.clearStoredContext();
        }

        this.onChannelChanged.emit(window, null, window.channel);
    }

    private isChannelEmpty(channel: ContextChannel): boolean {
        return !this._model.connections.some((window) => window.channel === channel);
    }

    private validateChannelId(channelId: ChannelId): void {
        const channel = this._model.getChannel(channelId);

        if (!channel) {
            throw new FDC3Error(ChannelError.ChannelWithIdDoesNotExist, `No channel with channelId: ${channelId}`);
        }
    }

    private isSystemChannel(channel: ContextChannel): channel is SystemContextChannel {
        return channel.type === 'system';
    }
}
