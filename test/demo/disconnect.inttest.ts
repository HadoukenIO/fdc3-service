import 'jest';
import {Identity} from 'openfin/_v2/main';

import {AppWindow} from '../../src/provider/model/AppWindow';
import {Application} from '../../src/client/directory';
import {SERVICE_IDENTITY} from '../../src/client/internal';
import {Model} from '../../src/provider/model/Model';
import {ChannelHandler} from '../../src/provider/controller/ChannelHandler';
import {EventHandler} from '../../src/provider/controller/EventHandler';
import {IntentHandler} from '../../src/provider/controller/IntentHandler';
import {FDC3ChannelEventType} from '../../src/client/main';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {fin} from './utils/fin';
import {OFPuppeteerBrowser} from './utils/ofPuppeteer';
import {setupTeardown, quitApps, TestAppData} from './utils/common';
import {testManagerIdentity, testAppInDirectory1, testAppWithPreregisteredListeners1, testAppNotInDirectory1, testAppNotFdc3} from './constants';
import {RemoteChannel} from './utils/RemoteChannel';
import {delay} from './utils/delay';

setupTeardown();

export type ProviderWindow = Window & {
    model: Model;
    intentHandler: IntentHandler;
    channelHandler: ChannelHandler;
    eventHandler: EventHandler;
}

const ofBrowser = new OFPuppeteerBrowser();
const TEST_INTENT = 'TestIntent';
let redChannel: RemoteChannel;
let blueChannel: RemoteChannel;

type TestParam = [
    string,
    TestAppData,
    (app: TestAppData) => Promise<void>,
    (app: TestAppData) => Promise<void>
];

type TestCatagoryParam = [string, TestParam[]];

async function openDirectoryApp(app: TestAppData) {
    await fdc3Remote.open(testManagerIdentity, app.name);
}

async function openNonDirectoryApp() {
    await fin.Application.startFromManifest(testAppNotInDirectory1.manifestUrl);
}

const directoryApps: TestParam[] = [
    ['closed', testAppInDirectory1, openDirectoryApp, async (app) => {
        await quitApps(app);
    }],
    ['navigated away', testAppInDirectory1, openDirectoryApp, async (app) => {
        await navigateTo(app, 'about:blank');
    }],
    ['reloaded', testAppInDirectory1, openDirectoryApp, async (app) => {
        await reload(app);
    }],
    ['closed with preregistered listeners', testAppWithPreregisteredListeners1, openDirectoryApp, async (app) => {
        await quitApps(app);
    }],
    ['navigated away with preregisted listeners', testAppWithPreregisteredListeners1, openDirectoryApp, async (app) => {
        await navigateTo(app, 'about:blank');
    }],
    ['reloaded with preregistered listeners', testAppWithPreregisteredListeners1, openDirectoryApp, async (app) => {
        await reload(app);
    }]
];

const nonDirectoryApps: TestParam[] = [
    ['closed', testAppNotInDirectory1, openNonDirectoryApp, async (app) => {
        await quitApps(app);
    }],
    ['navigated away', testAppNotInDirectory1, openNonDirectoryApp, async (app) => {
        await navigateTo(app, 'about:blank');
    }],
    ['reloaded', testAppNotInDirectory1, openNonDirectoryApp, async (app) => {
        await reload(app);
    }]
];

const testCatagories: TestCatagoryParam[] = [['Directory', directoryApps], ['Non Directory', nonDirectoryApps]];

describe('Disconnecting windows', () => {
    // Directory Apps or NonDirectory Apps
    describe.each(testCatagories)('%s Apps', (catagoryTitle: string, tests: TestParam[]) => {
        // E.g. When an app is closed.
        describe.each(tests)('When an app is %s', (
            testTitle: string,
            application: TestAppData,
            openMethod: (app: TestAppData) => Promise<void>,
            disconnectMethod: (app: TestAppData) => Promise<void>
        ) => {
            beforeEach(async () => {
                await openMethod(application);
                redChannel = await fdc3Remote.getChannelById(application, 'red');
                blueChannel = await fdc3Remote.getChannelById(application, 'blue');
                await fdc3Remote.addContextListener(application);
                await fdc3Remote.addEventListener(application, 'channel-changed');
                await fdc3Remote.addIntentListener(application, TEST_INTENT);
                await redChannel.join(application);
                await blueChannel.addContextListener();
                await blueChannel.addEventListener('window-added');

                await disconnectMethod(application);
            });

            afterEach(async () => {
                await quitApps(application);
            });

            it('Intent listeners are removed', async () => {
                const intents = await getIntentListeners(TEST_INTENT);
                expect(intents.length).toEqual(0);
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

async function reload(target: Identity): Promise<void> {
    await ofBrowser.executeOnWindow(target, async function () {
        const window = this.fin.Window.getCurrentSync();
        await window.reload();
    });

    await delay(500);
}

async function navigateTo(target: Identity, url: string): Promise<void> {
    await ofBrowser.executeOnWindow(target, async function (location) {
        const window = this.fin.Window.getCurrentSync();
        await window.navigate(location);
    }, url);

    await delay(500); // wait for page reload
}

async function getIntentListeners(intentType: string): Promise<Application[]> {
    return ofBrowser.executeOnWindow(SERVICE_IDENTITY, function (this: ProviderWindow, type: string): Promise<Application[]> {
        return this.model.getApplicationsForIntent(type);
    }, intentType);
}

async function getChannelContextListeners(remoteChannel: RemoteChannel): Promise<AppWindow[]> {
    return ofBrowser.executeOnWindow(SERVICE_IDENTITY, function (this: ProviderWindow, id: string): AppWindow[] {
        const channel = this.channelHandler.getChannelById(id);
        return this.channelHandler.getWindowsListeningForContextsOnChannel(channel);
    }, remoteChannel.channel.id);
}

async function hasEventListeners(identity: Identity, eventType: FDC3ChannelEventType): Promise<boolean> {
    const identities = await ofBrowser.executeOnWindow(SERVICE_IDENTITY, function (this: ProviderWindow, event: FDC3ChannelEventType): Identity[] {
        // Check that the window identity is on any channel.
        return this.model.channels.map(channel => {
            return this.channelHandler.getWindowsListeningForEventsOnChannel(channel, event).map(appWindow => appWindow.identity);
        }).reduce((acc, current) => [...acc, ...current], []);
    }, eventType);
    return identities.some(id => id.name === identity.name && id.uuid === identity.uuid);
}
