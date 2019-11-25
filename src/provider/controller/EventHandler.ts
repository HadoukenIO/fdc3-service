import {injectable, inject} from 'inversify';

import {AppConnection} from '../model/AppConnection';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic, Events} from '../../client/internal';
import {Inject} from '../common/Injectables';
import {ContextChannel} from '../model/ContextChannel';
import {ChannelWindowAddedEvent, ChannelWindowRemovedEvent, ChannelChangedEvent} from '../../client/main';
import {Transport, Targeted} from '../../client/EventRouter';
import {collateClientCalls, ClientCallsResult} from '../utils/helpers';

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

    public async dispatchEventOnChannelChanged(
        appConnection: AppConnection,
        channel: ContextChannel | null,
        previousChannel: ContextChannel | null
    ): Promise<void> {
        const partialEvent = {
            identity: appConnection.identity,
            channel: channel && channel.serialize(),
            previousChannel: previousChannel && previousChannel.serialize()
        };

        const promises: Promise<void>[] = [];

        if (channel) {
            const windowAddedEvent: Targeted<Transport<ChannelWindowAddedEvent>> = {
                target: {type: 'channel', id: channel.id},
                type: 'window-added',
                ...partialEvent,
                channel: channel.serialize()
            };

            const addedListeningWindows = this._channelHandler.getConnectionsListeningForEventsOnChannel(channel, 'window-added');

            promises.push(...addedListeningWindows.map((connection) => this.dispatchEvent(connection, windowAddedEvent)));
        }

        if (previousChannel) {
            const windowRemovedEvent: Targeted<Transport<ChannelWindowRemovedEvent>> = {
                target: {type: 'channel', id: previousChannel.id},
                type: 'window-removed',
                ...partialEvent,
                previousChannel: previousChannel.serialize()
            };

            const removedListeningWindows = this._channelHandler.getConnectionsListeningForEventsOnChannel(previousChannel, 'window-removed');

            promises.push(...removedListeningWindows.map((connection) => this.dispatchEvent(connection, windowRemovedEvent)));
        }

        const channelChangedEvent: Targeted<Transport<ChannelChangedEvent>> = {
            target: 'default',
            type: 'channel-changed',
            ...partialEvent
        };

        promises.push(this.publishEvent(channelChangedEvent));

        return Promise.all(promises).then(() => {});
    }

    private dispatchEvent<T extends Events>(target: AppConnection, eventTransport: Targeted<Transport<T>>): Promise<void> {
        return collateClientCalls([this._apiHandler.dispatch(target.identity, 'event', eventTransport)]).then(([result]) => {
            if (result === ClientCallsResult.ALL_FAILURE) {
                console.warn(`Error thrown by client attempting to handle event ${eventTransport.type}, swallowing error`);
            } else if (result === ClientCallsResult.TIMEOUT) {
                console.warn(`Timeout waiting for client to handle event ${eventTransport.type}, swallowing error`);
            }
        });
    }

    private publishEvent<T extends Events>(eventTransport: Targeted<Transport<T>>): Promise<void> {
        return collateClientCalls(this._apiHandler.publish('event', eventTransport)).then(([result]) => {
            if (result === ClientCallsResult.ALL_FAILURE) {
                console.warn(`Error(s) thrown by client attempting to handle event ${eventTransport.type}, swallowing error(s)`);
            } else if (result === ClientCallsResult.TIMEOUT) {
                console.warn(`Timeout waiting for client to handle event ${eventTransport.type}, swallowing error`);
            }
        });
    }
}
