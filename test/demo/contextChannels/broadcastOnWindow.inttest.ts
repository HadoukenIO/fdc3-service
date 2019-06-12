import 'jest';
import {connect, Fin, Identity, Application} from 'hadouken-js-adapter';

import {ChannelId} from '../../../src/client/contextChannels';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {appStartupTime, testManagerIdentity, testAppNotInDirectory} from '../constants';

/*
 * Tests top-level broadcast(), and addContextListener() calls, and how they interact with Channel.join()
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

        await fdc3Remote.open(testManagerIdentity, identity.name);
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
    }, appStartupTime);

    test('Context is not received by broadcasting window', async () => {
        const [defaultWindow] = await setupWindows(undefined);

        const defaultListener = await fdc3Remote.addContextListener(defaultWindow);

        // Broadcast our context on the default channel in our default window
        await fdc3Remote.broadcast(defaultWindow, testContext);

        // Check the default window did not received our test context
        const defaultContexts = await defaultListener.getReceivedContexts();
        expect(defaultContexts).toEqual([]);
    }, appStartupTime * 2);
});

describe('When broadcasting on a desktop channel', () => {
    test('Context is received by windows on that desktop channel only', async () => {
        const [redBroadcastingWindow, redListeningWindow, defaultWindow, blueWindow] = await setupWindows('red', 'red', 'default', 'blue');

        const redListener = await fdc3Remote.addContextListener(redListeningWindow);
        const defaultListener = await fdc3Remote.addContextListener(defaultWindow);
        const blueListener = await fdc3Remote.addContextListener(blueWindow);

        // Broadcast our context on the red channel
        await fdc3Remote.broadcast(redBroadcastingWindow, testContext);

        // Check our red window received our test context
        const redReceivedContexts = await redListener.getReceivedContexts();
        expect(redReceivedContexts).toEqual([testContext]);

        // Check the default window received no context
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

    test('Context is not received by broadcasting window', async () => {
        const [yellowWindow] = await setupWindows('yellow');

        const yellowListener = await fdc3Remote.addContextListener(yellowWindow);

        // Broadcast our context on the default channel in our default window
        await fdc3Remote.broadcast(yellowWindow, testContext);

        // Check the default window did not received our test context
        const defaultContexts = await yellowListener.getReceivedContexts();
        expect(defaultContexts).toEqual([]);
    }, appStartupTime * 2);
});

describe('When joining a channel', () => {
    test('When the channel is a desktop channel, joining window receives cached context', async () => {
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

    test('When the channel is the default channel, joining window receives no cached context', async () => {
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

    test('When the channel is a desktop channel, which was occupied but is now empty, joining window receives no cached context', async () => {
        const [broadcastingWindow, listeningWindow] = await setupWindows('green', 'yellow');

        // Broadcast to the currently occupied green channel, setting a cached context
        await fdc3Remote.broadcast(broadcastingWindow, testContext);

        // Ensure that the green channel has a cached context
        const preClearingListener = await fdc3Remote.addContextListener(listeningWindow);
        await joinChannel(listeningWindow, 'green');
        // Check our cached context has been received
        const preClearingReceivedContexts = await preClearingListener.getReceivedContexts();
        expect(preClearingReceivedContexts).toEqual([testContext]);

        // Have both our windows leave the green channel. This should leave the channel unoccupied, so cached context should be cleared
        await joinChannel(broadcastingWindow, 'yellow');
        await joinChannel(listeningWindow, 'yellow');

        // Have our listening window join the green channel and listen for the result
        const listener = await fdc3Remote.addContextListener(listeningWindow);
        await joinChannel(listeningWindow, 'green');

        // Check no cached context has been received, given that the green channel has been emptied
        const receivedContexts = await listener.getReceivedContexts();
        expect(receivedContexts).toEqual([]);
    }, appStartupTime * 2);
});

describe('When using a non-directory app', () => {
    beforeEach(async () => {
        await fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl);
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(testAppNotInDirectory).quit(true);
    });

    test('When broadcasting from the non-directory app, contexts are received as expected', async () => {
        const [orangeWindow] = await setupWindows('orange');

        const directoryListener = await fdc3Remote.addContextListener(orangeWindow);

        // Put our non-directory app in the orange channel
        await joinChannel(testAppNotInDirectory, 'orange');

        // Broadcast from our non-directory app
        await fdc3Remote.broadcast(testAppNotInDirectory, testContext);

        // Check listener recevied our context from the non-directory app
        await expect(directoryListener.getReceivedContexts()).resolves.toEqual([testContext]);
    });

    test('When listening from the non-directory app, contexts are received as expected', async () => {
        const [blueWindow] = await setupWindows('blue');

        // Set up a listener on the non-directory app
        const nonDirectoryListener = await fdc3Remote.addContextListener(testAppNotInDirectory);

        // Put our non-directory app in the blue channel
        await joinChannel(testAppNotInDirectory, 'blue');

        // Broadcast from our directory app
        await fdc3Remote.broadcast(blueWindow, testContext);

        // Check listener recevied our context from the non-directory app
        await expect(nonDirectoryListener.getReceivedContexts()).resolves.toEqual([testContext]);
    });
});
