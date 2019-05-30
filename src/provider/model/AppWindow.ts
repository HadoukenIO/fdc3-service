import {Identity} from 'openfin/_v2/main';

import {Application, IntentType} from '../../client/main';

import {ContextChannel} from './ContextChannel';

export interface ContextSpec {
    type: string;
}

/**
 * Model interface, representing a window that has connected to the service.
 *
 * Only windows that have created intent or context listeners will be represented in this model. If any non-registered
 * window.
 */
export interface AppWindow {
    id: string;

    identity: Identity;

    appInfo: Readonly<Application>;

    contexts: ReadonlyArray<ContextChannel>;

    intentListeners: ReadonlyArray<string>;

    hasIntentListener(intentName: string): boolean;

    addIntentListener(intentName: string): void;

    removeIntentListener(intentName: string): void;

    focus(): Promise<void>;

    ensureReadyToReceiveIntent(intent: IntentType): Promise<void>;
}
