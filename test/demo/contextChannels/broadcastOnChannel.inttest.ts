import {Identity} from 'openfin/_v2/main';

import {testAppInDirectory1, testManagerIdentity, testAppInDirectory2, testAppNotInDirectory1, testAppUrl} from '../constants';
import {Context} from '../../../src/client/main';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {RemoteChannel} from '../utils/RemoteChannel';
import {setupTeardown, setupOpenDirectoryAppBookends, setupStartNonDirectoryAppBookends} from '../utils/common';
import {getChannel, ChannelDescriptor} from '../utils/channels';
import {fakeAppChannelDescriptor} from '../utils/fakes';
import {delay, Duration} from '../utils/delay';

/**
 * Tests Channel.broadcast(), its interaction with Channel.getCurrentContext(), and Channel.addContextListener
 */

const testContext = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};

setupTeardown();

describe('When attempting to broadcast on a channel object', () => {
    let channel: RemoteChannel;

    beforeEach(async () => {
        channel = await fdc3Remote.getChannelById(testManagerIdentity, 'blue');
    });

    test('If an invalid context is provided, a TypeError is thrown', async () => {
        const invalidContext = {irrelevantProperty: 'irrelevantValue'} as unknown as Context;

        await expect(channel.broadcast(invalidContext)).rejects.toThrowError(new TypeError(`${JSON.stringify(invalidContext)} is not a valid Context`));
    });

    test('If a null context is provided, a TypeError is thrown', async () => {
        await expect(channel.broadcast(null!)).rejects.toThrowError(new TypeError(`${JSON.stringify(null)} is not a valid Context`));
    });

    test('If a valid context is provided, the broadcast() resolves successfully', async () => {
        await channel.broadcast(testContext);
    });
});

describe('When broadcasting on a channel', () => {
    const broadcastingApp = testAppInDirectory1;
    const listeningApp = testAppInDirectory2;

    setupOpenDirectoryAppBookends(broadcastingApp);
    setupOpenDirectoryAppBookends(listeningApp);

    type ReceieveTestParam = [string, ChannelDescriptor];
    const receiveTestParams = [
        ['the default', 'default'],
        ['a system', 'blue'],
        ['an app', fakeAppChannelDescriptor()]
    ] as ReceieveTestParam[];

    describe.each(receiveTestParams)('When the channel is %s channel', (titleParam: string, channelDescriptor: ChannelDescriptor) => {
        test('Context is not received by the same channel in the broadcasting window', async () => {
            // Get our channel and set up a listener in the same window
            const channel = await getChannel(broadcastingApp, channelDescriptor);
            const listener = await channel.addContextListener();

            // Broadcast
            await channel.broadcast(testContext);

            // Check no context is received
            await expect(listener.getReceivedContexts()).resolves.toEqual([]);
        });

        test('Context is received by the same channel in a different window', async () => {
            // Get two distinct instances of our channel - one from the broadcasting window, one from the listening window
            const channelInBroadcastingWindow = await getChannel(broadcastingApp, channelDescriptor);
            const channelInListeningWindow = await getChannel(listeningApp, channelDescriptor);

            // Set up our listener in the listening window
            const listener = await channelInListeningWindow.addContextListener();

            // Broadcast
            await channelInBroadcastingWindow.broadcast(testContext);

            // Check our context is received
            await expect(listener.getReceivedContexts()).resolves.toEqual([testContext]);
        });
    });

    type ChannelIndependenceTestParam = [string, string, ChannelDescriptor, ChannelDescriptor];
    const channelIndependenceTestParams = [
        ['the default', 'a system', 'default', 'green'],
        ['the default', 'an app', 'default', fakeAppChannelDescriptor()],
        ['a system', 'the default', 'yellow', 'default'],
        ['a system', 'a different system', 'red', 'blue'],
        ['an app', 'a system', fakeAppChannelDescriptor(), 'blue'],
        ['an app', 'a system', fakeAppChannelDescriptor(), 'blue'],
        ['an app', 'a different app', fakeAppChannelDescriptor(), fakeAppChannelDescriptor()]
    ] as ChannelIndependenceTestParam[];

    describe.each(channelIndependenceTestParams)(
        'When the channel is %s channel',
        (titleParam1: string, titleParam2: string, broadcastChannelDescriptor: ChannelDescriptor, listenChannelDescriptor: ChannelDescriptor) => {
            let broadcastingChannel: RemoteChannel;
            let listeningChannel: RemoteChannel;

            let listener: fdc3Remote.RemoteContextListener;

            beforeEach(async () => {
                // Set up our broadcasting and listening channels
                broadcastingChannel = await getChannel(broadcastingApp, broadcastChannelDescriptor);
                listeningChannel = await getChannel(listeningApp, listenChannelDescriptor);

                // Setup our listener
                listener = await listeningChannel.addContextListener();
            });

            test(`Context is not received by ${titleParam2} channel`, async () => {
                // Broadcast
                await broadcastingChannel.broadcast(testContext);

                // Check our context is not received
                await expect(listener.getReceivedContexts()).resolves.toEqual([]);
            });

            test(`And the broadcasting window is in ${titleParam2} context is not received by that channel`, async () => {
                // Place our broadcasting window in our listening channel
                await listeningChannel.join(broadcastingApp);

                // Broadcast
                await broadcastingChannel.broadcast(testContext);

                // Check our context is not received
                await expect(listener.getReceivedContexts()).resolves.toEqual([]);
            });
        }
    );
});

describe('When adding a context listener to a channel', () => {
    const broadcastingApp = testAppInDirectory1;
    const listeningApp = testAppInDirectory2;

    setupOpenDirectoryAppBookends(broadcastingApp);
    setupOpenDirectoryAppBookends(listeningApp);

    type ContextListenerTestParam = [string, ChannelDescriptor];
    const contextListenerTestParams = [
        ['the default', 'default'],
        ['a system', 'red'],
        ['an app', fakeAppChannelDescriptor()]
    ] as ContextListenerTestParam[];

    describe.each(contextListenerTestParams)(
        'When the channel is %s channel',
        (titleParam: string, channelDescriptor: ChannelDescriptor) => {
            let broadcastingChannel: RemoteChannel;
            let listeningChannel: RemoteChannel;

            let listener1: fdc3Remote.RemoteContextListener;
            let listener2: fdc3Remote.RemoteContextListener;

            beforeEach(async () => {
                // Set up our broadcasting and listening channels
                broadcastingChannel = await getChannel(broadcastingApp, channelDescriptor);
                listeningChannel = await getChannel(listeningApp, channelDescriptor);

                // Set up two listeners
                listener1 = await listeningChannel.addContextListener();
                listener2 = await listeningChannel.addContextListener();
            });

            test('When two context listeners are added, both are triggered correctly', async () => {
                // Broadcast
                await broadcastingChannel.broadcast(testContext);

                // Check our context is received on both listeners
                await expect(listener1.getReceivedContexts()).resolves.toEqual([testContext]);
                await expect(listener2.getReceivedContexts()).resolves.toEqual([testContext]);
            });

            test('When two context listeners are added then one is unsubscribed, only the still-subscribed listener is triggered', async () => {
                // Unsubscribe our first listener
                await listener1.unsubscribe();

                // Broadcast
                await broadcastingChannel.broadcast(testContext);

                // Check our context is received only the still-subscribed listener
                await expect(listener1.getReceivedContexts()).resolves.toEqual([]);
                await expect(listener2.getReceivedContexts()).resolves.toEqual([testContext]);
            });
        }
    );

    test('The context listener is not triggered when joining a channel', async () => {
        // Set up our broadcasting and listening channels
        const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, 'orange');
        const listeningChannel = await fdc3Remote.getChannelById(listeningApp, 'orange');

        // Set up our listener
        const listener = await listeningChannel.addContextListener();

        // Set up a cached context in our system channel
        await broadcastingChannel.join();
        await broadcastingChannel.broadcast(testContext);
        // Check the context has been cached and received as expected
        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(testContext);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(testContext);
        await expect(listener.getReceivedContexts()).resolves.toEqual([testContext]);

        // Have our listening window join our system channel
        await listeningChannel.join();

        // Check no additional context is received, contrary to 'flat' API behaviour
        await expect(listener.getReceivedContexts()).resolves.toEqual([testContext]);
    });

    describe('When the context listener is added after broadcast', () => {
        test('When a listener is added after a short delay, the listener is triggered exactly once with the correct \
context', async () => {
            // Set up our broadcasting and listening channels
            const broadcastingChannel = await getChannel(broadcastingApp, 'green');
            const listeningChannel = await getChannel(listeningApp, 'green');

            // Broadcast
            await broadcastingChannel.broadcast(testContext);

            // Setup listener after a short delay
            await delay(Duration.SHORTER_THAN_APP_MATURITY);
            const listener = await listeningChannel.addContextListener();

            // Check our context is received
            await delay(Duration.API_CALL);
            await expect(listener).toHaveReceivedContexts([testContext]);
        });

        test('When a listener is added after a long delay, the listener is not triggered', async () => {
            // Set up our broadcasting and listening channels
            const broadcastingChannel = await getChannel(broadcastingApp, 'yellow');
            const listeningChannel = await getChannel(listeningApp, 'yellow');

            // Broadcast
            await broadcastingChannel.broadcast(testContext);

            // Setup listener after a long delay
            await delay(Duration.LONGER_THAN_APP_MATURITY);
            const listener = await listeningChannel.addContextListener();

            // Check no context is received
            await delay(Duration.API_CALL);
            await expect(listener).toHaveReceivedContexts([]);
        });

        test('When a listener is added after a short delay on a child window, the listener is triggered exactly once \
with the correct context', async () => {
            // Set up our broadcasting channel
            const broadcastingChannel = await getChannel(broadcastingApp, 'orange');

            // Broadcast
            await broadcastingChannel.broadcast(testContext);

            // Setup listener after a short delay
            await delay(Duration.SHORTER_THAN_APP_MATURITY);
            const childIdentity = await fdc3Remote.createFinWindow(listeningApp, {url: testAppUrl, name: 'child-window'});
            const listeningChannel = await getChannel(childIdentity, 'orange');
            const listener = await listeningChannel.addContextListener();

            // Check our context is received
            await delay(Duration.API_CALL);
            await expect(listener).toHaveReceivedContexts([testContext]);
        });
    });
});

describe('When querying the current context of the default channel', () => {
    const broadcastingApp = testAppInDirectory1;
    const listeningApp = testAppInDirectory2;

    setupOpenDirectoryAppBookends(broadcastingApp);
    setupOpenDirectoryAppBookends(listeningApp);

    test('The last-broadcast context will not be returned, even when the channel is occupied', async () => {
        // Set up our broadcasting and listening channels
        const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, 'default');
        const listeningChannel = await fdc3Remote.getChannelById(listeningApp, 'default');

        // Ensure that our default channel is occupied, then broadcast
        await expect(listeningChannel.getMembers()).resolves.toHaveLength(3);
        await broadcastingChannel.broadcast(testContext);

        // Check our context has not been cached
        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(null);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(null);
    });
});

type QueryContextTestParam = [string, ChannelDescriptor];
const queryContextTestParams = [
    ['a system', 'yellow'],
    ['an app', fakeAppChannelDescriptor()]
] as QueryContextTestParam[];

describe.each(queryContextTestParams)('When querying the current context of %s channel', (titleParam: string, channelDescriptor: ChannelDescriptor) => {
    const broadcastingApp = testAppInDirectory1;
    const listeningApp = testAppInDirectory2;

    setupOpenDirectoryAppBookends(broadcastingApp);
    setupOpenDirectoryAppBookends(listeningApp);

    test('The last-broadcast context will be returned when the channel is occupied', async () => {
        // Set up our broadcasting and listening channels
        const broadcastingChannel = await getChannel(broadcastingApp, channelDescriptor);
        const listeningChannel = await getChannel(listeningApp, channelDescriptor);

        // Ensure the channel is occupied, then broadcast
        await broadcastingChannel.join();
        await broadcastingChannel.broadcast(testContext);

        // Check our context is present
        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(testContext);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(testContext);
    });

    test('The last-broadcast context will not be returned when the channel has been emptied', async () => {
        // Set up our broadcasting and listening channels
        const broadcastingChannel = await getChannel(broadcastingApp, channelDescriptor);
        const listeningChannel = await getChannel(listeningApp, channelDescriptor);

        // Ensure the channel is occupied, then broadcast
        await broadcastingChannel.join();
        await broadcastingChannel.broadcast(testContext);

        // Empty the channel
        const defaultChannel = await fdc3Remote.getChannelById(broadcastingApp, 'default');
        await defaultChannel.join();

        // Check our context has been cleared
        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(null);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(null);
    });

    test('The last-broadcast context will not be returned when the channel has never been occupied', async () => {
        // Set up our broadcasting and listening channels
        const broadcastingChannel = await getChannel(broadcastingApp, channelDescriptor);
        const listeningChannel = await getChannel(listeningApp, channelDescriptor);

        // Broadcast on our empty channel
        await broadcastingChannel.broadcast(testContext);

        // Check our context has not been cached
        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(null);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(null);
    });
});

describe('When using a non-directory app', () => {
    setupOpenDirectoryAppBookends(testAppInDirectory1);
    setupStartNonDirectoryAppBookends(testAppNotInDirectory1);

    type BroadcastTestParam = [string, string, Identity, Identity];
    const broadcastTestParams: BroadcastTestParam[] = [
        ['the app', 'a directory app', testAppNotInDirectory1, testAppInDirectory1],
        ['a directory app', 'the app', testAppInDirectory1, testAppNotInDirectory1]
    ];

    test.each(broadcastTestParams)(
        'When broadcasting from %s, context can be received by %s',
        async (titleParam1: string, titleParam2: string, broadcastingApp: Identity, listeningApp: Identity) => {
            // Set up our broadcasting and listening channels
            const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, 'red');
            const listeningChannel = await fdc3Remote.getChannelById(listeningApp, 'red');

            // Set up our listener
            const listener = await listeningChannel.addContextListener();

            // Broadcast
            await broadcastingChannel.broadcast(testContext);

            // Check our context is recevied
            await expect(listener.getReceivedContexts()).resolves.toEqual([testContext]);
        }
    );
});
