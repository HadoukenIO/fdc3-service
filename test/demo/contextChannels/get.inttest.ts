import {Identity} from 'openfin/_v2/main';

import {SystemChannel, DefaultChannel, ChannelError, IdentityError, ChannelId} from '../../../src/client/main';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {testManagerIdentity, testAppInDirectory1, testAppNotInDirectory1, appStartupTime, testAppNotInDirectoryNotFdc3} from '../constants';
import {setupTeardown, setupOpenDirectoryAppBookends, setupStartNonDirectoryAppBookends} from '../utils/common';
import {fakeAppChannelName} from '../utils/fakes';

/**
 * Tests getSystemChannels(), getChannelById(), and getCurrentChannel()
 */

setupTeardown();

describe('When getting a channel by ID', () => {
    test('When the ID provided is \'default\', the default channel is returned', async () => {
        await expect(fdc3Remote.getChannelById(testManagerIdentity, 'default')).resolves.toBeChannel({id: 'default', type: 'default'}, DefaultChannel);
    });

    const systemChannelIdParams = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

    test.each(systemChannelIdParams)(
        'When the ID provided is \'%s\', the expected system channel is returned',
        async (channelId: ChannelId) => {
            const channel = await fdc3Remote.getChannelById(testManagerIdentity, channelId);

            expect(channel).toBeChannel({id: channelId, type: 'system'}, SystemChannel);
        }
    );

    test('Subsequent calls return the same channel instance', async () => {
        const redChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'red');
        await expect(fdc3Remote.getChannelById(testManagerIdentity, 'red')).resolves.toBe(redChannel);
    });

    test('When the ID corresponds to an app channel, the expected app channel is returned', async () => {
        const appChannel = await fdc3Remote.getOrCreateAppChannel(testManagerIdentity, fakeAppChannelName());

        const id = appChannel.channel.id;

        await expect(fdc3Remote.getChannelById(testManagerIdentity, id)).resolves.toBe(appChannel);
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

describe('When getting the list of system channels', () => {
    const systemChannels = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

    test('All expected channels are returned', async () => {
        const channels = await fdc3Remote.getSystemChannels(testManagerIdentity);

        for (const channelId of systemChannels) {
            // Get channel by ID, to compare with our returned channels
            const channel = await fdc3Remote.getChannelById(testManagerIdentity, channelId);

            // Check we've received the same instance as returned by getChannelById()
            expect(channels).toContain(channel);
        }

        // Check only expected channels have been returned
        expect(channels).toHaveLength(systemChannels.length);
    });

    test('App channels are not included in the list of system channels', async () => {
        const appChannel = await fdc3Remote.getOrCreateAppChannel(testManagerIdentity, fakeAppChannelName());

        const channels = await fdc3Remote.getSystemChannels(testManagerIdentity);

        expect(channels).not.toContain(appChannel);
        expect(channels).toHaveLength(systemChannels.length);
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
        setupStartNonDirectoryAppBookends(testAppNotInDirectoryNotFdc3);

        test('When the non-FDC3 window identity is provided, an FDC3 error is thrown', async () => {
            await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testAppNotInDirectoryNotFdc3)).toThrowFDC3Error(
                IdentityError.WindowWithIdentityNotFound,
                `No connection to FDC3 service found from window with identity: \
${JSON.stringify({uuid: testAppNotInDirectoryNotFdc3.uuid, name: testAppNotInDirectoryNotFdc3.name})}`
            );
        });
    });

    test('When a valid identity is provided, the call resolves successfully', async () => {
        await fdc3Remote.getCurrentChannel(testManagerIdentity, testManagerIdentity);
    });
});

type TestParam = [string, Identity, () => void];
const testParams: TestParam[] = [
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

describe.each(testParams)('When getting the current channel of a window of %s', (titleParam: string, testApp: Identity, setupBookends: () => void) => {
    setupBookends();

    test('When the window has not joined a channel, the default channel is returned', async () => {
        const defaultChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'default');

        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testApp)).resolves.toBe(defaultChannel);
    });

    test('When the window has joined the \'purple\' channel, the purple channel is returned', async () => {
        // Join the purple channel
        const purpleChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'purple');
        await purpleChannel.join(testApp);

        // Check purple channel is returned
        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testApp)).resolves.toBe(purpleChannel);
    }, appStartupTime);

    test('When the window has joined an app channel, the app channel is returned', async () => {
        // Join a new app channel
        const appChannel = await fdc3Remote.getOrCreateAppChannel(testManagerIdentity, fakeAppChannelName());
        await appChannel.join(testApp);

        // Check the app channel is returned
        await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testApp)).resolves.toBe(appChannel);
    }, appStartupTime);

    test('Subsequent calls return the same channel object instance', async () => {
        // Join the red channel
        const redChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'red');
        await redChannel.join(testApp);

        // Perform calls to getCurrentChannel()
        const returnedRedChannel1 = await fdc3Remote.getCurrentChannel(testManagerIdentity, testApp);
        const returnedRedChannel2 = await fdc3Remote.getCurrentChannel(testManagerIdentity, testApp);

        // Check the same instace was returned each time
        expect(returnedRedChannel1).toBe(returnedRedChannel2);
    }, appStartupTime);

    test('When no window is passed to getCurrentChannel, the current window is used', async () => {
        // Join the green channel
        const greenChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'green');
        await greenChannel.join(testApp);

        // Perform call to getCurrentChannel in our joining window, with no target window specified
        const currentChannel = await fdc3Remote.getCurrentChannel(testApp);

        // Check we have the green channel. Note that due to these coming from different windows, these cannot be the same instance
        expect(currentChannel.channel).toEqual(greenChannel.channel);
    }, appStartupTime);
});
