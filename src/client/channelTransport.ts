import {ChannelId, DisplayMetadata} from './contextChannels';

export interface ChannelTransport {
    id: ChannelId;
    type: string;
}

export interface SystemChannelTransport extends ChannelTransport {
    type: 'system';
    visualIdentity: DisplayMetadata;
}

export interface AppChannelTransport extends ChannelTransport {
    type: 'app';
    name: string;
}
