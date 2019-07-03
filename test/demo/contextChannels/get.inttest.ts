import {Identity} from 'openfin/_v2/main';

import {DesktopChannel, DefaultChannel, ChannelError, IdentityError, ChannelId} from '../../../src/client/main';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {testManagerIdentity, testAppInDirectory1, testAppNotInDirectory1, appStartupTime, testAppNotFdc3} from '../constants';
import {fin} from '../utils/fin';
import {setupTeardown} from '../utils/common';

/**
 * Tests getDesktopChannels(), getChannelById(), and getCurrentChannel()
 */

setupTeardown();

describe('When getting a channel by ID', () => {
    test('When the ID provided is \'default\', the default channel is returned', async () => {
        await expect(fdc3Remote.getChannelById(testManagerIdentity, 'default')).resolves.toBeChannel({id: 'default', type: 'default'}, DefaultChannel);
    });

    const desktopChannelIdParams = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

    test.each(desktopChannelIdParams)(
        'When the ID provided is \'%s\', the expected desktop channel is returned',
        async (channelId: ChannelId) => {
            const channel = await fdc3Remote.getChannelById(testManagerIdentity, channelId);

            await expect(channel).toBeChannel({id: channelId, type: 'desktop'}, DesktopChannel);
        }
    );

    test('Subsequent calls return the same channel instance', async () => {
        const redChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'red');
        await expect(fdc3Remote.getChannelById(testManagerIdentity, 'red')).resolves.toBe(redChannel);
    });

    test('When the ID does not correspond to a channel, an FDC3Error is thrown', async () => {
        const getChannelByIdPromise = fdc3Remote.getChannelById(testManagerIdentity, 'non-existent-channel');

        await expect(getChannelByIdPromise).toThrowFDC3Error(
            ChannelError.ChannelDoesNotExist,
            'No channel with channelId: non-existent-channel'
        );
    });

    test('When the ID is null, a TypeError is thrown', async () => {
        const getChannelByIdPromise = fdc3Remote.getChannelById(testManagerIdentity, null!);

        await expect(getChannelByIdPromise).rejects.
            toThrowError(new TypeError(`${JSON.stringify(null)} is not a valid ChannelId`));
    });

    test('When the ID is an object, a TypeError is thrown', async () => {
        const invalidChannelId = {irrelevantProperty: 'irrelevantValue'} as unknown as string;
        const getChannelByIdPromise = fdc3Remote.getChannelById(testManagerIdentity, invalidChannelId);

        await expect(getChannelByIdPromise).rejects.
            toThrowError(new TypeError(`${JSON.stringify(invalidChannelId)} is not a valid ChannelId`));
    });
});

describe('When getting the list of desktop channels', () => {
    test('All expected channels are returned', async () => {
        const channels = await fdc3Remote.getDesktopChannels(testManagerIdentity);

        for (const channelId of ['red', 'orange', 'yellow', 'green', 'blue', 'purple']) {
            // Get channel by ID, to compare with our returned channels
            const channel = await fdc3Remote.getChannelById(testManagerIdentity, channelId);

            // Check we've received the same instance as returned by getChannelById()
            expect(channels).toContain(channel);
        }

        // Check all expected channels have been returned
        expect(channels).toHaveLength(6);
    });
});

describe('When attempting to get the current channel', () => {
    test('When an invalid identity is provided, a TypeError is thrown', async () => {
        const invalidIdentity: Identity = {irrelevantProperty: 'irrelevantValue'} as unknown as Identity;

        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, invalidIdentity)).rejects
            .toThrowError(new TypeError(`${JSON.stringify(invalidIdentity)} is not a valid Identity`));
    });

    test('When an identity for a window that does not exist is provided, an FDC3 error is thrown', async () => {
        const nonExistentWindowIdentity: Identity = {uuid: 'does-not-exist', name: 'does-not-exist'};

        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, nonExistentWindowIdentity)).toThrowFDC3Error(
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

        test('When the non-FDC3 window identity is provided, an FDC3 error is thrown', async () => {
            await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testAppNotFdc3)).toThrowFDC3Error(
                IdentityError.WindowWithIdentityNotFound,
                `No connection to FDC3 service found from window with identity: \
${JSON.stringify({uuid: testAppNotFdc3.uuid, name: testAppNotFdc3.name})}`
            );
        });
    });

    test('When a valid identity is provided, the call resolves successfully', async () => {
        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testManagerIdentity)).resolves;
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
        // Join the purple channel
        const purpleChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'purple');
        await purpleChannel.join(testAppInDirectory1);

        // Check purple channel is returned
        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testAppInDirectory1)).resolves.toBe(purpleChannel);
    }, appStartupTime);

    test('Subsequent calls return the same channel object instance', async () => {
        // Join the red channel
        const redChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'red');
        await redChannel.join(testAppInDirectory1);

        // Perform to calls to getCurrentChannel()
        const returnedRedChannel1 = await fdc3Remote.getCurrentChannel(testManagerIdentity, testAppInDirectory1);
        const returnedRedChannel2 = await fdc3Remote.getCurrentChannel(testManagerIdentity, testAppInDirectory1);

        // Check the same instace was returned each time
        await expect(returnedRedChannel1).toBe(returnedRedChannel2);
    }, appStartupTime);

    test('When no window is passed to getCurrentChannel, the current window is used', async () => {
        // Join the green channel
        const greenChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'green');
        await greenChannel.join(testAppInDirectory1);

        // Perform call to getCurrentChannel in our joining window, with no target window specified
        const currentChannel = await fdc3Remote.getCurrentChannel(testAppInDirectory1);

        // Check we have the green channel. Note that due to these coming from different windows, these cannot be the same instance
        await expect(currentChannel.channel).toEqual(greenChannel.channel);
    }, appStartupTime);
});

describe('When getting the current channel of a window of a non-directory app', () => {
    beforeEach(async () => {
        await fin.Application.startFromManifest(testAppNotInDirectory1.manifestUrl);
    }, appStartupTime);

    afterEach(async () => {
        await fin.Application.wrapSync(testAppNotInDirectory1).quit(true);
    });

    test('When the window of has not joined a channel, the default channel is returned', async () => {
        // Get the default channel
        const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

        // Get the current channel of the non-directory app
        const currentChannel = await fdc3Remote.getCurrentChannel(testManagerIdentity, testAppNotInDirectory1);

        // Check our channels are the same
        await expect(currentChannel).toBe(defaultChannel);
    });

    test('When the window has joined the \'red\' channel, the red channel is returned', async () => {
        // Get the purple channel, and put our non-directory app window in this channel
        const purpleChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'red');
        await purpleChannel.join(testAppNotInDirectory1);

        // Get the current channel of the non-directory app
        const currentChannel = await fdc3Remote.getCurrentChannel(testManagerIdentity, testAppNotInDirectory1);

        // Check our channels are the same
        await expect(currentChannel).toBe(purpleChannel);
    });
});
