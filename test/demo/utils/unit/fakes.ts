import {Application, Intent} from '../../../../src/client/directory';

let fakeCount = 0;

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

function idString(): string {
    return `[${(fakeCount++).toString(16).toUpperCase()}]`;
}
