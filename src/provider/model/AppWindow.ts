import {Identity} from 'openfin/_v2/main';

import {Application, IntentType, ChannelId} from '../../client/main';

import {ContextChannel} from './ContextChannel';

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

    channel: ContextChannel;

    intentListeners: ReadonlyArray<string>;

    contextListeners: ReadonlyArray<ChannelId>;

    hasIntentListener(intentName: string): boolean;

    addIntentListener(intentName: string): void;

    removeIntentListener(intentName: string): void;

    hasContextListener(channelId: ChannelId): boolean;

    addContextListener(channelId: ChannelId): void;

    removeContextListener(channelId: ChannelId): void;

    focus(): Promise<void>;

    ensureReadyToReceiveIntent(intent: IntentType): Promise<void>;
}
