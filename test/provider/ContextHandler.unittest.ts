import 'reflect-metadata';

import {Identity} from 'openfin/_v2/main';
import {ChannelProvider} from 'openfin/_v2/api/interappbus/channel/provider';

import {ContextHandler} from '../../src/provider/controller/ContextHandler';
import {APIHandler} from '../../src/provider/APIHandler';
import {AppWindow} from '../../src/provider/model/AppWindow';
import {APIFromClientTopic, APIToClientTopic, ReceiveContextPayload} from '../../src/client/internal';
import {createMockAppWindow, createMockChannel} from '../mocks';
import {ChannelHandler} from '../../src/provider/controller/ChannelHandler';
import {ContextChannel} from '../../src/provider/model/ContextChannel';

jest.mock('../../src/provider/controller/ChannelHandler');

const testContext = {type: 'test-context-payload'};
const mockDispatch = jest.fn<Promise<any>, [Identity, string, any]>();

let contextHandler: ContextHandler;

let mockChannelHandler: ChannelHandler;
let mockApiHandler: APIHandler<APIFromClientTopic>;

let mockGetChannelMembers: jest.Mock<AppWindow[], [ContextChannel]>;
let mockGetWindowsListeningToChannel: jest.Mock<AppWindow[], [ContextChannel]>;

function createCustomMockAppWindow(name: string, listensForContext: boolean): AppWindow {
    return createMockAppWindow({
        identity: {uuid: 'test', name},
        waitForReadyToReceiveContext: listensForContext ? jest.fn().mockResolvedValue(undefined) : jest.fn().mockRejectedValue(undefined)
    });
}

beforeEach(() => {
    jest.resetAllMocks();

    mockChannelHandler = new ChannelHandler(null!);
    // Grab getChannelMembers and getWindowsListeningToChannel so we can control their result for each test
    mockGetChannelMembers = mockChannelHandler.getChannelMembers as jest.Mock<AppWindow[], [ContextChannel]>;
    mockGetWindowsListeningToChannel = mockChannelHandler.getWindowsListeningForContextsOnChannel as jest.Mock<AppWindow[], [ContextChannel]>;

    mockGetChannelMembers.mockReturnValue([]);
    mockGetWindowsListeningToChannel.mockReturnValue([]);

    mockApiHandler = new APIHandler<APIFromClientTopic>();
    // Set up _providerChannel on our mock APIHandler so we can spy on it
    mockDispatch.mockResolvedValue(undefined);
    mockApiHandler['_providerChannel'] = {dispatch: mockDispatch} as unknown as ChannelProvider;

    contextHandler = new ContextHandler(mockChannelHandler, mockApiHandler);
});

describe('When sending a Context using ContextHandler', () => {
    describe('When the targeted window is ready to receive it', () => {
        it('The provided Context is dispatched to the expected target', async () => {
            const targetAppWindow = createCustomMockAppWindow('target', true);
            const expectedPayload: ReceiveContextPayload = {context: testContext};

            await contextHandler.send(targetAppWindow, testContext);

            expect(mockDispatch).toBeCalledWith(targetAppWindow.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload);
        });
    });

    describe('When the targeted window is not ready to receive it', () => {
        it('The send call resolves', async () => {
            const targetAppWindow = createCustomMockAppWindow('target', false);

            await expect(contextHandler.send(targetAppWindow, testContext)).resolves;
        });

        it('Dispatch is not called', async () => {
            const targetAppWindow = createCustomMockAppWindow('target', false);

            await contextHandler.send(targetAppWindow, testContext);

            expect(mockDispatch).not.toBeCalled();
        });
    });
});

describe('When broadcasting a Context using ContextHandler', () => {
    describe('When all relevant windows are ready to receive intents', () => {
        it('When ChannelHandler provides only the source window, the Context is not dispatched', async () => {
            const sourceAppWindow = createCustomMockAppWindow('source', true);

            mockGetChannelMembers.mockReturnValue([sourceAppWindow]);

            await contextHandler.broadcast(testContext, sourceAppWindow);

            expect(mockDispatch).toBeCalledTimes(0);
        });

        it('The relevant channel has its last broadcast context set', async () => {
            const sourceAppWindow = createCustomMockAppWindow('source', true);

            mockGetChannelMembers.mockReturnValue([sourceAppWindow]);

            await contextHandler.broadcast(testContext, sourceAppWindow);

            expect(mockChannelHandler.setLastBroadcastOnChannel).toBeCalledWith(sourceAppWindow.channel, testContext);
        });

        it('When ChannelHandler provides multiple channel member windows, all windows except the source window are dispatched to', async () => {
            const sourceAppWindow = createCustomMockAppWindow('source', true);
            const targetAppWindow1 = createCustomMockAppWindow('target-1', true);
            const targetAppWindow2 = createCustomMockAppWindow('target-2', true);
            const expectedPayload: ReceiveContextPayload = {context: testContext};

            mockGetChannelMembers.mockReturnValue([sourceAppWindow, targetAppWindow1, targetAppWindow2]);

            await contextHandler.broadcast(testContext, sourceAppWindow);

            expect(mockDispatch).toBeCalledTimes(2);

            expect(mockDispatch.mock.calls).toContainEqual([targetAppWindow1.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload]);
            expect(mockDispatch.mock.calls).toContainEqual([targetAppWindow2.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload]);
        });

        it('When ChannelHandler provides multiple listening windows, all windows except the source window are dispatched to', async () => {
            const sourceAppWindow = createCustomMockAppWindow('source', true);
            const targetAppWindow1 = createCustomMockAppWindow('target-1', true);
            const targetAppWindow2 = createCustomMockAppWindow('target-2', true);

            sourceAppWindow.channel = createMockChannel({id: 'source-channel'});
            mockGetWindowsListeningToChannel.mockReturnValue([sourceAppWindow, targetAppWindow1, targetAppWindow2]);

            await contextHandler.broadcast(testContext, sourceAppWindow);

            expect(mockDispatch).toBeCalledTimes(2);

            expect(mockDispatch.mock.calls).toContainEqual([
                targetAppWindow1.identity,
                APIToClientTopic.CHANNEL_RECEIVE_CONTEXT,
                {context: testContext, channel: 'source-channel'}
            ]);
            expect(mockDispatch.mock.calls).toContainEqual([
                targetAppWindow2.identity,
                APIToClientTopic.CHANNEL_RECEIVE_CONTEXT,
                {context: testContext, channel: 'source-channel'}
            ]);
        });

        it('When ChannelHandler provides both listening and channel member windows, all windows except the source window are dispatched to', async () => {
            const sourceAppWindow = createCustomMockAppWindow('source', true);
            const targetAppWindow1 = createCustomMockAppWindow('target-1', true);
            const targetAppWindow2 = createCustomMockAppWindow('target-2', true);
            const expectedPayload: ReceiveContextPayload = {context: testContext};

            sourceAppWindow.channel = createMockChannel({id: 'source-channel'});
            mockGetChannelMembers.mockReturnValue([sourceAppWindow, targetAppWindow1, targetAppWindow2]);
            mockGetWindowsListeningToChannel.mockReturnValue([sourceAppWindow, targetAppWindow1, targetAppWindow2]);

            await contextHandler.broadcast(testContext, sourceAppWindow);

            expect(mockDispatch).toBeCalledTimes(4);

            expect(mockDispatch.mock.calls).toContainEqual([targetAppWindow1.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload]);
            expect(mockDispatch.mock.calls).toContainEqual([targetAppWindow2.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload]);

            expect(mockDispatch.mock.calls).toContainEqual([
                targetAppWindow1.identity,
                APIToClientTopic.CHANNEL_RECEIVE_CONTEXT,
                {context: testContext, channel: 'source-channel'}
            ]);
            expect(mockDispatch.mock.calls).toContainEqual([
                targetAppWindow2.identity,
                APIToClientTopic.CHANNEL_RECEIVE_CONTEXT,
                {context: testContext, channel: 'source-channel'}
            ]);
        });
    });

    it('When some windows are ready to receive contexts and some are not, only the ready windows are dispatched to', async () => {
        const sourceAppWindow = createCustomMockAppWindow('source', true);
        const readyAppWindow1 = createCustomMockAppWindow('target-1', true);
        const readyAppWindow2 = createCustomMockAppWindow('target-2', true);
        const notReadyAppWindow1 = createCustomMockAppWindow('target-3', false);
        const notReadyAppWindow2 = createCustomMockAppWindow('target-4', false);

        const expectedPayload: ReceiveContextPayload = {context: testContext};

        sourceAppWindow.channel = createMockChannel({id: 'source-channel'});
        mockGetChannelMembers.mockReturnValue([sourceAppWindow, readyAppWindow1, readyAppWindow2, notReadyAppWindow1, notReadyAppWindow2]);

        await contextHandler.broadcast(testContext, sourceAppWindow);

        expect(mockDispatch).toBeCalledTimes(2);

        expect(mockDispatch.mock.calls).toContainEqual([readyAppWindow1.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload]);
        expect(mockDispatch.mock.calls).toContainEqual([readyAppWindow2.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload]);

        expect(mockDispatch.mock.calls).not.toContainEqual([notReadyAppWindow1.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload]);
        expect(mockDispatch.mock.calls).not.toContainEqual([notReadyAppWindow2.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload]);
    });
});
