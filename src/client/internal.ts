import { AppIntent, IntentResolution, Context } from "./main";
import { ProviderIdentity } from "openfin/_v2/api/interappbus/channel/channel";

// tslint:disable:no-any Temporary while e

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
    [APITopic.OPEN]: {name: string; context?: Context};
    [APITopic.FIND_INTENT]: {intent: string; context?: Context};
    [APITopic.FIND_INTENTS_BY_CONTEXT]: {context: Context};
    [APITopic.BROADCAST]: {context: Context};
    [APITopic.RAISE_INTENT]: {intent: string; context: Context, target?: string};
}

export interface TopicResponseMap {
    [APITopic.OPEN]: void;
    [APITopic.FIND_INTENT]: AppIntent;
    [APITopic.FIND_INTENTS_BY_CONTEXT]: AppIntent[];
    [APITopic.BROADCAST]: void;
    [APITopic.RAISE_INTENT]: IntentResolution;
}

export type Handler<T extends APITopic> = (() => TopicResponseMap[T]) | 
    ((payload: TopicPayloadMap[T]) => TopicResponseMap[T]) | 
    ((payload: TopicPayloadMap[T], source: ProviderIdentity) => TopicResponseMap[T]);


export type ActionsMap = {[T in APITopic]: Handler<T>};

const temp: ActionsMap = {
    [APITopic.OPEN]: () => {},
    [APITopic.FIND_INTENT]: () => {},
    [APITopic.FIND_INTENTS_BY_CONTEXT]: () => {},
    [APITopic.BROADCAST]: () => {},
    [APITopic.RAISE_INTENT]: () => {},
};