import {Identity} from 'openfin/_v2/main';
import {inject, injectable} from 'inversify';

import {Channel, ChannelId, DEFAULT_CHANNEL_ID, ChannelChangedEvent} from '../client/contextChannels';
import {Context} from '../client/main';
import {FDC3Error, ChannelError} from '../client/errors';
import {APIFromClientTopic, DesktopChannelTransport, ChannelTransport, EventTransport} from '../client/internal';

import {Signal1} from './common/Signal';
import {Inject} from './common/Injectables';
import {APIHandler} from './APIHandler';


type IdentityHash = string;

const GLOBAL_CHANNEL: ChannelTransport = {
    id: DEFAULT_CHANNEL_ID,
    type: 'default'
};

const DESKTOP_CHANNELS: DesktopChannelTransport[] = [
    {
        id: 'red',
        type: 'desktop',
        name: 'Red',
        color: 0xFF0000
    },
    {
        id: 'orange',
        type: 'desktop',
        name: 'Orange',
        color: 0xFF8000
    },
    {
        id: 'yellow',
        type: 'desktop',
        name: 'Yellow',
        color: 0xFFFF00
    },
    {
        id: 'green',
        type: 'desktop',
        name: 'Green',
        color: 0x00FF00
    },
    {
        id: 'blue',
        type: 'desktop',
        name: 'Blue',
        color: 0x0000FF
    },
    {
        id: 'purple',
        type: 'desktop',
        name: 'Purple',
        color: 0xFF00FF
    }
];

@injectable()
export class ChannelModel {
    public readonly onChannelChanged: Signal1<EventTransport<ChannelChangedEvent>> = new Signal1<EventTransport<ChannelChangedEvent>>();

    private _identityHashToChannelIdMap: Map<IdentityHash, ChannelId> = new Map<IdentityHash, ChannelId>();
    private _channelIdToIdentitiesMap: Map<ChannelId, Identity[]> = new Map<ChannelId, Identity[]>();
    private _channelIdToCachedContextMap: Map<ChannelId, Context> = new Map<ChannelId, Context>();

    private _channelIdToChannelMap: Map<ChannelId, ChannelTransport> = new Map<ChannelId, ChannelTransport>();
    private _channels: ChannelTransport[] = [];

    private _globalChannel: ChannelTransport;

    public constructor(@inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>) {
        this._globalChannel = GLOBAL_CHANNEL;

        this._channels.splice(0, 0, this._globalChannel);
        this._channels.splice(0, 0, ...DESKTOP_CHANNELS);

        for (const channel of this._channels) {
            this._channelIdToChannelMap.set(channel.id, channel);
        }

        apiHandler.onConnection.add(this.onConnection, this);
        apiHandler.onDisconnection.add(this.onDisconnection, this);
    }

    public getDesktopChannels(): ReadonlyArray<DesktopChannelTransport> {
        return DESKTOP_CHANNELS;
    }

    public getChannelById(channelId: ChannelId): ChannelTransport {
        this.validateChannelId(channelId);
        return this._channelIdToChannelMap.get(channelId)!;
    }

    public joinChannel(identity: Identity, channelId: ChannelId): void {
        this.validateChannelId(channelId);
        this.joinChannelInternal(identity, channelId);
    }

    public getChannelForWindow(identity: Identity): ChannelTransport {
        const identityHash = getIdentityHash(identity);
        const channelId = this._identityHashToChannelIdMap.get(identityHash)!;

        return this._channelIdToChannelMap.get(channelId)!;
    }

    public getChannelMembers(channelId: ChannelId): Identity[] {
        this.validateChannelId(channelId);

        return this._channelIdToIdentitiesMap.get(channelId) || [];
    }

    public setContext(channelId: ChannelId, context: Context): void {
        this.validateChannelId(channelId);

        if (channelId !== DEFAULT_CHANNEL_ID) {
            this._channelIdToCachedContextMap.set(channelId, context);
        }
    }

    public getContext(channelId: ChannelId): Context|undefined {
        this.validateChannelId(channelId);

        return this._channelIdToCachedContextMap.get(channelId);
    }

    private onConnection(identity: Identity): void {
        this.joinChannelInternal(identity, DEFAULT_CHANNEL_ID);
    }

    private onDisconnection(identity: Identity): void {
        this.joinChannelInternal(identity, undefined);
    }

    private validateChannelId(channelId: string): void {
        if (!this._channelIdToChannelMap.has(channelId)) {
            throw new FDC3Error(ChannelError.ChannelDoesNotExist, `No channel with channelId: ${channelId}`);
        }
    }

    private joinChannelInternal(identity: Identity, channelId: ChannelId|undefined): void {
        identity = {name: identity.name, uuid: identity.uuid};
        const identityHash = getIdentityHash(identity);
        const previousChannelId = this._identityHashToChannelIdMap.get(identityHash);

        if (channelId !== previousChannelId) {
            if (previousChannelId) {
                const previousIdentities = this._channelIdToIdentitiesMap.get(previousChannelId)!;

                const previousIdentityIndex = previousIdentities.findIndex(searchIdentity => getIdentityHash(searchIdentity) === identityHash);
                previousIdentities.splice(previousIdentityIndex, 1);

                if (previousIdentities.length === 0) {
                    this._channelIdToIdentitiesMap.delete(previousChannelId);
                    this._channelIdToCachedContextMap.delete(previousChannelId);
                }
            }

            if (channelId) {
                this._identityHashToChannelIdMap.set(identityHash, channelId);

                let identities = this._channelIdToIdentitiesMap.get(channelId);

                if (!identities) {
                    identities = [];
                    this._channelIdToIdentitiesMap.set(channelId, identities);
                }

                identities.push(identity);
            } else {
                this._identityHashToChannelIdMap.delete(identityHash);
            }

            const channel = channelId ? this._channelIdToChannelMap.get(channelId)! : null;
            const previousChannel = previousChannelId ? this._channelIdToChannelMap.get(previousChannelId)! : null;

            if (channel) {
                this.onChannelChanged.emit({type: 'channel-changed', identity, channel, previousChannel});
            }
        }
    }
}

function getIdentityHash(identity: Identity): IdentityHash {
    return `${identity.uuid}/${identity.name}`;
}
