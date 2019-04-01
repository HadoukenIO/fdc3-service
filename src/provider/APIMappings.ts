import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';
import {Identity} from 'openfin/_v2/main';

import {APITopic, BroadcastPayload, FindIntentPayload, FindIntentsByContextPayload, OpenPayload, RaiseIntentPayload, TopicPayloadMap, TopicResponseMap, GetChannelMembersPayload, GetChannelPayload, JoinChannelPayload, GetAllChannelsPayload} from '../client/internal';
import {AppIntent} from '../client/main';
import {Channel} from '../client/contextChannels';

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
    [APITopic.GET_ALL_CHANNELS]: handleGetAllChannels,
    [APITopic.JOIN_CHANNEL]: handleJoinChannel,
    [APITopic.GET_CHANNEL]: handleGetChannel,
    [APITopic.GET_CHANNEL_MEMBERS]: handleGetChannelMembers
};

async function handleOpen(payload: OpenPayload, source: ProviderIdentity): Promise<void> {
    // TODO: This should be filled in once provider re-structuring is complete (SERVICE-392)

    throw new NotImplementedError('handleOpen');
}

async function handleFindIntent(payload: FindIntentPayload, source: ProviderIdentity): Promise<AppIntent> {
    // TODO: This should be filled in once provider re-structuring is complete (SERVICE-392)

    throw new NotImplementedError('handleFindIntent');
}

async function handleFindIntentsByContext(payload: FindIntentsByContextPayload, source: ProviderIdentity): Promise<AppIntent[]> {
    // TODO: This should be filled in once provider re-structuring is complete (SERVICE-392)

    throw new NotImplementedError('handleFindIntentsByContext');
}

async function handleBroadcast(payload: BroadcastPayload, source: ProviderIdentity): Promise<void> {
    // TODO: This should be filled in once provider re-structuring is complete (SERVICE-392)

    throw new NotImplementedError('handleBroadcast');
}

async function handleRaiseIntent(payload: RaiseIntentPayload, source: ProviderIdentity): Promise<void> {
    // TODO: This should be filled in once provider re-structuring is complete (SERVICE-392)

    throw new NotImplementedError('handleRaiseIntent');
}

async function handleGetAllChannels(payload: GetAllChannelsPayload, source: ProviderIdentity): Promise<Channel[]> {
    // TODO: This should be filled in once provider re-structuring is complete (SERVICE-392)

    throw new NotImplementedError('handleRaiseIntent');
}

async function handleJoinChannel(payload: JoinChannelPayload, source: ProviderIdentity): Promise<void> {
    // TODO: This should be filled in once provider re-structuring is complete (SERVICE-392)

    throw new NotImplementedError('handleRaiseIntent');
}

async function handleGetChannel(payload: GetChannelPayload, source: ProviderIdentity): Promise<Channel> {
    // TODO: This should be filled in once provider re-structuring is complete (SERVICE-392)

    throw new NotImplementedError('handleRaiseIntent');
}

async function handleGetChannelMembers(payload: GetChannelMembersPayload, source: ProviderIdentity): Promise<Identity[]> {
    // TODO: This should be filled in once provider re-structuring is complete (SERVICE-392)

    throw new NotImplementedError('handleRaiseIntent');
}

// This should probably be put into a seperate file somewhere, but it's only temporary.
class NotImplementedError extends Error {
    constructor(message = '') {
        message = message + ' has not yet been implemented.';
        super(message);
    }
}
