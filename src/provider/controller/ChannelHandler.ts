import {injectable, inject} from 'inversify';

import {Model} from '../model/Model';
import {Inject} from '../common/Injectables';
import {ChannelId, FDC3Error, ChannelError, Context, FDC3ChannelEventType} from '../../client/main';
import {DesktopContextChannel, ContextChannel} from '../model/ContextChannel';
import {AppWindow} from '../model/AppWindow';
import {Signal3} from '../common/Signal';

@injectable()
export class ChannelHandler {
    /**
     * Channel is adding or removing a window
     *
     * Arguments: (window: AppWindow, channel: ContextChannel | null, previousChannel: ContextChannel | null)
     */
    public readonly onChannelChanged: Signal3<AppWindow, ContextChannel | null, ContextChannel | null>;

    private readonly _model: Model;

    constructor(@inject(Inject.MODEL) model: Model) {
        this._model = model;

        this.onChannelChanged = new Signal3<AppWindow, ContextChannel | null, ContextChannel | null>();

        this._model.onWindowAdded.add(this.onModelWindowAdded, this);
        this._model.onWindowRemoved.add(this.onModelWindowRemoved, this);
    }

    public getDesktopChannels(): DesktopContextChannel[] {
        return this._model.channels.filter(channel => channel.type === 'desktop') as DesktopContextChannel[];
    }

    public getWindowsListeningToChannel(channel: ContextChannel): AppWindow[] {
        return this._model.windows.filter(window => window.hasChannelContextListener(channel));
    }

    public getChannelById(channelId: ChannelId): ContextChannel {
        this.validateChannelId(channelId);
        return this._model.getChannel(channelId)!;
    }

    public getChannelContext(channel: ContextChannel): Context | null {
        return channel.getStoredContext();
    }

    public getChannelMembers(channel: ContextChannel): AppWindow[] {
        return this._model.windows.filter(window => window.channel === channel);
    }

    public getWindowsListeningForContextsOnChannel(channel: ContextChannel): AppWindow[] {
        return this._model.windows.filter(window => window.hasChannelContextListener(channel));
    }

    public getWindowsListeningForEventsOnChannel(channel: ContextChannel, eventType: FDC3ChannelEventType): AppWindow[] {
        return this._model.windows.filter(window => window.hasChannelEventListener(channel, eventType));
    }

    public joinChannel(appWindow: AppWindow, channel: ContextChannel): void {
        const previousChannel = appWindow.channel;

        if (previousChannel !== channel) {
            appWindow.channel = channel;

            if (this.isChannelEmpty(previousChannel)) {
                previousChannel.clearStoredContext();
            }

            this.onChannelChanged.emit(appWindow, channel, previousChannel);
        }
    }

    public setLastBroadcastOnChannel(channel: ContextChannel, context: Context): void {
        if (this._model.windows.some(window => window.channel === channel)) {
            channel.setLastBroadcastContext(context);
        }
    }

    private onModelWindowAdded(window: AppWindow): void {
        this.onChannelChanged.emit(window, window.channel, null);
    }

    private onModelWindowRemoved(window: AppWindow): void {
        if (this.isChannelEmpty(window.channel)) {
            window.channel.clearStoredContext();
        }

        this.onChannelChanged.emit(window, null, window.channel);
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
