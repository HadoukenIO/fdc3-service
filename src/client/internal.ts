/**
 * @hidden
 */

/**
 * File contains types used to communicate between client and provider.
 *
 * These types are a part of the client, but are not required by applications wishing to interact with the service.
 * This file is excluded from the public-facing TypeScript documentation.
 */
import {Identity} from 'openfin/_v2/main';

import {AppName} from './directory';
import {AppIntent, Context, IntentResolution} from './main';
import {Channel, ChannelId} from './contextChannels';

/**
 * The identity of the main application window of the service provider
 */
export const SERVICE_IDENTITY = {
    uuid: 'fdc3-service',
    name: 'fdc3-service'
};

/**
 * Name of the IAB channel use to communicate between client and provider
 */
export const SERVICE_CHANNEL = 'of-fdc3-service-v1';

/**
 * Enum containing all and only actions that the provider can accept.
 */
export enum APITopic {
    OPEN = 'OPEN',
    FIND_INTENT = 'FIND-INTENT',
    FIND_INTENTS_BY_CONTEXT = 'FIND-INTENTS-BY-CONTEXT',
    BROADCAST = 'BROADCAST',
    RAISE_INTENT = 'RAISE-INTENT',
    GET_ALL_CHANNELS = 'GET-ALL-CHANNELS',
    JOIN_CHANNEL = 'JOIN-CHANNEL',
    GET_CHANNEL = 'GET-CHANNEL',
    GET_CHANNEL_MEMBERS = 'GET-CHANNEL-MEMBERS'
}

export type API = {
    [APITopic.OPEN]: [OpenPayload, void];
    [APITopic.FIND_INTENT]: [FindIntentPayload, AppIntent];
    [APITopic.FIND_INTENTS_BY_CONTEXT]: [FindIntentsByContextPayload, AppIntent[]];
    [APITopic.BROADCAST]: [BroadcastPayload, void];
    [APITopic.RAISE_INTENT]: [RaiseIntentPayload, IntentResolution];
    [APITopic.GET_ALL_CHANNELS]: [GetAllChannelsPayload, Channel[]];
    [APITopic.JOIN_CHANNEL]: [JoinChannelPayload, void];
    [APITopic.GET_CHANNEL]: [GetChannelPayload, Channel];
    [APITopic.GET_CHANNEL_MEMBERS]: [GetChannelMembersPayload, Identity[]];
}

export interface OpenPayload {
    name: AppName;
    context?: Context;
}
export interface FindIntentPayload {
    intent: string;
    context?: Context;
}
export interface FindIntentsByContextPayload {
    context: Context;
}
export interface BroadcastPayload {
    context: Context;
}
export interface RaiseIntentPayload {
    intent: string;
    context: Context;
    target?: string;
}

export interface GetAllChannelsPayload {

}

export interface JoinChannelPayload {
    id: ChannelId,
    identity?: Identity
}

export interface GetChannelPayload {
    identity?: Identity
}

export interface GetChannelMembersPayload {
    id: ChannelId;
}
