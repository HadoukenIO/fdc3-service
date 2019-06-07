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

import {FDC3Error, IdentityError} from './errors';
import {AppName} from './directory';
import {AppIntent, Context, IntentResolution} from './main';
import {Channel, ChannelId, DefaultChannel, DesktopChannel} from './contextChannels';
import {FDC3Event} from './connection';

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
    GET_DESKTOP_CHANNELS = 'GET-DESKTOP-CHANNELS',
    GET_CHANNEL_BY_ID = 'GET-CHANNEL-BY-ID',
    GET_CURRENT_CHANNEL = 'GET-CURRENT-CHANNEL',
    CHANNEL_GET_MEMBERS = 'CHANNEL-GET-MEMBERS',
    CHANNEL_JOIN = 'CHANNEL-JOIN'
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
    [APIFromClientTopic.GET_DESKTOP_CHANNELS]: [GetDesktopChannelsPayload, DesktopChannelTransport[]];
    [APIFromClientTopic.GET_CHANNEL_BY_ID]: [GetChannelByIdPayload, ChannelTransport];
    [APIFromClientTopic.GET_CURRENT_CHANNEL]: [GetCurrentChannelPayload, ChannelTransport];
    [APIFromClientTopic.CHANNEL_GET_MEMBERS]: [ChannelGetMembersPayload, Identity[]];
    [APIFromClientTopic.CHANNEL_JOIN]: [ChannelJoinPayload, void];
}

export type APIToClient = {
    [APIToClientTopic.CONTEXT]: [ContextPayload, void];
    [APIToClientTopic.INTENT]: [IntentPayload, any];
}

export type TransportMappings<T> =
    T extends Channel ? ChannelTransport :
    T extends DefaultChannel ? ChannelTransport :
    T extends DesktopChannel ? DesktopChannelTransport :
    T;

export type EventTransport<T extends FDC3Event> = {
    [K in keyof T]: TransportMappings<T[K]>;
}

export interface ChannelTransport {
    id: ChannelId;
    type: string;
}

export interface DesktopChannelTransport extends ChannelTransport {
    type: 'desktop';
    name: string;
    color: number;
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

export interface GetDesktopChannelsPayload {

}

export interface GetChannelByIdPayload {
    id: ChannelId;
}

export interface GetCurrentChannelPayload {
    identity?: Identity;
}

export interface ChannelGetMembersPayload {
    id: ChannelId;
}

export interface ChannelJoinPayload {
    id: ChannelId;
    identity?: Identity;
}

export interface IntentListenerPayload {
    intent: string;
}

export interface ContextPayload {
    context: Context;
}

export interface IntentPayload {
    intent: string;
    context: Context;
}
