import {Signal} from 'openfin-service-signal';
import {Identity} from 'openfin/_v2/main';

import {AppWindow} from '../src/provider/model/AppWindow';
import {IntentType, Context, Application} from '../src/client/main';
import {ContextChannel} from '../src/provider/model/ContextChannel';
import {ChannelTransport, ChannelEvents, APIFromClientTopic} from '../src/client/internal';
import {Environment, EntityType} from '../src/provider/model/Environment';
import {AppDirectory} from '../src/provider/model/AppDirectory';
import {APIHandler} from '../src/provider/APIHandler';

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
        storedContext: null,
        setLastBroadcastContext: jest.fn<void, [Context]>(),
        clearStoredContext: jest.fn<void, []>(),
        serialize: jest.fn<ChannelTransport, []>()
    };
}

export function createMockEnvironmnent(): jest.Mocked<Environment> {
    return {
        windowCreated: new Signal<[Identity]>(),
        windowClosed: new Signal<[Identity]>(),
        isRunning: jest.fn<Promise<boolean>, [Application]>(),
        createApplication: jest.fn<Promise<void>, [Application, ContextChannel]>(),
        wrapApplication: jest.fn<AppWindow, [Application, Identity, ContextChannel]>(),
        inferApplication: jest.fn<Promise<Application>, [Identity]>(),
        getEntityType: jest.fn<Promise<EntityType>, [Identity]>(),
        isWindowCreated: jest.fn<boolean, [Identity]>()
    };
}

export function createMockAppDirectory(): jest.Mocked<AppDirectory> {
    const {AppDirectory} = jest.requireMock('../src/provider/model/AppDirectory');
    return new AppDirectory();
}

export function createMockApiHandler(): jest.Mocked<APIHandler<APIFromClientTopic>> {
    const {APIHandler} = jest.requireMock('../src/provider/APIHandler');

    const apiHandler = new APIHandler() as jest.Mocked<APIHandler<APIFromClientTopic>>;

    assignMockGetter(apiHandler, 'onConnection');
    assignMockGetter(apiHandler, 'onDisconnection');

    return apiHandler;
}

/**
 * Returns the mock getter function of an object. Assumes the mock has already been assigned.
 *
 * @param mock The mock object to get a getter mock of
 * @param key The key of the mock getter to get
 */
export function getterMock<Mock extends object, Key extends keyof Mock, Value extends Mock[Key]>(mock: Mock, key: Key): jest.Mock<Value, []> {
    return Object.getOwnPropertyDescriptor(mock, key)!.get as jest.Mock<Value, []>;
}

/**
 * Returns the mock setter function of an object. Assumes the mock has already been assigned.
 *
 * @param mock The mock object to get a setter mock of
 * @param key The key of the mock setter to get
 */
export function setterMock<Mock extends object, Key extends keyof Mock, Value extends Mock[Key]>(mock: Mock, key: Key): jest.Mock<void, [Value]> {
    return Object.getOwnPropertyDescriptor(mock, key)!.set as jest.Mock<void, [Value]>;
}

function assignMockGetter<Mock extends object, Key extends keyof Mock, Value extends Mock[Key]>(mock: Mock, key: Key): void {
    Object.defineProperty(mock, key, {
        'get': jest.fn<Value, []>()
    });
}
