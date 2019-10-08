import {Identity} from 'openfin/_v2/main';

import {Application, IntentType, ChannelId} from '../../client/main';
import {ChannelEvents} from '../../client/internal';

import {ContextChannel} from './ContextChannel';

/**
 * Model interface, representing a window that has connected to the service.
 *
 * Only windows that have created intent or context listeners will be represented in this model. If any non-registered
 * window.
 *
 * TODO [SERVICE-737] Review naming of this interface, due to these objects now representing (potentially window-less)
 * external connections. Likewise for "downstream" types/functions/etc.
 */
export interface AppWindow {
    id: string;

    identity: Identity;

    appInfo: Readonly<Application>;

    appWindowNumber: number;

    channel: ContextChannel;

    intentListeners: ReadonlyArray<string>;

    channelContextListeners: ReadonlyArray<ChannelId>;

    hasIntentListener(intentName: string): boolean;

    addIntentListener(intentName: string): void;

    removeIntentListener(intentName: string): void;

    hasChannelContextListener(channel: ContextChannel): boolean;

    addChannelContextListener(channel: ContextChannel): void;

    removeChannelContextListener(channel: ContextChannel): void;

    hasChannelEventListener(channel: ContextChannel, eventType: ChannelEvents['type']): boolean;

    addChannelEventListener(channel: ContextChannel, eventType: ChannelEvents['type']): void;

    removeChannelEventListener(channel: ContextChannel, eventType: ChannelEvents['type']): void;

    bringToFront(): Promise<void>;

    focus(): Promise<void>;

    isReadyToReceiveIntent(intent: IntentType): Promise<boolean>;

    removeAllListeners(): void;
}
