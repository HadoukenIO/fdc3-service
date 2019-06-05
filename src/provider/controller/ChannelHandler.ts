import {injectable, inject} from 'inversify';
import {Channel} from 'openfin/_v2/api/interappbus/channel';
import {Identity} from 'openfin/_v2/main';

import {Model} from '../model/Model';
import {Inject} from '../common/Injectables';
import {DEFAULT_CHANNEL_ID, DefaultChannel, ChannelId, FDC3Error, ChannelError, getChannelById, ChannelChangedEvent, Context} from '../../client/main';
import {DesktopContextChannel, DefaultContextChannel, ContextChannel} from '../model/ContextChannel';
import {AppWindow} from '../model/AppWindow';
import {Signal1} from '../common/Signal';
import {EventTransport, APIFromClientTopic} from '../../client/internal';
import {APIHandler} from '../APIHandler';

const DESKTOP_CHANNELS = [
    {
        id: 'red',
        name: 'Red',
        color: 0xFF0000
    },
    {
        id: 'orange',
        name: 'Orange',
        color: 0xFF8000
    },
    {
        id: 'yellow',
        name: 'Yellow',
        color: 0xFFFF00
    },
    {
        id: 'green',
        name: 'Green',
        color: 0x00FF00
    },
    {
        id: 'blue',
        name: 'Blue',
        color: 0x0000FF
    },
    {
        id: 'purple',
        name: 'Purple',
        color: 0xFF00FF
    }
];


@injectable()
export class ChannelHandler {
    public readonly onChannelChanged: Signal1<EventTransport<ChannelChangedEvent>> = new Signal1<EventTransport<ChannelChangedEvent>>();

    private readonly _model: Model;

    constructor(@inject(Inject.MODEL) model: Model,) {
        this._model = model;

        this._model.onWindowAdded.add(this.onModelWindowAdded, this);
        this._model.onWindowRemoved.add(this.onModelWindowRemoved, this);
    }

    public registerChannels(): void {
        const defaultChannel = new DefaultContextChannel(DEFAULT_CHANNEL_ID);

        this._model.registerChannel(defaultChannel);
        for (const channel of DESKTOP_CHANNELS) {
            this._model.registerChannel(new DesktopContextChannel(channel.id, channel.name, channel.color));
        }
    }

    public getDesktopChannels(): ReadonlyArray<DesktopContextChannel> {
        return this._model.channels.filter(channel => channel.type === 'desktop') as DesktopContextChannel[];
    }

    public getWindowsListeningToChannel(channel: ContextChannel): ReadonlyArray<AppWindow> {
        // TODO - Can we drop the `|| window.channel === channel`? May be a break old clients
        return this._model.windows.filter(window => window.contextListeners.indexOf(channel.id) !== -1 || window.channel === channel);
    }

    public getChannelById(channelId: ChannelId): ContextChannel {
        this.validateChannelId(channelId);
        return this._model.getChannel(channelId)!;
    }

    public getChannelMembers(channelId: ChannelId): ReadonlyArray<AppWindow> {
        this.validateChannelId(channelId);

        return this._model.windows.filter(window => window.channel.id === channelId);
    }

    public getChannelContext(channelId: ChannelId): Context | null {
        const channel = this.getChannelById(channelId);
        return channel.getStoredContext();
    }

    public joinChannel(appWindow: AppWindow, id: ChannelId): void {
        const channel = this.getChannelById(id);
        const previousChannel = appWindow.channel;

        appWindow.channel = channel;

        if (this.isChannelEmpty(previousChannel)) {
            previousChannel.clearStoredContext();
        }

        this.onChannelChanged.emit({type: 'channel-changed', identity: appWindow.identity, channel, previousChannel});
    }

    private onModelWindowAdded(window: AppWindow): void {
        this.onChannelChanged.emit({type: 'channel-changed', identity: window.identity, channel: window.channel, previousChannel: null});
    }

    private onModelWindowRemoved(window: AppWindow): void {
        if (this.isChannelEmpty(window.channel)) {
            window.channel.clearStoredContext();
        }

        this.onChannelChanged.emit({type: 'channel-changed', identity: window.identity, channel: null, previousChannel: window.channel});
    }

    private isChannelEmpty(channel: ContextChannel): boolean {
        return !this._model.windows.some(window => window.channel === channel);
    }

    private validateChannelId(channelId: ChannelId): void {
        const channel = this._model.getChannel(channelId);

        if (!channel) {
            throw new FDC3Error(ChannelError.ChannelDoesNotExist, `No channel with channelId: ${channelId}`);
        }
    }
}
