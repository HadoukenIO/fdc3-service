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
     * Send a context to a specific app
     * @param connection Window to send the context to
     * @param context Context to be sent
     */
    public send(connection: AppConnection, context: Context): Promise<void> {
        const payload: ReceiveContextPayload = {context};
        if (connection.hasContextListener()) {
            // TODO: Make sure this will not cause problems if it never returns [SERVICE-555]
            return this._apiHandler.dispatch(connection.identity, APIToClientTopic.RECEIVE_CONTEXT, payload);
        } else {
            // We intentionally don't await this, as we have no expectation that windows will add a context listener
            connection.waitForReadyToReceiveContext().then(() => {
                // TODO: Make sure this will not cause problems if it never returns [SERVICE-555]
                return this._apiHandler.dispatch(connection.identity, APIToClientTopic.RECEIVE_CONTEXT, payload);
            }, () => {});

            return Promise.resolve();
        }
    }

    /**
     * Broadcast context onto the channel the source window is a member of. The context will be received by all
     * windows in the channel, or listening to the channel, except for the sender itself
     *
     * @param context Context to send
     * @param source Window sending the context. It won't receive the broadcast
     */
    public broadcast(context: Context, source: AppConnection): Promise<void> {
        return this.broadcastOnChannel(context, source, source.channel);
    }

    /**
     * Broadcast context onto the provided channel. The context will be received by all windows in the channel, or
     * listening to the channel, except for the sender itself
     *
     * @param context Context to send
     * @param source Window sending the context. It won't receive the broadcast
     * @param channel ContextChannel to broadcast on
     */
    public broadcastOnChannel(context: Context, source: AppConnection, channel: ContextChannel): Promise<void> {
        const memberWindows = this._channelHandler.getChannelMembers(channel);
        const listeningWindows = this._channelHandler.getWindowsListeningForContextsOnChannel(channel);

        this._channelHandler.setLastBroadcastOnChannel(channel, context);

        const sourceId = getId(source.identity);
        const notSender = (window: AppConnection) => getId(window.identity) !== sourceId;

        const promises: Promise<void>[] = [];

        promises.push(...memberWindows
            .filter(notSender)
            .map((window) => this.send(window, context)));

        promises.push(...listeningWindows
            .filter(notSender)
            .map((window) => this.sendOnChannel(window, context, channel)));

        // We intentionally don't await this, as we have no expectation that windows will add a context listener
        for (const app of this._model.apps.filter((testApp: LiveApp) => testApp.started)) {
            app.waitForAppInfo().then((appInfo) => {
                this._model.expectConnectionsForApp(
                    appInfo,
                    (window: AppConnection) => window.hasContextListener(),
                    async (window: AppConnection) => window.waitForReadyToReceiveContext()
                ).then((windows) => {
                    windows
                        .filter((window) => notSender(window) && !memberWindows.includes(window) && window.channel.id === channel.id)
                        .forEach((window) => this.send(window, context));
                });

                this._model.expectConnectionsForApp(
                    appInfo,
                    (window: AppConnection) => window.hasChannelContextListener(channel),
                    async (window: AppConnection) => window.waitForReadyToReceiveContextOnChannel(channel)
                ).then((windows) => {
                    windows
                        .filter((window) => notSender(window) && !listeningWindows.includes(window))
                        .forEach((window) => this.sendOnChannel(window, context, channel));
                });
            });
        }

        return Promise.all(promises).then(() => {});
    }

    /**
     * Send a context to a specific app on a specific channel
     * @param window Window to send the context to
     * @param context Context to be sent
     * @param channel Channel context is to be sent on
     */
    private async sendOnChannel(window: AppConnection, context: Context, channel: ContextChannel): Promise<void> {
        const payload: ChannelReceiveContextPayload = {channel: channel.id, context};

        await this._apiHandler.dispatch(window.identity, APIToClientTopic.CHANNEL_RECEIVE_CONTEXT, payload);
    }
}
