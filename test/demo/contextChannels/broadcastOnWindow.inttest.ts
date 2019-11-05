/* eslint-disable @typescript-eslint/await-thenable */
import 'jest';
import {Identity, Application} from 'hadouken-js-adapter';

import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {appStartupTime, testManagerIdentity, testAppNotInDirectory1, testAppInDirectory1, testAppInDirectory2, testAppInDirectory3, testAppInDirectory4, testAppWithPreregisteredListeners1} from '../constants';
import {fin} from '../utils/fin';
import {setupTeardown, quitApps, setupStartNonDirectoryAppBookends} from '../utils/common';
import {ChannelDescriptor, getChannel} from '../utils/channels';
import {fakeAppChannelDescriptor} from '../utils/fakes';

/*
 * Tests top-level broadcast(), and addContextListener() calls, and how they interact with Channel.join()
 */
const testContext = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};

const startedApps: Application[] = [];

afterEach(async () => {
    await quitApps(...startedApps.map((app) => app.identity));

    startedApps.length = 0;
});

setupTeardown();

type BroadcastTestParam = [string, ChannelDescriptor, ChannelDescriptor, ChannelDescriptor[]];
const broadcastTestParams = [
    ['the default', 'default', 'blue', ['orange', fakeAppChannelDescriptor()]],
    ['a system', 'yellow', 'default', ['green', 'default', fakeAppChannelDescriptor()]],
    ['an app', fakeAppChannelDescriptor(), 'default', ['purple', 'default', fakeAppChannelDescriptor()]]
] as BroadcastTestParam[];

describe.each(broadcastTestParams)(
    'When broadcasting on %s channel',
    (titleParam: string, broadcastChannel: ChannelDescriptor, destinationChannel: ChannelDescriptor, otherChannels: ChannelDescriptor[]) => {
        test('Context is received by windows on that channel only', async () => {
            const [broadcastingWindow, listeningWindow, ...otherWindows] = await setupWindows(broadcastChannel, broadcastChannel, ...otherChannels);

            const listener = await fdc3Remote.addContextListener(listeningWindow);

            const otherListeners = await Promise.all(otherWindows.map((window) => fdc3Remote.addContextListener(window)));

            // Broadcast our context on the broadcast channel
            await fdc3Remote.broadcast(broadcastingWindow, testContext);

            // Check our listening window received our test context
            await expect(listener).toHaveReceivedContexts([testContext]);

            // Check the other windows received no context
            for (const otherListener of otherListeners) {
                await expect(otherListener).toHaveReceivedContexts([]);
            }
        }, appStartupTime * 4);

        test('Context is received by window that has left and rejoined our channel', async () => {
            const [broadcastingWindow, channelChangingWindow] = await setupWindows(broadcastChannel, broadcastChannel);

            // Change the channel of our window
            await joinChannel(channelChangingWindow, destinationChannel);
            await joinChannel(channelChangingWindow, broadcastChannel);

            const channelChangingWindowListener = await fdc3Remote.addContextListener(channelChangingWindow);

            // Broadcast our context on the blue channel
            await fdc3Remote.broadcast(broadcastingWindow, testContext);

            // Check our blue window received our test context
            await expect(channelChangingWindowListener).toHaveReceivedContexts([testContext]);
        }, appStartupTime * 2);

        test('Context is not received by broadcasting window', async () => {
            const [broadcastingWindow] = await setupWindows(broadcastChannel);

            const listener = await fdc3Remote.addContextListener(broadcastingWindow);

            // Broadcast our context on the default channel in our default window
            await fdc3Remote.broadcast(broadcastingWindow, testContext);

            // Check the default window did not received our test context
            await expect(listener).toHaveReceivedContexts([]);
        }, appStartupTime * 2);
    }
);

describe('When adding a context listener to the default channel', () => {
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
    }, appStartupTime * 2);
});

type ContextListenerTestParam = [string, ChannelDescriptor];

const contextListenerTestParams = [
    ['a system', 'blue'],
    ['an app', fakeAppChannelDescriptor()]
] as ContextListenerTestParam[];

describe.each(contextListenerTestParams)('When adding a context listener to %s channel', (titleParam: string, broadcastChannel: ChannelDescriptor) => {
    test('When the channel, has been broadcast on and has remained occupied, a context is received when joining', async () => {
        const [broadcastWindow, channelChangingWindow] = await setupWindows(broadcastChannel, 'default');

        // Broadcast our test context our channel to give the channel a cached context
        await fdc3Remote.broadcast(broadcastWindow, testContext);

        // Set up our context listener
        const channelChangingListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Change the channel of our now-default window to test channel
        await joinChannel(channelChangingWindow, broadcastChannel);

        // Check our previously-default window received our test context
        await expect(channelChangingListener).toHaveReceivedContexts([testContext]);
    }, appStartupTime * 2);

    test('When the channel that has been emptied since last being broadcast on, no context is received when joining', async () => {
        const [broadcastingWindow, listeningWindow] = await setupWindows(broadcastChannel, 'default');

        // Broadcast our test context our channel to give the channel a cached context
        await fdc3Remote.broadcast(broadcastingWindow, testContext);

        // Have our broadcast window leave the channel. This should leave the channel unoccupied, so cached context should be cleared
        await joinChannel(broadcastingWindow, 'default');

        // Have our listening window join the green channel and listen for the result
        const listener = await fdc3Remote.addContextListener(listeningWindow);
        await joinChannel(listeningWindow, broadcastChannel);

        // Check no cached context has been received, given that the green channel has been emptied
        await expect(listener).toHaveReceivedContexts([]);
    }, appStartupTime * 2);
});

describe('When using a non-directory app', () => {
    setupStartNonDirectoryAppBookends(testAppNotInDirectory1);

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

// Creates one window for each channel, and has that window join that channel if not undefined
async function setupWindows(...channels: (ChannelDescriptor|undefined)[]): Promise<Identity[]> {
    // Pre-registered listeners do not affect this test. `testAppWithPreregisteredListeners1` is just another app directory entry for our purposes
    const appIdentities = [testAppInDirectory1, testAppInDirectory2, testAppInDirectory3, testAppInDirectory4, testAppWithPreregisteredListeners1];

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

async function joinChannel(identity: Identity, channel: ChannelDescriptor): Promise<void> {
    const remoteChannel = await getChannel(identity, channel);
    return remoteChannel.join();
}
