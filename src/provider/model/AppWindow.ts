import {Identity} from 'openfin/_v2/main';

import {Application, IntentType, ChannelId, FDC3ChannelEventType} from '../../client/main';

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

    hasChannelEventListener(channel: ContextChannel, eventType: FDC3ChannelEventType): boolean;

    addChannelEventListener(channel: ContextChannel, eventType: FDC3ChannelEventType): void;

    removeChannelEventListener(channel: ContextChannel, eventType: FDC3ChannelEventType): void;

    bringToFront(): Promise<void>;

    focus(): Promise<void>;

    isReadyToReceiveIntent(intent: IntentType): Promise<boolean>;
}
