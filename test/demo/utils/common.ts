import {Identity} from 'openfin/_v2/main';
import {withTimeout} from 'openfin-service-async';

import {Intent} from '../../../src/provider/intents';
import {testManagerIdentity, appStartupTime} from '../constants';
import {Boxed} from '../../../src/provider/utils/types';
import {RESOLVER_IDENTITY} from '../../../src/provider/utils/constants';
import {getServiceIdentity} from '../../../src/client/internal';
import {Model} from '../../../src/provider/model/Model';

import {fin} from './fin';
import * as fdc3Remote from './fdc3RemoteExecution';
import {delay, Duration} from './delay';
import {BaseWindowContext} from './ofPuppeteer';

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

type ProviderWindow = BaseWindowContext & {
    model: Model;
};

/**
 * Quits an OpenFin app (or multiple in parallel) using `force=true` and swallowing errors
 * @param apps Identities of the apps to quit
 */
export async function quitApps(...apps: Identity[]) {
    await Promise.all(apps.map((app) => fin.Application.wrapSync(app).quit(true).catch(() => {})));
    // We delay here to give FDC3 a chance to process the quit, which is not captured in the returned promise
    await delay(250);
}

export async function reloadProvider(): Promise<void> {
    await fdc3Remote.ofBrowser.executeOnWindow(getServiceIdentity(), async function (this: ProviderWindow) {
        await this.fin.Window.wrapSync({uuid: this.fin.Window.me.uuid, name: 'fdc3-resolver'}).close(true).catch(() => {});
        this.window.location.reload();
    });
    await delay(Duration.PROVIDER_RELOAD);
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
        await startDirectoryApp(app);
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
        await startNonDirectoryApp(app);
    });

    afterEach(async () => {
        await quitApps(app);
    });
}

export async function startDirectoryApp(app: DirectoryTestAppData): Promise<void> {
    await fdc3Remote.open(testManagerIdentity, app.name);
    await delay(Duration.API_CALL);
}

export async function startNonDirectoryApp(app: NonDirectoryTestAppData): Promise<void> {
    await fin.Application.startFromManifest(app.manifestUrl);
    await delay(Duration.API_CALL);
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
        let resolverShowing = false;
        while (await fin.Window.wrapSync(RESOLVER_IDENTITY).isShowing()) {
            resolverShowing = true;
            await closeResolver();
        }

        const expectedRunningApps = [getServiceIdentity().uuid, testManagerIdentity.uuid];

        const runningApps = (await fin.System.getAllApplications()).map((appInfo) => appInfo.uuid);
        const unexpectedRunningApps = runningApps.filter((uuid) => !expectedRunningApps.includes(uuid));

        await quitApps(...unexpectedRunningApps.map((uuid) => ({uuid})));

        expect(resolverShowing).toBe(false);
        expect(runningApps.sort()).toEqual(expectedRunningApps.sort());

        await checkService();
    });
}

/**
 * Remotely clicks the cancel button on the resolver
 */
export async function closeResolver(): Promise<void> {
    const cancelClicked = await fdc3Remote.clickHTMLElement(RESOLVER_IDENTITY, '#cancel');
    if (!cancelClicked) {
        throw new Error('Error clicking cancel button on resolver. Make sure it has id="cancel".');
    }

    await delay(Duration.API_CALL);
}

/**
 * Checks that the service is in the expected state when no test apps are running
 */
async function checkService(): Promise<void> {
    const problemList = await fdc3Remote.ofBrowser.executeOnWindow<[TestAppData], string[], ProviderWindow>(
        getServiceIdentity(),
        function (this: ProviderWindow, expectedWindowIdentity: Identity): string[] {
            const problems: string[] = [];
            const {connections, apps} = this.model;

            if (connections.length !== 1) {
                problems.push(`Had ${connections.length} connections, expected 1. Connections: ${connections.map((c) => c.id).join(', ')}`);
            } else {
                const singleConnection = connections[0];

                if (singleConnection.appInfo.appId !== expectedWindowIdentity.uuid) {
                    problems.push(`Expected connection to be from ${expectedWindowIdentity.uuid}, was from ${singleConnection.id}`);
                }

                if (singleConnection.hasContextListener() || singleConnection.channelContextListeners.length !== 0) {
                    problems.push('Expected connection to have a context listener, but it did not');
                }

                if (singleConnection.intentListeners.length !== 0) {
                    problems.push(`Expected connection to have no intent listener, but it has listeners for: ${singleConnection.intentListeners.join(', ')}`);
                }
            }

            if (apps.length !== 1) {
                problems.push(`Had ${apps.length} live apps, expected 1. Apps: ${apps.map((a) => a.appInfo?.appId || '<unknown>').join(', ')}`);
            } else {
                const singleApp = apps[0];

                if (singleApp.appInfo!.appId !== expectedWindowIdentity.uuid) {
                    problems.push(`Expected registered app to be ${expectedWindowIdentity.uuid}, was from ${singleApp.appInfo?.appId || '<unknown>'}`);
                }

                if (singleApp.connections.length !== 1 || connections.length !== 1 || singleApp.connections[0] !== connections[0]) {
                    problems.push(`Expected sole connection to be from sole app. App connections: ${singleApp.connections.map((c) => c.id).join(', ')}`);
                }
            }

            return problems;
        }, testManagerIdentity
    );

    const problemCount = problemList.length;
    if (problemCount === 1) {
        throw new Error(`Problem found within service state: ${problemList[0]}`);
    } else if (problemCount > 1) {
        const sep = '\n  - ';
        throw new Error(`Found ${problemCount} problems within service state:${sep}${problemList.join(sep)}`);
    }
}
