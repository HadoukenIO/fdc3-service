import 'jest';
import {connect, Fin, Identity, Application} from 'hadouken-js-adapter';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {delay} from './utils/delay';

const testManagerIdentity = {uuid: 'test-app', name: 'test-app'};

const testContext = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};

const startedApps:Application[] = [];

let fin: Fin;

beforeAll(async () => {
    fin = await connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-contextChannels.ts'});
    await expect(fin.Application.wrapSync({uuid: 'test-app', name: 'test-app'}).isRunning()).resolves.toBe(true);
});

afterEach(async () => {
    jest.clearAllMocks();

    for (const app of startedApps) {
        await app.quit().catch(() => {});
        await expect(app.isRunning()).resolves.toBe(false);
    }

    startedApps.length = 0;
});

jest.setTimeout(60 * 60 * 60 * 1000);

// Creates one window for each channel, and has that window join that channel if not undefined
async function setupWindows(...channels: (string|undefined)[]): Promise<Identity[]> {
    const app1 = {uuid: 'test-app-1', name: 'test-app-1'};
    const app2 = {uuid: 'test-app-2', name: 'test-app-2'};
    const app3 = {uuid: 'test-app-3', name: 'test-app-3'};
    const app4 = {uuid: 'test-app-4', name: 'test-app-4'};

    const appIdentities = [app1, app2, app3, app4];

    // Creating apps takes time, so increase timeout
    jest.setTimeout(60 * 60 * 60 * 1000);

    const result: Identity[] = await Promise.all(channels.map(async (channel, index) => {
        const identity = appIdentities[index];

        await fdc3Remote.open(testManagerIdentity, identity.uuid);
        const app = fin.Application.wrapSync(appIdentities[index]);

        await expect(app.isRunning()).resolves.toBe(true);

        startedApps.push(app);
        if (channel) {
            await fdc3Remote.joinChannel(identity, channel);
        }

        return identity;
    }));

    return result;
}

describe('When starting an app', () => {
    it('channel-changed event is fired for global channel', async () => {
        /* const listener = await fdc3Remote.addEventListener(testManagerIdentity, 'channel-changed');

        const [channelChangingWindow] = await setupWindows(undefined);

        // Check we received a channel-changed event
        const payload = await listener.getReceivedEvents();*/

        jest.setTimeout(60 * 60 * 60 * 1000);
        await delay(60 * 60 * 60 * 1000);

        /*
        expect(payload).toHaveLength(1);
        expect(payload[0]).toHaveProperty('channel.id', 'global');
        expect(payload[0]).toHaveProperty('previousChannel.id', undefined);
        expect(payload[0]).toHaveProperty('identity', channelChangingWindow);*/
    });
});

