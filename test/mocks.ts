import {Signal} from 'openfin-service-signal';
import {Identity} from 'openfin/_v2/main';
import {ChannelProvider} from 'hadouken-js-adapter/out/types/src/api/interappbus/channel/provider';
import {findNodeModule} from 'jest-resolve';

import {AppWindow} from '../src/provider/model/AppWindow';
import {IntentType, Context, FDC3ChannelEventType, Application} from '../src/client/main';
import {ContextChannel} from '../src/provider/model/ContextChannel';
import {ChannelTransport, APIFromClientTopic} from '../src/client/internal';
import {Environment} from '../src/provider/model/Environment';
import {APIHandler, APISpecification, APIImplementation} from '../src/provider/APIHandler';

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
        hasChannelEventListener: jest.fn<boolean, [ContextChannel, FDC3ChannelEventType]>(),
        addChannelEventListener: jest.fn<void, [ContextChannel, FDC3ChannelEventType]>(),
        removeChannelEventListener: jest.fn<void, [ContextChannel, FDC3ChannelEventType]>(),
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
        windowCreated: new Signal<[Identity, string]>(),
        windowClosed: new Signal<[Identity]>(),
        windowSeen: new Signal<[Identity]>(),
        createApplication: jest.fn<Promise<void>, [Application, ContextChannel]>(),
        wrapApplication: jest.fn<AppWindow, [Application, Identity, ContextChannel]>(),
        inferApplication: jest.fn<Promise<Application>, [Identity]>()
    };
}
