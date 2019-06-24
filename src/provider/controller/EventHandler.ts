import {injectable, inject} from 'inversify';
import _WindowModule from 'openfin/_v2/api/window/window';

import {AppWindow} from '../model/AppWindow';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic, EventTransport} from '../../client/internal';
import {Inject} from '../common/Injectables';
import {ContextChannel} from '../model/ContextChannel';
import {FDC3Event, ChannelWindowAddedEvent, ChannelWindowRemovedEvent, ChannelChangedEvent} from '../../client/main';

import {ChannelHandler} from './ChannelHandler';

@injectable()
export class EventHandler {
    private readonly _channelHandler: ChannelHandler;
    private readonly _apiHandler: APIHandler<APIFromClientTopic>;

    constructor(
        @inject(Inject.CHANNEL_HANDLER) channelHandler: ChannelHandler,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>
    ) {
        this._channelHandler = channelHandler;
        this._apiHandler = apiHandler;
    }

    public async dispatchEventOnChannelChanged(appWindow: AppWindow, channel: ContextChannel | null, previousChannel: ContextChannel | null): Promise<void> {
        const partialEvent = {
            identity: appWindow.identity,
            channel: channel && channel.serialize(),
            previousChannel: previousChannel && previousChannel.serialize()
        };

        const promises: Promise<void>[] = [];

        if (channel) {
            const windowAddedEvent: EventTransport<ChannelWindowAddedEvent> = {
                target: {type: 'channel', id: channel.id},
                type: 'window-added',
                ...partialEvent,
                channel: channel.serialize()
            };

            const addedListeningWindows = this._channelHandler.getWindowsListeningForEventsOnChannel(channel, 'window-added');

            promises.push(...addedListeningWindows.map(window => this.dispatchEvent(window, windowAddedEvent)));
        }

        if (previousChannel) {
            const windowRemovedEvent: EventTransport<ChannelWindowRemovedEvent> = {
                target: {type: 'channel', id: previousChannel.id},
                type: 'window-removed',
                ...partialEvent,
                previousChannel: previousChannel.serialize()
            };

            const removedListeningWindows = this._channelHandler.getWindowsListeningForEventsOnChannel(previousChannel, 'window-removed');

            promises.push(...removedListeningWindows.map(window => this.dispatchEvent(window, windowRemovedEvent)));
        }

        const channelChangedEvent: EventTransport<ChannelChangedEvent> = {
            target: {type: 'main', id: 'main'},
            type: 'channel-changed',
            ...partialEvent
        };

        promises.push(this.publishEvent(channelChangedEvent));

        return Promise.all(promises).then(() => {});
    }

    private dispatchEvent<T extends FDC3Event>(targetWindow: AppWindow, eventTransport: EventTransport<T>): Promise<void> {
        return this._apiHandler.channel.dispatch(targetWindow.identity, 'event', eventTransport);
    }

    private publishEvent<T extends FDC3Event>(eventTransport: EventTransport<T>): Promise<void> {
        return Promise.all(this._apiHandler.channel.publish('event', eventTransport)).then(() => {});
    }
}
