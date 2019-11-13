import {injectable, inject} from 'inversify';

import {AppWindow} from '../model/AppWindow';
import {Context} from '../../client/main';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic, APIToClientTopic, ChannelReceiveContextPayload, ReceiveContextPayload} from '../../client/internal';
import {Inject} from '../common/Injectables';
import {getId} from '../utils/getId';
import {ContextChannel} from '../model/ContextChannel';
import {Model} from '../model/Model';
import {LiveApp} from '../model/LiveApp';
import {collateClientCalls, CollateClientCallsResult} from '../utils/helpers';

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
     * Send a context to a specific window. The promise returned may reject if provided window throws an error, so caller should take
     * responsibility for error handling.
     *
     * @param window Window to send the context to
     * @param context Context to be sent
     */
    public send(window: AppWindow, context: Context): Promise<void> {
        const payload: ReceiveContextPayload = {context};
        if (window.hasContextListener()) {
            return this._apiHandler.dispatch(window.identity, APIToClientTopic.RECEIVE_CONTEXT, payload);
        } else {
            // We intentionally don't await this, as we have no expectation that windows will add a context listener
            window.waitForReadyToReceiveContext().then(() => {
                collateClientCalls([this._apiHandler.dispatch(window.identity, APIToClientTopic.RECEIVE_CONTEXT, payload)]).then(([result]) => {
                    if (result === CollateClientCallsResult.ALL_FAILURE) {
                        console.warn(`Error thrown by client window ${window.id} attempting to handle context, swallowing error`);
                    } else if (result === CollateClientCallsResult.TIMEOUT) {
                        console.warn(`Timeout waiting for client window ${window.id} to handle context, swallowing error`);
                    }
                });
            }, () => {});

            return Promise.resolve();
        }
    }

    /**
     * Broadcast context onto the channel the source window is a member of. The context will be received by all
     * windows in the channel, or listening to the channel, except for the sender itself.
     *
     * @param context Context to send
     * @param source Window sending the context. It won't receive the broadcast
     */
    public broadcast(context: Context, source: AppWindow): Promise<void> {
        return this.broadcastOnChannel(context, source, source.channel);
    }

    /**
     * Broadcast context onto the provided channel. The context will be received by all windows in the channel, or
     * listening to the channel, except for the sender itself.
     *
     * @param context Context to send
     * @param source Window sending the context. It won't receive the broadcast
     * @param channel ContextChannel to broadcast on
     */
    public broadcastOnChannel(context: Context, source: AppWindow, channel: ContextChannel): Promise<void> {
        const memberWindows = this._channelHandler.getChannelMembers(channel);
        const listeningWindows = this._channelHandler.getWindowsListeningForContextsOnChannel(channel);

        this._channelHandler.setLastBroadcastOnChannel(channel, context);

        const sourceId = getId(source.identity);
        const notSender = (window: AppWindow) => getId(window.identity) !== sourceId;

        const promises: Promise<void>[] = [];

        promises.push(...memberWindows
            .filter(notSender)
            .map((window) => this.sendForBroadcast(window, context)));

        promises.push(...listeningWindows
            .filter(notSender)
            .map((window) => this.sendOnChannelForBroadcast(window, context, channel)));

        // We intentionally don't await this, as we have no expectation that windows will add a context listener
        for (const app of this._model.apps.filter((testApp: LiveApp) => testApp.started)) {
            app.waitForAppInfo().then((appInfo) => {
                this._model.expectWindowsForApp(
                    appInfo,
                    (window: AppWindow) => window.hasContextListener(),
                    async (window: AppWindow) => window.waitForReadyToReceiveContext()
                ).then((windows) => {
                    windows
                        .filter((window) => notSender(window) && !memberWindows.includes(window) && window.channel.id === channel.id)
                        .forEach((window) => this.sendForBroadcast(window, context));
                });

                this._model.expectWindowsForApp(
                    appInfo,
                    (window: AppWindow) => window.hasChannelContextListener(channel),
                    async (window: AppWindow) => window.waitForReadyToReceiveContextOnChannel(channel)
                ).then((windows) => {
                    windows
                        .filter((window) => notSender(window) && !listeningWindows.includes(window))
                        .forEach((window) => this.sendOnChannelForBroadcast(window, context, channel));
                });
            });
        }

        return Promise.all(promises).then(() => {});
    }

    private async sendForBroadcast(window: AppWindow, context: Context): Promise<void> {
        await collateClientCalls([this.send(window, context)]).then(([result]) => {
            if (result === CollateClientCallsResult.ALL_FAILURE) {
                console.warn(`Error thrown by client window ${window.id} attempting to handle broadcast, swallowing error`);
            } else if (result === CollateClientCallsResult.TIMEOUT) {
                console.warn(`Timeout waiting for client window ${window.id} to handle broadcast, swallowing error`);
            }
        });
    }

    /**
     * Send a context to a specific app on a specific channel.
     *
     * @param window Window to send the context to
     * @param context Context to be sent
     * @param channel Channel context is to be sent on
     */
    private async sendOnChannelForBroadcast(window: AppWindow, context: Context, channel: ContextChannel): Promise<void> {
        const payload: ChannelReceiveContextPayload = {channel: channel.id, context};

        await collateClientCalls([this._apiHandler.dispatch(window.identity, APIToClientTopic.CHANNEL_RECEIVE_CONTEXT, payload)]).then(([result]) => {
            if (result === CollateClientCallsResult.ALL_FAILURE) {
                console.warn(`Error thrown by client window ${window.id} attempting to handle broadcast on channel, swallowing error`);
            } else if (result === CollateClientCallsResult.TIMEOUT) {
                console.warn(`Timeout waiting for client window ${window.id} to handle broadcast on channel, swallowing error`);
            }
        });
    }
}
