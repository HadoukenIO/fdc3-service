import {Intent} from '../client/main';
import {IApplication} from '../client/directory';
import {IntentType} from '../client/intents';

import {FDC3} from './FDC3';
import {IAppMetadata} from './MetadataStore';
import { Context } from '../client/main';

console.log('the provider has landed.');

// Create and initialise desktop agent
const service: FDC3 = new FDC3();
service.register();

/**
 * When the user is shown an app selector popup, they have the option of telling
 * the service how to handle similar intents in the future.
 *
 * This enum defines the options available to users.
 */
export const enum eDefaultAction {
    /**
     * Service should always show the app selection UI, to allow the user to
     * choose which application to use.
     */
    ALWAYS_ASK = 'ALWAYS_ASK',

    /**
     * The service should always use the current selection when the intent is
     * coming from the app that fired the current intent.
     */
    ALWAYS_FOR_APP = 'ALWAYS_FOR_APP',

    /**
     * The service should always use the current selection, whenever an intent of
     * this type is fired.
     */
    ALWAYS_FOR_INTENT = 'ALWAYS_FOR_INTENT'
}

// Message definitions
export interface IOpenArgs {
    name: string;
    context?: Context;
}
export interface IResolveArgs {
    intent: IntentType;
    context?: Context;
}
export interface ISelectorResultArgs {
    handle: number;
    success: boolean;

    /**
     * The application that was selected by the user.
     *
     * Only specified when success is true.
     */
    app?: IApplication;

    /**
     * The reason that an app wasn't selected.
     *
     * Only specified when success is false.
     */
    reason?: string;

    /**
     * Determines the future behaviour of this intent
     */
    defaultAction: eDefaultAction;
}

/**
 * If there are multiple applications available that can handle an intent, the
 * service must ask the user which application they would like to use. To avoid
 * confusing users, only one selector will be shown at a time - if another
 * intent is fired whilst the resolver is open then it will be queued.
 *
 * This interface is used to wrap each intent that comes into the service that
 * requires manual resolution by the user. These wrappers can then be placed in
 * a queue.
 *
 * NOTE: Only intents that require user interaction will (potentially) be placed
 * in a queue. Any explicit intents, or intents where there is only one
 * application available, will always be handled immediately.
 */
export interface IQueuedIntent {
    /**
     * A unique identifier for this intent.
     *
     * This is created when the service first recives the intent, and is used to
     * manage communication across between the service back-end and front-end.
     */
    handle: number;

    /**
     * The original intent, launched by the user
     */
    intent: Intent;

    /**
     * UUID of the application that fired this intent
     */
    source: IAppMetadata;

    /**
     * List of available applications that are capable of handling the intent
     */
    applications: IApplication[];

    /**
     * The application spawned by the service to allow the user to decide how to
     * handle the intent.
     *
     * If there are multiple simultanous intents that require a user selection,
     * they will be queued. Only the first item in the queue will have an
     * application - selector will be null until the intent reaches the front of
     * the queue.
     */
    selector: fin.OpenFinApplication|null;

    /**
     * Function to use to resolve this intent
     */
    resolve: (selectedApp: IApplication) => void;

    /**
     * Function to use to reject this intent
     */
    reject: (reason: Error) => void;
}
