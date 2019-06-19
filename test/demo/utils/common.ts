import {Identity} from 'openfin/_v2/main';

import {Intent} from '../../../src/client/intents';
import {testManagerIdentity} from '../constants';

import {fin} from './fin';
import * as fdc3Remote from './fdc3RemoteExecution';

export type Boxed<T> = { current: T }

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

/**
 * Registers `beforeEach` to open an app in the directory via FDC3's `open` method, and `afterEach` to quit
 * @param app app identity
 */
export function setupOpenDirectoryApp(app: DirectoryAppIdentity) {
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
export function setupStartNonDirectoryApp(app: NonDirectoryAppIdentity) {
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
export function setupStartNonDirectoryAppWithIntentListener(intent: Intent, app: NonDirectoryAppIdentity): Boxed<fdc3Remote.RemoteIntentListener> {
    setupStartNonDirectoryApp(app);
    const listener: Boxed<fdc3Remote.RemoteIntentListener> = {current: undefined!};

    beforeEach(async () => {
        listener.current = await fdc3Remote.addIntentListener(app, intent.type);
    });

    return listener;
}
