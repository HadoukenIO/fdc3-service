import {AppWindow} from '../src/provider/model/AppWindow';
import {IntentType, Context} from '../src/client/main';
import {ContextChannel} from '../src/provider/model/ContextChannel';
import {ChannelTransport} from '../src/client/internal';

/**
 * Creates a minimal mock app window. Any utilizing test should set properties and set up mock functions as needed
 */
export function createMockAppWindow(): AppWindow {
    return {
        id: '',
        identity: {name: '', uuid: ''},
        appInfo: {appId: '', name: '', manifest: '', manifestType: ''},
        channel: createMockChannel(),
        contextListeners: [],
        intentListeners: [],
        hasIntentListener: jest.fn<boolean, [string]>(),
        addIntentListener: jest.fn<void, [string]>(),
        removeIntentListener: jest.fn<void, [string]>(),
        focus: jest.fn<Promise<void>, []>(),
        ensureReadyToReceiveIntent: jest.fn<Promise<void>, [IntentType]>()
    };
}

function createMockChannel(): ContextChannel {
    return {
        id: '',
        type: '',
        getStoredContext: jest.fn<Context | null, []>(),
        setLastBroadcastContext: jest.fn<void, [Context]>(),
        clearStoredContext: jest.fn<void, []>(),
        serialize: jest.fn<ChannelTransport, []>()
    };
}
