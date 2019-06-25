import 'reflect-metadata';

import {Identity} from 'openfin/_v2/main';

import {ContextHandler} from '../../src/provider/controller/ContextHandler';
import {APIHandler} from '../../src/provider/APIHandler';
import {AppWindow} from '../../src/provider/model/AppWindow';
import {APIFromClientTopic, APIToClientTopic} from '../../src/client/internal';
import {createMockAppWindow} from '../mocks';
import {ChannelHandler} from '../../src/provider/controller/ChannelHandler';
import {ContextChannel} from '../../src/provider/model/ContextChannel';

jest.mock('../../src/provider/controller/ChannelHandler');
jest.mock('../../src/provider/APIHandler');

const testContext = {type: 'test-context-payload'};
const mockDispatch: jest.Mock<Promise<any>, [Identity, string, any]> = jest.fn<Promise<any>, [Identity, string, any]>();

let contextHandler: ContextHandler;

let mockChannelHandler: ChannelHandler;
let mockApiHandler: APIHandler<APIFromClientTopic>;

let mockGetChannelMembers: jest.Mock<AppWindow[], [ContextChannel]>;
let mockGetWindowsListeningToChannel: jest.Mock<AppWindow[], [ContextChannel]>;

function createMockAppWindowWithName(name: string): AppWindow {
    const mockAppWindow: AppWindow = createMockAppWindow();
    mockAppWindow.identity = {uuid: 'test', name};

    return mockAppWindow;
}

beforeEach(() => {
    jest.resetAllMocks();

    mockChannelHandler = new ChannelHandler(null!);
    // Grab getChannelMembers and getWindowsListeningToChannel so we can control their result for each test
    mockGetChannelMembers = mockChannelHandler.getChannelMembers as jest.Mock<AppWindow[], [ContextChannel]>;
    mockGetWindowsListeningToChannel = mockChannelHandler.getWindowsListeningToChannel as jest.Mock<AppWindow[], [ContextChannel]>;

    mockGetChannelMembers.mockReturnValue([]);
    mockGetWindowsListeningToChannel.mockReturnValue([]);

    mockApiHandler = new APIHandler<APIFromClientTopic>();
    // Set up channel.dispatch on our mock APIHandler so we can spy on it
    (mockApiHandler as any)['channel'] = {dispatch: mockDispatch};

    contextHandler = new ContextHandler(mockChannelHandler, mockApiHandler);
});

describe('When sending a Context using ContextHandler', () => {
    it('The provided Context is dispatched to the expected target', async () => {
        const targetAppWindow = createMockAppWindowWithName('target');

        await contextHandler.send(targetAppWindow, testContext);

        expect(mockDispatch).toBeCalledWith(targetAppWindow.identity, APIToClientTopic.CONTEXT, testContext);
    });
});

describe('When broadcasting a Context using ContextHandler', () => {
    it('When ContextModel provides only the source window, the Context is not dispatched', async () => {
        const sourceAppWindow = createMockAppWindowWithName('source');

        mockGetChannelMembers.mockReturnValue([sourceAppWindow]);

        await contextHandler.broadcast(testContext, sourceAppWindow);

        expect(mockDispatch).toBeCalledTimes(0);
    });

    it('The relevant channel has its last broadcast context set', async () => {
        const sourceAppWindow = createMockAppWindowWithName('source');

        mockGetChannelMembers.mockReturnValue([sourceAppWindow]);

        await contextHandler.broadcast(testContext, sourceAppWindow);

        expect(mockChannelHandler.setLastBroadcastOnChannel).toBeCalledWith(sourceAppWindow.channel, testContext);
    });

    it('When ContextModel provides multiple windows, all windows except the source window are dispatched to', async () => {
        const sourceAppWindow = createMockAppWindowWithName('source');
        const targetAppWindow1 = createMockAppWindowWithName('target-1');
        const targetAppWindow2 = createMockAppWindowWithName('target-2');

        mockGetChannelMembers.mockReturnValue([sourceAppWindow, targetAppWindow1, targetAppWindow2]);

        await contextHandler.broadcast(testContext, sourceAppWindow);

        expect(mockDispatch).toBeCalledTimes(2);

        expect(mockDispatch.mock.calls).toContainEqual([targetAppWindow1.identity, APIToClientTopic.CONTEXT, testContext]);
        expect(mockDispatch.mock.calls).toContainEqual([targetAppWindow2.identity, APIToClientTopic.CONTEXT, testContext]);
    });
});
