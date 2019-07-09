import {Identity} from 'openfin/_v2/main';

import {testAppInDirectory1, testManagerIdentity, appStartupTime, testAppInDirectory2, testAppNotInDirectory1} from '../constants';
import {ChannelId, Context} from '../../../src/client/main';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {RemoteChannel} from '../utils/RemoteChannel';
import {fin} from '../utils/fin';
import {setupTeardown} from '../utils/common';

/**
 * Tests Channel.broadcast(), its interaction with Channel.getCurrentContext(), and Channel.addContextListener
 */

const testContext = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};

setupTeardown();

describe('When attempting to broadcast on a channel object', () => {
    let defaultChannel: RemoteChannel;

    beforeEach(async () => {
        defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'blue');
    });

    test('If an invalid context is provided, a TypeError is thrown', async () => {
        const invalidContext = {irrelevantProperty: 'irrelevantValue'} as unknown as Context;

        expect(defaultChannel.broadcast(invalidContext)).rejects.toThrowError(new TypeError(`${JSON.stringify(invalidContext)} is not a valid Context`));
    });

    test('If a null context is provided, a TypeError is thrown', async () => {
        expect(defaultChannel.broadcast(null!)).rejects.toThrowError(new TypeError(`${JSON.stringify(null)} is not a valid Context`));
    });

    test('If a valid context is provided, the broadcast() resolves successfully', async () => {
        await expect(defaultChannel.broadcast(testContext)).resolves;
    });
});

describe('When broadcasting on a channel', () => {
    const broadcastingApp = testAppInDirectory1;
    const listeningApp = testAppInDirectory2;

    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, broadcastingApp.name);
        await fdc3Remote.open(testManagerIdentity, listeningApp.name);
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(broadcastingApp).quit(true);
        await fin.Application.wrapSync(listeningApp).quit(true);
    });

    const receiveTestParams = [['the default', 'default'], ['a desktop', 'blue']];

    describe.each(receiveTestParams)('When the channel is %s channel', (titleParam: string, channelId: ChannelId) => {
        test('Context is not received by the same channel in the broadcasting window', async() => {
            // Get our channel and set up a listener in the same window
            const channel = await fdc3Remote.getChannelById(broadcastingApp, channelId);
            const listener = await channel.addContextListener();

            // Broadcast
            await channel.broadcast(testContext);

            // Check no context is received
            await expect(listener.getReceivedContexts()).resolves.toEqual([]);
        });

        test('Context is received by the same channel in a different window', async () => {
            // Get two distinct instances of our channel - one from the broadcasting window, one from the listening window
            const channelInBroadcastingWindow = await fdc3Remote.getChannelById(broadcastingApp, channelId);
            const channelInListeningWindow = await fdc3Remote.getChannelById(listeningApp, channelId);

            // Set up our listener in the listening window
            const listener = await channelInListeningWindow.addContextListener();

            // Broadcast
            await channelInBroadcastingWindow.broadcast(testContext);

            // Check our context is received
            await expect(listener.getReceivedContexts()).resolves.toEqual([testContext]);
        });
    });

    const channelIndependenceTestParams = [
        ['the default', 'a desktop', 'default', 'green'],
        ['a desktop', 'the default', 'yellow', 'default'],
        ['a desktop', 'different desktop', 'red', 'blue']
    ];

    describe.each(channelIndependenceTestParams)(
        'When the channel is %s channel',
        (titleParam1: string, titleParam2: string, broadcastChannelId: ChannelId, listenChannelId: ChannelId) => {
            let broadcastingChannel: RemoteChannel;
            let listeningChannel: RemoteChannel;

            let listener: fdc3Remote.RemoteContextListener;

            beforeEach(async () => {
                // Set up our broadcasting and listening channels
                broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, broadcastChannelId);
                listeningChannel = await fdc3Remote.getChannelById(listeningApp, listenChannelId);

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
                listeningChannel.join(broadcastingApp);

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

    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, broadcastingApp.name);
        await fdc3Remote.open(testManagerIdentity, listeningApp.name);
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(broadcastingApp).quit(true);
        await fin.Application.wrapSync(listeningApp).quit(true);
    });

    describe.each([['the default', 'default'], ['a desktop', 'red']])(
        'When the channel is %s channel',
        (titleParam: string, channelId: ChannelId) => {
            let broadcastingChannel: RemoteChannel;
            let listeningChannel: RemoteChannel;

            let listener1: fdc3Remote.RemoteContextListener;
            let listener2: fdc3Remote.RemoteContextListener;

            beforeEach(async () => {
                // Set up our broadcasting and listening channels
                broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, channelId);
                listeningChannel = await fdc3Remote.getChannelById(listeningApp, channelId);

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
                listener1.unsubscribe();

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

        // Set up a cached context in our desktop channel
        await broadcastingChannel.join();
        await broadcastingChannel.broadcast(testContext);
        // Check the context had been cached
        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(testContext);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(testContext);

        // Set up our listener
        const listener = await listeningChannel.addContextListener();

        // Have our listening window join our desktop channel
        await listeningChannel.join();

        // Check no context is received, contrary to 'flat' API behaviour
        await expect(listener.getReceivedContexts()).resolves.toEqual([]);
    });
});

describe('When querying the current context', () => {
    const broadcastingApp = testAppInDirectory1;
    const listeningApp = testAppInDirectory2;

    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, broadcastingApp.name);
        await fdc3Remote.open(testManagerIdentity, listeningApp.name);
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(broadcastingApp).quit(true);
        await fin.Application.wrapSync(listeningApp).quit(true);
    });

    test('The last-broadcast context will be returned for a desktop channel when the channel is occupied', async () => {
        // Set up our broadcasting and listening channels
        const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, 'purple');
        const listeningChannel = await fdc3Remote.getChannelById(listeningApp, 'purple');

        // Ensure the channel is occupied, then broadcast
        await broadcastingChannel.join();
        await broadcastingChannel.broadcast(testContext);

        // Check our context is present
        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(testContext);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(testContext);
    });

    test('The last-broadcast context will not be returned for a desktop channel when the channel has been emptied', async () => {
        // Set up our broadcasting and listening channels
        const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, 'yellow');
        const listeningChannel = await fdc3Remote.getChannelById(listeningApp, 'yellow');

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

    test('The last-broadcast context will not be returned for the a desktop channel when the channel has never been occupied', async () => {
        // Set up our broadcasting and listening channels
        const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, 'blue');
        const listeningChannel = await fdc3Remote.getChannelById(listeningApp, 'blue');

        // Broadcast on our empty channel
        await broadcastingChannel.broadcast(testContext);

        // Check our context has not been cached
        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(null);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(null);
    });

    test('The last-broadcast context will not be returned for the default channel, even when the channel is occupied', async () => {
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

describe('When using a non-directory app', () => {
    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, testAppInDirectory1.name);
        await fin.Application.startFromManifest(testAppNotInDirectory1.manifestUrl);
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(testAppInDirectory1).quit(true);
        await fin.Application.wrapSync(testAppNotInDirectory1).quit(true);
    });

    type TestParam = [string, string, Identity, Identity];
    const params: TestParam[] = [
        ['the app', 'a directory app', testAppNotInDirectory1, testAppInDirectory1],
        ['a directory app', 'the app', testAppInDirectory1, testAppNotInDirectory1]
    ];

    test.each(params)(
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
