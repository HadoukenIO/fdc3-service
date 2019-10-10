import {Application} from '../../../../src/client/directory';

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

function idString(): string {
    return `[${(fakeCount++).toString(16).toUpperCase()}]`;
}
