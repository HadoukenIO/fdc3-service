import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Application} from '../../client/main';

import {AppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';

export enum EntityType {
    WINDOW = 'window',
    IFRAME = 'iframe',
    EXTERNAL_CONNECTION = 'external connection',
    UNKNOWN = 'unknown'
}

export interface Environment {
    windowSeen: Signal<[Identity]>;
    windowCreated: Signal<[Identity, string]>;
    windowClosed: Signal<[Identity]>;

    /**
     * Checks if an application is running, given an App Directory entry.
     */
    isRunning: (appInfo: Application) => Promise<boolean>;

    /**
     * Creates a new application, given an App Directory entry.
     * @throws:
     * * FDC3Error if app fails to start
     * * FDC3Error if timeout trying to start app
     */
    createApplication: (appInfo: Application, channel: ContextChannel) => Promise<void>;

    /**
     * Creates an `AppWindow` object for an existing window. Should only be called once per window, after the `windowCreated` signal has
     * been fired for that window
     */
    wrapApplication: (appInfo: Application, identity: Identity, channel: ContextChannel) => AppWindow;

    /**
     * Examines a running window, and returns a best-effort Application description
     */
    inferApplication: (identity: Identity) => Promise<Application>;

    /**
     * Determines the type of object that is represented by 'identity'
     */
    getEntityType(identity: Identity): Promise<EntityType>;

    /**
     * Returns whether the window has been seen by the service and is still open
     */
    isWindowSeen: (identity: Identity) => boolean;
}
