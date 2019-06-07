import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';

import {AppWindow} from '../model/AppWindow';
import {Context} from '../../client/main';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic, APIToClientTopic} from '../../client/internal';
import {Inject} from '../common/Injectables';
import {getId} from '../model/Model';
import {ContextChannel} from '../model/ContextChannel';

import {ChannelHandler} from './ChannelHandler';

@injectable()
export class ContextHandler {
    private readonly _channelHandler: ChannelHandler;
    private readonly _apiHandler: APIHandler<APIFromClientTopic>;

    constructor(
        @inject(Inject.CHANNEL_HANDLER) channelHandler: ChannelHandler,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>
    ) {
        this._channelHandler = channelHandler;
        this._apiHandler = apiHandler;
    }

    // TODO: Remove ability to pass an Identity, standardise on AppWindow
    /**
     * Send a context to a specific app. Fire and forget
     * @param window Window to send the context to
     * @param context Context to be sent
     */
    public async send(window: AppWindow|Identity, context: Context): Promise<void> {
        const identity: Identity = (window as AppWindow).identity || window;
        await this._apiHandler.channel.dispatch(identity, APIToClientTopic.CONTEXT, context);
    }

    /**
     * Broadcast context onto the channel the source window is a member of. The context will be received by all
     * windows in the channel, or listening to the channel, except for the sender itself
     *
     * @param context Context to send
     * @param source Window sending the context. It won't receive the broadcast
     */
    public broadcast(context: Context, source: AppWindow): void {
        this.broadcastOnChannel(context, source, source.channel);
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
        const listeningWindows = this._channelHandler.getWindowsListeningToChannel(channel);

        channel.setLastBroadcastContext(context);

        const sourceId = getId(source.identity);

        listeningWindows
            // Sender window should not receive its own broadcasts
            .filter(window => getId(window.identity) !== sourceId)
            .forEach(window => this.send(window.identity, context));
    }
}
