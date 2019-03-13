import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';

import {APITopic, BroadcastPayload, FindIntentPayload, FindIntentsByContextPayload, OpenPayload, RaiseIntentPayload, TopicPayloadMap, TopicResponseMap} from '../client/internal';
import {AppIntent} from '../client/main';

import {ActionHandlerMap} from './APIHandler';

/**
 * For the time being this file is not used. Expectation is that the provider restructure
 * would include modularising enough that these end-points could be wired up.
 */

export const actionHandlerMap: ActionHandlerMap<APITopic, TopicPayloadMap, TopicResponseMap> = {
    [APITopic.OPEN]: handleOpen,
    [APITopic.FIND_INTENT]: handleFindIntent,
    [APITopic.FIND_INTENTS_BY_CONTEXT]: handleFindIntentsByContext,
    [APITopic.BROADCAST]: handleBroadcast,
    [APITopic.RAISE_INTENT]: handleRaiseIntent,
};

async function handleOpen(payload: OpenPayload, source: ProviderIdentity): Promise<void> {
    // This should be filled in once provider re-structuring is complete

    throw new NotImplementedError('handleOpen');
}

async function handleFindIntent(payload: FindIntentPayload, source: ProviderIdentity): Promise<AppIntent> {
    // This should be filled in once provider re-structuring is complete

    throw new NotImplementedError('handleFindIntent');
}

async function handleFindIntentsByContext(payload: FindIntentsByContextPayload, source: ProviderIdentity): Promise<AppIntent[]> {
    // This should be filled in once provider re-structuring is complete

    throw new NotImplementedError('handleFindIntentsByContext');
}

async function handleBroadcast(payload: BroadcastPayload, source: ProviderIdentity): Promise<void> {
    // This should be filled in once provider re-structuring is complete

    throw new NotImplementedError('handleBroadcast');
}

async function handleRaiseIntent(payload: RaiseIntentPayload, source: ProviderIdentity): Promise<void> {
    // This should be filled in once provider re-structuring is complete

    throw new NotImplementedError('handleRaiseIntent');
}

// This should probably be put into a seperate file somewhere, but it's only temporary....
class NotImplementedError extends Error {
    constructor(message = '') {
        message = message + ' has not yet been implemented.';
        super(message);
    }
}