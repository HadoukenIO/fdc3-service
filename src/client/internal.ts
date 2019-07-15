/**
 * @hidden
 */

/**
 * File contains types and helpers used to communicate between client and provider.
 *
 * These exports are a part of the client, but are not required by applications wishing to interact with the service.
 * This file is excluded from the public-facing TypeScript documentation.
 */
import {Identity} from 'openfin/_v2/main';

import {AppName} from './directory';
import {AppIntent, Context, IntentResolution, FDC3Event} from './main';
import {Channel, ChannelId, DefaultChannel, DesktopChannel, FDC3ChannelEventType} from './contextChannels';
import {FDC3Error} from './errors';

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
    CHANNEL_JOIN = 'CHANNEL-JOIN',
    CHANNEL_BROADCAST = 'CHANNEL-BROADCAST',
    CHANNEL_GET_CURRENT_CONTEXT = 'CHANNEL-GET-CURRENT-CONTEXT',
    CHANNEL_ADD_CONTEXT_LISTENER = 'CHANNEL-ADD-CONTEXT-LISTENER',
    CHANNEL_REMOVE_CONTEXT_LISTENER = 'CHANNEL-REMOVE-CONTEXT-LISTENER',
    CHANNEL_ADD_EVENT_LISTENER = 'CHANNEL-ADD-EVENT-LISTENER',
    CHANNEL_REMOVE_EVENT_LISTENER = 'CHANNEL-REMOVE-EVENT-LISTENER'
}

/**
 * Enum containing all and only actions that the client can accept.
 */
export enum APIToClientTopic {
    // TODO: When we're ready to make a breaking change, rename `INTENT` and `CONTEXT` to something more descriptive (SERVICE-533)
    INTENT = 'INTENT',
    CONTEXT = 'CONTEXT',
    HANDLE_CHANNEL_CONTEXT = 'HANDLE-CHANNEL-CONTEXT'
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
    [APIFromClientTopic.CHANNEL_BROADCAST]: [ChannelBroadcastPayload, void];
    [APIFromClientTopic.CHANNEL_GET_CURRENT_CONTEXT]: [ChannelGetCurrentContextPayload, Context|null];
    [APIFromClientTopic.CHANNEL_ADD_CONTEXT_LISTENER]: [ChannelAddContextListenerPayload, void];
    [APIFromClientTopic.CHANNEL_REMOVE_CONTEXT_LISTENER]: [ChannelRemoveContextListenerPayload, void];
    [APIFromClientTopic.CHANNEL_ADD_EVENT_LISTENER]: [ChannelAddEventListenerPayload, void];
    [APIFromClientTopic.CHANNEL_REMOVE_EVENT_LISTENER]: [ChannelRemoveEventListenerPayload, void];
}

export type APIToClient = {
    [APIToClientTopic.CONTEXT]: [ContextPayload, void];
    [APIToClientTopic.INTENT]: [IntentPayload, void];
    [APIToClientTopic.HANDLE_CHANNEL_CONTEXT]: [HandleChannelContextPayload, void];
}

export type TransportMappings<T> =
    T extends DesktopChannel ? DesktopChannelTransport :
    T extends DefaultChannel ? ChannelTransport :
    T extends Channel ? ChannelTransport :
    T;

export type EventTransport<T extends FDC3Event> = {
    [K in keyof T]: TransportMappings<T[K]>;
} & {
    target: {type: string, id: string}
};

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

export interface ChannelBroadcastPayload {
    id: ChannelId,
    context: Context
}

export interface ChannelGetCurrentContextPayload {
    id: ChannelId,
}

export interface ChannelAddContextListenerPayload {
    id: ChannelId;
}

export interface ChannelRemoveContextListenerPayload {
    id: ChannelId;
}

export interface ChannelAddEventListenerPayload {
    id: ChannelId;
    eventType: FDC3ChannelEventType;
}

export interface ChannelRemoveEventListenerPayload {
    id: ChannelId;
    eventType: FDC3ChannelEventType;
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

export interface HandleChannelContextPayload {
    channel: ChannelId,
    context: Context
}

/**
 * If error is a type we explicitly handle (e.g., `TypeError`, `FDC3Error`) so it can be identified as the correct type at the client's end
 * Otherwise return the error itself
 * @param error The error
 */
export function serializeError(error: Error | FDC3Error): Error {
    if (error.name === 'FDC3Error') {
        return new Error(JSON.stringify({
            name: 'FDC3Error',
            code: (error as FDC3Error).code,
            message: error.message
        }));
    } else if (error.name === 'TypeError') {
        return new Error(JSON.stringify({
            name: 'TypeError',
            message: error.message
        }));
    }

    return error;
}

/**
 * Check if the error was a serialized error, and if so reconstruct as the correct type
 * Otherwise return the error itself
 * @param error The error
 */
export function deserializeError(error: Error): Error | FDC3Error {
    try {
        const errorData = JSON.parse(error.message);
        if (errorData && errorData.name) {
            if (errorData.name === 'FDC3Error') {
                return new FDC3Error(errorData.code, errorData.message);
            } else if (errorData.name === 'TypeError') {
                return new TypeError(errorData.message);
            }
        }
    } catch (e) {
        // Payload wasn't a serialized JSON object
    }

    return error;
}
