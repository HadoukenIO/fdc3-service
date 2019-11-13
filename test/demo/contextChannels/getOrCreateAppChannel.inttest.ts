import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {testManagerIdentity, testAppInDirectory1, testAppInDirectory2} from '../constants';
import {setupOpenDirectoryAppBookends} from '../utils/common';
import {AppChannel} from '../../../src/client/main';
import {fakeAppChannelName} from '../utils/fakes';

test('If a name of the wrong type is provided, a TypeError is thrown', async () => {
    const invalidName = {irrelevantProperty: 'irrelevantValue'} as unknown as string;

    await expect(fdc3Remote.getOrCreateAppChannel(testManagerIdentity, invalidName))
        .rejects.toThrowError(new TypeError(`${JSON.stringify(invalidName)} is not a valid app channel name`));
});

test('If an empty string name is is provided, a TypeError is thrown', async () => {
    const invalidName = {irrelevantProperty: 'irrelevantValue'} as unknown as string;

    await expect(fdc3Remote.getOrCreateAppChannel(testManagerIdentity, invalidName))
        .rejects.toThrowError(new TypeError(`${JSON.stringify(invalidName)} is not a valid app channel name`));
});

test('If a null name is provided, a TypeError is thrown', async () => {
    await expect(fdc3Remote.getOrCreateAppChannel(testManagerIdentity, null!))
        .rejects.toThrowError(new TypeError(`${JSON.stringify(null)} is not a valid app channel name`));
});

test('When creating an app channel, a channel object is returned successfully', async () => {
    const appChannelName = fakeAppChannelName();
    const appChannel = await fdc3Remote.getOrCreateAppChannel(testManagerIdentity, appChannelName);

    expect(appChannel).toBeChannel({type: 'app'}, AppChannel);
    expect(appChannel.channel).toHaveProperty('name', appChannelName);
});

test('When getting an already created app channel within the same app, the same app channel instance is returned', async () => {
    const appChannelName = fakeAppChannelName();

    const appChannel1 = await fdc3Remote.getOrCreateAppChannel(testManagerIdentity, appChannelName);
    const appChannel2 = await fdc3Remote.getOrCreateAppChannel(testManagerIdentity, appChannelName);

    expect(appChannel2).toBe(appChannel1);
});

describe('When getting an already created app channel within a different app', () => {
    setupOpenDirectoryAppBookends(testAppInDirectory1);
    setupOpenDirectoryAppBookends(testAppInDirectory2);

    test('An identical app channel is returned', async () => {
        const appChannelName = fakeAppChannelName();

        const appChannel1 = await fdc3Remote.getOrCreateAppChannel(testAppInDirectory1, appChannelName);
        await appChannel1.join(testAppInDirectory1);

        // Since the channel objects come from different apps, they cannot be the same instance, but we can indirectly
        // check they represent the same channel
        const appChannel2 = await fdc3Remote.getOrCreateAppChannel(testAppInDirectory2, appChannelName);

        expect(appChannel2.channel).toEqual(appChannel1.channel);
        expect(await appChannel2.getMembers()).toEqual(await appChannel1.getMembers());
    });
});
