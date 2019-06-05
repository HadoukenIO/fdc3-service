import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';

import {AppWindow} from '../model/AppWindow';
import {Context} from '../../client/main';
import {ChannelModel} from '../ChannelModel';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic, APIToClientTopic} from '../../client/internal';
import {Inject} from '../common/Injectables';
import {getId} from '../model/Model';

@injectable()
export class ContextHandler {
    private readonly _apiHandler: APIHandler<APIFromClientTopic>;
    private readonly _channelModel: ChannelModel;

    constructor(
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>,
        @inject(Inject.CHANNEL_MODEL) channelModel: ChannelModel
    ) {
        this._apiHandler = apiHandler;
        this._channelModel = channelModel;
    }

    // TODO: Remove ability to pass an Identity, standardise on AppWindow
    /**
     * Send a context to a specific app. Fire and forget
     * @param app App to send the context to
     * @param context Context to be sent
     */
    public async send(app: AppWindow|Identity, context: Context): Promise<void> {
        const identity: Identity = (app as AppWindow).identity || app;
        await this._apiHandler.channel.dispatch(identity, APIToClientTopic.CONTEXT, context);
    }

    /**
     * Broadcast context to all apps in the same channel as the sender, except the sender itself. Fire and forget
     * @param context Context to send
     * @param source App sending the context. It won't receive the broadcast
     */
    public broadcast(context: Context, source: Identity): void {
        const channel = this._channelModel.getChannelForWindow(source);
        const channelMembers = this._channelModel.getChannelMembers(channel.id);

        this._channelModel.setContext(channel.id, context);

        const sourceId = getId(source);

        channelMembers
            // Sender window should not receive its own broadcasts
            .filter(identity => getId(identity) !== sourceId)
            .forEach(identity => this.send(identity, context));
    }
}
