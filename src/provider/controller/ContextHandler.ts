import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';

import {AppWindow} from '../model/AppWindow';
import {Context, ChannelChangedEvent, Channel} from '../../client/main';
import {ChannelModel} from '../ChannelModel';
import {APIHandler} from '../APIHandler';
import {
    APIFromClientTopic,
    GetAllChannelsPayload,
    JoinChannelPayload,
    GetChannelPayload,
    GetChannelMembersPayload,
    APIToClientTopic
} from '../../client/internal';
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
        this._channelModel.onChannelChanged.add(this.onChannelChangedHandler, this);
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
        const channel = this._channelModel.getChannel(source);
        const channelMembers = this._channelModel.getChannelMembers(channel.id);

        this._channelModel.setContext(channel.id, context);

        const sourceId = getId(source);

        channelMembers
            // Sender window should not receive its own broadcasts
            .filter(identity => getId(identity) !== sourceId)
            .forEach(identity => this.send(identity, context));
    }

    public getAllChannels(payload: GetAllChannelsPayload, source: ProviderIdentity): Channel[] {
        return this._channelModel.getAllChannels();
    }

    public async joinChannel(payload: JoinChannelPayload, source: ProviderIdentity): Promise<void> {
        const identity = payload.identity || source;

        this._channelModel.joinChannel(identity, payload.id);
        const context = this._channelModel.getContext(payload.id);

        if (context) {
            await this.send(identity, context);
        }
    }

    public getChannel(payload: GetChannelPayload, source: ProviderIdentity): Channel {
        const identity = payload.identity || source;

        return this._channelModel.getChannel(identity);
    }

    public getChannelMembers(payload: GetChannelMembersPayload, source: ProviderIdentity): Identity[] {
        return this._channelModel.getChannelMembers(payload.id);
    }

    private onChannelChangedHandler(event: ChannelChangedEvent): void {
        this._apiHandler.channel.publish('event', event);
    }
}
