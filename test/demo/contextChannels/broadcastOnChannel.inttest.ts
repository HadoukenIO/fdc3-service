import {Fin, connect} from 'hadouken-js-adapter';

import {testAppNotInDirectory, testAppInDirectory1, testManagerIdentity, appStartupTime} from '../constants';
import {ChannelId, Context} from '../../../src/client/main';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {RemoteChannel} from '../utils/RemoteChannel';

const testContext = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};

let fin: Fin;

beforeAll(async () => {
    fin = await connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-contextChannels-broadcastOnChannel.inttest.ts'});
    await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);
});

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
});

describe('When broadcasting on a channel', () => {
    const broadcastingApp = testAppNotInDirectory;
    const listeningApp = testAppInDirectory1;

    beforeEach(async () => {
        await fin.Application.startFromManifest(broadcastingApp.manifestUrl);
        await fdc3Remote.open(testManagerIdentity, listeningApp.name);
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(broadcastingApp).quit(true);
        await fin.Application.wrapSync(listeningApp).quit(true);
    });

    test.each(['default', 'blue'])('When broadcasting on the %s channel, context is not received in the broadcasting window', async (channelId: ChannelId) => {
        const channel = await fdc3Remote.getChannelById(broadcastingApp, channelId);
        const listener = await channel.addBroadcastListener();

        await channel.broadcast(testContext);

        await expect(listener.getReceivedContexts()).resolves.toEqual([]);
    });

    test.each(['default', 'green'])('When broadcasting on the %s channel, context is not received by a different window', async (channelId: ChannelId) => {
        const channelInBroadcastingWinodw = await fdc3Remote.getChannelById(broadcastingApp, channelId);
        const channelInListeningWindow = await fdc3Remote.getChannelById(listeningApp, channelId);

        const listener = await channelInListeningWindow.addBroadcastListener();

        await channelInBroadcastingWinodw.broadcast(testContext);

        await expect(listener.getReceivedContexts()).resolves.toEqual([testContext]);
    });

    const channelPairs = [['green', 'default'], ['default', 'yellow'], ['red', 'blue']];
    test.each(channelPairs)(
        'When broadcasting on the %s channel, context is not received by the %s channel',
        async (broadcastChannelId: ChannelId, listenChannelId: ChannelId) => {
            const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, broadcastChannelId);
            const listeningChannel = await fdc3Remote.getChannelById(listeningApp, listenChannelId);

            const listener = await listeningChannel.addBroadcastListener();

            await broadcastingChannel.broadcast(testContext);

            await expect(listener.getReceivedContexts()).resolves.toEqual([]);
            await expect(listener.getReceivedContexts()).resolves.toEqual([]);
        }
    );
});

describe('When adding a broadcast listener', () => {
    const broadcastingApp = testAppInDirectory1;
    const listeningApp = testAppNotInDirectory;

    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, broadcastingApp.name);
        await fin.Application.startFromManifest(listeningApp.manifestUrl);
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(broadcastingApp).quit(true);
        await fin.Application.wrapSync(listeningApp).quit(true);
    });

    test.each(['default', 'red'])(
        'When broadcasting on the %s channel, when two broadcast listeners are added, both are triggered correctly',
        async (channelId: ChannelId) => {
            const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, channelId);
            const listeningChannel = await fdc3Remote.getChannelById(listeningApp, channelId);

            const listener1 = await listeningChannel.addBroadcastListener();
            const listener2 = await listeningChannel.addBroadcastListener();

            await broadcastingChannel.broadcast(testContext);

            await expect(listener1.getReceivedContexts()).resolves.toEqual([testContext]);
            await expect(listener2.getReceivedContexts()).resolves.toEqual([testContext]);
        }
    );

    test.each(['default', 'yellow'])('When unsubscribed from the %s channel, contexts are no longer received', async (channelId: ChannelId) => {
        const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, channelId);
        const listeningChannel = await fdc3Remote.getChannelById(listeningApp, channelId);

        const listener1 = await listeningChannel.addBroadcastListener();
        const listener2 = await listeningChannel.addBroadcastListener();

        await listener1.unsubscribe();

        await broadcastingChannel.broadcast(testContext);

        await expect(listener1.getReceivedContexts()).resolves.toEqual([]);
        await expect(listener2.getReceivedContexts()).resolves.toEqual([testContext]);
    });

    test('Joining a channel does not trigger the broadcast listener', async () => {
        const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, 'orange');
        const listeningChannel = await fdc3Remote.getChannelById(listeningApp, 'orange');

        await broadcastingChannel.join();
        await broadcastingChannel.broadcast(testContext);

        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(testContext);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(testContext);

        const listener = await listeningChannel.addBroadcastListener();

        await listeningChannel.join();

        await expect(listener.getReceivedContexts()).resolves.toEqual([]);
    });
});


describe('When querying the current context', () => {
    const broadcastingApp = testAppNotInDirectory;
    const listeningApp = testAppInDirectory1;

    beforeEach(async () => {
        await fin.Application.startFromManifest(broadcastingApp.manifestUrl);
        await fdc3Remote.open(testManagerIdentity, listeningApp.name);
    }, appStartupTime * 2);

    afterEach(async () => {
        await fin.Application.wrapSync(broadcastingApp).quit(true);
        await fin.Application.wrapSync(listeningApp).quit(true);
    });

    test('The last-broadcast context will be returned for the \'purple\' channel when the channel is occupied', async () => {
        const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, 'purple');
        const listeningChannel = await fdc3Remote.getChannelById(listeningApp, 'purple');

        await broadcastingChannel.join();
        await broadcastingChannel.broadcast(testContext);


        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(testContext);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(testContext);
    });

    test('The last-broadcast context will not be returned for the \'yellow\' channel when the channel has been emptied', async () => {
        const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, 'yellow');
        const listeningChannel = await fdc3Remote.getChannelById(listeningApp, 'yellow');

        await broadcastingChannel.join();
        await broadcastingChannel.broadcast(testContext);

        const defaultChannel = await fdc3Remote.getChannelById(broadcastingApp, 'default');
        await defaultChannel.join();


        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(null);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(null);
    });

    test('The last-broadcast context will not be returned for the \'blue\' channel when the channel has never been occupied', async () => {
        const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, 'blue');
        const listeningChannel = await fdc3Remote.getChannelById(listeningApp, 'blue');

        await broadcastingChannel.broadcast(testContext);

        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(null);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(null);
    });

    test('The last-broadcast context will not be returned for the default channel, even when the channel is occupied', async () => {
        const broadcastingChannel = await fdc3Remote.getChannelById(broadcastingApp, 'default');
        const listeningChannel = await fdc3Remote.getChannelById(listeningApp, 'default');

        await expect(listeningChannel.getMembers()).resolves.toHaveLength(3);
        await broadcastingChannel.broadcast(testContext);

        await expect(broadcastingChannel.getCurrentContext()).resolves.toEqual(null);
        await expect(listeningChannel.getCurrentContext()).resolves.toEqual(null);
    });
});
