/* eslint-disable @typescript-eslint/no-unused-vars, no-shadow */
import {Signal} from 'openfin-service-signal';
import {Identity} from 'openfin/_v2/main';
import {Store} from 'openfin-service-config';

import {AppConnection} from '../src/provider/model/AppConnection';
import {Context, Application} from '../src/client/main';
import {ContextChannel} from '../src/provider/model/ContextChannel';
import {ChannelTransport, ChannelEvents, APIFromClientTopic, StoredAppDirectoryShard} from '../src/client/internal';
import {Environment, EntityType} from '../src/provider/model/Environment';
import {AppDirectory} from '../src/provider/model/AppDirectory';
import {APIHandler} from '../src/provider/APIHandler';
import {getId} from '../src/provider/utils/getId';
import {IntentType} from '../src/provider/intents';
import {LiveApp} from '../src/provider/model/LiveApp';
import {Model} from '../src/provider/model/Model';
import {ChannelHandler} from '../src/provider/controller/ChannelHandler';
import {AppDirectoryStorage, DomainAppDirectoryShard} from '../src/provider/model/AppDirectoryStorage';
import {ConfigStoreBinding} from '../src/provider/model/ConfigStore';
import {ConfigurationObject} from '../gen/provider/config/fdc3-config';

import {createFakeIdentity, createFakeApp} from './demo/utils/fakes';

export function createMockApiHandler(): jest.Mocked<APIHandler<APIFromClientTopic>> {
    const {APIHandler} = jest.requireMock('../src/provider/APIHandler');

    const apiHandler: jest.Mocked<APIHandler<APIFromClientTopic>> = new APIHandler();

    assignMockGetter(apiHandler, 'onConnection');
    assignMockGetter(apiHandler, 'onDisconnection');

    return apiHandler;
}

/**
 * Creates a minimal mock app window. Any utilizing test should set properties and set up mock functions as needed
 */
export function createMockAppConnection(options: Partial<jest.Mocked<AppConnection>> = {}): jest.Mocked<AppConnection> {
    const identity = createFakeIdentity();

    return {
        id: getId(identity),
        identity,
        entityType: EntityType.WINDOW,
        entityNumber: 0,
        appInfo: createFakeApp({appId: identity.uuid}),
        channel: createMockChannel(),
        intentListeners: [],
        channelContextListeners: [],
        hasIntentListener: jest.fn<boolean, [string]>(),
        addIntentListener: jest.fn<void, [string]>(),
        removeIntentListener: jest.fn<void, [string]>(),
        hasContextListener: jest.fn<boolean, []>(),
        addContextListener: jest.fn<void, []>(),
        removeContextListener: jest.fn<void, []>(),
        hasChannelContextListener: jest.fn<boolean, [ContextChannel]>(),
        addChannelContextListener: jest.fn<void, [ContextChannel]>(),
        removeChannelContextListener: jest.fn<void, [ContextChannel]>(),
        hasChannelEventListener: jest.fn<boolean, [ContextChannel, ChannelEvents['type']]>(),
        addChannelEventListener: jest.fn<void, [ContextChannel, ChannelEvents['type']]>(),
        removeChannelEventListener: jest.fn<void, [ContextChannel, ChannelEvents['type']]>(),
        bringToFront: jest.fn<Promise<void>, []>(),
        focus: jest.fn<Promise<void>, []>(),
        waitForReadyToReceiveIntent: jest.fn<Promise<void>, [IntentType]>(),
        waitForReadyToReceiveContext: jest.fn<Promise<void>, []>(),
        waitForReadyToReceiveContextOnChannel: jest.fn<Promise<void>, [ContextChannel]>(),
        removeAllListeners: jest.fn<void, []>(),
        // Apply any custom overrides
        ...options
    };
}

export function createMockAppDirectory(options: Partial<jest.Mocked<AppDirectoryStorage>> = {}): jest.Mocked<AppDirectory> {
    const {AppDirectory} = jest.requireMock('../src/provider/model/AppDirectory');
    const appDirectory: jest.Mocked<AppDirectory> = new AppDirectory();

    assignMockGetter(appDirectory, 'directoryChanged');

    // Apply any custom overrides
    Object.assign(appDirectory, options);

    return appDirectory;
}

export function createMockAppDirectoryStorage(options: Partial<jest.Mocked<AppDirectoryStorage>> = {}): jest.Mocked<AppDirectoryStorage> {
    const appDirectoryStorage = {
        changed: null! as Signal<[]>,
        getDirectoryShards: jest.fn<DomainAppDirectoryShard[], []>()
    };

    assignMockGetter(appDirectoryStorage, 'changed');

    // Apply any custom overrides
    Object.assign(appDirectoryStorage, options);

    return appDirectoryStorage;
}

export function createMockChannel(options: Partial<jest.Mocked<ContextChannel>> = {}): jest.Mocked<ContextChannel> {
    return {
        id: '',
        type: '',
        storedContext: null,
        setLastBroadcastContext: jest.fn<void, [Context]>(),
        clearStoredContext: jest.fn<void, []>(),
        serialize: jest.fn<ChannelTransport, []>(),
        // Apply any custom overrides
        ...options
    };
}

export function createMockChannelHandler(): jest.Mocked<ChannelHandler> {
    const {ChannelHandler} = jest.requireMock('../src/provider/controller/ChannelHandler');
    return new ChannelHandler();
}

export function createMockConfigStore(options: Partial<jest.Mocked<ConfigStoreBinding>> = {}): jest.Mocked<ConfigStoreBinding> {
    const configStore = {
        config: null! as Store<ConfigurationObject>,
        initialized: null! as Promise<void>
    };

    assignMockGetter(configStore, 'config');
    assignMockGetter(configStore, 'initialized');

    // Apply any custom overrides
    Object.assign(configStore, options);

    return configStore;
}

export function createMockEnvironmnent(options: Partial<jest.Mocked<Environment>> = {}): jest.Mocked<Environment> {
    return {
        onApplicationCreated: new Signal<[Identity, LiveApp]>(),
        onApplicationClosed: new Signal<[Identity]>(),
        onWindowCreated: new Signal<[Identity]>(),
        onWindowClosed: new Signal<[Identity]>(),
        createApplication: jest.fn<void, [Application]>(),
        wrapConnection: jest.fn<AppConnection, [LiveApp, Identity, EntityType, ContextChannel]>(),
        inferApplication: jest.fn<Promise<Application>, [Identity]>(),
        getEntityType: jest.fn<Promise<EntityType>, [Identity]>(),
        isKnownEntity: jest.fn<boolean, [Identity]>(),
        // Apply any custom overrides
        ...options
    };
}

export function createMockModel(): jest.Mocked<Model> {
    const {Model} = jest.requireMock('../src/provider/model/Model');
    const model: jest.Mocked<Model> = new Model();

    assignMockGetter(model, 'connections');
    assignMockGetter(model, 'apps');
    assignMockGetter(model, 'channels');
    assignMockGetter(model, 'onConnectionAdded');
    assignMockGetter(model, 'onConnectionRemoved');

    return model;
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
