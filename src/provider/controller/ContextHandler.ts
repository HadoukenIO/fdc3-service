import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';

import {AppWindow} from '../model/AppWindow';
import {Context, ChannelChangedEvent} from '../../client/main';
import {ChannelModel, createChannelModel} from '../ChannelModel';
import {APIHandler} from '../APIHandler';
import {
    APIFromClientTopic,
    APIToClientTopic,
    ChannelTransport,
    GetDesktopChannelsPayload,
    GetCurrentChannelPayload,
    ChannelBroadcastPayload,
    ChannelGetCurrentContextPayload,
    ChannelGetMembersPayload,
    ChannelJoinPayload,
    EventTransport
} from '../../client/internal';
import {Inject} from '../common/Injectables';

@injectable()
export class ContextHandler {
    private _apiHandler: APIHandler<APIFromClientTopic>;
    private _channelModel: ChannelModel;

    constructor(@inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>) {
        this._apiHandler = apiHandler;
        this._channelModel = createChannelModel(apiHandler.onConnection, apiHandler.onDisconnection);
        this._channelModel.onChannelChanged.add(this.onChannelChangedHandler, this);
    }

    // TODO: Remove ability to pass an Identity, standardise on AppWindow
    public async send(app: AppWindow|Identity, context: Context): Promise<void> {
        const identity: Identity = (app as AppWindow).identity || app;
        this._apiHandler.channel.dispatch(identity, APIToClientTopic.CONTEXT, context);
    }

    public async broadcast(context: Context, source: Identity): Promise<void> {
        const channel = this._channelModel.getChannelForWindow(source);
        const channelMembers = this._channelModel.getChannelMembers(channel.id);

        this._channelModel.setContext(channel.id, context);

        const sourceId = AppWindow.getId(source);

        await Promise.all(channelMembers
            // Sender window should not receive its own broadcasts
            .filter(identity => AppWindow.getId(identity) !== sourceId)
            .map(identity => this.send(identity, context)));
    }

    public async getDesktopChannels(payload: GetDesktopChannelsPayload, source: ProviderIdentity): Promise<ChannelTransport[]> {
        return this._channelModel.getAllChannels();
    }

    public async getCurrentChannel(payload: GetCurrentChannelPayload, source: ProviderIdentity): Promise<ChannelTransport> {
        const identity = payload.identity || source;

        return this._channelModel.getChannelForWindow(identity);
    }

    public async channelBroadcast(payload: ChannelBroadcastPayload, source: ProviderIdentity): Promise<void> {
        const channel = this._channelModel.getChannelForWindow(source);
        const channelMembers = this._channelModel.getChannelMembers(channel.id);

        this._channelModel.setContext(channel.id, payload.context);

        return Promise.all(channelMembers.map(identity => this.send(identity, payload.context))).then(() => {});
    }

    public async channelGetCurrentContext(payload: ChannelGetCurrentContextPayload, source: ProviderIdentity): Promise<Context|null> {
        return this._channelModel.getChannelContext(payload.id) || null;
    }

    public async channelGetMembers(payload: ChannelGetMembersPayload, source: ProviderIdentity): Promise<Identity[]> {
        return this._channelModel.getChannelMembers(payload.id);
    }

    public async channelJoin(payload: ChannelJoinPayload, source: ProviderIdentity): Promise<void> {
        const identity = payload.identity || source;

        this._channelModel.joinChannel(identity, payload.id);
        const context = this._channelModel.getContext(payload.id);

        if (context) {
            this.send(identity, context);
        }
    }

    private onChannelChangedHandler(event: EventTransport<ChannelChangedEvent>): void {
        this._apiHandler.channel.publish('event', event);
    }
}
