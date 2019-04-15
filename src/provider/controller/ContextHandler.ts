import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';

import {AppWindow} from '../model/AppWindow';
import {Context, ChannelChangedEvent, Channel} from '../../client/main';
import {ChannelModel, createChannelModel} from '../ChannelModel';
import {APIHandler} from '../APIHandler';
import {APITopic, GetAllChannelsPayload, JoinChannelPayload, GetChannelPayload, GetChannelMembersPayload} from '../../client/internal';
import {Inject} from '../common/Injectables';

@injectable()
export class ContextHandler {
    private _apiHandler: APIHandler<APITopic>;
    private _channelModel: ChannelModel;

    constructor(@inject(Inject.API_HANDLER) apiHandler: APIHandler<APITopic>) {
        this._apiHandler = apiHandler;
        this._channelModel = createChannelModel(apiHandler.onConnection, apiHandler.onDisconnection);
        this._channelModel.onChannelChanged.add(this.onChannelChangedHandler, this);
    }

    public async send(app: AppWindow, context: Context): Promise<void> {
    }

    public async broadcast(context: Context, source: Identity): Promise<void> {
        // const channel = this._channelModel.getChannel(source);
        // const channelMembers = this._channelModel.getChannelMembers(channel.id);

        // this._channelModel.setContext(channel.id, context);

        // return Promise.all(channelMembers.map(identity => this.send(identity, context))).then(() => {});
    }

    public async getAllChannels(payload: GetAllChannelsPayload, source: ProviderIdentity): Promise<Channel[]> {
        return this._channelModel.getAllChannels();
    }

    public async joinChannel(payload: JoinChannelPayload, source: ProviderIdentity): Promise<void> {
        // const identity = payload.identity || source;

        // this._channelModel.joinChannel(identity, payload.id);
        // const context = this._channelModel.getContext(payload.id);

        // if (context) {
        //     this.send(identity, context);
        // }
    }

    public async getChannel(payload: GetChannelPayload, source: ProviderIdentity): Promise<Channel> {
        const identity = payload.identity || source;

        return this._channelModel.getChannel(identity);
    }

    public async getChannelMembers(payload: GetChannelMembersPayload, source: ProviderIdentity): Promise<Identity[]> {
        return this._channelModel.getChannelMembers(payload.id);
    }

    private onChannelChangedHandler(event: ChannelChangedEvent): void {
        this._apiHandler.channel.publish('event', event);
    }
}
