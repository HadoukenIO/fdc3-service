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
import {RuntimeInfo} from 'openfin/_v2/api/system/runtime-info';
import {Signal} from 'openfin-service-signal';

import {AppName} from './directory';
import {AppIntent, Context, IntentResolution, Listener} from './main';
import {ChannelId, DefaultChannel, SystemChannel, ChannelWindowAddedEvent, ChannelWindowRemovedEvent, ChannelChangedEvent, ChannelBase, AppChannel, SystemChannelTransport, ChannelTransport, AppChannelTransport} from './contextChannels';
import {FDC3Error} from './errors';

/**
 * The identity of the main application window of the service provider
 */
const serviceIdentity: Identity = {
    uuid: 'fdc3-service',
    name: 'fdc3-service'
};

/**
 * Name of the IAB channel use to communicate between client and provider
 */
let serviceChannel: string = 'of-fdc3-service-v1';

/**
 * Event fired when the channel to the provider has been re-established.
 */
export const onReconnect = new Signal();

/**
 * ID of the channel all windows are placed in by default when first created
 */
export const DEFAULT_CHANNEL_ID: ChannelId = 'default';

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
    ADD_CONTEXT_LISTENER = 'ADD-CONTEXT-LISTENER',
    REMOVE_CONTEXT_LISTENER = 'REMOVE-CONTEXT-LISTENER',
    GET_SYSTEM_CHANNELS = 'GET-SYSTEM-CHANNELS',
    GET_CHANNEL_BY_ID = 'GET-CHANNEL-BY-ID',
    GET_CURRENT_CHANNEL = 'GET-CURRENT-CHANNEL',
    GET_OR_CREATE_APP_CHANNEL = 'GET-OR-CREATE-APP-CHANNEL',
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
    RECEIVE_INTENT = 'RECEIVE-INTENT',
    RECEIVE_CONTEXT = 'RECEIVE-CONTEXT',
    CHANNEL_RECEIVE_CONTEXT = 'CHANNEL-RECEIVE-CONTEXT'
}

export interface APIFromClient {
    [APIFromClientTopic.OPEN]: [OpenPayload, void];
    [APIFromClientTopic.FIND_INTENT]: [FindIntentPayload, AppIntent];
    [APIFromClientTopic.FIND_INTENTS_BY_CONTEXT]: [FindIntentsByContextPayload, AppIntent[]];
    [APIFromClientTopic.BROADCAST]: [BroadcastPayload, void];
    [APIFromClientTopic.RAISE_INTENT]: [RaiseIntentPayload, IntentResolution];
    [APIFromClientTopic.ADD_INTENT_LISTENER]: [AddIntentListenerPayload, void];
    [APIFromClientTopic.REMOVE_INTENT_LISTENER]: [RemoveIntentListenerPayload, void];
    [APIFromClientTopic.ADD_CONTEXT_LISTENER]: [AddContextListenerPayload, void];
    [APIFromClientTopic.REMOVE_CONTEXT_LISTENER]: [AddContextListenerPayload, void];
    [APIFromClientTopic.GET_SYSTEM_CHANNELS]: [GetSystemChannelsPayload, SystemChannelTransport[]];
    [APIFromClientTopic.GET_CHANNEL_BY_ID]: [GetChannelByIdPayload, ChannelTransport];
    [APIFromClientTopic.GET_CURRENT_CHANNEL]: [GetCurrentChannelPayload, ChannelTransport];
    [APIFromClientTopic.GET_OR_CREATE_APP_CHANNEL]: [GetOrCreateAppChannelPayload, AppChannelTransport];
    [APIFromClientTopic.CHANNEL_GET_MEMBERS]: [ChannelGetMembersPayload, Identity[]];
    [APIFromClientTopic.CHANNEL_JOIN]: [ChannelJoinPayload, void];
    [APIFromClientTopic.CHANNEL_BROADCAST]: [ChannelBroadcastPayload, void];
    [APIFromClientTopic.CHANNEL_GET_CURRENT_CONTEXT]: [ChannelGetCurrentContextPayload, Context|null];
    [APIFromClientTopic.CHANNEL_ADD_CONTEXT_LISTENER]: [ChannelAddContextListenerPayload, void];
    [APIFromClientTopic.CHANNEL_REMOVE_CONTEXT_LISTENER]: [ChannelRemoveContextListenerPayload, void];
    [APIFromClientTopic.CHANNEL_ADD_EVENT_LISTENER]: [ChannelAddEventListenerPayload, void];
    [APIFromClientTopic.CHANNEL_REMOVE_EVENT_LISTENER]: [ChannelRemoveEventListenerPayload, void];
}

export interface APIToClient {
    [APIToClientTopic.RECEIVE_CONTEXT]: [ReceiveContextPayload, void];
    [APIToClientTopic.RECEIVE_INTENT]: [ReceiveIntentPayload, void];
    [APIToClientTopic.CHANNEL_RECEIVE_CONTEXT]: [ChannelReceiveContextPayload, void];
}

/**
 * Defines all events that are fired by the service
 */
export type Events = MainEvents | ChannelEvents;

/**
 * Events that can be received through the top-level `addEventListener`
 */
export type MainEvents = ChannelChangedEvent;

/**
 * Events that can be received through a channel object
 */
export type ChannelEvents = ChannelWindowAddedEvent | ChannelWindowRemovedEvent;

export type TransportMappings<T> =
    T extends DefaultChannel ? ChannelTransport :
        T extends SystemChannel ? SystemChannelTransport :
            T extends AppChannel ? AppChannelTransport :
                T extends ChannelBase ? ChannelTransport :
                    never;
export type TransportMemberMappings<T> =
    T extends DefaultChannel ? ChannelTransport :
        T extends SystemChannel ? SystemChannelTransport :
            T extends AppChannel ? AppChannelTransport :
                T extends ChannelBase ? ChannelTransport :
                    T;

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

export interface GetSystemChannelsPayload {

}

export interface GetChannelByIdPayload {
    id: ChannelId;
}

export interface GetCurrentChannelPayload {
    identity?: Identity;
}

export interface GetOrCreateAppChannelPayload {
    name: string;
}

export interface ChannelGetMembersPayload {
    id: ChannelId;
}

export interface ChannelJoinPayload {
    id: ChannelId;
    identity?: Identity;
}

export interface ChannelBroadcastPayload {
    id: ChannelId;
    context: Context;
}

export interface ChannelGetCurrentContextPayload {
    id: ChannelId;
}

export interface ChannelAddContextListenerPayload {
    id: ChannelId;
}

export interface ChannelRemoveContextListenerPayload {
    id: ChannelId;
}

export interface ChannelAddEventListenerPayload {
    id: ChannelId;
    eventType: ChannelEvents['type'];
}

export interface ChannelRemoveEventListenerPayload {
    id: ChannelId;
    eventType: ChannelEvents['type'];
}

export interface AddIntentListenerPayload {
    intent: string;
}

export interface RemoveIntentListenerPayload {
    intent: string;
}

export interface AddContextListenerPayload {

}

export interface RemoveContextListenerPayload {

}

export interface ReceiveContextPayload {
    context: Context;
}

export interface ReceiveIntentPayload {
    intent: string;
    context: Context;
}

export interface ChannelReceiveContextPayload {
    channel: ChannelId;
    context: Context;
}

/**
 * Invokes an array of listeners with a given context, allowing us to apply consistent error handling. Will throw an error if > 0 listeners are given, and all
 * fail. Otherwise the first *defined* value returned is returned, or undefined is no defined values are returned.
 *
 * @param listeners An array of listeners to invoke
 * @param context The context to invoke the listeners with
 * @param singleFailureHandler A function that will be called each time a listener throws an exception
 * @param createAllFailuresError A function that will be called if all (and more than one) listeners fail.
 * Should return an error, which `invokeListeners` will then throw.
 */
export async function invokeListeners<T = unknown>(
    listeners: Listener[],
    context: Context,
    singleFailureHandler: (e: any) => void,
    createAllFailuresError: () => Error
): Promise<T> {
    let successes = 0;
    let failures = 0;

    const result: T = await new Promise<T>(async (resolve) => {
        await Promise.all(listeners.map(async (listener) => {
            try {
                const value = await listener.handler(context);
                successes++;
                if (value !== undefined) {
                    resolve(value as T);
                }
            } catch (e) {
                failures++;
                singleFailureHandler(e);
            }
        }));
        resolve(undefined);
    });

    if (failures > 0 && successes === 0) {
        throw createAllFailuresError();
    }
    return result;
}

/**
 * If error is a type we explicitly handle (e.g., `TypeError`, `FDC3Error`) so it can be identified as the correct type at the client's end. Otherwise return
 * the error itself.
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
 * Check if the error was a serialized error, and if so reconstruct as the correct type. Otherwise return the error itself.
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

export function getServiceChannel(): string {
    return serviceChannel;
}
export function getServiceIdentity(): Identity {
    return serviceIdentity;
}

export async function setServiceIdentity(runtimeVersion?: string) {
    if (runtimeVersion === undefined) {
        const info: RuntimeInfo = await fin.System.getRuntimeInfo();

        if (info.fdc3AppUuid && info.fdc3ChannelName) {
            serviceIdentity.uuid = info.fdc3AppUuid;
            serviceIdentity.name = info.fdc3AppUuid;
            serviceChannel = info.fdc3ChannelName;
        }
    } else if (runtimeVersion) {
        serviceIdentity.uuid += `-${runtimeVersion}`;
        serviceIdentity.name += `-${runtimeVersion}`;
        serviceChannel += `-${runtimeVersion}`;
    }
}
