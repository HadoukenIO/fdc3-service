import {injectable, inject} from 'inversify';
import _WindowModule from 'openfin/_v2/api/window/window';

import {AppWindow} from '../model/AppWindow';
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
        @inject(Inject.MODEL) model: Model,
    ) {
        this._apiHandler = apiHandler;
        this._channelHandler = channelHandler;
        this._model = model;
    }

    /**
     * Send a context to a specific app
     * @param window Window to send the context to
     * @param context Context to be sent
     */
    public async send(window: AppWindow, context: Context): Promise<void> {
        const payload: ReceiveContextPayload = {context};
        if (await window.isReadyToReceiveContext()) {
            // TODO: Make sure this will not cause problems if it never returns [SERVICE-555]
            return this._apiHandler.dispatch(window.identity, APIToClientTopic.RECEIVE_CONTEXT, payload);
        }
    }

    /**
     * Broadcast context onto the channel the source window is a member of. The context will be received by all
     * windows in the channel, or listening to the channel, except for the sender itself
     *
     * @param context Context to send
     * @param source Window sending the context. It won't receive the broadcast
     */
    public async broadcast(context: Context, source: AppWindow): Promise<void> {
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
    public async broadcastOnChannel(context: Context, source: AppWindow, channel: ContextChannel): Promise<void> {
        const memberWindows = this._channelHandler.getChannelMembers(channel);
        const listeningWindows = this._channelHandler.getWindowsListeningForContextsOnChannel(channel);

        this._channelHandler.setLastBroadcastOnChannel(channel, context);

        const sourceId = getId(source.identity);

        const promises: Promise<void>[] = [];

        promises.push(...memberWindows
            // Sender window should not receive its own broadcasts
            .filter(window => getId(window.identity) !== sourceId)
            .map(window => this.send(window, context)));

        promises.push(...listeningWindows
        // Sender window should not receive its own broadcasts
            .filter(window => getId(window.identity) !== sourceId)
            .map(window => this.sendOnChannel(window, context, channel)));

        // We intentionally don't await any of this, as these dispatches are not important enough to block the caller
        for (const app of this._model.apps.filter((app: LiveApp) => app.started)) {
            app.getAppInfo().then((appInfo) => {
                this._model.expectWindowsForApp(
                    appInfo,
                    (window: AppWindow) => window.hasContextListener(),
                    async (window: AppWindow) => window.isReadyToReceiveContext()
                ).then((windows) => {
                    windows
                        // Sender window should not receive its own broadcasts
                        .filter(window => getId(window.identity) !== sourceId)
                        .filter(window => !memberWindows.includes(window))
                        .filter(window => window.channel.id === channel.id)
                        .forEach(window => this.sendOnChannel(window, context, channel));
                });
            });

            app.getAppInfo().then((appInfo) => {
                this._model.expectWindowsForApp(
                    appInfo,
                    (window: AppWindow) => window.hasChannelContextListener(channel),
                    async (window: AppWindow) => window.isReadyToReceiveContextOnChannel(channel)
                ).then((windows) => {
                    windows
                        // Sender window should not receive its own broadcasts
                        .filter(window => getId(window.identity) !== sourceId)
                        .filter(window => !listeningWindows.includes(window))
                        .forEach(window => this.sendOnChannel(window, context, channel));
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
    private async sendOnChannel(window: AppWindow, context: Context, channel: ContextChannel): Promise<void> {
        const payload: ChannelReceiveContextPayload = {channel: channel.id, context};

        await this._apiHandler.dispatch(window.identity, APIToClientTopic.CHANNEL_RECEIVE_CONTEXT, payload);
    }
}
