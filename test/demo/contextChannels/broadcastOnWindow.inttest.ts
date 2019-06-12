import 'jest';
import {connect, Fin, Identity, Application} from 'hadouken-js-adapter';

import {ChannelId} from '../../../src/client/contextChannels';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {appStartupTime, testManagerIdentity} from '../constants';

/*
 * Tests top-level broadcast() and addContextListener() calls interact with Channel.join()
 */
const testContext = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};

const startedApps:Application[] = [];

let fin: Fin;

beforeAll(async () => {
    fin = await connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-contextChannels-broadcastOnWindow.inttest.ts'});
    await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);
});

afterEach(async () => {
    jest.clearAllMocks();

    for (const app of startedApps) {
        await app.quit().catch(() => {});
    }

    startedApps.length = 0;
});

// Creates one window for each channel, and has that window join that channel if not undefined
async function setupWindows(...channels: (ChannelId|undefined)[]): Promise<Identity[]> {
    const app1 = {uuid: 'test-app-1', name: 'test-app-1'};
    const app2 = {uuid: 'test-app-2', name: 'test-app-2'};
    const app3 = {uuid: 'test-app-3', name: 'test-app-3'};
    const app4 = {uuid: 'test-app-4', name: 'test-app-4'};

    const appIdentities = [app1, app2, app3, app4];

    const offset = startedApps.length;

    const result: Identity[] = [];

    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        const identity = appIdentities[i + offset];

        await fdc3Remote.open(testManagerIdentity, identity.uuid);
        const app = fin.Application.wrapSync(appIdentities[i + offset]);

        await expect(app.isRunning()).resolves.toBe(true);

        startedApps.push(app);
        if (channel) {
            await joinChannel(identity, channel);
        }

        result.push(identity);
    }

    return result;
}

async function joinChannel(identity: Identity, channel: ChannelId): Promise<void> {
    const remoteChannel = (await fdc3Remote.getChannelById(identity, channel))!;

    return remoteChannel.join();
}

describe('When broadcasting on default channel', () => {
    test('Context is received by default windows only', async () => {
        const [defaultWindow, blueWindow] = await setupWindows(undefined, 'blue');

        const defaultListener = await fdc3Remote.addContextListener(defaultWindow);
        const blueListener = await fdc3Remote.addContextListener(blueWindow);

        // Broadcast our context on the default channel
        await fdc3Remote.broadcast(testManagerIdentity, testContext);

        // Check the default window received our test context
        const defaultContexts = await defaultListener.getReceivedContexts();
        expect(defaultContexts).toEqual([testContext]);

        // Check the blue window received no context
        const blueContexts = await blueListener.getReceivedContexts();
        expect(blueContexts).toHaveLength(0);
    }, appStartupTime * 2);

    test('Context is received by window that has left and rejoined default channel', async () => {
        const [channelChangingWindow] = await setupWindows('blue');

        // Change the channel of our window
        await joinChannel(channelChangingWindow, 'default');

        const channelChangingListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Broadcast our context on the default channel
        await fdc3Remote.broadcast(testManagerIdentity, testContext);

        // Check our window received our test context
        const receivedContexts = await channelChangingListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);
    });
});

describe('When broadcasting on a desktop channel', () => {
    test('Context is received by windows on that desktop channel only', async () => {
        const [red1Window, red2Window, defaultWindow, blueWindow] = await setupWindows('red', 'red', 'default', 'blue');

        const redListener = await fdc3Remote.addContextListener(red2Window);
        const defaultListener = await fdc3Remote.addContextListener(defaultWindow);
        const blueListener = await fdc3Remote.addContextListener(blueWindow);

        // Broadcast our context on the red channel
        await fdc3Remote.broadcast(red1Window, testContext);

        // Check our red window received our test context
        const redReceivedContexts = await redListener.getReceivedContexts();
        expect(redReceivedContexts).toEqual([testContext]);

        const defaultReceivedContexts = await defaultListener.getReceivedContexts();
        expect(defaultReceivedContexts).toHaveLength(0);

        // Check our blue window received no context
        const blueReceivedContexts = await blueListener.getReceivedContexts();
        expect(blueReceivedContexts).toHaveLength(0);
    }, appStartupTime * 4);

    test('Context is received by window that has left and rejoined desktop channel', async () => {
        const [blueWindow, channelChangingWindow] = await setupWindows('blue', undefined);

        // Change the channel of our window
        await joinChannel(channelChangingWindow, 'default');
        await joinChannel(channelChangingWindow, 'blue');

        const channelChangingWindowListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Broadcast our context on the blue channel
        await fdc3Remote.broadcast(blueWindow, testContext);

        // Check our blue window received our test context
        const receivedContexts = await channelChangingWindowListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);
    }, appStartupTime * 2);
});

describe('When joining a channel', () => {
    test('Window receives cached context for desktop channel', async () => {
        const [yellowWindow, channelChangingWindow] = await setupWindows('yellow', 'red');

        // Broadcast our test context on the yellow channel
        await fdc3Remote.broadcast(yellowWindow, testContext);

        const channelChangingListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Change the channel of our now-red window to yellow
        await joinChannel(channelChangingWindow, 'yellow');

        // Check our now-yellow window received our test context
        const receivedContexts = await channelChangingListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);
    }, appStartupTime * 2);

    test('Window does not receive cached context for default channel', async () => {
        const [channelChangingWindow] = await setupWindows('red');

        // Broadcast our test context on the default channel
        await fdc3Remote.broadcast(testManagerIdentity, testContext);

        const channelChangingWindowListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Change the channel of our window to default
        await joinChannel(channelChangingWindow, 'default');

        // Check our now-default window received no context
        const receivedContexts = await channelChangingWindowListener.getReceivedContexts();
        expect(receivedContexts).toHaveLength(0);
    });

    test('If everything is unsubscribed, and something rejoins, there is no data held in the channel', async () => {
        // First, set up a pair of windows on different channels. Yellow will be unused; green will be the
        // interesting one. Broadcast on green. No one is listening, no one hears.
        const [sendWindow, receiveWindow] = await setupWindows('green', 'yellow');
        const receiveWindowListener = await fdc3Remote.addContextListener(receiveWindow);
        await fdc3Remote.broadcast(sendWindow, testContext);
        let receivedContexts = await receiveWindowListener.getReceivedContexts();
        expect(receivedContexts).toHaveLength(0);

        // Now join green, and we should a callback because of the current state of the green channel.
        await joinChannel(receiveWindow, 'green');
        receivedContexts = await receiveWindowListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);

        // Move all the windows to a different channel, so no one is listening to green. This should cause
        // the state data to be dropped
        await joinChannel(sendWindow, 'yellow');
        await joinChannel(receiveWindow, 'yellow');

        // Now, subscribe to the green channel again. Because the state data is dropped, we won't get a callback,
        // and our received contexts will be unchanged (remember, receivedContexts is the life history of all
        // the contexts received)
        receivedContexts = await receiveWindowListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);
        await joinChannel(receiveWindow, 'green');
        receivedContexts = await receiveWindowListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);
    }, appStartupTime * 2);
});
