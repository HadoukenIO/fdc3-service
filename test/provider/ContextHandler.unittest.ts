import 'reflect-metadata';

import {ContextHandler} from '../../src/provider/controller/ContextHandler';
import {AppWindow} from '../../src/provider/model/AppWindow';
import {APIToClientTopic, ReceiveContextPayload} from '../../src/client/internal';
import {createMockAppWindow, createMockChannel, createMockChannelHandler, createMockModel, createMockApiHandler, getterMock} from '../mocks';
import {ContextChannel} from '../../src/provider/model/ContextChannel';

let contextHandler: ContextHandler;

const testContext = {type: 'test-context-payload'};

const mockChannelHandler = createMockChannelHandler();
const mockModel = createMockModel();
const mockApiHandler = createMockApiHandler();

const mockGetChannelMembers = mockChannelHandler.getChannelMembers;
const mockGetWindowsListeningForContextsOnChannel = mockChannelHandler.getWindowsListeningForContextsOnChannel;
const mockDispatch = mockApiHandler.dispatch;

const mockWindows: AppWindow[] = [];

beforeEach(() => {
    jest.resetAllMocks();
    mockWindows.length = 0;

    mockGetChannelMembers.mockReturnValue([]);
    mockGetWindowsListeningForContextsOnChannel.mockReturnValue([]);

    getterMock(mockModel, 'windows').mockReturnValue(mockWindows);
    getterMock(mockModel, 'apps').mockReturnValue([]);

    contextHandler = new ContextHandler(mockApiHandler, mockChannelHandler, mockModel);
});

describe('When sending a Context using ContextHandler', () => {
    describe('When the targeted window is ready to receive it', () => {
        it('The provided Context is dispatched to the expected target', async () => {
            const targetAppWindow = setupCustomMockAppWindow('target', true);
            const expectedPayload: ReceiveContextPayload = {context: testContext};

            await contextHandler.send(targetAppWindow, testContext);

            expect(mockDispatch).toBeCalledWith(targetAppWindow.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload);
        });
    });

    describe('When the targeted window is not ready to receive it', () => {
        it('The send call resolves', async () => {
            const targetAppWindow = setupCustomMockAppWindow('target', false);

            await contextHandler.send(targetAppWindow, testContext);
        });

        it('Dispatch is not called', async () => {
            const targetAppWindow = setupCustomMockAppWindow('target', false);

            await contextHandler.send(targetAppWindow, testContext);

            expect(mockDispatch).not.toBeCalled();
        });
    });
});

describe('When broadcasting a Context using ContextHandler', () => {
    describe('When all relevant windows are ready to receive intents', () => {
        it('When ChannelHandler provides only the source window, the Context is not dispatched', async () => {
            const sourceAppWindow = setupCustomMockAppWindow('source', true);

            mockGetChannelMembers.mockReturnValue([sourceAppWindow]);

            await contextHandler.broadcast(testContext, sourceAppWindow);

            expect(mockDispatch).toBeCalledTimes(0);
        });

        it('The relevant channel has its last broadcast context set', async () => {
            const sourceAppWindow = setupCustomMockAppWindow('source', true);

            mockGetChannelMembers.mockReturnValue([sourceAppWindow]);

            await contextHandler.broadcast(testContext, sourceAppWindow);

            expect(mockChannelHandler.setLastBroadcastOnChannel).toBeCalledWith(sourceAppWindow.channel, testContext);
        });

        it('When ChannelHandler provides multiple channel member windows, all windows except the source window are dispatched to', async () => {
            const sourceAppWindow = setupCustomMockAppWindow('source', true);
            const targetAppWindow1 = setupCustomMockAppWindow('target-1', true);
            const targetAppWindow2 = setupCustomMockAppWindow('target-2', true);
            const expectedPayload: ReceiveContextPayload = {context: testContext};

            mockGetChannelMembers.mockReturnValue([sourceAppWindow, targetAppWindow1, targetAppWindow2]);

            await contextHandler.broadcast(testContext, sourceAppWindow);

            expect(mockDispatch).toBeCalledTimes(2);

            expect(mockDispatch.mock.calls).toContainEqual([targetAppWindow1.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload]);
            expect(mockDispatch.mock.calls).toContainEqual([targetAppWindow2.identity, APIToClientTopic.RECEIVE_CONTEXT, expectedPayload]);
        });

        it('When ChannelHandler provides multiple listening windows, all windows except the source window are dispatched to', async () => {
            const sourceAppWindow = setupCustomMockAppWindow('source', true);
            const targetAppWindow1 = setupCustomMockAppWindow('target-1', true);
            const targetAppWindow2 = setupCustomMockAppWindow('target-2', true);

            const channel = createMockChannel({id: 'source-channel'});

            sourceAppWindow.channel = channel;

            setWindowsListeningToChannel([sourceAppWindow, targetAppWindow1, targetAppWindow2], channel);

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
            const sourceAppWindow = setupCustomMockAppWindow('source', true);
            const targetAppWindow1 = setupCustomMockAppWindow('target-1', true);
            const targetAppWindow2 = setupCustomMockAppWindow('target-2', true);
            const expectedPayload: ReceiveContextPayload = {context: testContext};

            const channel = createMockChannel({id: 'source-channel'});

            sourceAppWindow.channel = channel;
            mockGetChannelMembers.mockReturnValue([sourceAppWindow, targetAppWindow1, targetAppWindow2]);

            setWindowsListeningToChannel([sourceAppWindow, targetAppWindow1, targetAppWindow2], channel);

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
        const sourceAppWindow = setupCustomMockAppWindow('source', true);
        const readyAppWindow1 = setupCustomMockAppWindow('target-1', true);
        const readyAppWindow2 = setupCustomMockAppWindow('target-2', true);
        const notReadyAppWindow1 = setupCustomMockAppWindow('target-3', false);
        const notReadyAppWindow2 = setupCustomMockAppWindow('target-4', false);

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

function setupCustomMockAppWindow(name: string, listensForContext: boolean): jest.Mocked<AppWindow> {
    const mockWindow = createMockAppWindow({
        identity: {uuid: 'test', name},
        waitForReadyToReceiveContext: listensForContext ? jest.fn().mockResolvedValue(undefined) : jest.fn().mockRejectedValue(undefined)
    });

    mockWindows.push(mockWindow);

    return mockWindow;
}

function setWindowsListeningToChannel(windows: jest.Mocked<AppWindow>[], channel: ContextChannel): void {
    mockGetWindowsListeningForContextsOnChannel.mockImplementation(((testChannel) => testChannel.id === channel.id ? windows : []));

    for (const window of windows) {
        window.waitForReadyToReceiveContextOnChannel.mockImplementation((testChannel) => {
            return testChannel.id === channel.id ? Promise.resolve() : Promise.reject(new Error());
        });
    }
}
