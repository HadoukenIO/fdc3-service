import { AppIntent, IntentResolution, Context } from "./main";

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
    [APITopic.RAISE_INTENT]: IntentResolution;
}

export interface OpenPayload {
    name: string;
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
    target: string;
}