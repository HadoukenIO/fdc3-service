import {Signal} from 'openfin-service-signal';
import {Identity} from 'openfin/_v2/main';

import {AppWindow} from '../src/provider/model/AppWindow';
import {IntentType, Context, Application} from '../src/client/main';
import {ContextChannel} from '../src/provider/model/ContextChannel';
import {ChannelTransport, ChannelEvents} from '../src/client/internal';
import {Environment, EntityType} from '../src/provider/model/Environment';

/**
 * Creates a minimal mock app window. Any utilizing test should set properties and set up mock functions as needed
 */
export function createMockAppWindow(): jest.Mocked<AppWindow> {
    return {
        id: '',
        identity: {name: '', uuid: ''},
        appInfo: {appId: '', name: '', manifest: '', manifestType: ''},
        appWindowNumber: 0,
        channel: createMockChannel(),
        channelContextListeners: [],
        intentListeners: [],
        hasIntentListener: jest.fn<boolean, [string]>(),
        addIntentListener: jest.fn<void, [string]>(),
        removeIntentListener: jest.fn<void, [string]>(),
        hasChannelContextListener: jest.fn<boolean, [ContextChannel]>(),
        addChannelContextListener: jest.fn<void, [ContextChannel]>(),
        removeChannelContextListener: jest.fn<void, [ContextChannel]>(),
        hasChannelEventListener: jest.fn<boolean, [ContextChannel, ChannelEvents['type']]>(),
        addChannelEventListener: jest.fn<void, [ContextChannel, ChannelEvents['type']]>(),
        removeChannelEventListener: jest.fn<void, [ContextChannel, ChannelEvents['type']]>(),
        bringToFront: jest.fn<Promise<void>, []>(),
        focus: jest.fn<Promise<void>, []>(),
        isReadyToReceiveIntent: jest.fn<Promise<boolean>, [IntentType]>(),
        removeAllListeners: jest.fn<void, []>()
    };
}

export function createMockChannel(): jest.Mocked<ContextChannel> {
    return {
        id: '',
        type: '',
        getStoredContext: jest.fn<Context | null, []>(),
        setLastBroadcastContext: jest.fn<void, [Context]>(),
        clearStoredContext: jest.fn<void, []>(),
        serialize: jest.fn<ChannelTransport, []>()
    };
}

export function createMockEnvironmnent(): jest.Mocked<Environment> {
    return {
        windowSeen: new Signal<[Identity]>(),
        windowClosed: new Signal<[Identity]>(),
        createApplication: jest.fn<Promise<void>, [Application, ContextChannel]>(),
        wrapApplication: jest.fn<AppWindow, [Application, Identity, ContextChannel]>(),
        inferApplication: jest.fn<Promise<Application>, [Identity]>(),
        getEntityType: jest.fn<Promise<EntityType>, [Identity]>(),
        isWindowCreated: jest.fn<boolean, [Identity]>()
    };
}
