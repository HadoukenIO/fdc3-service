import 'jest';
import {Identity} from 'openfin/_v2/main';

import {AppWindow} from '../../src/provider/model/AppWindow';
import {SERVICE_IDENTITY, ChannelEvents} from '../../src/client/internal';
import {Model} from '../../src/provider/model/Model';
import {ChannelHandler} from '../../src/provider/controller/ChannelHandler';
import {EventHandler} from '../../src/provider/controller/EventHandler';
import {IntentHandler} from '../../src/provider/controller/IntentHandler';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {fin} from './utils/fin';
import {OFPuppeteerBrowser} from './utils/ofPuppeteer';
import {setupTeardown, quitApps, TestAppData, NonDirectoryTestAppData} from './utils/common';
import {testManagerIdentity, testAppInDirectory1, testAppWithPreregisteredListeners1, testAppNotInDirectory1, testAppNotInDirectoryNotFdc3, testAppNotFdc3} from './constants';
import {RemoteChannel} from './utils/RemoteChannel';
import {delay, Duration} from './utils/delay';

setupTeardown();

type ProviderWindow = Window & {
    model: Model;
    intentHandler: IntentHandler;
    channelHandler: ChannelHandler;
    eventHandler: EventHandler;
};

enum RegistrationStatus {
    REGISTERED,
    NOT_REGISTERED
}

const ofBrowser = new OFPuppeteerBrowser();

type ConnectTestParam = [
    string,
    TestAppData,
    RegistrationStatus,
    (app: TestAppData) => Promise<void>,
];

type ConnectTestCategoryParam = [string, ConnectTestParam[]];

const directoryConnectTestParams: ConnectTestParam[] = [
    ['has an FDC3 connection', testAppInDirectory1, RegistrationStatus.REGISTERED, openDirectoryApp],
    ['does not have an FDC3 connection', testAppNotFdc3, RegistrationStatus.NOT_REGISTERED, openDirectoryApp]
];

const nonDirectoryConnectTestParams: ConnectTestParam[] = [
    ['has an FDC3 connection', testAppNotInDirectory1, RegistrationStatus.REGISTERED, openNonDirectoryApp],
    ['does not have an FDC3 connection', testAppNotInDirectoryNotFdc3, RegistrationStatus.NOT_REGISTERED, openNonDirectoryApp]
];

const connectTestCategories: ConnectTestCategoryParam[] = [['Directory', directoryConnectTestParams], ['Non-Directory', nonDirectoryConnectTestParams]];

describe('Connecting windows', () => {
    // Directory Apps or Non-Directory Apps
    describe.each(connectTestCategories)('%s Apps', (categoryTitle: string, tests: ConnectTestParam[]) => {
        // E.g. When an app has an FDC3 connection
        describe.each(tests)('When an app %s', (
            testTitle: string,
            application: TestAppData,
            statusAfterDisconnect: RegistrationStatus,
            openFunction: (app: TestAppData) => Promise<void>
        ) => {
            beforeEach(async () => {
                await openFunction(application);
            });

            afterEach(async () => {
                await quitApps(application);
            });

            it(`Window is ${statusAfterDisconnect === RegistrationStatus.REGISTERED ? 'registered' : 'not registered'}`, async () => {
                await delay(Duration.WINDOW_REGISTRATION);
                await expect(isRegistered(application)).resolves.toBe(statusAfterDisconnect === RegistrationStatus.REGISTERED);
            });
        });
    });
});

type DisconnectTestParam = [
    string,
    TestAppData,
    RegistrationStatus,
    (app: TestAppData) => Promise<void>,
    (app: TestAppData) => Promise<void>
];

type DisconnectTestCategoryParam = [string, DisconnectTestParam[]];

const directoryDisconnectTestParams: DisconnectTestParam[] = [
    ['closed', testAppInDirectory1, RegistrationStatus.NOT_REGISTERED, openDirectoryApp, async (app) => {
        await quitApps(app);
    }],
    ['navigated away', testAppInDirectory1, RegistrationStatus.REGISTERED, openDirectoryApp, async (app) => {
        await navigateTo(app, 'about:blank');
    }],
    ['reloaded', testAppInDirectory1, RegistrationStatus.REGISTERED, openDirectoryApp, async (app) => {
        await reload(app);
    }],
    ['closed with preregistered listeners', testAppWithPreregisteredListeners1, RegistrationStatus.NOT_REGISTERED, openDirectoryApp, async (app) => {
        await quitApps(app);
    }],
    ['navigated away with preregisted listeners', testAppWithPreregisteredListeners1, RegistrationStatus.REGISTERED, openDirectoryApp, async (app) => {
        await navigateTo(app, 'about:blank');
    }],
    ['reloaded with preregistered listeners', testAppWithPreregisteredListeners1, RegistrationStatus.REGISTERED, openDirectoryApp, async (app) => {
        await reload(app);
    }]
];

const nonDirectoryDisconnectTestParams: DisconnectTestParam[] = [
    ['closed', testAppNotInDirectory1, RegistrationStatus.NOT_REGISTERED, openNonDirectoryApp, async (app) => {
        await quitApps(app);
    }],
    ['navigated away', testAppNotInDirectory1, RegistrationStatus.REGISTERED, openNonDirectoryApp, async (app) => {
        await navigateTo(app, 'about:blank');
    }],
    ['reloaded', testAppNotInDirectory1, RegistrationStatus.REGISTERED, openNonDirectoryApp, async (app) => {
        await reload(app);
    }]
];

const disconnectTestCategories: DisconnectTestCategoryParam[] = [
    ['Directory', directoryDisconnectTestParams],
    ['Non-Directory', nonDirectoryDisconnectTestParams]
];

describe('Disconnecting windows', () => {
    // Directory Apps or Non-Directory Apps
    describe.each(disconnectTestCategories)('%s Apps', (categoryTitle: string, tests: DisconnectTestParam[]) => {
        const TEST_INTENT = 'TestIntent';
        let redChannel: RemoteChannel;
        let blueChannel: RemoteChannel;

        // E.g. When an app is closed.
        describe.each(tests)('When an app is %s', (
            testTitle: string,
            application: TestAppData,
            statusAfterDisconnect: RegistrationStatus,
            openFunction: (app: TestAppData) => Promise<void>,
            disconnectFunction: (app: TestAppData) => Promise<void>
        ) => {
            beforeEach(async () => {
                await openFunction(application);

                await fdc3Remote.addContextListener(application);
                await fdc3Remote.addEventListener(application, 'channel-changed');
                await fdc3Remote.addIntentListener(application, TEST_INTENT);

                redChannel = await fdc3Remote.getChannelById(application, 'red');
                blueChannel = await fdc3Remote.getChannelById(application, 'blue');

                await redChannel.join(application);
                await blueChannel.addContextListener();
                await blueChannel.addEventListener('window-added');

                await disconnectFunction(application);
            });

            afterEach(async () => {
                await quitApps(application);
            });

            it('Intent listeners are removed', async () => {
                const intents = await getIntentListeners(TEST_INTENT);
                expect(intents.length).toEqual(0);
            });

            it(`Window is ${statusAfterDisconnect === RegistrationStatus.REGISTERED ? 'registered' : 'not registered'}`, async () => {
                await delay(Duration.WINDOW_REGISTRATION);
                await expect(isRegistered(application)).resolves.toBe(statusAfterDisconnect === RegistrationStatus.REGISTERED);
            });

            describe('Channels', () => {
                it('Context listeners are removed', async () => {
                    const contextListeners = await getChannelContextListeners(blueChannel);
                    expect(contextListeners.length).toEqual(0);
                });

                it('Event listeners are removed', async () => {
                    const eventListeners = await hasEventListeners(application, 'window-added');
                    expect(eventListeners).toEqual(false);
                });
            });
        });
    });
});

async function openDirectoryApp(app: TestAppData): Promise<void> {
    await fdc3Remote.open(testManagerIdentity, app.name);
}

async function openNonDirectoryApp(app: TestAppData): Promise<void> {
    await fin.Application.startFromManifest((app as NonDirectoryTestAppData).manifestUrl);
}

async function reload(target: Identity): Promise<void> {
    await ofBrowser.executeOnWindow(target, async function () {
        const window = this.fin.Window.getCurrentSync();
        await window.reload();
    });

    await delay(Duration.PAGE_RELOAD);
}

async function navigateTo(target: Identity, url: string): Promise<void> {
    await fin.Window.wrapSync(target).navigate(url);

    await delay(Duration.PAGE_NAVIGATE);
}

async function getIntentListeners(intentType: string): Promise<AppWindow[]> {
    return ofBrowser.executeOnWindow(SERVICE_IDENTITY, async function (this: ProviderWindow, type: string): Promise<AppWindow[]> {
        return this.model.windows.filter((window) => window.hasIntentListener(type));
    }, intentType);
}

function getChannelContextListeners(remoteChannel: RemoteChannel): Promise<AppWindow[]> {
    return ofBrowser.executeOnWindow(SERVICE_IDENTITY, function (this: ProviderWindow, id: string): AppWindow[] {
        const channel = this.channelHandler.getChannelById(id);
        return this.channelHandler.getWindowsListeningForContextsOnChannel(channel);
    }, remoteChannel.channel.id);
}

async function hasEventListeners(identity: Identity, eventType: ChannelEvents['type']): Promise<boolean> {
    const identities = await ofBrowser.executeOnWindow(SERVICE_IDENTITY, function (this: ProviderWindow, event: ChannelEvents['type']): Identity[] {
        // Check that the window identity is on any channel.
        return this.model.channels.map((channel) => {
            return this.channelHandler.getWindowsListeningForEventsOnChannel(channel, event).map((appWindow) => appWindow.identity);
        }).reduce((acc, current) => [...acc, ...current], []);
    }, eventType);
    return identities.some((id) => id.name === identity.name && id.uuid === identity.uuid);
}

function isRegistered(identity: Identity): Promise<boolean> {
    return ofBrowser.executeOnWindow(SERVICE_IDENTITY, function (this: ProviderWindow, identityRemote: Identity): boolean {
        return this.model.getWindow(identityRemote) !== null;
    }, identity);
}
