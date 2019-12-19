import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';

import {Inject} from '../common/Injectables';
import {ContextChannel} from '../model/ContextChannel';
import {Context, ChannelId} from '../../client/main';
import {getServiceIdentity} from '../../client/internal';
import {Model} from '../model/Model';
import {AppConnection} from '../model/AppConnection';

import {AsyncInit} from './AsyncInit';
import {ContextHandler} from './ContextHandler';
import {ChannelHandler} from './ChannelHandler';

const IAB_TOPIC = 'fdc3-cabal';
const REQUEST_GET_ALL = 'request-get-all';
const RESPOND_GET_ALL = 'respond-get-all';
const SET_COLOR_CHANNEL = 'set-color-channel';
const REGISTER_APP_IN_CHANNEL = 'register-app-in-channel';
const UNREGISTER_APP_FROM_CHANNEL = 'unregister-app-from-channel';

interface MsgRequestGetAll {
    kind: typeof REQUEST_GET_ALL;
    source: Identity;
}

interface ChannelState{
    channelId: string;
    context: Context | null;
}

interface MsgRespondGetAll {
    kind: typeof RESPOND_GET_ALL;
    channelStates: ChannelState[];
}

interface MsgSetColorChannel {
    kind: typeof SET_COLOR_CHANNEL;
    channelState: ChannelState;
}

interface MsgRegisterAppInChannel {
    kind: typeof REGISTER_APP_IN_CHANNEL;
    channelId: ChannelId;
    identity: Identity;
}

interface MsgUnregisterAppFromChannel {
    kind: typeof UNREGISTER_APP_FROM_CHANNEL;
    channelId: ChannelId;
    identity: Identity;
}

type Msg = MsgRequestGetAll | MsgRespondGetAll | MsgSetColorChannel | MsgRegisterAppInChannel | MsgUnregisterAppFromChannel;

@injectable()
export class MultiRuntimeHandler extends AsyncInit {
    private readonly _contextHandler: ContextHandler;
    private readonly _channelHandler: ChannelHandler;
    private readonly _model: Model;
    constructor(
        @inject(Inject.CONTEXT_HANDLER) contextHandler: ContextHandler, // eslint-disable-line @typescript-eslint/indent
        @inject(Inject.CHANNEL_HANDLER) channelHandler: ChannelHandler,
        @inject(Inject.MODEL) model: Model
    ) {
        super();
        this._contextHandler = contextHandler;
        this._channelHandler = channelHandler;
        this._model = model;

        this._channelHandler.onChannelChanged.add(this.onChannelChangedHandler, this);
    }

    private async onChannelChangedHandler(connection: AppConnection, channel: ContextChannel | null, previousChannel: ContextChannel | null): Promise<void> {
        const identity = connection.identity;
        if (previousChannel) {
            fin.InterApplicationBus.publish(IAB_TOPIC, {kind: UNREGISTER_APP_FROM_CHANNEL, identity, channelId: previousChannel.id});
        }
        if (channel) {
            fin.InterApplicationBus.publish(IAB_TOPIC, {kind: REGISTER_APP_IN_CHANNEL, identity, channelId: channel.id});
        }
    }

    private handleRequestGetAll(msg: MsgRequestGetAll) {
        const source = msg.source;
        const channelStates = this._model.channels.map((channel) => ({id: channel.id, context: channel.storedContext}));
        fin.InterApplicationBus.send(source, IAB_TOPIC, {kind: RESPOND_GET_ALL, channelStates});
    }

    private handleRespondGetAll(msg: MsgRespondGetAll) {
        for (const channelState of msg.channelStates) {
            this.setSetColorChannel(channelState);
        }
    }

    private handleSetColorChannel(msg: MsgSetColorChannel) {
        this.setSetColorChannel(msg.channelState);
    }

    private handleRegisterAppInChannel(msg: MsgRegisterAppInChannel) {
        this._channelHandler.registerForeignChannelMember(msg.identity, msg.channelId);
    }

    private handleUnregisterAppFromChannel(msg: MsgUnregisterAppFromChannel) {
        this._channelHandler.unregisterForeignChannelMember(msg.identity, msg.channelId);
    }

    private setSetColorChannel(channelState: ChannelState) {
        if (channelState.context) {
            const channel = this._channelHandler.getChannelById(channelState.channelId);
            this._contextHandler.broadcastOnChannel(channelState.context, null, channel, true);
        }
    }

    protected async init(): Promise<void> {
        const subMsg = (msg: Msg, sourceUUID: string, sourceName: string) => {
            switch (msg.kind) {
                case REQUEST_GET_ALL: {
                    this.handleRequestGetAll(msg);
                    break;
                }

                case RESPOND_GET_ALL: {
                    this.handleRespondGetAll(msg);
                    break;
                }

                case SET_COLOR_CHANNEL: {
                    this.handleSetColorChannel(msg);
                    break;
                }

                case REGISTER_APP_IN_CHANNEL: {
                    this.handleRegisterAppInChannel(msg);
                    break;
                }

                case UNREGISTER_APP_FROM_CHANNEL: {
                    this.handleUnregisterAppFromChannel(msg);
                    break;
                }
            }
        };
        await fin.InterApplicationBus.subscribe({uuid: '*'}, IAB_TOPIC, subMsg);
        fin.InterApplicationBus.publish(IAB_TOPIC, {kind: REQUEST_GET_ALL, source: getServiceIdentity()});
    }

    public async broadcastOnChannel(context: Context, channel: ContextChannel): Promise<void> {
        fin.InterApplicationBus.publish(IAB_TOPIC, {kind: SET_COLOR_CHANNEL, id: channel.id, context});
    }

    public async joinChannel(context: Context, channel: ContextChannel): Promise<void> {
        fin.InterApplicationBus.publish(IAB_TOPIC, {kind: SET_COLOR_CHANNEL, id: channel.id, context});
    }
}
