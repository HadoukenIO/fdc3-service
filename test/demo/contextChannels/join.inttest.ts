import {Identity} from 'openfin/_v2/main';

import {IdentityError, DEFAULT_CHANNEL_ID} from '../../../src/client/main';
import {testManagerIdentity, appStartupTime, testAppNotInDirectory1, testAppNotFdc3, testAppInDirectory1, testAppInDirectory2} from '../constants';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {RemoteChannel, RemoteChannelEventListener} from '../utils/RemoteChannel';
import {fin} from '../utils/fin';
import {setupTeardown} from '../utils/common';

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

    test('When the channel is a desktop channel, an empty result is returned', async () => {
        const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'blue');

        await expect(defaultChannel.getMembers()).resolves.toEqual([]);
    });

    type TestParam = [string, Identity, () => Promise<any>];
    const testParams: TestParam[] = [
        [
            'an FDC3 app',
            testAppInDirectory1,
            async () => fdc3Remote.open(testManagerIdentity, testAppInDirectory1.name)
        ], [
            'a non directory app',
            testAppNotInDirectory1,
            async () => fin.Application.startFromManifest(testAppNotInDirectory1.manifestUrl).then(() => {})
        ]
    ];

    describe.each(testParams)('When %s has been started', (titleParam: string, appIdentity: Identity, openFunction: () => Promise<any>) => {
        beforeEach(async () => {
            await openFunction();
        }, appStartupTime);

        afterEach(async () => {
            const app = fin.Application.wrapSync(appIdentity);
            if (await app.isRunning()) {
                await app.quit(true);
            }
        });

        test('When the channel is the default channel, result contains the app', async () => {
            const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

            await expect(defaultChannel.getMembers()).resolves.toContainEqual({uuid: appIdentity.uuid, name: appIdentity.name});
        });

        test('After closing the app, result does not contains the app', async () => {
            const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

            await fin.Application.wrapSync(appIdentity).quit(true);

            await expect(defaultChannel.getMembers()).resolves.toEqual([testManagerIdentity]);
        });
    });

    describe('When a non-FDC3 app has been started', () => {
        beforeEach(async () => {
            await fin.Application.startFromManifest(testAppNotFdc3.manifestUrl);
        }, appStartupTime);

        afterEach(async () => {
            await fin.Application.wrapSync(testAppNotFdc3).quit(true);
        });

        test('Result does not contain the non-FDC3 app', async () => {
            const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

            await expect(defaultChannel.getMembers()).resolves.toEqual([testManagerIdentity]);
        });
    });
});

describe('When listening for channel-changed and Channel events', () => {
    const listeningApp = testAppInDirectory1;
    let defaultChannel: RemoteChannel;

    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, listeningApp.name);

        defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, DEFAULT_CHANNEL_ID);
    }, appStartupTime);

    afterEach(async () => {
        await fin.Application.wrapSync(listeningApp).quit(true);

        const inDirectoryApp = fin.Application.wrapSync(testAppInDirectory2);
        if (await inDirectoryApp.isRunning()) {
            await inDirectoryApp.quit(true);
        }

        const notInDirectoryApp = fin.Application.wrapSync(testAppNotInDirectory1);
        if (await notInDirectoryApp.isRunning()) {
            await notInDirectoryApp.quit(true);
        }

        const notFdc3App = fin.Application.wrapSync(testAppNotFdc3);
        if (await notFdc3App.isRunning()) {
            await notFdc3App.quit(true);
        }
    });

    type TestParam = [string, Identity, () => Promise<any>];
    const testParams: TestParam[] = [
        [
            'an FDC3 app',
            testAppInDirectory2,
            async () => fdc3Remote.open(testManagerIdentity, testAppInDirectory2.name)
        ],
        [
            'a non directory app',
            testAppNotInDirectory1,
            async () => fin.Application.startFromManifest(testAppNotInDirectory1.manifestUrl).then(() => {})
        ]
    ];

    test.each(testParams)('Events are recevied when %s starts', async (titleParam: string, appIdentity: Identity, openFunction: () => Promise<any>) => {
        // Set up our listener
        const channelChangedListener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');
        const windowAddedListener = await defaultChannel.addEventListener('window-added');

        // Open our app
        await openFunction();

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
        await fin.Application.startFromManifest(testAppNotFdc3.manifestUrl);

        // Check no event is received
        await expect(channelChangedListener.getReceivedEvents()).resolves.toEqual([]);
        await expect(windowAddedListener.getReceivedEvents()).resolves.toEqual([]);
    });

    test('Event is received when an FDC3 app quits', async () => {
        // Open our FDC3 app ahead of setting up our listener
        await fdc3Remote.open(testManagerIdentity, testAppInDirectory2.name);

        // Set up our listeners then quit the app
        const channelChangedListener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');
        const windowRemovedListener = await defaultChannel.addEventListener('window-removed');
        await fin.Application.wrapSync(testAppInDirectory2).quit(true);

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
                IdentityError.WindowWithIdentityNotFound,
                `No connection to FDC3 service found from window with identity: ${JSON.stringify(nonExistentWindowIdentity)}`
            );
    });

    describe('When a non-FDC3 app has been started', () => {
        beforeEach(async () => {
            await fin.Application.startFromManifest(testAppNotFdc3.manifestUrl);
        }, appStartupTime);

        afterEach(async () => {
            await fin.Application.wrapSync(testAppNotFdc3).quit(true);
        });

        test('If the non-FDC3 app identity is provided, an FDC3 error is thrown', async () => {
            await expect(blueChannel.join(testAppNotFdc3)).
                toThrowFDC3Error(
                    IdentityError.WindowWithIdentityNotFound,
                    `No connection to FDC3 service found from window with identity: \
${JSON.stringify({uuid: testAppNotFdc3.uuid, name: testAppNotFdc3.name})}`
                );
        });
    });

    describe('When an FDC3 app has been started', () => {
        beforeEach(async () => {
            await fdc3Remote.open(testManagerIdentity, testAppInDirectory1.name);
        }, appStartupTime);

        afterEach(async () => {
            await fin.Application.wrapSync(testAppInDirectory1).quit(true);
        });

        test('If the FDC3 app identity is provided, join resolves successfully', async () => {
            await expect(blueChannel.join(testAppInDirectory1)).resolves;
        });
    });
});

describe('When joining a channel', () => {
    const listeningApp = testAppInDirectory1;
    const joiningApp = testAppInDirectory2;

    let channelChangedListener: fdc3Remote.RemoteEventListener;
    let defaultChannel: RemoteChannel;

    let defaultChannelWindowAddedListener: RemoteChannelEventListener;
    let defaultChannelWindowRemovedListener: RemoteChannelEventListener;

    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, listeningApp.name);
        await fdc3Remote.open(testManagerIdentity, joiningApp.name);

        // Set up our listeners and default channel
        channelChangedListener = await fdc3Remote.addEventListener(joiningApp, 'channel-changed');
        defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

        defaultChannelWindowAddedListener = await defaultChannel.addEventListener('window-added');
        defaultChannelWindowRemovedListener = await defaultChannel.addEventListener('window-removed');
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(listeningApp).quit(true);
        await fin.Application.wrapSync(joiningApp).quit(true);
    });

    describe('When the channel is a desktop channel', () => {
        let desktopChannel: RemoteChannel;

        beforeEach(async () => {
            desktopChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'orange');
        });

        test('The expected channel is returned when querying the current channel', async () => {
            // Join our desktop channel
            await desktopChannel.join(joiningApp);

            // Check the joining window has the expected current channel
            await expect(fdc3Remote.getCurrentChannel(joiningApp)).resolves.toHaveProperty('channel', desktopChannel.channel);
        });

        test('The window is present when querying the members of the desktop channel and not the default channel', async () => {
            // Join our desktop channel
            await desktopChannel.join(joiningApp);

            // Check our desktop channel contains our joining app
            await expect(desktopChannel.getMembers()).resolves.toEqual([{
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
            // Set up listeners on our desktop channel
            const desktopChannelWindowAddedListener = await desktopChannel.addEventListener('window-added');
            const desktopChannelWindowRemovedListener = await desktopChannel.addEventListener('window-removed');

            // Join our desktop channel
            await desktopChannel.join(joiningApp);

            const expectedEvent = {
                identity: {uuid: joiningApp.uuid, name: joiningApp.name},
                channel: desktopChannel.channel,
                previousChannel: {id: 'default', type: 'default'}
            };

            // Check we received the expected events on the default channel
            await expect(defaultChannelWindowAddedListener.getReceivedEvents()).resolves.toEqual([]);
            await expect(defaultChannelWindowRemovedListener.getReceivedEvents()).resolves.toEqual([{
                type: 'window-removed', ...expectedEvent
            }]);

            // Check we received the expected events on the desktop channel
            await expect(desktopChannelWindowAddedListener.getReceivedEvents()).resolves.toEqual([{
                type: 'window-added', ...expectedEvent
            }]);
            await expect(desktopChannelWindowRemovedListener.getReceivedEvents()).resolves.toEqual([]);

            // Check we a channel-changed event
            await expect(channelChangedListener.getReceivedEvents()).resolves.toEqual([{
                type: 'channel-changed', ...expectedEvent
            }]);
        });
    });

    describe('When we join the channel for a second time', () => {
        let blueChannel: RemoteChannel;

        beforeEach(async () => {
            blueChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'blue');
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

    describe('When the channel is a desktop channel, and we then re-join the default channel', () => {
        let purpleChannel: RemoteChannel;

        beforeEach(async () => {
            purpleChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'purple');
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
        // Get a desktop channel from our joining window
        const blueChannel = await fdc3Remote.getChannelById(joiningApp, 'blue');

        // Set up listeners for our blue channel
        const blueChannelWindowAddedListener = await blueChannel.addEventListener('window-added');
        const blueChannelWindowRemovedListener = await blueChannel.addEventListener('window-removed');

        // Join the channel
        await blueChannel.join();

        // Check that the joining window is now a member of the desktop channel
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
    beforeEach(async () => {
        await fin.Application.startFromManifest(testAppNotInDirectory1.manifestUrl);
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(testAppNotInDirectory1).quit(true);
    });

    test('The app can join a channel as expected', async () => {
        // Get a desktop channel and the default channel from our non-directory window
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

        // Check that the joining window is now a member of the desktop channel
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
