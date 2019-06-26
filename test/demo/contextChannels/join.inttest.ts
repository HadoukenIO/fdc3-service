import {Identity} from 'openfin/_v2/main';

import {IdentityError} from '../../../src/client/main';
import {testManagerIdentity, appStartupTime, testAppNotInDirectory, testAppNotFdc3, testAppInDirectory1, testAppInDirectory2} from '../constants';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {RemoteChannel} from '../utils/RemoteChannel';
import {fin} from '../utils/fin';

/*
 * Tests simple behaviour of Channel.getMembers() and the channel-changed event, before testing how they and getCurrentChannel()
 * are influenced by Channel.join()
 */

beforeAll(async () => {
    await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);
});

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
            testAppNotInDirectory,
            async () => fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl).then(() => {})
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

describe('When listening for a channel-changed event', () => {
    const listeningApp = testAppInDirectory1;

    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, listeningApp.name);
    }, appStartupTime);

    afterEach(async () => {
        await fin.Application.wrapSync(listeningApp).quit(true);

        const inDirectoryApp = fin.Application.wrapSync(testAppInDirectory2);
        if (await inDirectoryApp.isRunning()) {
            await inDirectoryApp.quit(true);
        }

        const notInDirectoryApp = fin.Application.wrapSync(testAppNotInDirectory);
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
        ], [
            'a non directory app',
            testAppNotInDirectory,
            async () => fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl).then(() => {})
        ]
    ];

    test.each(testParams)('Event is recevied when %s starts', async (titleParam: string, appIdentity: Identity, openFunction: () => Promise<any>) => {
        // Set up our listener
        const listener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');

        // Open our app
        await openFunction();

        // Check we received a channel-changed event
        await expect(listener.getReceivedEvents()).resolves.toEqual([{
            type: 'channel-changed',
            identity: {uuid: appIdentity.uuid, name: appIdentity.name},
            channel: {id: 'default', type: 'default'},
            previousChannel: null
        }]);
    }, appStartupTime);

    test('Event is not received when a non-FDC3 app starts', async () => {
        // Set up our listener
        const listener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');

        // Start our non-FDC3 app
        await fin.Application.startFromManifest(testAppNotFdc3.manifestUrl);

        // Check no event is received
        await expect(listener.getReceivedEvents()).resolves.toEqual([]);
    });

    test('Event is received when an FDC3 app quits', async () => {
        // Open our FDC3 app ahead of setting up our listener
        await fdc3Remote.open(testManagerIdentity, testAppInDirectory2.name);

        // Set up our listener then quit the app
        const listener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');
        await fin.Application.wrapSync(testAppInDirectory2).quit(true);

        // Check we received a channel-changed event
        await expect(listener.getReceivedEvents()).resolves.toEqual([{
            type: 'channel-changed',
            identity: {uuid: testAppInDirectory2.uuid, name: testAppInDirectory2.name},
            channel: null,
            previousChannel: {id: 'default', type: 'default'}
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

    let listener: fdc3Remote.RemoteEventListener;
    let defaultChannel: RemoteChannel;

    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, listeningApp.name);
        await fdc3Remote.open(testManagerIdentity, joiningApp.name);

        // Set up our listener and default channel
        listener = await fdc3Remote.addEventListener(joiningApp, 'channel-changed');
        defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');
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
                uuid: joiningApp.uuid,
                name: joiningApp.name
            }]);

            // Check the default channel does not contain our joining app
            await expect(defaultChannel.getMembers()).resolves.not.toContain([{
                uuid: joiningApp.uuid,
                name: joiningApp.name
            }]);
            // We expect the default channel to contain the test manager and the listening window
            await expect(defaultChannel.getMembers()).resolves.toHaveLength(2);
        });

        test('A channel-change event is fired', async () => {
            // Join our desktop channel
            await desktopChannel.join(joiningApp);

            //  Check we a channel-changed event
            await expect(listener.getReceivedEvents()).resolves.toEqual([{
                type: 'channel-changed',
                identity: {uuid: joiningApp.uuid, name: joiningApp.name},
                channel: desktopChannel.channel,
                previousChannel: {id: 'default', type: 'default'}
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
                uuid: joiningApp.uuid,
                name: joiningApp.name
            }]);
        });

        test('A channel-change event is fired only once', async () => {
            // Join the channel twice
            await blueChannel.join(joiningApp);
            await blueChannel.join(joiningApp);

            // Check the channel-changed event is only received once
            await expect(listener.getReceivedEvents()).resolves.toEqual([{
                type: 'channel-changed',
                identity: {uuid: joiningApp.uuid, name: joiningApp.name},
                channel: blueChannel.channel,
                previousChannel: {id: 'default', type: 'default'}
            }]);
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
                uuid: joiningApp.uuid,
                name: joiningApp.name
            });
            // We expect the default channel to contain our joining window, the test manager, and the listening window
            await expect(defaultChannel.getMembers()).resolves.toHaveLength(3);
        });

        test('A channel-change event is fired twice', async () => {
            // Leave and re-join the default channel
            await purpleChannel.join(joiningApp);
            await defaultChannel.join(joiningApp);

            // Check events are fired for both leaving and re-joining
            await expect(listener.getReceivedEvents()).resolves.toEqual([{
                type: 'channel-changed',
                identity: {uuid: joiningApp.uuid, name: joiningApp.name},
                channel: purpleChannel.channel,
                previousChannel: {id: 'default', type: 'default'}
            },
            {
                type: 'channel-changed',
                identity: {uuid: joiningApp.uuid, name: joiningApp.name},
                channel: {id: 'default', type: 'default'},
                previousChannel: purpleChannel.channel
            }]);
        });
    });

    test('When joining a channel and no target window is specified, the current window is used', async () => {
        // Get a desktop channel from our joining window
        const blueChannel = await fdc3Remote.getChannelById(joiningApp, 'blue');

        // Join the channel
        await blueChannel.join();

        // Check that the joining window is now a member of the desktop channel
        await expect(fdc3Remote.getCurrentChannel(joiningApp)).resolves.toHaveProperty('channel', blueChannel.channel);
        await expect(blueChannel.getMembers()).resolves.toEqual([{uuid: joiningApp.uuid, name: joiningApp.name}]);

        // Check event is received
        await expect(listener.getReceivedEvents()).resolves.toEqual([{
            type: 'channel-changed',
            identity: {uuid: joiningApp.uuid, name: joiningApp.name},
            channel: blueChannel.channel,
            previousChannel: {id: 'default', type: 'default'}
        }]);
    });
});

describe('When using a non-directory app', () => {
    beforeEach(async () => {
        await fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl);
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(testAppNotInDirectory).quit(true);
    });

    test('The app can join a channel as expected', async () => {
        // Get a desktop channel from our non-directory window
        const greenChannel = await fdc3Remote.getChannelById(testAppNotInDirectory, 'green');

        // Set up a listener in the non-directory window
        const listener = await fdc3Remote.addEventListener(testAppNotInDirectory, 'channel-changed');

        // Join the channel
        await greenChannel.join();

        // Check that the joining window is now a member of the desktop channel
        await expect(fdc3Remote.getCurrentChannel(testAppNotInDirectory)).resolves.toHaveProperty('channel', greenChannel.channel);
        await expect(greenChannel.getMembers()).resolves.toEqual([{uuid: testAppNotInDirectory.uuid, name: testAppNotInDirectory.name}]);

        // Check event is received
        await expect(listener.getReceivedEvents()).resolves.toEqual([{
            type: 'channel-changed',
            identity: {uuid: testAppNotInDirectory.uuid, name: testAppNotInDirectory.name},
            channel: greenChannel.channel,
            previousChannel: {id: 'default', type: 'default'}
        }]);
    });
});
