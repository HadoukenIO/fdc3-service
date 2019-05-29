import {Window, Identity} from 'openfin/_v2/main';

import {Application, IntentType} from '../../client/main';
import {Signal1} from '../common/Signal';

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

    contexts: ReadonlyArray<ContextChannel>;

    identity: Identity;

    appInfo: Readonly<Application>;

    addIntentListener(intentName: string): void;

    removeIntentListener(intentName: string): void;

    hasAnyIntentListener(): boolean;

    focus(): Promise<void>;

    ensureReadyToReceiveIntent(intent: IntentType): Promise<void>;
}
