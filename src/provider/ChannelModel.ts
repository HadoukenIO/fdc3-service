import {Identity} from 'openfin/_v2/main';

import {Channel, ChannelChangedPayload, ChannelId, GLOBAL_CHANNEL_ID} from '../client/contextChannels';
import {Context} from '../client/main';

type IdentityHash = string;

const GLOBAL_CHANNEL: Channel = {
    id: GLOBAL_CHANNEL_ID,
    type: 'global',
    name: 'Global',
    color: 0xFFFFFF
};

const RED_CHANNEL: Channel = {
    id: 'red',
    type: 'user',
    name: 'Red',
    color: 0xFF0000
};

const ORANGE_CHANNEL: Channel = {
    id: 'orange',
    type: 'user',
    name: 'Orange',
    color: 0xFF8000
};

const YELLOW_CHANNEL: Channel = {
    id: 'yellow',
    type: 'user',
    name: 'Yellow',
    color: 0xFFFF00
};

const GREEN_CHANNEL: Channel = {
    id: 'green',
    type: 'user',
    name: 'Green',
    color: 0x00FF00
};

const BLUE_CHANNEL: Channel = {
    id: 'blue',
    type: 'user',
    name: 'Blue',
    color: 0x0000FF
};

const PURPLE_CHANNEL: Channel = {
    id: 'purple',
    type: 'user',
    name: 'Purple',
    color: 0xFF00FF
};

export function createChannelModel() {
    return new ChannelModel(GLOBAL_CHANNEL, [RED_CHANNEL, ORANGE_CHANNEL, YELLOW_CHANNEL, GREEN_CHANNEL, BLUE_CHANNEL, PURPLE_CHANNEL]);
}

export class ChannelModel {
    private _identityHashToChannelIdMap: Map<IdentityHash, ChannelId> = new Map<IdentityHash, ChannelId>();
    private _channelIdToIdentitiesMap: Map<ChannelId, Identity[]> = new Map<ChannelId, Identity[]>();
    private _channelIdToCachedContextMap: Map<ChannelId, Context> = new Map<ChannelId, Context>();

    private _channelIdToChannelMap: Map<ChannelId, Channel> = new Map<ChannelId, Channel>();
    private _channels: Channel[] = [];

    private _globalChannel: Channel;

    public constructor(globalChannel: Channel, userChannels: Channel[]) {
        this._globalChannel = globalChannel;

        this._channels.splice(0, 0, this._globalChannel);
        this._channels.splice(0, 0, ...userChannels);

        for (const channel of this._channels) {
            this._channelIdToChannelMap.set(channel.id, channel);
        }
    }

    public getAllChannels(): Channel[] {
        return this._channels.slice();
    }

    public joinChannel(identity: Identity, channelId: ChannelId, onChannelChanged: (payload: ChannelChangedPayload) => void) {
        this.validateChannelId(channelId);

        const identityHash = getIdentityHash(identity);
        const previousChannelId = this._identityHashToChannelIdMap.get(identityHash) || GLOBAL_CHANNEL_ID;

        if (channelId !== previousChannelId) {
            if (channelId === GLOBAL_CHANNEL_ID) {
                this._identityHashToChannelIdMap.delete(identityHash);
                let identities = this._channelIdToIdentitiesMap.get(channelId)!;

                identities = identities.filter(searchIdentity => getIdentityHash(searchIdentity) !== identityHash);
                if (identities.length === 0) {
                    this._channelIdToChannelMap.delete(channelId);
                }
            } else {
                this._identityHashToChannelIdMap.set(identityHash, channelId);

                let identities = this._channelIdToIdentitiesMap.get(channelId);

                if (!identities) {
                    identities = [];
                    this._channelIdToIdentitiesMap.set(channelId, identities);
                }

                identities.push(identity);
            }

            const channel = this._channelIdToChannelMap.get(channelId)!;
            const previousChannel = this._channelIdToChannelMap.get(previousChannelId)!;

            onChannelChanged({identity, channel, previousChannel});
        }
    }

    public getChannel(identity: Identity): Channel {
        const identityHash = getIdentityHash(identity);
        const channelId = this._identityHashToChannelIdMap.get(identityHash);

        return channelId ? this._channelIdToChannelMap.get(channelId)! : this._globalChannel;
    }

    public getChannelMembers(channelId: ChannelId, allWindows: Identity[]): Identity[] {
        this.validateChannelId(channelId);

        if (channelId === GLOBAL_CHANNEL_ID) {
            return allWindows.filter(identity => !this._identityHashToChannelIdMap.has(getIdentityHash(identity)));
        } else {
            return this._channelIdToIdentitiesMap.get(channelId) || [];
        }
    }

    public setContext(channelId: ChannelId, context: Context): void {
        this.validateChannelId(channelId);

        if (channelId !== GLOBAL_CHANNEL_ID) {
            this._channelIdToCachedContextMap.set(channelId, context);
        }
    }

    public getContext(channelId: ChannelId): Context|undefined {
        this.validateChannelId(channelId);

        return this._channelIdToCachedContextMap.get(channelId);
    }

    private validateChannelId(channelId: string) {
        if (!this._channelIdToChannelMap.has(channelId)) {
            throw new Error('No channel with channelId: ' + channelId);
        }
    }
}

function getIdentityHash(identity: Identity): IdentityHash {
    return `${identity.uuid}/${identity.name}`;
}
