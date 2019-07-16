import 'jest';
import {Identity} from 'openfin/_v2/main';

import {AppWindow} from '../../src/provider/model/AppWindow';
import {Application} from '../../src/client/directory';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {fin} from './utils/fin';
import {OFPuppeteerBrowser} from './utils/ofPuppeteer';
import {setupTeardown, quitApps, TestAppData} from './utils/common';
import {testManagerIdentity, testAppInDirectory1, testAppWithPreregisteredListeners1, testAppNotInDirectory1, testAppNotFdc3} from './constants';
import {RemoteChannel} from './utils/RemoteChannel';
import {delay} from './utils/delay';

setupTeardown();

const ofBrowser = new OFPuppeteerBrowser();
const TEST_INTENT = 'TestIntent';
let redChannel: RemoteChannel;
let blueChannel: RemoteChannel;
type EventType = 'window-added' | 'window-removed';

describe('Disconnecting windows', () => {
    describe('Directory Apps', () => {
        async function open(app: TestAppData) {
            await fdc3Remote.open(testManagerIdentity, app.name);
        }

        testSuite('When app is closed', testAppInDirectory1, open, async (app) => {
            await quitApps(app);
        });

        testSuite('When app is closed with preregistered listeners', testAppWithPreregisteredListeners1, open, async (app) => {
            await quitApps(app);
        });

        testSuite('When app navigates away', testAppInDirectory1, open, async (app) => {
            await navigateTo(app, 'about:blank');
        });

        testSuite('When app with pregistered listeners navigates away', testAppWithPreregisteredListeners1, open, async (app) => {
            await navigateTo(app, 'about:blank');
        });
    });

    describe('Non Directory Apps', () => {
        async function open() {
            await fin.Application.startFromManifest(testAppNotInDirectory1.manifestUrl);
        }

        testSuite('When app is closed', testAppNotInDirectory1, open, async (app) => {
            await quitApps(app);
        });

        testSuite('When app navigates away', testAppNotInDirectory1, open, async (app) => {
            await navigateTo(app, 'about:blank');
        });
    });
});

async function testSuite(
    title: string,
    application: TestAppData,
    open: (app: TestAppData) => Promise<void>,
    disconnectMethod: (app: TestAppData) => Promise<void>
) {
    describe(title, () => {
        beforeEach(async () => {
            await open(application);
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

        it('The window is removed from the model', async () => {
            expect(await getWindow(application)).toBeNull();
        });

        it('Intent listeners are removed', async () => {
            const intents = await getIntentListeners(TEST_INTENT);
            expect(intents.length).toEqual(0);
        });

        describe('Channels', () => {
            it('All channels have been left', async () => {
                expect(await windowIsNotInChannels(application)).toEqual(true);
            });

            it('Context listeners are removed', async () => {
                const contextListeners = await getChannelContextListeners(blueChannel);
                expect(contextListeners.length).toEqual(0);
            });

            it('Event listeners are removed', async () => {
                const eventListeners = await getChannelEventListeners(blueChannel, 'window-added');
                expect(eventListeners.length).toEqual(0);
            });
        });
    });
}

async function navigateTo(target: Identity, url: string): Promise<void>{
    await ofBrowser.executeOnWindow(target, async function (location) {
        const window = this.fin.Window.getCurrentSync();
        await window.navigate(location);
    }, url);

    await delay(300); // wait for page reload
}

async function getWindow(identity: Identity): Promise<AppWindow | null> {
    return ofBrowser.executeOnProvider(function (id: Identity): AppWindow | null {
        return this.model.getWindow(id);
    }, identity);
}

async function getIntentListeners(intentType: string): Promise<Application[]> {
    return ofBrowser.executeOnProvider(function (type: string): Promise<Application[]> {
        return this.model.getApplicationsForIntent(type);
    }, intentType);
}

async function getChannelContextListeners(remoteChannel: RemoteChannel): Promise<AppWindow[]> {
    return ofBrowser.executeOnProvider(function (id: string): AppWindow[] {
        const channel = this.channelHandler.getChannelById(id);
        return this.channelHandler.getWindowsListeningForContextsOnChannel(channel);
    }, remoteChannel.channel.id);
}

async function getChannelEventListeners(remoteChannel: RemoteChannel, eventType: EventType): Promise<AppWindow[]> {
    return ofBrowser.executeOnProvider(function (id: string, event: EventType): AppWindow[] {
        const channel = this.channelHandler.getChannelById(id);
        return this.channelHandler.getWindowsListeningForEventsOnChannel(channel, event);
    }, remoteChannel.channel.id, eventType);
}

async function windowIsNotInChannels(identity: Identity): Promise<boolean> {
    return ofBrowser.executeOnProvider(function (id): boolean {
        const window = this.model.getWindow(id);
        return !this.model.channels.some(channel => {
            return this.channelHandler.getChannelMembers(channel).some(member => member === window);
        });
    }, identity);
}
