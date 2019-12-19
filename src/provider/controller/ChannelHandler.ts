import {injectable, inject} from 'inversify';
import {Signal, Aggregators} from 'openfin-service-signal';
import {Identity} from 'openfin/_v2/main';

import {Model} from '../model/Model';
import {Inject} from '../common/Injectables';
import {ChannelId, FDC3Error, ChannelError, Context} from '../../client/main';
import {SystemContextChannel, ContextChannel, AppContextChannel} from '../model/ContextChannel';
import {AppConnection} from '../model/AppConnection';
import {ChannelEvents} from '../../client/internal';
import {MultiRuntimeHandler} from '../controller/MultiRuntimeHandler';

@injectable()
export class ChannelHandler {
    /**
     * Channel is adding or removing an entity
     *
     * Arguments: (connection: AppConnection, channel: ContextChannel | null, previousChannel: ContextChannel | null)
     */
    public readonly onChannelChanged: Signal<[AppConnection, ContextChannel | null, ContextChannel | null], Promise<void>>;

    private readonly _model: Model;
    private readonly _mrh: MultiRuntimeHandler;

    constructor(
        @inject(Inject.MODEL) model: Model, // eslint-disable-line @typescript-eslint/indent
        @inject(Inject.MULTI_RUNTIME_HANDLER) multiRuntimeHandler: MultiRuntimeHandler
    ) {
        this._model = model;
        this._mrh = multiRuntimeHandler;

        this.onChannelChanged = new Signal(Aggregators.AWAIT_VOID);

        this._model.onConnectionAdded.add(this.onModelConnectionAdded, this);
        this._model.onConnectionRemoved.add(this.onModelConnectionRemoved, this);
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

    public getConnectionsListeningForContextsOnChannel(channel: ContextChannel): AppConnection[] {
        return this._model.connections.filter((connection) => connection.hasChannelContextListener(channel));
    }

    public getConnectionsListeningForEventsOnChannel(channel: ContextChannel, eventType: ChannelEvents['type']): AppConnection[] {
        return this._model.connections.filter((connection) => connection.hasChannelEventListener(channel, eventType));
    }

    public async joinChannel(connection: AppConnection, channel: ContextChannel): Promise<void> {
        const previousChannel = connection.channel;

        if (previousChannel !== channel) {
            connection.channel = channel;

            if (this.isChannelEmpty(previousChannel)) {
                previousChannel.clearStoredContext();
            }

            await this.onChannelChanged.emit(connection, channel, previousChannel);
        }
    }

    public setLastBroadcastOnChannel(channel: ContextChannel, context: Context): void {
        if (this._model.connections.some((connection) => connection.channel === channel)) {
            channel.setLastBroadcastContext(context);
        }
    }

    private onModelConnectionAdded(connection: AppConnection): void {
        this.onChannelChanged.emit(connection, connection.channel, null);
    }

    private onModelConnectionRemoved(connection: AppConnection): void {
        if (this.isChannelEmpty(connection.channel)) {
            connection.channel.clearStoredContext();
        }

        this.onChannelChanged.emit(connection, null, connection.channel);
    }

    private isChannelEmpty(channel: ContextChannel): boolean {
        return !this._model.connections.some((connection) => connection.channel === channel) && this._model.getForeignChannelMembers(channel.id).length === 0;
    }

    private validateChannelId(channelId: ChannelId): void {
        const channel = this._model.getChannel(channelId);

        if (!channel) {
            throw new FDC3Error(ChannelError.ChannelWithIdDoesNotExist, `No channel '${channelId}' found`);
        }
    }

    private isSystemChannel(channel: ContextChannel): channel is SystemContextChannel {
        return channel.type === 'system';
    }

    public registerForeignChannelMember(id: Identity, channelId: ChannelId): void {
        this._model.registerForeignChannelMember(id, channelId);
    }

    public unregisterForeignChannelMember(id: Identity, channelId: ChannelId): void {
        this._model.unregisterForeignChannelMember(id, channelId);
    }
}
