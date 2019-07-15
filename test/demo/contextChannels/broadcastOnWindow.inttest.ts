import 'jest';
import {Identity, Application} from 'hadouken-js-adapter';

import {ChannelId} from '../../../src/client/contextChannels';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {appStartupTime, testManagerIdentity, testAppNotInDirectory1, testAppInDirectory1, testAppInDirectory2, testAppInDirectory3, testAppInDirectory4} from '../constants';
import {fin} from '../utils/fin';
import {setupTeardown} from '../utils/common';

/*
 * Tests top-level broadcast(), and addContextListener() calls, and how they interact with Channel.join()
 */
const testContext = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};

const startedApps:Application[] = [];

setupTeardown();

afterEach(async () => {
    jest.clearAllMocks();

    for (const app of startedApps) {
        await app.quit().catch(() => {});
    }

    startedApps.length = 0;
});

// Creates one window for each channel, and has that window join that channel if not undefined
async function setupWindows(...channels: (ChannelId|undefined)[]): Promise<Identity[]> {
    const appIdentities = [testAppInDirectory1, testAppInDirectory2, testAppInDirectory3, testAppInDirectory4];

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
        await expect(defaultListener).toHaveReceivedContexts([testContext]);

        // Check the blue window received no context
        await expect(blueListener).toHaveReceivedContexts([]);
    }, appStartupTime * 2);

    test('Context is received by window that has left and rejoined default channel', async () => {
        const [channelChangingWindow] = await setupWindows('blue');

        // Change the channel of our window
        await joinChannel(channelChangingWindow, 'default');

        const channelChangingListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Broadcast our context on the default channel
        await fdc3Remote.broadcast(testManagerIdentity, testContext);

        // Check our window received our test context
        await expect(channelChangingListener).toHaveReceivedContexts([testContext]);
    }, appStartupTime);

    test('Context is not received by broadcasting window', async () => {
        const [defaultWindow] = await setupWindows(undefined);

        const defaultListener = await fdc3Remote.addContextListener(defaultWindow);

        // Broadcast our context on the default channel in our default window
        await fdc3Remote.broadcast(defaultWindow, testContext);

        // Check the default window did not received our test context
        await expect(defaultListener).toHaveReceivedContexts([]);
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
        await expect(redListener).toHaveReceivedContexts([testContext]);

        // Check the default window received no context
        await expect(defaultListener).toHaveReceivedContexts([]);

        // Check our blue window received no context
        await expect(blueListener).toHaveReceivedContexts([]);
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
        await expect(channelChangingWindowListener).toHaveReceivedContexts([testContext]);
    }, appStartupTime * 2);

    test('Context is not received by broadcasting window', async () => {
        const [yellowWindow] = await setupWindows('yellow');

        const yellowListener = await fdc3Remote.addContextListener(yellowWindow);

        // Broadcast our context on the default channel in our default window
        await fdc3Remote.broadcast(yellowWindow, testContext);

        // Check the default window did not received our test context
        await expect(yellowListener).toHaveReceivedContexts([]);
    }, appStartupTime * 2);
});

describe('When adding a context listener', () => {
    test('A context is received when joining a desktop channel that has been broadcast on and has remained occupied', async () => {
        const [yellowWindow, channelChangingWindow] = await setupWindows('yellow', 'red');

        // Broadcast our test context on the yellow channel to give the channel a cached context
        await fdc3Remote.broadcast(yellowWindow, testContext);

        // Set up our context listener
        const channelChangingListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Change the channel of our now-red window to yellow
        await joinChannel(channelChangingWindow, 'yellow');

        // Check our now-yellow window received our test context
        await expect(channelChangingListener).toHaveReceivedContexts([testContext]);
    }, appStartupTime * 2);

    test('No context is received when joining the default channel, which has been broadcast on and has remained occupied', async () => {
        const [defaultWindow, channelChangingWindow] = await setupWindows('default', 'red');

        // Broadcast our test context on the default channel
        await fdc3Remote.broadcast(defaultWindow, testContext);

        // Set up our context listener
        const channelChangingWindowListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Change the channel of our now-red window to default
        await joinChannel(channelChangingWindow, 'default');

        // Check our now-default window received no context
        await expect(channelChangingWindowListener).toHaveReceivedContexts([]);
    });

    test('No context is received when joining a desktop channel that has been emptied since last being broadcast on', async () => {
        const [broadcastingWindow, listeningWindow] = await setupWindows('green', 'yellow');

        // Broadcast to the currently occupied green channel, setting a cached context
        await fdc3Remote.broadcast(broadcastingWindow, testContext);

        // Ensure that the green channel has a cached context
        const preClearingListener = await fdc3Remote.addContextListener(listeningWindow);
        await joinChannel(listeningWindow, 'green');
        // Check our cached context has been received
        await expect(preClearingListener).toHaveReceivedContexts([testContext]);

        // Have both our windows leave the green channel. This should leave the channel unoccupied, so cached context should be cleared
        await joinChannel(broadcastingWindow, 'yellow');
        await joinChannel(listeningWindow, 'yellow');

        // Have our listening window join the green channel and listen for the result
        const listener = await fdc3Remote.addContextListener(listeningWindow);
        await joinChannel(listeningWindow, 'green');

        // Check no cached context has been received, given that the green channel has been emptied
        await expect(listener).toHaveReceivedContexts([]);
    }, appStartupTime * 2);
});

describe('When using a non-directory app', () => {
    beforeEach(async () => {
        await fin.Application.startFromManifest(testAppNotInDirectory1.manifestUrl);
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(testAppNotInDirectory1).quit(true);
    });

    test('When broadcasting from the non-directory app, contexts are received as expected', async () => {
        const [orangeWindow] = await setupWindows('orange');

        const directoryListener = await fdc3Remote.addContextListener(orangeWindow);

        // Put our non-directory app in the orange channel
        await joinChannel(testAppNotInDirectory1, 'orange');

        // Broadcast from our non-directory app
        await fdc3Remote.broadcast(testAppNotInDirectory1, testContext);

        // Check listener recevied our context from the non-directory app
        await expect(directoryListener.getReceivedContexts()).resolves.toEqual([testContext]);
    });

    test('When listening from the non-directory app, contexts are received as expected', async () => {
        const [blueWindow] = await setupWindows('blue');

        // Set up a listener on the non-directory app
        const nonDirectoryListener = await fdc3Remote.addContextListener(testAppNotInDirectory1);

        // Put our non-directory app in the blue channel
        await joinChannel(testAppNotInDirectory1, 'blue');

        // Broadcast from our directory app
        await fdc3Remote.broadcast(blueWindow, testContext);

        // Check listener recevied our context from the non-directory app
        await expect(nonDirectoryListener.getReceivedContexts()).resolves.toEqual([testContext]);
    });
});
