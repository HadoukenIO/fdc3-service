import 'reflect-metadata';

import {Identity} from 'openfin/_v2/main';

import {ContextHandler} from '../../src/provider/controller/ContextHandler';
import {APIHandler} from '../../src/provider/APIHandler';
import {ChannelModel} from '../../src/provider/ChannelModel';
import {Signal1} from '../../src/provider/common/Signal';
import {ChannelChangedEvent, ChannelId, Channel} from '../../src/client/main';
import {AppWindow} from '../../src/provider/model/AppWindow';
import {APIFromClientTopic, APIToClientTopic, ChannelTransport} from '../../src/client/internal';
import {createMockAppWindow} from '../mocks';

jest.mock('../../src/provider/APIHandler');
jest.mock('../../src/provider/ChannelModel');

const testContext = {type: 'test-context-payload'};
const mockDispatch: jest.Mock<Promise<any>, [Identity, string, any]> = jest.fn<Promise<any>, [Identity, string, any]>();

let contextHandler: ContextHandler;
let mockGetChannelMembers: jest.Mock<Identity[], [ChannelId]>;

function createMockAppWindowWithName(name: string): AppWindow {
    const mockAppWindow: AppWindow = createMockAppWindow();
    mockAppWindow.identity = {uuid: 'test', name};

    return mockAppWindow;
}

function setChannelModelToProvideWindows(...windows: AppWindow[]): void {
    mockGetChannelMembers.mockImplementation(() => {
        return windows.map(window => (window.identity));
    });
}

beforeEach(() => {
    jest.resetAllMocks();

    const mockApiHandler = new APIHandler<APIFromClientTopic>();
    // Set up channel.dispatch on our mock APIHandler so we can spy on it
    (mockApiHandler as any)['channel'] = {dispatch: mockDispatch};

    const mockChannelModel = new ChannelModel(null!);
    // Modify default mock ChannelModel just enough to let ContextHandler work
    (mockChannelModel.getChannelForWindow as jest.Mock<ChannelTransport, [Identity]>).mockImplementation((identity: Identity) => {
        return {id: 'test', type: 'user', name: 'test', color: 0};
    });
    (mockChannelModel as any)['onChannelChanged'] = new Signal1<ChannelChangedEvent>();
    // Grab getChannelMembers so we can control its result for each test
    mockGetChannelMembers = mockChannelModel.getChannelMembers as jest.Mock<Identity[], [ChannelId]>;

    contextHandler = new ContextHandler(mockApiHandler, mockChannelModel);
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

        setChannelModelToProvideWindows(sourceAppWindow);

        await contextHandler.broadcast(testContext, sourceAppWindow.identity);

        expect(mockDispatch).toBeCalledTimes(0);
    });

    it('When ContextModel provides multiple windows, all windows except the source window are dispatched to', async () => {
        const sourceAppWindow = createMockAppWindowWithName('source');
        const targetAppWindow1 = createMockAppWindowWithName('target-1');
        const targetAppWindow2 = createMockAppWindowWithName('target-2');

        setChannelModelToProvideWindows(sourceAppWindow, targetAppWindow1, targetAppWindow2);

        await contextHandler.broadcast(testContext, sourceAppWindow.identity);

        expect(mockDispatch).toBeCalledTimes(2);

        expect(mockDispatch.mock.calls).toContainEqual([targetAppWindow1.identity, APIToClientTopic.CONTEXT, testContext]);
        expect(mockDispatch.mock.calls).toContainEqual([targetAppWindow2.identity, APIToClientTopic.CONTEXT, testContext]);
    });
});
