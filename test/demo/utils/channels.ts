import {Identity} from 'openfin/_v2/main';

import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {ChannelId} from '../../../src/client/main';

import {RemoteChannel} from './RemoteChannel';

let fakeCount = 0;

export type ChannelDescriptor = {
    type: 'default'
 } | {
     type: 'system',
     id: 'red' | 'yellow' | 'blue' | 'orange' | 'green' | 'purple'
 } | {
     type: 'app',
     name: string
 } | 'red' | 'yellow' | 'blue' | 'orange' | 'yellow' | 'green' | 'default';

export async function getChannel(executionTarget: Identity, descriptor: ChannelDescriptor): Promise<RemoteChannel> {
    if (typeof descriptor === 'string') {
        return fdc3Remote.getChannelById(executionTarget, descriptor);
    } else if (descriptor.type === 'default') {
        return fdc3Remote.getChannelById(executionTarget, 'default');
    } else if (descriptor.type === 'system') {
        return fdc3Remote.getChannelById(executionTarget, descriptor.id);
    } else {
        return fdc3Remote.getOrCreateAppChannel(executionTarget, descriptor.name);
    }
}

export function fakeAppChannelDescriptor(): ChannelDescriptor {
    return {type: 'app', name: fakeAppChannelName()};
}

export function fakeAppChannelName(): ChannelId {
    return `app-channel-name-${idString()}`;
}

function idString(): string {
    return `[${(fakeCount++).toString(16).toUpperCase()}]`;
}
