import {Identity} from 'openfin/_v2/main';

import {Intent} from '../../../src/client/intents';
import {withTimeout} from '../../../src/provider/utils/async';
import {testManagerIdentity, appStartupTime} from '../constants';
import {Boxed} from '../../../src/provider/utils/types';
import {RESOLVER_IDENTITY} from '../../../src/provider/utils/constants';
import {SERVICE_IDENTITY} from '../../../src/client/internal';
import {Model} from '../../../src/provider/model/Model';

import {fin} from './fin';
import * as fdc3Remote from './fdc3RemoteExecution';
import {delay} from './delay';

type ProviderWindow = Window & {
    model: Model;
}

export interface TestAppData {
    name: string; // Note that this may be treated as a 'name' in the FDC3 app directory sense, or a 'name' in the OpenFin window Identity sense
    uuid: string;
}

export interface DirectoryTestAppData extends TestAppData {
    appId: string;
}

export interface NonDirectoryTestAppData extends TestAppData {
    manifestUrl: string;
}

/**
 * Quits an OpenFin app (or multiple in parallel) using `force=true` and swallowing errors
 * @param apps Identities of the apps to quit
 */
export async function quitApps(...apps: Identity[]) {
    await Promise.all(apps.map(app => fin.Application.wrapSync(app).quit(true).catch(() => {})));
}

export async function waitForAppToBeRunning(app: Identity): Promise<void> {
    let timedOut = false;

    [timedOut] = await withTimeout(appStartupTime, new Promise<void>(async (resolve) => {
        while (!await fin.Application.wrapSync(app).isRunning() && !timedOut) {
            await delay(100);
        }

        resolve();
    }));

    if (timedOut) {
        throw new Error(`Timeout waiting for app ${JSON.stringify(app)} to start`);
    }

    // Additional delay to ensure app window is ready for puppeteer connection
    await delay(500);
}

/**
 * Registers `beforeEach` to open an app in the directory via FDC3's `open` method, and `afterEach` to quit
 * @param app app identity
 */
export function setupOpenDirectoryAppBookends(app: DirectoryTestAppData): void {
    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, app.name);
    });

    afterEach(async () => {
        await quitApps(app);
    });
}

/**
 * Registers `beforeEach` to start an app from its `manifestUrl`, and `afterEach` to quit
 * @param app app info.
 */
export function setupStartNonDirectoryAppBookends(app: NonDirectoryTestAppData): void {
    beforeEach(async () => {
        await fin.Application.startFromManifest(app.manifestUrl);
    });

    afterEach(async () => {
        await quitApps(app);
    });
}

/**
 * Registers `beforeEach` to start an app from its `manifestUrl` and add an intent listener, and `afterEach` to quit the app
 * @param intent intent to add listener to. Listener is returned, boxed in an object
 * @param app app info.
 */
export function setupStartNonDirectoryAppWithIntentListenerBookends(intent: Intent, app: NonDirectoryTestAppData): Boxed<fdc3Remote.RemoteIntentListener> {
    setupStartNonDirectoryAppBookends(app);
    const listener: Boxed<fdc3Remote.RemoteIntentListener> = {value: undefined!};

    beforeEach(async () => {
        listener.value = await fdc3Remote.addIntentListener(app, intent.type);
    });

    return listener;
}

export function setupQuitAppAfterEach(...apps: Identity[]): void {
    afterEach(async () => {
        await quitApps(...apps);
    });
}

export function setupTeardown(): void {
    afterEach(async () => {
        const expectedRunningApps = ['fdc3-service', testManagerIdentity.uuid];

        const runningApps = (await fin.System.getAllApplications()).map(appInfo => appInfo.uuid);
        const unexpectedRunningApps = runningApps.filter((uuid) => !expectedRunningApps.includes(uuid));

        await quitApps(...unexpectedRunningApps.map((uuid) => ({uuid})));

        const resolverShowing = await fin.Window.wrapSync(RESOLVER_IDENTITY).isShowing();
        if (resolverShowing) {
            await closeResolver();
        }

        expect(runningApps.sort()).toEqual(expectedRunningApps.sort());
        expect(resolverShowing).toBe(false);

        await expect(isServiceClear()).resolves.toBe(true);
    });
}

/**
 * Checks that the service is in the expected state when no test apps are running
 */
async function isServiceClear(): Promise<boolean> {
    return fdc3Remote.ofBrowser.executeOnWindow(SERVICE_IDENTITY, function (this: ProviderWindow, testManagerIdentity: Identity): string | boolean {
        if (this.model.windows.length !== 1) {
            return `excess windows ${JSON.stringify(this.model.windows.map((window) => window.id))}`;
        }

        const singleWindow = this.model.windows[0];

        if (singleWindow.appInfo.appId !== testManagerIdentity.uuid) {
            return 'window not test manager';
        }

        if (singleWindow.channelContextListeners.length !== 0 ||
            singleWindow.intentListeners.length !== 0 ||
            singleWindow.channelContextListeners.length !== 0) {
            return 'unexpected listeners on window';
        }

        return true;
    }, testManagerIdentity) as unknown as boolean;
}

async function closeResolver(): Promise<void> {
    const cancelClicked = await fdc3Remote.clickHTMLElement(RESOLVER_IDENTITY, '#cancel');
    if (!cancelClicked) {
        throw new Error('Error clicking cancel button on resolver. Make sure it has id="cancel".');
    }
}
