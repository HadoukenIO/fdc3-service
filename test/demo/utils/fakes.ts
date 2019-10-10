import {Identity} from 'openfin/_v2/main';

import {Application, Intent} from '../../../src/client/directory';
import {ChannelId} from '../../../src/client/main';

import {ChannelDescriptor} from './channels';

let fakeCount = 0;

export function createFakeUuid(): string {
    return `test-app-${idString()}`;
}

export function createFakeIdentity(): Identity {
    return {name: `test-window-${idString()}`, uuid: createFakeUuid()};
}

export function createFakeApp(): Application {
    return {
        appId: `app-id-${idString()}`,
        name: `app-name-${idString()}`,
        manifestType: '',
        manifest: '',
        intents: []
    };
}

export function createFakeIntent(): Intent {
    return {
        name: `intent-name-${idString()}`,
        customConfig: []
    };
}

export function createFakeContextType(): string {
    return `context=${idString()}`;
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
