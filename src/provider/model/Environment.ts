import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Application} from '../../client/main';

import {AppConnection} from './AppConnection';
import {ContextChannel} from './ContextChannel';
import {LiveApp} from './LiveApp';

/**
 * The runtime-defined list of possible OpenFin entity types.
 */
export enum EntityType {
    /**
     * Connection from a non-DOM source. Typically from a .NET, Java, or other adapter-based app.
     */
    EXTERNAL_CONNECTION = 'external connection',
    /**
     * Connection from an app running in a `fin.View` container. Typically, a Layouts2-enabled app.
     */
    VIEW = 'view',
    /**
     * Connection from an app running in a `fin.Window` container. Typically a non-Layouts2 app, or the frame of a
     * Layouts2-based application.
     */
    WINDOW = 'window',

    /**
     * Connection from an app running in an iframe within a `view` or `window` entity.
     *
     * Not supported. Entities of this type may not be able to use FDC3 fully.
     */
    IFRAME = 'iframe',
    /**
     * Runtime couldn't determine entity type. Could be an external connection from an outdated adapter version.
     *
     * Not supported.
     */
    UNKNOWN = 'unknown'
}

export interface Environment {
    /**
     * Indicates that a window-like entity has been created, and registered with the service. Fired only for entity types where
     * this is possible (`VIEW` and `WINDOW`).
     *
     * Will fire for all window-like entities that get created, and that existed before the service started running.
     * These entities may or may not be FDC3-aware.
     *
     * Arguments: (identity: Identity, entityType: EntityType)
     */
    onWindowCreated: Signal<[Identity, EntityType]>;

    /**
     * Indicates that an existing window-like entity has been closed.
     *
     * Arguments: (identity: Identity, entityType: EntityType)
     */
    onWindowClosed: Signal<[Identity, EntityType]>;

    /**
     * Indicates that an application has been created by the service.
     *
     * Arguments: (identity: Identity, liveApp: LiveApp)
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
