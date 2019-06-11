import {connect, Fin} from 'hadouken-js-adapter';
import {Identity} from 'openfin/_v2/main';

import {DesktopChannel, DefaultChannel, ChannelError, IdentityError} from '../../src/client/main';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {testManagerIdentity, testAppInDirectory1, testAppNotInDirectory, appStartupTime, testAppNotFdc3} from './constants';

/**
 * Tests getDesktopChannels(), getChannelById(), and getCurrentChannel()
 */

let fin: Fin;

beforeAll(async () => {
    fin = await connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-contextChannelQuerying.ts'});
    await expect(fin.Application.wrapSync({uuid: 'test-app', name: 'test-app'}).isRunning()).resolves.toBe(true);
});

describe('When getting the list of desktop channels', () => {
    test('All expected channels are returned', async () => {
        const channels = await fdc3Remote.getDesktopChannels(testManagerIdentity);

        const reducedChannels = channels.map(channel => ({id: channel.channel.id, type: channel.channel.type}));

        expect(reducedChannels).toHaveLength(6);

        expect(reducedChannels).toContainEqual({id: 'red', type: 'desktop'});
        expect(reducedChannels).toContainEqual({id: 'orange', type: 'desktop'});
        expect(reducedChannels).toContainEqual({id: 'yellow', type: 'desktop'});
        expect(reducedChannels).toContainEqual({id: 'green', type: 'desktop'});
        expect(reducedChannels).toContainEqual({id: 'blue', type: 'desktop'});
        expect(reducedChannels).toContainEqual({id: 'purple', type: 'desktop'});

        for (const channel of channels) {
            expect(channel).toBeChannel({}, DesktopChannel);
        }
    });

    test('Subsequent calls return the same channel instances', async () => {
        const channels1 = await fdc3Remote.getDesktopChannels(testManagerIdentity);
        const channels2 = await fdc3Remote.getDesktopChannels(testManagerIdentity);

        expect(channels2).toHaveLength(channels1.length);

        for (const channel of channels1) {
            expect(channels2).toContain(channel);
        }
    });

    test('When also querying a channel by ID, the same channel instance is returned', async () => {
        const channels = await fdc3Remote.getDesktopChannels(testManagerIdentity);
        const redChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'red');

        expect(channels).toContain(redChannel);
    });
});

describe('When getting a channel by ID', () => {
    test('When the ID provided is \'default\', the default channel is returned', async () => {
        await expect(fdc3Remote.getChannelById(testManagerIdentity, 'default')).resolves.toBeChannel({id: 'default', type: 'default'}, DefaultChannel);
    });

    test('When the ID provided is \'green\', a desktop channel is returned', async () => {
        await expect(fdc3Remote.getChannelById(testManagerIdentity, 'green')).resolves.toBeChannel({id: 'green', type: 'desktop'}, DesktopChannel);
    });

    test('Subsequent calls return the same channel instance', async () => {
        const redChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'red');
        await expect(fdc3Remote.getChannelById(testManagerIdentity, 'red')).resolves.toBe(redChannel);
    });

    test('If the channel does not exist, an FDC3Error is thrown', async () => {
        const getChannelByIdPromise = fdc3Remote.getChannelById(testManagerIdentity, 'non-existent-channel');

        await expect(getChannelByIdPromise).toThrowFDC3Error(
            ChannelError.ChannelDoesNotExist,
            'No channel with channelId: non-existent-channel'
        );
    });
});

describe('When getting the current channel of a window of a directory app', () => {
    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, testAppInDirectory1.name);
    }, appStartupTime);

    afterEach(async () => {
        await fin.Application.wrapSync(testAppInDirectory1).quit(true);
    });

    test('When the window has not joined a channel, the default channel is returned', async () => {
        const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testAppInDirectory1)).resolves.toBe(defaultChannel);
    });

    test('When the window has joined the \'purple\' channel, the purple channel is returned', async () => {
        const purpleChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'purple');
        await purpleChannel.join(testAppInDirectory1);

        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testAppInDirectory1)).resolves.toBe(purpleChannel);
    }, appStartupTime);

    test('Subsequent calls return the same channel object instance', async () => {
        const redChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'red');
        await redChannel.join(testAppInDirectory1);

        const returnedRedChannel1 = await fdc3Remote.getCurrentChannel(testManagerIdentity, testAppInDirectory1);
        const returnedRedChannel2 = await fdc3Remote.getCurrentChannel(testManagerIdentity, testAppInDirectory1);

        await expect(returnedRedChannel1).toBe(returnedRedChannel2);
    }, appStartupTime);

    test('When no window is passed to getCurrentChannel, the current window is used', async () => {
        const purpleChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'purple');
        await purpleChannel.join(testAppInDirectory1);

        // Note we can't expect this to be the same instance of the purple channel object, as the result will come from a different window
        await expect(fdc3Remote.getCurrentChannel(testAppInDirectory1)).resolves.toBeChannel({id: 'purple', type: 'desktop'}, DesktopChannel);
    }, appStartupTime);
});

describe('When getting the current channel of a window of a non-directory app', () => {
    beforeEach(async () => {
        await fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl);
    }, appStartupTime);

    afterEach(async () => {
        await fin.Application.wrapSync(testAppNotInDirectory).quit(true);
    });

    test('When the window of has not joined a channel, the default channel is returned', async () => {
        const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testAppNotInDirectory)).resolves.toBe(defaultChannel);
    });

    test('When the window has joined the \'red\' channel, the red channel is returned', async () => {
        const purpleChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'red');
        await purpleChannel.join(testAppNotInDirectory);

        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testAppNotInDirectory)).resolves.toBe(purpleChannel);
    });
});

describe('When getting the current channel without specifying a FDC3 window', () => {
    test('If an invalid identity is provided, a TypeError is thrown', async () => {
        const invalidIdentity: Identity = {irrelevantProperty: 'irrelevantValue'} as unknown as Identity;

        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, invalidIdentity)).rejects
            .toThrowError(new TypeError(`${JSON.stringify(invalidIdentity)} is not a valid Identity`));
    });

    test('If an identity for a window that does not exist is provided, an FDC3 error is thrown', async () => {
        const nonExistentWindowIdentity: Identity = {uuid: 'does-not-exist', name: 'does-not-exist'};

        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, nonExistentWindowIdentity)).toThrowFDC3Error(
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

        test('If the non-FDC3 window identity is provided, an FDC3 error is thrown', async () => {
            await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testAppNotFdc3)).toThrowFDC3Error(
                IdentityError.WindowWithIdentityNotFound,
                `No connection to FDC3 service found from window with identity: \
${JSON.stringify({uuid: testAppNotFdc3.uuid, name: testAppNotFdc3.name})}`
            );
        });
    });
});
