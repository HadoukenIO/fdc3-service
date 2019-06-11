import {connect, Fin} from 'hadouken-js-adapter';
import {Identity} from 'openfin/_v2/main';

import {IdentityError} from '../../src/client/main';

import {testManagerIdentity, appStartupTime, testAppNotInDirectory, testAppNotFdc3, testAppInDirectory1} from './constants';
import * as fdc3Remote from './utils/fdc3RemoteExecution';

/*
 * Tests simple behaviour of ContextChannel.getMembers() and the channel-changed event, before testing how they and getCurrentChannel()
 * are influenced by ContextChannel.join()
 */

let fin: Fin;

beforeAll(async () => {
    fin = await connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-contextChannelJoining.ts'});
    await expect(fin.Application.wrapSync({uuid: 'test-app', name: 'test-app'}).isRunning()).resolves.toBe(true);
});

describe('When getting members of a channel', () => {
    test('When getting members of the default channel, only the test manager is returned', async () => {
        const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

        await expect(defaultChannel.getMembers()).resolves.toEqual([{uuid: testManagerIdentity.uuid, name: testManagerIdentity.name}]);
    });

    test('When getting members of a the \'blue\' channel, an empty result is returned', async () => {
        const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'blue');

        await expect(defaultChannel.getMembers()).resolves.toEqual([]);
    });

    describe('When an FDC3 app is running', () => {
        beforeEach(async () => {
            await fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl);
        }, appStartupTime);

        afterEach(async () => {
            const app = fin.Application.wrapSync(testAppNotInDirectory);
            if (await app.isRunning()) {
                await app.quit(true);
            }
        });

        test('When getting members of the default channel, result contains the FDC3 app', async () => {
            const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

            await expect(defaultChannel.getMembers()).resolves.toEqual([
                {uuid: testManagerIdentity.uuid, name: testManagerIdentity.name},
                {uuid: testAppNotInDirectory.uuid, name: testAppNotInDirectory.name}
            ]);
        });

        test('After closing the FDC3 app, when getting members of the default channel, result does not contains the FDC3 app', async () => {
            const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

            await fin.Application.wrapSync(testAppNotInDirectory).quit(true);

            await expect(defaultChannel.getMembers()).resolves.toEqual([{uuid: testManagerIdentity.uuid, name: testManagerIdentity.name}]);
        });
    });

    describe('When a non-FDC3 app is running', () => {
        beforeEach(async () => {
            await fin.Application.startFromManifest(testAppNotFdc3.manifestUrl);
        }, appStartupTime);

        afterEach(async () => {
            await fin.Application.wrapSync(testAppNotFdc3).quit(true);
        });

        test('When getting members of the default channel, result does not contain the non-FDC3 app', async () => {
            const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

            await expect(defaultChannel.getMembers()).resolves.toEqual([{uuid: testManagerIdentity.uuid, name: testManagerIdentity.name}]);
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

        const notInDirectoryApp = fin.Application.wrapSync(testAppNotInDirectory);
        if (await notInDirectoryApp.isRunning()) {
            await notInDirectoryApp.quit(true);
        }

        const notFdc3App = fin.Application.wrapSync(testAppNotFdc3);
        if (await notFdc3App.isRunning()) {
            await notFdc3App.quit(true);
        }
    });

    test('Event is fired when an FDC3 app starts', async () => {
        const listener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');

        await fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl);

        // Check we received a channel-changed event
        await expect(listener.getReceivedEvents()).resolves.toEqual([{
            type: 'channel-changed',
            identity: {uuid: testAppNotInDirectory.uuid, name: testAppNotInDirectory.name},
            channel: {id: 'default', type: 'default'},
            previousChannel: null
        }]);
    }, appStartupTime);

    test('No event is fired when a non-FDC3 app starts', async () => {
        const listener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');

        await fin.Application.startFromManifest(testAppNotFdc3.manifestUrl);

        await expect(listener.getReceivedEvents()).resolves.toEqual([]);
    });

    describe('When an app is already running', () => {
        beforeEach(async () => {
            await fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl);
        }, appStartupTime);

        test('Event is fired when an FDC3 app quits', async () => {
            const listener = await fdc3Remote.addEventListener(listeningApp, 'channel-changed');

            // Quit the FDC3 app
            await fin.Application.wrapSync(testAppNotInDirectory).quit(true);

            // Check we received a channel-changed event
            await expect(listener.getReceivedEvents()).resolves.toEqual([{
                type: 'channel-changed',
                identity: {uuid: testAppNotInDirectory.uuid, name: testAppNotInDirectory.name},
                channel: null,
                previousChannel: {id: 'default', type: 'default'}
            }]);
        }, appStartupTime);
    });
});

describe('When attempting to join a channel', () => {
    let blueChannel: fdc3Remote.RemoteChannel;

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

    describe('When a non-FDC3 app is running', () => {
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

    describe('When an FDC3 app is running', () => {
        beforeEach(async () => {
            await fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl);
        }, appStartupTime);

        afterEach(async () => {
            await fin.Application.wrapSync(testAppNotInDirectory).quit(true);
        });

        test('If the FDC3 app identity is provided, join resolves successfully', async () => {
            await expect(blueChannel.join(testAppNotInDirectory)).resolves;
        });
    });
});

describe('When joining a channel', () => {
    const listeningApp = testAppInDirectory1;
    const channelChangingApp = testAppNotInDirectory;

    let listener: fdc3Remote.RemoteEventListener;
    let defaultChannel: fdc3Remote.RemoteChannel;

    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, listeningApp.name);
        await fin.Application.startFromManifest(channelChangingApp.manifestUrl);

        listener = await fdc3Remote.addEventListener(channelChangingApp, 'channel-changed');
        defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(listeningApp).quit(true);
        await fin.Application.wrapSync(channelChangingApp).quit(true);
    });

    describe('When joining the \'orange\' channel', () => {
        let organgeChannel: fdc3Remote.RemoteChannel;

        beforeEach(async () => {
            organgeChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'orange');
            await organgeChannel.join(channelChangingApp);
        });

        test('The correct channel is returned when querying the current channel', async () => {
            await expect(fdc3Remote.getCurrentChannel(channelChangingApp)).resolves.toHaveProperty('channel', organgeChannel.channel);
        });

        test('The window is present when querying the members of the \'orange\' channel and not the default channel', async () => {
            await expect(organgeChannel.getMembers()).resolves.toEqual([{
                uuid: channelChangingApp.uuid,
                name: channelChangingApp.name
            }]);

            // We expect the default channel to contain the test manager, and the listening window
            await expect(defaultChannel.getMembers()).resolves.toHaveLength(2);
            await expect(defaultChannel.getMembers()).resolves.not.toContain([{
                uuid: channelChangingApp.uuid,
                name: channelChangingApp.name
            }]);
        });

        test('A channel-change event is fired', async () => {
            await expect(listener.getReceivedEvents()).resolves.toEqual([{
                type: 'channel-changed',
                identity: {uuid: channelChangingApp.uuid, name: channelChangingApp.name},
                channel: organgeChannel.channel,
                previousChannel: {id: 'default', type: 'default'}
            }]);
        });
    });

    describe('When joining the \'blue\' channel twice', () => {
        let blueChannel: fdc3Remote.RemoteChannel;

        beforeEach(async () => {
            blueChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'blue');
            await blueChannel.join(channelChangingApp);
            await blueChannel.join(channelChangingApp);
        });

        test('The window is present only once when querying the members of the \'blue\'', async () => {
            await expect(blueChannel.getMembers()).resolves.toEqual([{
                uuid: channelChangingApp.uuid,
                name: channelChangingApp.name
            }]);
        });

        test('A channel-change event is fired only once', async () => {
            await expect(listener.getReceivedEvents()).resolves.toEqual([{
                type: 'channel-changed',
                identity: {uuid: channelChangingApp.uuid, name: channelChangingApp.name},
                channel: blueChannel.channel,
                previousChannel: {id: 'default', type: 'default'}
            }]);
        });
    });

    describe('When joining the \'purple\' channel, and re-joining the default channel', () => {
        let purpleChannel: fdc3Remote.RemoteChannel;

        beforeEach(async () => {
            purpleChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'purple');

            await purpleChannel.join(channelChangingApp);
            await defaultChannel.join(channelChangingApp);
        });

        test('The correct channel is returned when querying the current channel', async () => {
            await expect(fdc3Remote.getCurrentChannel(channelChangingApp)).resolves.toHaveProperty('channel', defaultChannel.channel);
        });

        test('The window is present when querying the members of the default channel and not the purple channel', async () => {
            // We expect the default channel to contain our channel changing window, the test manager, and the listening window
            await expect(defaultChannel.getMembers()).resolves.toHaveLength(3);
            await expect(defaultChannel.getMembers()).resolves.toContainEqual({
                uuid: channelChangingApp.uuid,
                name: channelChangingApp.name
            });

            await expect(purpleChannel.getMembers()).resolves.toHaveLength(0);
        });

        test('A channel-change event is fired twice', async () => {
            await expect(listener.getReceivedEvents()).resolves.toEqual([{
                type: 'channel-changed',
                identity: {uuid: channelChangingApp.uuid, name: channelChangingApp.name},
                channel: purpleChannel.channel,
                previousChannel: {id: 'default', type: 'default'}
            },
            {
                type: 'channel-changed',
                identity: {uuid: channelChangingApp.uuid, name: channelChangingApp.name},
                channel: {id: 'default', type: 'default'},
                previousChannel: purpleChannel.channel
            }]);
        });
    });
});
