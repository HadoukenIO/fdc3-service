import {AppIntent, Context, IntentResolution} from './main';
import { DirectoryAppName } from './directory';

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
    FIND_INTENTS_BY_CONTEXT = 'FIND-INTENT-BY-CONTEXT',
    BROADCAST = 'BROADCAST',
    RAISE_INTENT = 'RAISE-INTENT'
}

export interface TopicPayloadMap {
    [APITopic.OPEN]: OpenPayload;
    [APITopic.FIND_INTENT]: FindIntentPayload;
    [APITopic.FIND_INTENTS_BY_CONTEXT]: FindIntentsByContextPayload;
    [APITopic.BROADCAST]: BroadcastPayload;
    [APITopic.RAISE_INTENT]: RaiseIntentPayload;
}

export interface TopicResponseMap {
    [APITopic.OPEN]: void;
    [APITopic.FIND_INTENT]: AppIntent;
    [APITopic.FIND_INTENTS_BY_CONTEXT]: AppIntent[];
    [APITopic.BROADCAST]: void;
    // This is not strictly to spec as target should be able to return data.
    // Needs a not-insignificant amount of provider changes to allow the two-way
    // transmission of data before it can be put back to IntentResponse
    // TODO: Revisit after SERVICE-392
    [APITopic.RAISE_INTENT]: void;
}

export interface OpenPayload {
    name: DirectoryAppName;
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