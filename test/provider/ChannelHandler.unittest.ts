import 'reflect-metadata';
import {Signal} from 'openfin-service-signal';

import {ChannelHandler} from '../../src/provider/controller/ChannelHandler';
import {Model} from '../../src/provider/model/Model';
import {AppConnection} from '../../src/provider/model/AppConnection';
import {SystemContextChannel, ContextChannel} from '../../src/provider/model/ContextChannel';
import {ChannelError} from '../../src/client/main';
import {createMockChannel, createMockAppConnection} from '../mocks';
import {PartiallyWritable} from '../types';

jest.mock('../../src/provider/model/Model');

const mockOnChannelChanged = jest.fn<void, [AppConnection, ContextChannel | null, ContextChannel | null]>();

let mockModel: jest.Mocked<Model>;

let channelHandler: ChannelHandler;

beforeEach(() => {
    jest.resetAllMocks();

    mockModel = new Model(null!, null!, null!) as jest.Mocked<Model>;

    (mockModel as PartiallyWritable<typeof mockModel, 'onConnectionAdded'>).onConnectionAdded = new Signal<[AppConnection]>();
    (mockModel as PartiallyWritable<typeof mockModel, 'onConnectionRemoved'>).onConnectionRemoved = new Signal<[AppConnection]>();

    channelHandler = new ChannelHandler(mockModel);
    channelHandler.onChannelChanged.add(async (connection: AppConnection, channel: ContextChannel | null, previousChannel: ContextChannel | null) => {
        mockOnChannelChanged(connection, channel, previousChannel);
    });
});

it('When getting system channels, ChannelHandler only returns system channels', () => {
    const testChannels = [
        createMockChannel({id: 'test-1', type: 'system'}),
        createMockChannel({id: 'test-2'}),
        createMockChannel({id: 'test-3', type: 'system'})
    ];

    setModelChannels(testChannels);

    expect(channelHandler.getSystemChannels()).toEqual([testChannels[0], testChannels[2]]);
});

describe('When getting an app channel by name', () => {
    it('When getting a channel by name for the first time, a new channel is created and added to the Model', () => {
        mockModel.getChannel.mockReturnValue(null);

        const appChannel = channelHandler.getAppChannelByName('test');

        expect(mockModel.setChannel).toBeCalledTimes(1);
        expect(mockModel.setChannel).toBeCalledWith(appChannel);
    });

    it('When getting a channel by name that is already in the model, that app channel is returned', () => {
        const appChannel1 = createMockChannel();

        mockModel.getChannel.mockReturnValue(appChannel1);

        const appChannel2 = channelHandler.getAppChannelByName('test');

        expect(appChannel2).toBe(appChannel1);
        expect(mockModel.setChannel).toBeCalledTimes(0);
    });
});

describe('When geting channel by ID', () => {
    it('If Model returns a channel, ChannelHandler returns the channel', () => {
        const testChannel = new SystemContextChannel('test', {name: 'test', color: '#000000', glyph: ''});

        mockModel.getChannel.mockReturnValue(testChannel);

        expect(channelHandler.getChannelById('test')).toEqual(testChannel);
    });

    it('If Model returns null, ChannelHandler throws an exception', () => {
        mockModel.getChannel.mockReturnValue(null);

        expect(() => {
            channelHandler.getChannelById('test');
        }).toThrowFDC3Error(ChannelError.ChannelWithIdDoesNotExist, 'No channel with channelId: test');
    });
});

it('When getting the context of a channel, ChannelHandler returns the provided channel\'s context', () => {
    const testContext = {type: 'test'};

    const testChannel = createMockChannel();
    (testChannel as PartiallyWritable<ContextChannel, 'storedContext'>).storedContext = testContext;

    expect(channelHandler.getChannelContext(testChannel)).toEqual(testContext);
});

it('When getting channel members, ChannelHandler returns expected AppWindows', () => {
    const testChannel = createMockChannel();

    const testWindows = [
        createMockAppConnection({id: 'test-1', channel: testChannel}),
        createMockAppConnection({id: 'test-2'}),
        createMockAppConnection({id: 'test-3', channel: testChannel})
    ];

    setModelConnections(testWindows);

    expect(channelHandler.getChannelMembers(testChannel)).toEqual([testWindows[0], testWindows[2]]);
});

it('When querying which windows are listening for contexts on a channel, ChannelHander returns the expected AppWindows', () => {
    const testWindows = [
        createMockAppConnection({id: 'test-1'}),
        createMockAppConnection({id: 'test-2'}),
        createMockAppConnection({id: 'test-3'})
    ];

    const testChannel = createMockChannel();

    testWindows[0].hasChannelContextListener.mockImplementation((channel) => true);
    testWindows[2].hasChannelContextListener.mockImplementation((channel) => true);

    setModelConnections(testWindows);

    expect(channelHandler.getConnectionsListeningForContextsOnChannel(testChannel)).toEqual([testWindows[0], testWindows[2]]);
});

it('When querying which windows are listening for events on a channel, ChannelHander returns the expected AppWindows', () => {
    const testWindows = [
        createMockAppConnection({id: 'test-1'}),
        createMockAppConnection({id: 'test-2'}),
        createMockAppConnection({id: 'test-3'})
    ];

    const testChannel = createMockChannel();

    testWindows[0].hasChannelEventListener.mockImplementation((channel) => true);
    testWindows[2].hasChannelEventListener.mockImplementation((channel) => true);

    setModelConnections(testWindows);

    expect(channelHandler.getConnectionsListeningForEventsOnChannel(testChannel, 'window-added')).toEqual([testWindows[0], testWindows[2]]);
});

describe('When setting the last broadcast context for a channel', () => {
    const testChannel = createMockChannel();
    const testContext = {type: 'test'};

    let testConnection: AppConnection;

    beforeEach(() => {
        testConnection = createMockAppConnection();

        setModelConnections([testConnection]);
    });

    it('If the channel is populated, ChannelHandler sets the context on the channel', () => {
        testConnection.channel = testChannel;

        channelHandler.setLastBroadcastOnChannel(testChannel, testContext);

        expect(testChannel.setLastBroadcastContext).toBeCalledWith(testContext);
    });

    it('If the channel is empty, ChannelHandler does not set the context on the channel', () => {
        channelHandler.setLastBroadcastOnChannel(testChannel, testContext);

        expect(testChannel.setLastBroadcastContext).toBeCalledTimes(0);
    });
});

describe('When joining a channel', () => {
    it('ChannelHandler sets the channel of the window', async () => {
        const testChannel1 = createMockChannel({id: 'test-1'});
        const testChannel2 = createMockChannel({id: 'test-2'});

        const testWindow = createMockAppConnection({channel: testChannel1});
        setModelConnections([testWindow]);

        await channelHandler.joinChannel(testWindow, testChannel2);

        expect(testWindow.channel).toEqual(testChannel2);
    });

    it('If changing channel, ChannelHandler fires it onChannelChanged signal', async () => {
        const testChannel1 = createMockChannel({id: 'test-1'});
        const testChannel2 = createMockChannel({id: 'test-2'});

        const testWindow = createMockAppConnection({channel: testChannel1});
        setModelConnections([testWindow]);

        await channelHandler.joinChannel(testWindow, testChannel2);

        expect(mockOnChannelChanged.mock.calls).toEqual([[testWindow, testChannel2, testChannel1]]);
    });

    it('If not changing channel, ChannelHandler fires a onChannelChanged signal', async () => {
        const testChannel = createMockChannel();

        const testWindow = createMockAppConnection({channel: testChannel});
        setModelConnections([testWindow]);

        await channelHandler.joinChannel(testWindow, testChannel);

        expect(mockOnChannelChanged).toBeCalledTimes(0);
    });

    it('If the previous channel is now empty, ChannelHandler clears the context of the previous channel', async () => {
        const testChannel1 = createMockChannel();
        const testChannel2 = createMockChannel();

        const testWindow = createMockAppConnection({channel: testChannel1});
        setModelConnections([testWindow]);

        await channelHandler.joinChannel(testWindow, testChannel2);

        expect(testChannel1.clearStoredContext).toBeCalledTimes(1);
    });

    it('If the previous channel is still populated, ChannelHandler does not clear the context of the previous channel', async () => {
        const testChannel1 = createMockChannel();
        const testChannel2 = createMockChannel();

        const testWindow1 = createMockAppConnection({channel: testChannel1});
        const testWindow2 = createMockAppConnection({channel: testChannel1});

        setModelConnections([testWindow1, testWindow2]);

        await channelHandler.joinChannel(testWindow1, testChannel2);

        expect(testChannel1.clearStoredContext).toBeCalledTimes(0);
    });
});

it('When a window is added to the Model, ChannelHandler fires a onChannelChanged signal', () => {
    const testWindow = createMockAppConnection();

    mockModel.onConnectionAdded.emit(testWindow);

    expect(mockOnChannelChanged.mock.calls).toEqual([[testWindow, testWindow.channel, null]]);
});

describe('When a window is removed from the Model', () => {
    it('ChannelHandler fires a onChannelChanged signal', () => {
        const testWindow = createMockAppConnection();
        setModelConnections([]);

        mockModel.onConnectionRemoved.emit(testWindow);

        expect(mockOnChannelChanged.mock.calls).toEqual([[testWindow, null, testWindow.channel]]);
    });

    it('If the window\'s channel is now empty, ChannelHandler clears the context of the channel', () => {
        const testChannel1 = createMockChannel();
        const testChannel2 = createMockChannel();

        const testWindow1 = createMockAppConnection({channel: testChannel1});
        const testWindow2 = createMockAppConnection({channel: testChannel2});

        setModelConnections([testWindow2]);

        mockModel.onConnectionRemoved.emit(testWindow1);

        expect(testChannel1.clearStoredContext).toBeCalledTimes(1);
    });

    it('If the window\'s channel is still populated, ChannelHandler does not clear the context of the channel', () => {
        const testChannel = createMockChannel();

        const testWindow1 = createMockAppConnection({channel: testChannel});
        const testWindow2 = createMockAppConnection({channel: testChannel});

        setModelConnections([testWindow2]);

        mockModel.onConnectionRemoved.emit(testWindow1);

        expect(testChannel.clearStoredContext).toBeCalledTimes(0);
    });
});

function setModelChannels(channels: ContextChannel[]): void {
    Object.defineProperty(mockModel, 'channels', {
        get: () => channels
    });
}

function setModelConnections(connections: AppConnection[]): void {
    Object.defineProperty(mockModel, 'connections', {
        get: () => connections
    });
}
