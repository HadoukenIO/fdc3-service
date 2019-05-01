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
export enum APIFromClientTopic {
    OPEN = 'OPEN',
    FIND_INTENT = 'FIND-INTENT',
    FIND_INTENTS_BY_CONTEXT = 'FIND-INTENTS-BY-CONTEXT',
    BROADCAST = 'BROADCAST',
    RAISE_INTENT = 'RAISE-INTENT',
    ADD_INTENT_LISTENER = 'ADD-INTENT-LISTENER',
    REMOVE_INTENT_LISTENER = 'REMOVE-INTENT-LISTENER',
    GET_ALL_CHANNELS = 'GET-ALL-CHANNELS',
    JOIN_CHANNEL = 'JOIN-CHANNEL',
    GET_CHANNEL = 'GET-CHANNEL',
    GET_CHANNEL_MEMBERS = 'GET-CHANNEL-MEMBERS'
}

/**
 * Enum containing all and only actions that the client can accept.
 */
export enum APIToClientTopic {
  INTENT = 'INTENT',
  CONTEXT = 'CONTEXT',
}

export type APIFromClient = {
    [APIFromClientTopic.OPEN]: [OpenPayload, void];
    [APIFromClientTopic.FIND_INTENT]: [FindIntentPayload, AppIntent];
    [APIFromClientTopic.FIND_INTENTS_BY_CONTEXT]: [FindIntentsByContextPayload, AppIntent[]];
    [APIFromClientTopic.BROADCAST]: [BroadcastPayload, void];
    [APIFromClientTopic.RAISE_INTENT]: [RaiseIntentPayload, IntentResolution];
    [APIFromClientTopic.ADD_INTENT_LISTENER]: [IntentListenerPayload, void];
    [APIFromClientTopic.REMOVE_INTENT_LISTENER]: [IntentListenerPayload, void];
    [APIFromClientTopic.GET_ALL_CHANNELS]: [GetAllChannelsPayload, Channel[]];
    [APIFromClientTopic.JOIN_CHANNEL]: [JoinChannelPayload, void];
    [APIFromClientTopic.GET_CHANNEL]: [GetChannelPayload, Channel];
    [APIFromClientTopic.GET_CHANNEL_MEMBERS]: [GetChannelMembersPayload, Identity[]];
}

export type APIToClient = {
    [APIToClientTopic.CONTEXT]: [ContextPayload, void];
    [APIToClientTopic.INTENT]: [IntentPayload, any];
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

export interface IntentPayload {
    intent: string;
    context: Context;
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

export interface ContextPayload {
    context: Context;
}

export interface IntentListenerPayload {
  intent: string;
}
