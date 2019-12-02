import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Application} from '../../client/main';

import {AppConnection} from './AppConnection';
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
     * Indicates that a window has been created by the service.
     *
     * Will fire for all OpenFin windows that get created, and that existed before the service started running. These windows may or may not be FDC3-aware.
     *
     * Arguments: (identity: Identity)
     */
    onWindowCreated: Signal<[Identity]>;

    /**
     * Indicates that a window has been closed.
     *
     * Arguments: (identity: Identity)
     */
    onWindowClosed: Signal<[Identity]>;

    /**
     * Indicates that an application has been created by the service.
     *
     * Arguments: (identity: Identity)
     */
    onApplicationCreated: Signal<[Identity, LiveApp]>;

    /**
     * Indicates that an application has been closed.
     *
     * Arguments: (identity: Identity)
     */
    onApplicationClosed: Signal<[Identity]>;

    /**
     * Creates a new application, given an App Directory entry.
     * @throws
     * * FDC3Error if app fails to start
     * * FDC3Error if timeout trying to start app
     */
    createApplication: (appInfo: Application) => void;

    /**
     * Creates an `AppConnection` object for an existing identity, should only be called once per identity.
     *
     * Should be called after the `onWindowCreated` signal for windows, and the `APIHandler.onConnection` signal for external connections.
     */
    wrapConnection: (liveApp: LiveApp, identity: Identity, entityType: EntityType, channel: ContextChannel) => AppConnection;

    /**
     * Examines a running window or external connection, and returns a best-effort Application description
     */
    inferApplication(identity: Identity): Promise<Application>;

    /**
     * Determines the type of object that is represented by `identity`
     */
    getEntityType(identity: Identity): Promise<EntityType>;

    /**
     * Returns whether the given identity is either an open window, or is an external connection that is currently connected to the service.
     */
    isKnownEntity(identity: Identity): boolean;
}
