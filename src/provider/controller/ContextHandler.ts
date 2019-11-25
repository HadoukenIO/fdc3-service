import {injectable, inject} from 'inversify';

import {AppConnection} from '../model/AppConnection';
import {Context} from '../../client/main';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic, APIToClientTopic, ChannelReceiveContextPayload, ReceiveContextPayload} from '../../client/internal';
import {Inject} from '../common/Injectables';
import {getId} from '../utils/getId';
import {ContextChannel} from '../model/ContextChannel';
import {Model} from '../model/Model';
import {LiveApp} from '../model/LiveApp';
import {collateClientCalls, ClientCallsResult} from '../utils/helpers';

import {ChannelHandler} from './ChannelHandler';

@injectable()
export class ContextHandler {
    private readonly _apiHandler: APIHandler<APIFromClientTopic>;
    private readonly _channelHandler: ChannelHandler;
    private readonly _model: Model;

    constructor(
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>,
        @inject(Inject.CHANNEL_HANDLER) channelHandler: ChannelHandler,
        @inject(Inject.MODEL) model: Model
    ) {
        this._apiHandler = apiHandler;
        this._channelHandler = channelHandler;
        this._model = model;
    }

    /**
     * Send a context to a specific connection. The promise returned may reject if provided client throws an error, so caller should take
     * responsibility for error handling.
     *
     * @param connection Entity to send the context to
     * @param context Context to be sent
     */
    public send(connection: AppConnection, context: Context): Promise<void> {
        const payload: ReceiveContextPayload = {context};
        if (connection.hasContextListener()) {
            return this._apiHandler.dispatch(connection.identity, APIToClientTopic.RECEIVE_CONTEXT, payload);
        } else {
            // We intentionally don't await this, as we have no expectation that connected will add a context listener
            connection.waitForReadyToReceiveContext().then(() => {
                collateClientCalls([this._apiHandler.dispatch(connection.identity, APIToClientTopic.RECEIVE_CONTEXT, payload)]).then(([result]) => {
                    if (result === ClientCallsResult.ALL_FAILURE) {
                        console.warn(`Error thrown by client connection ${connection.id} attempting to handle context, swallowing error`);
                    } else if (result === ClientCallsResult.TIMEOUT) {
                        console.warn(`Timeout waiting for client connection ${connection.id} to handle context, swallowing error`);
                    }
                });
            }, () => {});

            return Promise.resolve();
        }
    }

    /**
     * Broadcast context onto the channel the source entity is a member of. The context will be received by all
     * connections in the channel, or listening to the channel, except for the sender itself.
     *
     * @param context Context to send
     * @param source Entity sending the context. It won't receive the broadcast
     */
    public broadcast(context: Context, source: AppConnection): Promise<void> {
        return this.broadcastOnChannel(context, source, source.channel);
    }

    /**
     * Broadcast context onto the provided channel. The context will be received by all entities in the channel, or
     * listening to the channel, except for the sender itself.
     *
     * @param context Context to send
     * @param source Entity sending the context. It won't receive the broadcast
     * @param channel ContextChannel to broadcast on
     */
    public broadcastOnChannel(context: Context, source: AppConnection, channel: ContextChannel): Promise<void> {
        const members = this._channelHandler.getChannelMembers(channel);
        const listeners = this._channelHandler.getConnectionsListeningForContextsOnChannel(channel);

        this._channelHandler.setLastBroadcastOnChannel(channel, context);

        const sourceId = getId(source.identity);
        const notSender = (connection: AppConnection) => getId(connection.identity) !== sourceId;

        const promises: Promise<void>[] = [];

        promises.push(...members
            .filter(notSender)
            .map((connection) => this.sendForBroadcast(connection, context)));

        promises.push(...listeners
            .filter(notSender)
            .map((connection) => this.sendOnChannelForBroadcast(connection, context, channel)));

        // We intentionally don't await this, as we have no expectation that entities will add a context listener
        for (const app of this._model.apps.filter((testApp: LiveApp) => testApp.started)) {
            app.waitForAppInfo().then((appInfo) => {
                this._model.expectConnectionsForApp(
                    appInfo,
                    (connection: AppConnection) => connection.hasContextListener(),
                    async (connection: AppConnection) => connection.waitForReadyToReceiveContext()
                ).then((connections) => {
                    connections
                        .filter((connection) => notSender(connection) && !members.includes(connection) && connection.channel.id === channel.id)
                        .forEach((connection) => this.sendForBroadcast(connection, context));
                });

                this._model.expectConnectionsForApp(
                    appInfo,
                    (connection: AppConnection) => connection.hasChannelContextListener(channel),
                    async (connection: AppConnection) => connection.waitForReadyToReceiveContextOnChannel(channel)
                ).then((connections) => {
                    connections
                        .filter((connection) => notSender(connection) && !listeners.includes(connection))
                        .forEach((connection) => this.sendOnChannelForBroadcast(connection, context, channel));
                });
            });
        }

        return Promise.all(promises).then(() => {});
    }

    private async sendForBroadcast(connection: AppConnection, context: Context): Promise<void> {
        await collateClientCalls([this.send(connection, context)]).then(([result]) => {
            if (result === ClientCallsResult.ALL_FAILURE) {
                console.warn(`Error thrown by client connection ${connection.id} attempting to handle broadcast, swallowing error`);
            } else if (result === ClientCallsResult.TIMEOUT) {
                console.warn(`Timeout waiting for client connection ${connection.id} to handle broadcast, swallowing error`);
            }
        });
    }

    /**
     * Send a context to a specific app on a specific channel.
     *
     * @param connection Entity to send the context to
     * @param context Context to be sent
     * @param channel Channel context is to be sent on
     */
    private async sendOnChannelForBroadcast(connection: AppConnection, context: Context, channel: ContextChannel): Promise<void> {
        const payload: ChannelReceiveContextPayload = {channel: channel.id, context};

        await collateClientCalls([this._apiHandler.dispatch(connection.identity, APIToClientTopic.CHANNEL_RECEIVE_CONTEXT, payload)]).then(([result]) => {
            if (result === ClientCallsResult.ALL_FAILURE) {
                console.warn(`Error thrown by client connection ${connection.id} attempting to handle broadcast on channel, swallowing error`);
            } else if (result === ClientCallsResult.TIMEOUT) {
                console.warn(`Timeout waiting for client connection ${connection.id} to handle broadcast on channel, swallowing error`);
            }
        });
    }
}
