import {Identity} from 'openfin/_v2/main';

import {Intent} from '../../../src/client/intents';
import {testManagerIdentity} from '../constants';

import {fin} from './fin';
import * as fdc3Remote from './fdc3RemoteExecution';
import {delay} from './delay';

export type Boxed<T> = {value: T}

/**
 * Identity with a mandatory `name`
 */
export interface AppIdentity extends Identity {
    name: string; // Make inherited field mandatory
}

export interface DirectoryAppIdentity extends AppIdentity {
    appId: string;
}

export interface NonDirectoryAppIdentity extends AppIdentity {
    manifestUrl: string;
}

/**
 * Quits an OpenFin app (or multiple in parallel) using `force=true` and swallowing errors
 * @param apps Identities of the apps to quit
 */
export async function quitApp(...apps: Identity[]) {
    await Promise.all(apps.map(app => fin.Application.wrapSync(app).quit(true).catch(() => {})));
}

export async function waitForAppToBeRunning(app: Identity): Promise<void> {
    while (!await fin.Application.wrapSync(app).isRunning()) {
        await delay(100);
    }

    // Additional delay to ensure app window is ready for puppeteer connection
    await delay(500);
}

/**
 * Registers `beforeEach` to open an app in the directory via FDC3's `open` method, and `afterEach` to quit
 * @param app app identity
 */
export function setupOpenDirectoryAppBookends(app: DirectoryAppIdentity): void {
    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, app.name);
    });

    afterEach(async () => {
        await quitApp(app);
    });
}

/**
 * Registers `beforeEach` to start an app from its `manifestUrl`, and `afterEach` to quit
 * @param app app info.
 */
export function setupStartNonDirectoryAppBookends(app: NonDirectoryAppIdentity): void {
    beforeEach(async () => {
        await fin.Application.startFromManifest(app.manifestUrl);
    });

    afterEach(async () => {
        await quitApp(app);
    });
}

/**
 * Registers `beforeEach` to start an app from its `manifestUrl` and add an intent listener, and `afterEach` to quit the app
 * @param intent intent to add listener to. Listener is returned, boxed in an object
 * @param app app info.
 */
export function setupStartNonDirectoryAppWithIntentListenerBookends(intent: Intent, app: NonDirectoryAppIdentity): Boxed<fdc3Remote.RemoteIntentListener> {
    setupStartNonDirectoryAppBookends(app);
    const listener: Boxed<fdc3Remote.RemoteIntentListener> = {value: undefined!};

    beforeEach(async () => {
        listener.value = await fdc3Remote.addIntentListener(app, intent.type);
    });

    return listener;
}

export function setupQuitAppAfterEach(...apps: Identity[]): void {
    afterEach(async () => {
        await quitApp(...apps);
    });
}

export function setupTeardown(): void {
    afterAll(async () => {
        const expectedRunningAppIdentities = ['fdc3-service', testManagerIdentity.uuid];

        const runningAppInfos = await fin.System.getAllApplications();

        const runningAppIdentities = runningAppInfos.map(appInfo => appInfo.uuid);

        for (const identity of runningAppIdentities) {
            if (!expectedRunningAppIdentities.includes(identity)) {
                await quitApp({uuid: identity});
            }
        }

        expect(runningAppIdentities).toEqual(expectedRunningAppIdentities);
    });
}
