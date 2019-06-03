import 'jest';
import {connect, Fin, Identity, Application} from 'hadouken-js-adapter';

import {ChannelError} from '../../src/client/errors';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {appStartupTime} from './constants';

const testManagerIdentity = {uuid: 'test-app', name: 'test-app'};

const testContext = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};

const startedApps:Application[] = [];

let fin: Fin;

beforeAll(async () => {
    fin = await connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-contextChannels.ts'});
    await expect(fin.Application.wrapSync({uuid: 'test-app', name: 'test-app'}).isRunning()).resolves.toBe(true);
});

afterEach(async () => {
    jest.clearAllMocks();

    for (const app of startedApps) {
        await app.quit().catch(() => {});
    }

    startedApps.length = 0;
});

// Creates one window for each channel, and has that window join that channel if not undefined
async function setupWindows(...channels: (string|undefined)[]): Promise<Identity[]> {
    const app1 = {uuid: 'test-app-1', name: 'test-app-1'};
    const app2 = {uuid: 'test-app-2', name: 'test-app-2'};
    const app3 = {uuid: 'test-app-3', name: 'test-app-3'};
    const app4 = {uuid: 'test-app-4', name: 'test-app-4'};

    const appIdentities = [app1, app2, app3, app4];

    const offset = startedApps.length;

    const result: Identity[] = await Promise.all(channels.map(async (channel, index) => {
        const identity = appIdentities[index + offset];

        await fdc3Remote.open(testManagerIdentity, identity.uuid);
        const app = fin.Application.wrapSync(appIdentities[index + offset]);

        await expect(app.isRunning()).resolves.toBe(true);

        startedApps.push(app);
        if (channel) {
            await fdc3Remote.joinChannel(identity, channel);
        }

        return identity;
    }));

    return result;
}

describe('When broadcasting on global channel', () => {
    test('Context is received by global windows only', async () => {
        const [globalWindow, blueWindow] = await setupWindows(undefined, 'blue');

        const globalListener = await fdc3Remote.addContextListener(globalWindow);
        const blueListener = await fdc3Remote.addContextListener(blueWindow);

        // Broadcast our context on the global channel
        await fdc3Remote.broadcast(testManagerIdentity, testContext);

        // Check the global window received our test context
        const globalContexts = await globalListener.getReceivedContexts();
        expect(globalContexts).toEqual([testContext]);

        // Check the blue window received no context
        const blueContexts = await blueListener.getReceivedContexts();
        expect(blueContexts).toHaveLength(0);
    }, appStartupTime * 2);

    test('Context is received by window that has left and rejoined global channel', async () => {
        const [channelChangingWindow] = await setupWindows('blue');

        // Change the channel of our window
        await fdc3Remote.joinChannel(channelChangingWindow, 'global');

        const channelChangingListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Broadcast our context on the global channel
        await fdc3Remote.broadcast(testManagerIdentity, testContext);

        // Check our window received our test context
        const receivedContexts = await channelChangingListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);
    });
});

describe('When broadcasting on a user channel', () => {
    test('Context is received by windows on that user channel only', async () => {
        const [red1Window, red2Window, globalWindow, blueWindow] = await setupWindows('red', 'red', 'global', 'blue');

        const redListener = await fdc3Remote.addContextListener(red2Window);
        const globalListener = await fdc3Remote.addContextListener(globalWindow);
        const blueListener = await fdc3Remote.addContextListener(blueWindow);

        // Broadcast our context on the red channel
        await fdc3Remote.broadcast(red1Window, testContext);

        // Check our red window received our test context
        const redReceivedContexts = await redListener.getReceivedContexts();
        expect(redReceivedContexts).toEqual([testContext]);

        const globalReceivedContexts = await globalListener.getReceivedContexts();
        expect(globalReceivedContexts).toHaveLength(0);

        // Check our blue window received no context
        const blueReceivedContexts = await blueListener.getReceivedContexts();
        expect(blueReceivedContexts).toHaveLength(0);
    }, appStartupTime * 4);

    test('Context is received by window that has left and rejoined user channel', async () => {
        const [blueWindow, channelChangingWindow] = await setupWindows('blue', undefined);

        // Change the channel of our window
        await fdc3Remote.joinChannel(channelChangingWindow, 'global');
        await fdc3Remote.joinChannel(channelChangingWindow, 'blue');

        const channelChangingWindowListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Broadcast our context on the blue channel
        await fdc3Remote.broadcast(blueWindow, testContext);

        // Check our blue window received our test context
        const receivedContexts = await channelChangingWindowListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);
    }, appStartupTime * 2);
});

describe('When joining a channel', () => {
    test('Window is listed as a member of the channel', async () => {
        const [greenWindow] = await setupWindows('green');

        const greenChannelMembers = await fdc3Remote.getChannelMembers(testManagerIdentity, 'green');
        const globalChannelMembers = await fdc3Remote.getChannelMembers(testManagerIdentity, 'global');

        // Check the channel of our green window is green
        await expect(fdc3Remote.getChannel(greenWindow)).resolves.toHaveProperty('id', 'green');

        // Check our green window is only listed in the green channel
        expect(greenChannelMembers).toContainEqual(greenWindow);
        expect(globalChannelMembers).not.toContainEqual(greenWindow);
    });

    test('Window is listed as a member of the correct channel after changing channel', async () => {
        const [channelChangingWindow] = await setupWindows('orange');

        // Change the channel of our window
        await fdc3Remote.joinChannel(channelChangingWindow, 'red');

        const redChannelMembers = await fdc3Remote.getChannelMembers(channelChangingWindow, 'red');
        const orangeChannelMembers = await fdc3Remote.getChannelMembers(channelChangingWindow, 'orange');

        // Check the channel of our window is red
        await expect(fdc3Remote.getChannel(channelChangingWindow)).resolves.toHaveProperty('id', 'red');

        // Check our window is only listed in the red channel
        expect(redChannelMembers).toContainEqual(channelChangingWindow);
        expect(orangeChannelMembers).not.toContainEqual(channelChangingWindow);
    });

    test('Window is listed as a member of the correct channel after rejoining the global channel', async () => {
        const [channelChangingWindow] = await setupWindows('purple');

        // Change the channel of our window
        await fdc3Remote.joinChannel(channelChangingWindow, 'global');

        const globalChannelMembers = await fdc3Remote.getChannelMembers(channelChangingWindow, 'global');
        const purpleChannelMembers = await fdc3Remote.getChannelMembers(channelChangingWindow, 'purple');

        // Check the channel of our window is global
        await expect(fdc3Remote.getChannel(channelChangingWindow)).resolves.toHaveProperty('id', 'global');

        // Check our window is only listed in the global channel
        expect(globalChannelMembers).toContainEqual(channelChangingWindow);
        expect(purpleChannelMembers).not.toContainEqual(channelChangingWindow);
    });

    test('Window receives cached context for user channel', async () => {
        const [yellowWindow, channelChangingWindow] = await setupWindows('yellow', 'red');

        // Broadcast our test context on the yellow channel
        await fdc3Remote.broadcast(yellowWindow, testContext);

        const channelChangingListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Change the channel of our now-red window to yellow
        await fdc3Remote.joinChannel(channelChangingWindow, 'yellow');

        // Check our now-yellow window received our test context
        const receivedContexts = await channelChangingListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);
    }, appStartupTime * 2);

    test('Window does not receive cached context for global channel', async () => {
        const [channelChangingWindow] = await setupWindows('red');

        // Broadcast our test context on the global channel
        await fdc3Remote.broadcast(testManagerIdentity, testContext);

        const channelChangingWindowListener = await fdc3Remote.addContextListener(channelChangingWindow);

        // Change the channel of our window to global
        await fdc3Remote.joinChannel(channelChangingWindow, 'global');

        // Check our now-global window received no context
        const receivedContexts = await channelChangingWindowListener.getReceivedContexts();
        expect(receivedContexts).toHaveLength(0);
    });

    test('channel-changed event is fired for user channel', async () => {
        const [listeningWindow, channelChangingWindow] = await setupWindows(undefined, undefined);

        const listener = await fdc3Remote.addEventListener(listeningWindow, 'channel-changed');

        // Change the channel of our window to green
        await fdc3Remote.joinChannel(channelChangingWindow, 'green');

        // Check we received a channel-changed event
        const payload = await listener.getReceivedEvents();
        expect(payload).toHaveLength(1);
        expect(payload[0]).toHaveProperty('channel.id', 'green');
        expect(payload[0]).toHaveProperty('previousChannel.id', 'global');
        expect(payload[0]).toHaveProperty('identity', channelChangingWindow);
    }, appStartupTime * 2);

    test('channel-changed event is fired for global channel', async () => {
        const [listeningWindow, channelChangingWindow] = await setupWindows(undefined, 'blue');

        const listener = await fdc3Remote.addEventListener(listeningWindow, 'channel-changed');

        // Change the channel of our window to green
        await fdc3Remote.joinChannel(channelChangingWindow, 'global');

        // Check we received a channel-changed event
        const payload = await listener.getReceivedEvents();
        expect(payload).toHaveLength(1);
        expect(payload[0]).toHaveProperty('channel.id', 'global');
        expect(payload[0]).toHaveProperty('previousChannel.id', 'blue');
        expect(payload[0]).toHaveProperty('identity', channelChangingWindow);
    }, appStartupTime * 2);

    test('If everything is unsubscribed, and something rejoins, there is no data held in the channel', async ()=>{
        // First, set up a pair of windows on different channels. Yellow will be unused; green will be the
        // interesting one. Broadcast on green. No one is listening, no one hears.
        const [sendWindow, receiveWindow] = await setupWindows('green', 'yellow');
        const receiveWindowListener = await fdc3Remote.addContextListener(receiveWindow);
        await fdc3Remote.broadcast(sendWindow, testContext);
        let receivedContexts = await receiveWindowListener.getReceivedContexts();
        expect(receivedContexts).toHaveLength(0);

        // Now join green, and we should a callback because of the current state of the green channel.
        await fdc3Remote.joinChannel(receiveWindow, 'green');
        receivedContexts = await receiveWindowListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);

        // Move all the windows to a different channel, so no one is listening to green. This should cause
        // the state data to be dropped
        await fdc3Remote.joinChannel(sendWindow, 'yellow');
        await fdc3Remote.joinChannel(receiveWindow, 'yellow');
        const members = await fdc3Remote.getChannelMembers(receiveWindow, 'green');
        expect(members).toEqual([]);

        // Now, subscribe to the green channel again. Because the state data is dropped, we won't get a callback,
        // and our received contexts will be unchanged (remember, receivedContexts is the life history of all
        // the contexts received)
        receivedContexts = await receiveWindowListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);
        await fdc3Remote.joinChannel(receiveWindow, 'green');
        receivedContexts = await receiveWindowListener.getReceivedContexts();
        expect(receivedContexts).toEqual([testContext]);
    }, appStartupTime * 2);

    test('If the channel to join does not exist, an FDC3Error is thrown', async () => {
        const [window] = await setupWindows(undefined);

        // Join a non-existent channel
        const joinChannelPromise = fdc3Remote.joinChannel(window, 'non-existent-channel');

        await expect(joinChannelPromise).toThrowFDC3Error(
            ChannelError.ChannelDoesNotExist,
            'No channel with channelId: non-existent-channel'
        );
    });
});

describe('When starting an app', () => {
    test('channel-changed event is fired for global channel', async () => {
        const [listeningWindow] = await setupWindows(undefined);
        const listener = await fdc3Remote.addEventListener(listeningWindow, 'channel-changed');

        const [channelChangingWindow] = await setupWindows(undefined);

        // Check we received a channel-changed event
        const payload = await listener.getReceivedEvents();
        expect(payload).toHaveLength(1);
        expect(payload[0]).toHaveProperty('channel.id', 'global');
        expect(payload[0]).toHaveProperty('previousChannel.id', undefined);
        expect(payload[0]).toHaveProperty('identity', channelChangingWindow);
    }, appStartupTime * 2);
});

