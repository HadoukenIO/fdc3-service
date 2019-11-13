import {Identity} from 'openfin/_v2/main';

import {Application, AppDirIntent} from '../../../src/client/directory';
import {ChannelId} from '../../../src/client/main';

import {ChannelDescriptor} from './channels';

let fakeCount = 0;

export function createFakeIdentity(options: Partial<Identity> = {}): Identity {
    return {
        name: `test-window-${idString()}`,
        uuid: createFakeUuid(),
        ...options
    };
}

export function createFakeApp(options: Partial<Application> = {}): Application {
    return {
        appId: `app-id-${idString()}`,
        name: `app-name-${idString()}`,
        manifestType: '',
        manifest: '',
        intents: [],
        ...options
    };
}

export function createFakeIntent(options: Partial<AppDirIntent> = {}): AppDirIntent {
    return {
        name: `intent-name-${idString()}`,
        customConfig: [],
        ...options
    };
}

export function fakeAppChannelDescriptor(): ChannelDescriptor {
    return {type: 'app', name: fakeAppChannelName()};
}

export function createFakeUuid(): string {
    return `test-app-${idString()}`;
}

export function createFakeContextType(): string {
    return `context-${idString()}`;
}

export function fakeAppChannelName(): ChannelId {
    return `app-channel-name-${idString()}`;
}

function idString(): string {
    return `[${(fakeCount++).toString(16).toUpperCase()}]`;
}
