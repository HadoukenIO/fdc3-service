import {AppWindow} from '../src/provider/model/AppWindow';
import {IntentType, Context, FDC3ChannelEventType} from '../src/client/main';
import {ContextChannel} from '../src/provider/model/ContextChannel';
import {ChannelTransport} from '../src/client/internal';

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
        isReadyToReceiveIntent: jest.fn<Promise<boolean>, [IntentType]>()
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
