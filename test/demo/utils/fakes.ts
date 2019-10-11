import {Identity} from 'openfin/_v2/main';

import {Application} from '../../../src/client/directory';
import {ChannelId} from '../../../src/client/main';

import {ChannelDescriptor} from './channels';
import { Intent } from '../../../src/client/internal';

let fakeCount = 0;

export function createFakeUuid(): string {
    return `test-app-${idString()}`;
}

export function createFakeIdentity(options?: Partial<Identity>): Identity {
    return {
        name: `test-window-${idString()}`,
        uuid: createFakeUuid(),
        ...options
    };
}

export function createFakeApp(options?: Partial<Application>): Application {
    return {
        appId: `app-id-${idString()}`,
        name: `app-name-${idString()}`,
        manifestType: '',
        manifest: '',
        intents: [],
        ...options
    };
}

export function createFakeIntent(options?: Partial<Intent>): Intent {
    return {
        name: `intent-name-${idString()}`,
        customConfig: [],
        ...options
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
