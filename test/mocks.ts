import {AppWindow} from '../src/provider/model/AppWindow';
import {IntentType} from '../src/client/main';

/**
 * Creates a minimal mock app window. Any utilizing test should set properties and set up mock functions as needed
 */
export function createMockAppWindow(): AppWindow {
    return {
        id: '',
        identity: {name: '', uuid: ''},
        appInfo: {appId: '', name: '', manifest: '', manifestType: ''},
        contexts: [],
        addIntentListener: jest.fn<void, [string]>(),
        removeIntentListener: jest.fn<void, [string]>(),
        hasAnyIntentListener: jest.fn<boolean, []>(),
        focus: jest.fn<Promise<void>, []>(),
        ensureReadyToReceiveIntent: jest.fn<Promise<void>, [IntentType]>()
    };
}
