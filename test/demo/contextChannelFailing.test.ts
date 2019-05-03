import 'jest';
import {connect, Fin, Identity, Application} from 'hadouken-js-adapter';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {delay} from './utils/delay';

const testManagerIdentity = {uuid: 'test-app', name: 'test-app'};

const testContext = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};

const startedApps:Application[] = [];

let fin: Fin;

beforeAll(async () => {
    fin = await connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-contextChannelFailing.ts'});
    await expect(fin.Application.wrapSync({uuid: 'test-app', name: 'test-app'}).isRunning()).resolves.toBe(true);

    jest.setTimeout(10 * 60 * 60 * 1000);
});

afterEach(async () => {
    jest.clearAllMocks();

    for (const app of startedApps) {
        await app.quit().catch(() => {});
    }

    startedApps.length = 0;
});

// Creates one window for each channel, and has that window join that channel if not undefined
async function setupWindows(...channels: (string|undefined)[]): Promise<Identity[]> {
    const app1 = {uuid: 'test-app-1', name: 'test-app-1'};
    const app2 = {uuid: 'test-app-2', name: 'test-app-2'};
    const app3 = {uuid: 'test-app-3', name: 'test-app-3'};
    const app4 = {uuid: 'test-app-4', name: 'test-app-4'};

    const appIdentities = [app1, app2, app3, app4];

    // Creating apps takes time, so increase timeout
    // jest.setTimeout(channels.length * 5000);

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


describe('When joining a channel', () => {
    it('channel-changed event is fired for user channel', async () => {
        const [channelChangingWindow] = await setupWindows(undefined);

        const listener = await fdc3Remote.addEventListener(testManagerIdentity, 'channel-changed');

        // Change the channel of our window to green
        await fdc3Remote.joinChannel(channelChangingWindow, 'green');

        // Check we received a channel-changed event
        const payload = await listener.getReceivedEvents();

        if (payload.length === 0) {
            console.log('Pausing for investigation');
            await delay(10 * 60 * 60 * 1000);
        }

        expect(payload).toHaveLength(1);
        expect(payload[0]).toHaveProperty('channel.id', 'green');
        expect(payload[0]).toHaveProperty('previousChannel.id', 'global');
        expect(payload[0]).toHaveProperty('identity', channelChangingWindow);
    });
});

