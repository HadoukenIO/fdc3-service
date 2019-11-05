import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Application} from '../../client/main';

import {AppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {LiveApp} from './LiveApp';

export enum EntityType {
    WINDOW = 'window',
    IFRAME = 'iframe',
    EXTERNAL_CONNECTION = 'external connection',
    UNKNOWN = 'unknown'
}

export interface Environment {
    /**
     * Indicates that an application has been created by the service.
     *
     * Arguments: (identity: Identity)
     */
    applicationCreated: Signal<[Identity, LiveApp]>;

    /**
     * Indicates that an application has been closed.
     *
     * Arguments: (identity: Identity)
     */
    applicationClosed: Signal<[Identity]>;

    /**
     * Indicates that a window has been created by the service.
     *
     * Arguments: (identity: Identity)
     */
    windowCreated: Signal<[Identity]>;

    /**
     * Checks if an application is running, given an App Directory entry.
     */
    windowClosed: Signal<[Identity]>;

    /**
     * Creates a new application, given an App Directory entry.
     * @throws
     * * FDC3Error if app fails to start
     * * FDC3Error if timeout trying to start app
     */
    createApplication: (appInfo: Application) => void;

    /**
     * Creates an `AppWindow` object for an existing window. Should only be called once per window, after the `windowCreated` signal has
     * been fired for that window
     */
    wrapWindow: (liveApp: LiveApp, identity: Identity, channel: ContextChannel) => AppWindow;

    /**
     * Examines a running window, and returns a best-effort Application description
     */
    inferApplication: (identity: Identity) => Promise<Application>;

    /**
     * Determines the type of object that is represented by 'identity'
     */
    getEntityType(identity: Identity): Promise<EntityType>;

    /**
     * Returns whether the window has been created by the service and is still open
     */
    isWindowCreated: (identity: Identity) => boolean;
}
