import {Identity} from 'openfin/_v2/main';

import {ConnectionError} from '../../../src/client/main';
import {testManagerIdentity, appStartupTime, testAppNotInDirectory1, testAppNotInDirectoryNotFdc3, testAppInDirectory1, testAppInDirectory2, testAppUrl} from '../constants';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {RemoteChannel, RemoteChannelEventListener} from '../utils/RemoteChannel';
import {setupTeardown, setupOpenDirectoryAppBookends, setupStartNonDirectoryAppBookends, quitApps, startNonDirectoryApp, startDirectoryApp, reloadProvider} from '../utils/common';
import {fakeAppChannelName, createFakeContext} from '../utils/fakes';
import {TestWindowContext} from '../utils/ofPuppeteer';
import {DEFAULT_CHANNEL_ID} from '../../../src/client/internal';

/*
 * Tests simple behaviour of Channel.getMembers() and the channel-changed and Channel events, before testing how they and getCurrentChannel()
 * are influenced by Channel.join()
 */

setupTeardown();

describe('When getting members of a channel', () => {
    test('When the channel is the default channel, only the test manager is returned', async () => {
        const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

        await expect(defaultChannel.getMembers()).resolves.toEqual([testManagerIdentity]);
    });

    test('When the channel is a system channel, an empty result is returned', async () => {
        const blueChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'blue');

        await expect(blueChannel.getMembers()).resolves.toEqual([]);
    });

    test('When the channel is a newly-created app channel, an empty result is returned', async () => {
        const appChannel = await fdc3Remote.getOrCreateAppChannel(testManagerIdentity, fakeAppChannelName());

        await expect(appChannel.getMembers()).resolves.toEqual([]);
    });

    type StartAppTestParam = [string, Identity, () => void];
    const startAppTestParams: StartAppTestParam[] = [
        [
            'an FDC3 app',
            testAppInDirectory1,
            () => setupOpenDirectoryAppBookends(testAppInDirectory1)
        ], [
            'a non-directory app',
            testAppNotInDirectory1,
            () => setupStartNonDirectoryAppBookends(testAppNotInDirectory1)
        ]
    ];

    describe.each(startAppTestParams)('When %s has been started', (titleParam: string, appIdentity: Identity, setupBookends: () => void) => {
        setupBookends();

        test('When the channel is the default channel, result contains the app', async () => {
            const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

            await expect(defaultChannel.getMembers()).resolves.toContainEqual({uuid: appIdentity.uuid, name: appIdentity.name});
        });

        test('After closing the app, result does not contains the app', async () => {
            const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

            await quitApps(appIdentity);

            await expect(defaultChannel.getMembers()).resolves.toEqual([testManagerIdentity]);
        });
    });

    describe('When a non-FDC3 app has been started', () => {
        setupStartNonDirectoryAppBookends(testAppNotInDirectoryNotFdc3);

        test('Result does not contain the non-FDC3 app', async () => {
            const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

            await expect(defaultChannel.getMembers()).resolves.toEqual([testManagerIdentity]);
        });
    });
});

describe('When listening for channel-changed and Channel events', () => {
    const listeningApp = testAppInDirectory1;
    let defaultChannel: RemoteChannel;

    setupOpenDirectoryAppBookends(listeningApp);

    beforeEach(async () => {
        defaultChannel = await fdc3Remote.getChannelById(listeningApp, DEFAULT_CHANNEL_ID);
    }, appStartupTime);

    afterEach(async () => {
        await quitApps(testAppInDirectory2, testAppNotInDirectory1, testAppNotInDirectoryNotFdc3);
    });

    type EventTestParam = [string, Identity, () => Promise<void>];
    const eventTestParams: EventTestParam[] = [
        [
            'an FDC3 app',
            testAppInDirectory2,
            () => startDirectoryApp(testAppInDirectory2)
        ],
        [
            'a non-directory app',
            testAppNotInDirectory1,
            () => startNonDirectoryApp(testAppNotInDirectory1)
        ]
    ];

    test.each(eventTestParams)('Events are recevied when %s starts', async (titleParam: string, appIdentity: Identity, startApp: () => Promise<void>) => {
        // Set up our listener
        const channelChangedListener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');
        const windowAddedListener = await defaultChannel.addEventListener('window-added');

        // Start our app
        await startApp();

        const expectedEvent = {
            identity: {uuid: appIdentity.uuid, name: appIdentity.name},
            channel: {id: 'default', type: 'default'},
            previousChannel: null
        };

        // Check we received window-added event
        await expect(windowAddedListener.getReceivedEvents()).resolves.toEqual([{
            type: 'window-added', ...expectedEvent
        }]);

        // Check we received a channel-changed event
        await expect(channelChangedListener.getReceivedEvents()).resolves.toEqual([{
            type: 'channel-changed', ...expectedEvent
        }]);
    }, appStartupTime);

    test('No events are received when a non-FDC3 app starts', async () => {
        // Set up our listener
        const channelChangedListener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');
        const windowAddedListener = await defaultChannel.addEventListener('window-added');

        // Start our non-FDC3 app
        await startNonDirectoryApp(testAppNotInDirectoryNotFdc3);

        // Check no event is received
        await expect(channelChangedListener.getReceivedEvents()).resolves.toEqual([]);
        await expect(windowAddedListener.getReceivedEvents()).resolves.toEqual([]);
    });

    test('Event is received when an FDC3 app quits', async () => {
        // Open our FDC3 app ahead of setting up our listener
        await startDirectoryApp(testAppInDirectory2);

        // Set up our listeners then quit the app
        const channelChangedListener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');
        const windowRemovedListener = await defaultChannel.addEventListener('window-removed');
        await quitApps(testAppInDirectory2);

        const expectedEvent = {
            identity: {uuid: testAppInDirectory2.uuid, name: testAppInDirectory2.name},
            channel: null,
            previousChannel: {id: 'default', type: 'default'}
        };

        // Check we received a window-removed event
        await expect(windowRemovedListener.getReceivedEvents()).resolves.toEqual([{
            type: 'window-removed', ...expectedEvent
        }]);

        // Check we received a channel-changed event
        await expect(channelChangedListener.getReceivedEvents()).resolves.toEqual([{
            type: 'channel-changed', ...expectedEvent
        }]);
    }, appStartupTime);
});

describe('When attempting to join a channel', () => {
    let blueChannel: RemoteChannel;

    beforeEach(async () => {
        blueChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'blue');
    });

    test('If an invalid identity is provided, a TypeError is thrown', async () => {
        const invalidIdentity = {irrelevantProperty: 'irrelevantValue'} as unknown as Identity;

        await expect(blueChannel.join(invalidIdentity)).
            rejects.
            toThrowError(new TypeError(`${JSON.stringify(invalidIdentity)} is not a valid Identity`));
    });

    test('If an identity for a window that does not exist is provided, an FDC3 error is thrown', async () => {
        const nonExistentWindowIdentity: Identity = {uuid: 'does-not-exist', name: 'does-not-exist'};

        await expect(blueChannel.join(nonExistentWindowIdentity)).
            toThrowFDC3Error(
                ConnectionError.WindowWithIdentityNotFound,
                `No connection to FDC3 service found from window with identity: ${JSON.stringify(nonExistentWindowIdentity)}`
            );
    });

    describe('When a non-FDC3 app has been started', () => {
        setupStartNonDirectoryAppBookends(testAppNotInDirectoryNotFdc3);

        test('If the non-FDC3 app identity is provided, an FDC3 error is thrown', async () => {
            await expect(blueChannel.join(testAppNotInDirectoryNotFdc3)).
                toThrowFDC3Error(
                    ConnectionError.WindowWithIdentityNotFound,
                    `No connection to FDC3 service found from window with identity: \
${JSON.stringify({uuid: testAppNotInDirectoryNotFdc3.uuid, name: testAppNotInDirectoryNotFdc3.name})}`
                );
        });
    });

    describe('When an FDC3 app has been started', () => {
        setupOpenDirectoryAppBookends(testAppInDirectory1);

        test('If the FDC3 app identity is provided, join resolves successfully', async () => {
            await blueChannel.join(testAppInDirectory1);
        });
    });
});

describe('When joining a non-default channel', () => {
    const listeningApp = testAppInDirectory1;
    const joiningApp = testAppInDirectory2;

    let channelChangedListener: fdc3Remote.RemoteEventListener;
    let defaultChannel: RemoteChannel;

    let defaultChannelWindowAddedListener: RemoteChannelEventListener;
    let defaultChannelWindowRemovedListener: RemoteChannelEventListener;

    setupOpenDirectoryAppBookends(listeningApp);
    setupOpenDirectoryAppBookends(joiningApp);

    beforeEach(async () => {
        // Set up our listeners and default channel
        channelChangedListener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');
        defaultChannel = await fdc3Remote.getChannelById(listeningApp, 'default');

        defaultChannelWindowAddedListener = await defaultChannel.addEventListener('window-added');
        defaultChannelWindowRemovedListener = await defaultChannel.addEventListener('window-removed');
    });

    type JoinTestParam = [string, () => Promise<RemoteChannel>];
    const joinTestParams: JoinTestParam[] = [
        [
            'system',
            () => fdc3Remote.getChannelById(listeningApp, 'orange')
        ],
        [
            'app',
            () => fdc3Remote.getOrCreateAppChannel(listeningApp, fakeAppChannelName())
        ]
    ];

    describe.each(joinTestParams)('When the channel is a %s channel', (titleParam: string, getChannel: () => Promise<RemoteChannel>) => {
        let channel: RemoteChannel;

        beforeEach(async () => {
            channel = await getChannel();
        });

        test('The expected channel is returned when querying the current channel', async () => {
            // Join our channel
            await channel.join(joiningApp);

            // Check the joining window has the expected current channel
            await expect(fdc3Remote.getCurrentChannel(joiningApp)).resolves.toHaveProperty('channel', channel.channel);
        });

        test('When the channel has stored context, and the app has an erroring context listener, the promise resolves without error', async () => {
            // Broadcast on our channel while populated to set a context
            const childWindow = await fdc3Remote.createFinWindow(joiningApp, {url: testAppUrl, name: 'child-window'});
            await channel.join(childWindow);
            await channel.broadcast(createFakeContext());

            // Setup an erroring listener
            await fdc3Remote.ofBrowser.executeOnWindow(joiningApp, function (this: TestWindowContext): void {
                this.fdc3.addContextListener(() => {
                    throw new Error('Context listener throwing error');
                });
            });

            // Join our channel
            await channel.join(joiningApp);
        });

        test('When the channel has stored context, and the app has a mix of error and non-erroring context listeners, all listeners are \
triggered, and the promise resolves without error', async () => {
            // Broadcast on our channel while populated to set a context
            const context = createFakeContext();
            const childWindow = await fdc3Remote.createFinWindow(joiningApp, {url: testAppUrl, name: 'child-window'});
            await channel.join(childWindow);
            await channel.broadcast(context);

            // Setup an erroring listener
            await fdc3Remote.ofBrowser.executeOnWindow(joiningApp, function (this: TestWindowContext): void {
                this.fdc3.addContextListener(() => {
                    throw new Error('Context listener throwing error');
                });
            });

            const listener = await fdc3Remote.addContextListener(joiningApp);

            // Join our channel
            await channel.join(joiningApp);

            // Check the non-erroring listener received the context
            await expect(listener).toHaveReceivedContexts([context]);
        });

        test(`The window is present when querying the members of the ${titleParam} channel and not the default channel`, async () => {
            // Join our system channel
            await channel.join(joiningApp);

            // Check our channel contains our joining app
            await expect(channel.getMembers()).resolves.toEqual([{
                uuid: joiningApp.uuid, name: joiningApp.name
            }]);

            // Check the default channel does not contain our joining app
            await expect(defaultChannel.getMembers()).resolves.not.toContain([{
                uuid: joiningApp.uuid, name: joiningApp.name
            }]);
            // We expect the default channel to contain the test manager and the listening window
            await expect(defaultChannel.getMembers()).resolves.toHaveLength(2);
        });

        test('The expected events are received', async () => {
            // Set up listeners on our channel
            const testChannelWindowAddedListener = await channel.addEventListener('window-added');
            const testChannelWindowRemovedListener = await channel.addEventListener('window-removed');

            // Join our channel
            await channel.join(joiningApp);

            const expectedEvent = {
                identity: {uuid: joiningApp.uuid, name: joiningApp.name},
                channel: channel.channel,
                previousChannel: {id: 'default', type: 'default'}
            };

            // Check we received the expected events on the default channel
            await expect(defaultChannelWindowAddedListener.getReceivedEvents()).resolves.toEqual([]);
            await expect(defaultChannelWindowRemovedListener.getReceivedEvents()).resolves.toEqual([{
                type: 'window-removed', ...expectedEvent
            }]);

            // Check we received the expected events on our channel
            await expect(testChannelWindowAddedListener.getReceivedEvents()).resolves.toEqual([{
                type: 'window-added', ...expectedEvent
            }]);
            await expect(testChannelWindowRemovedListener.getReceivedEvents()).resolves.toEqual([]);

            // Check we a channel-changed event
            await expect(channelChangedListener.getReceivedEvents()).resolves.toEqual([{
                type: 'channel-changed', ...expectedEvent
            }]);
        });
    });

    describe('When we join the channel for a second time', () => {
        let blueChannel: RemoteChannel;

        beforeEach(async () => {
            blueChannel = await fdc3Remote.getChannelById(listeningApp, 'blue');
        });

        test('The window is present only once when querying the members of the \'blue\'', async () => {
            // Join the channel twice
            await blueChannel.join(joiningApp);
            await blueChannel.join(joiningApp);

            // Check our joining window is only present once when getting channel members
            await expect(blueChannel.getMembers()).resolves.toEqual([{
                uuid: joiningApp.uuid, name: joiningApp.name
            }]);
        });

        test('The expected events are received only once', async () => {
            // Set up listeners on our blue channel
            const blueChannelWindowAddedListener = await blueChannel.addEventListener('window-added');
            const blueChannelWindowRemovedListener = await blueChannel.addEventListener('window-removed');

            // Join the channel twice
            await blueChannel.join(joiningApp);
            await blueChannel.join(joiningApp);

            // Check the expected events on the default channel are received only once
            await expect(defaultChannelWindowAddedListener.getReceivedEvents()).resolves.toHaveLength(0);
            await expect(defaultChannelWindowRemovedListener.getReceivedEvents()).resolves.toHaveLength(1);

            // Check the expected events on the blue channel are received only once
            await expect(blueChannelWindowAddedListener.getReceivedEvents()).resolves.toHaveLength(1);
            await expect(blueChannelWindowRemovedListener.getReceivedEvents()).resolves.toHaveLength(0);

            // Check the channel-changed event is only received once
            await expect(channelChangedListener.getReceivedEvents()).resolves.toHaveLength(1);
        });
    });

    describe('When we then re-join the default channel', () => {
        let purpleChannel: RemoteChannel;

        beforeEach(async () => {
            purpleChannel = await fdc3Remote.getChannelById(listeningApp, 'purple');
        });

        test('The correct channel is returned when querying the current channel', async () => {
            // Leave and re-join the default channel
            await purpleChannel.join(joiningApp);
            await defaultChannel.join(joiningApp);

            // Check the joining window has the expected current channel
            await expect(fdc3Remote.getCurrentChannel(joiningApp)).resolves.toHaveProperty('channel', defaultChannel.channel);
        });

        test('The window is present when querying the members of the default channel and not the purple channel', async () => {
            // Leave and re-join the default channel
            await purpleChannel.join(joiningApp);
            await defaultChannel.join(joiningApp);

            // Check the purple channel is empty
            await expect(purpleChannel.getMembers()).resolves.toHaveLength(0);

            // Check the default channel contains our joining window
            await expect(defaultChannel.getMembers()).resolves.toContainEqual({
                uuid: joiningApp.uuid, name: joiningApp.name
            });
            // We expect the default channel to contain our joining window, the test manager, and the listening window
            await expect(defaultChannel.getMembers()).resolves.toHaveLength(3);
        });

        test('A channel-change event is fired twice', async () => {
            // Set up listeners on our purple channel
            const purpleChannelWindowAddedListener = await purpleChannel.addEventListener('window-added');
            const purpleChannelWindowRemovedListener = await purpleChannel.addEventListener('window-removed');

            // Leave and re-join the default channel
            await purpleChannel.join(joiningApp);
            await defaultChannel.join(joiningApp);

            const expectedEvent1 = {
                identity: {uuid: joiningApp.uuid, name: joiningApp.name},
                channel: purpleChannel.channel,
                previousChannel: {id: 'default', type: 'default'}
            };

            const expectedEvent2 = {
                identity: {uuid: joiningApp.uuid, name: joiningApp.name},
                channel: {id: 'default', type: 'default'},
                previousChannel: purpleChannel.channel
            };

            // Check expected events are received on the default channel for leaving and rejoining
            await expect(defaultChannelWindowRemovedListener.getReceivedEvents()).resolves.toEqual([{
                type: 'window-removed', ...expectedEvent1
            }]);
            await expect(defaultChannelWindowAddedListener.getReceivedEvents()).resolves.toEqual([{
                type: 'window-added', ...expectedEvent2
            }]);

            // Check expected events are received on the purple channel for joining then leaving
            await expect(purpleChannelWindowAddedListener.getReceivedEvents()).resolves.toEqual([{
                type: 'window-added', ...expectedEvent1
            }]);
            await expect(purpleChannelWindowRemovedListener.getReceivedEvents()).resolves.toEqual([{
                type: 'window-removed', ...expectedEvent2
            }]);

            // Check channel-changed are received for both leaving and re-joining
            await expect(channelChangedListener.getReceivedEvents()).resolves.toEqual([{
                type: 'channel-changed', ...expectedEvent1
            },
            {
                type: 'channel-changed', ...expectedEvent2
            }]);
        });
    });

    test('When joining a channel and no target window is specified, the current window is used', async () => {
        // Get a system channel from our joining window
        const blueChannel = await fdc3Remote.getChannelById(joiningApp, 'blue');

        // Set up listeners for our blue channel
        const blueChannelWindowAddedListener = await blueChannel.addEventListener('window-added');
        const blueChannelWindowRemovedListener = await blueChannel.addEventListener('window-removed');

        // Join the channel
        await blueChannel.join();

        // Check that the joining window is now a member of the system channel
        await expect(fdc3Remote.getCurrentChannel(joiningApp)).resolves.toHaveProperty('channel', blueChannel.channel);
        await expect(blueChannel.getMembers()).resolves.toEqual([{uuid: joiningApp.uuid, name: joiningApp.name}]);

        const expectedEvent = {
            identity: {uuid: joiningApp.uuid, name: joiningApp.name},
            channel: blueChannel.channel,
            previousChannel: {id: 'default', type: 'default'}
        };

        // Check expected events are received on the default channel
        await expect(defaultChannelWindowAddedListener.getReceivedEvents()).resolves.toEqual([]);
        await expect(defaultChannelWindowRemovedListener.getReceivedEvents()).resolves.toEqual([{
            type: 'window-removed', ...expectedEvent
        }]);

        // Check expected events are received on the blue channel
        await expect(blueChannelWindowAddedListener.getReceivedEvents()).resolves.toEqual([{
            type: 'window-added', ...expectedEvent
        }]);
        await expect(blueChannelWindowRemovedListener.getReceivedEvents()).resolves.toEqual([]);

        // Check channel-changed event is received
        await expect(channelChangedListener.getReceivedEvents()).resolves.toEqual([{
            type: 'channel-changed', ...expectedEvent
        }]);
    });
});

describe('When using a non-directory app', () => {
    setupStartNonDirectoryAppBookends(testAppNotInDirectory1);

    test('The app can join a channel as expected', async () => {
        // Get a system channel and the default channel from our non-directory window
        const defaultChannel = await fdc3Remote.getChannelById(testAppNotInDirectory1, 'default');
        const greenChannel = await fdc3Remote.getChannelById(testAppNotInDirectory1, 'green');

        // Set up our listeners in the non-directory window
        const channelChangedListener = await fdc3Remote.addEventListener(testAppNotInDirectory1, 'channel-changed');

        const defaultChannelWindowAddedListener = await defaultChannel.addEventListener('window-added');
        const defaultChannelWindowRemovedListener = await defaultChannel.addEventListener('window-removed');

        const greenChannelWindowAddedListener = await greenChannel.addEventListener('window-added');
        const greenChannelWindowRemovedListener = await greenChannel.addEventListener('window-removed');

        // Join the channel
        await greenChannel.join();

        // Check that the joining window is now a member of the system channel
        await expect(fdc3Remote.getCurrentChannel(testAppNotInDirectory1)).resolves.toHaveProperty('channel', greenChannel.channel);
        await expect(greenChannel.getMembers()).resolves.toEqual([{uuid: testAppNotInDirectory1.uuid, name: testAppNotInDirectory1.name}]);

        const expectedEvent = {
            identity: {uuid: testAppNotInDirectory1.uuid, name: testAppNotInDirectory1.name},
            channel: greenChannel.channel,
            previousChannel: {id: 'default', type: 'default'}
        };

        // Check expected events are received on the default channel
        await expect(defaultChannelWindowAddedListener.getReceivedEvents()).resolves.toEqual([]);
        await expect(defaultChannelWindowRemovedListener.getReceivedEvents()).resolves.toEqual([{
            type: 'window-removed', ...expectedEvent
        }]);

        // Check expected events are received on the green channel
        await expect(greenChannelWindowAddedListener.getReceivedEvents()).resolves.toEqual([{
            type: 'window-added', ...expectedEvent
        }]);
        await expect(greenChannelWindowRemovedListener.getReceivedEvents()).resolves.toEqual([]);

        // Check channel-changed event is received
        await expect(channelChangedListener.getReceivedEvents()).resolves.toEqual([{
            type: 'channel-changed', ...expectedEvent
        }]);
    });
});

describe('When the provider is reloaded', () => {
    setupStartNonDirectoryAppBookends(testAppNotInDirectory1);

    test('The client rejoins the channel it was previously in', async () => {
        const greenChannel = await fdc3Remote.getChannelById(testAppNotInDirectory1, 'green');
        await greenChannel.join();

        // Reload multiple times to confirm that the client reconnected and joins the correct channel
        // If this fails the test app will be in the default channel and not green.
        for (let i = 0; i < 4; i++) {
            await reloadProvider();
        }

        await expect(fdc3Remote.getCurrentChannel(testAppNotInDirectory1)).resolves.toHaveProperty('channel', greenChannel.channel);
        await expect(greenChannel.getMembers()).resolves.toEqual([{uuid: testAppNotInDirectory1.uuid, name: testAppNotInDirectory1.name}]);
    });
});
