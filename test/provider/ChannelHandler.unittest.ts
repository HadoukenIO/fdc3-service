import 'reflect-metadata';

import {ChannelHandler} from '../../src/provider/controller/ChannelHandler';
import {Model} from '../../src/provider/model/Model';
import {Signal1} from '../../src/provider/common/Signal';
import {AppWindow} from '../../src/provider/model/AppWindow';
import {DesktopContextChannel, ContextChannel} from '../../src/provider/model/ContextChannel';
import {ChannelError, Context, FDC3ChannelEventType} from '../../src/client/main';
import {createMockChannel, createMockAppWindow} from '../mocks';

jest.mock('../../src/provider/model/Model');

const mockOnChannelChanged = jest.fn<void, [AppWindow, ContextChannel | null, ContextChannel | null]>();

let mockModel: Model;

let channelHandler: ChannelHandler;

beforeEach(() => {
    jest.resetAllMocks();

    mockModel = new Model(null!, null!, null!);
    (mockModel as any)['onWindowAdded'] = new Signal1<AppWindow>();
    (mockModel as any)['onWindowRemoved'] = new Signal1<AppWindow>();

    channelHandler = new ChannelHandler(mockModel);
    channelHandler.onChannelChanged.add((appWindow: AppWindow, channel: ContextChannel | null, previousChannel: ContextChannel | null) => {
        mockOnChannelChanged(appWindow, channel, previousChannel);
    });
});

it('When registering channels, ChannelHandler adds expected channels to the model', () => {
    channelHandler.registerChannels();

    expect(mockModel.registerChannel).toBeCalledTimes(7);
});

it('When getting desktop channels, ChannelHandler only returns desktop channels', () => {
    const testChannels = [
        {...createMockChannel(), id: 'test-1'},
        {...createMockChannel(), id: 'test-2'},
        {...createMockChannel(), id: 'test-3'}
    ];

    (testChannels[0] as any)['type'] = 'desktop';
    (testChannels[2] as any)['type'] = 'desktop';

    (mockModel as any)['channels'] = testChannels;

    expect(channelHandler.getDesktopChannels()).toEqual([testChannels[0], testChannels[2]]);
});

describe('When geting channel by ID', () => {
    it('If Model returns a channel, ChannelHandler returns the channel', () => {
        const testChannel = new DesktopContextChannel('test', 'test', 0);

        (mockModel.getChannel as jest.Mock<ContextChannel | null, [string]>).mockReturnValue(testChannel);

        expect(channelHandler.getChannelById('test')).toEqual(testChannel);
    });

    it('If Model returns null, ChannelHandler throws an exception', () => {
        (mockModel.getChannel as jest.Mock<ContextChannel | null, [string]>).mockReturnValue(null);

        expect(() => {
            channelHandler.getChannelById('test');
        }).toThrowFDC3Error(ChannelError.ChannelDoesNotExist, 'No channel with channelId: test');
    });
});

it('When getting the context of a channel, ChannelHandler returns the provided channel\'s context', () => {
    const testContext = {type: 'test'};

    const testChannel = createMockChannel();
    (testChannel.getStoredContext as jest.Mock<Context, []>).mockReturnValue(testContext);

    expect(channelHandler.getChannelContext(testChannel)).toEqual(testContext);
});

it('When getting channel members, ChannelHandler returns expected AppWindows', () => {
    const testWindows = [
        {...createMockAppWindow(), id: 'test-1'},
        {...createMockAppWindow(), id: 'test-2'},
        {...createMockAppWindow(), id: 'test-3'}
    ];

    const testChannel = createMockChannel();

    testWindows[0].channel = testChannel;
    testWindows[2].channel = testChannel;

    (mockModel as any)['windows'] = testWindows;

    expect(channelHandler.getChannelMembers(testChannel)).toEqual([testWindows[0], testWindows[2]]);
});

it('When querying which windows are listening for contexts on a channel, ChannelHander returns the expected AppWindows', () => {
    const testWindows = [
        {...createMockAppWindow(), id: 'test-1'},
        {...createMockAppWindow(), id: 'test-2'},
        {...createMockAppWindow(), id: 'test-3'}
    ];

    const testChannel = createMockChannel();

    (testWindows[0].hasContextListener as jest.Mock<boolean, [ContextChannel]>).mockImplementation((channel) => true);
    (testWindows[2].hasContextListener as jest.Mock<boolean, [ContextChannel]>).mockImplementation((channel) => true);

    (mockModel as any)['windows'] = testWindows;

    expect(channelHandler.getWindowsListeningForContextsOnChannel(testChannel)).toEqual([testWindows[0], testWindows[2]]);
});

it('When querying which windows are listening for events on a channel, ChannelHander returns the expected AppWindows', () => {
    const testWindows = [
        {...createMockAppWindow(), id: 'test-1'},
        {...createMockAppWindow(), id: 'test-2'},
        {...createMockAppWindow(), id: 'test-3'}
    ];

    const testChannel = createMockChannel();

    (testWindows[0].hasChannelEventListener as jest.Mock<boolean, [ContextChannel, FDC3ChannelEventType]>).mockImplementation((channel) => true);
    (testWindows[2].hasChannelEventListener as jest.Mock<boolean, [ContextChannel, FDC3ChannelEventType]>).mockImplementation((channel) => true);

    (mockModel as any)['windows'] = testWindows;

    expect(channelHandler.getWindowsListeningForEventsOnChannel(testChannel, 'window-added')).toEqual([testWindows[0], testWindows[2]]);
});

describe('When setting the last broadcast context for a channel', () => {
    const testChannel = createMockChannel();
    const testContext = {type: 'test'};

    let testWindow: AppWindow;

    beforeEach(() => {
        testWindow = createMockAppWindow();

        (mockModel as any)['windows'] = [testWindow];
    });

    it('If the channel is populated, ChannelHandler sets the context on the channel', () => {
        testWindow.channel = testChannel;

        channelHandler.setLastBroadcastOnChannel(testChannel, testContext);

        expect(testChannel.setLastBroadcastContext).toBeCalledWith(testContext);
    });

    it('If the channel is empty, ChannelHandler does not set the context on the channel', () => {
        channelHandler.setLastBroadcastOnChannel(testChannel, testContext);

        expect(testChannel.setLastBroadcastContext).toBeCalledTimes(0);
    });
});

describe('When joining a channel', () => {
    it('ChannelHandler sets the channel of the window', () => {
        const testChannel1 = {...createMockChannel(), id: 'test-1'};
        const testChannel2 = {...createMockChannel(), id: 'test-2'};

        const testWindow = {...createMockAppWindow(), channel: testChannel1};
        (mockModel as any).windows = [testWindow];

        channelHandler.joinChannel(testWindow, testChannel2);

        expect(testWindow.channel).toEqual(testChannel2);
    });

    it('If changing channel, ChannelHandler fires it onChannelChanged signal', () => {
        const testChannel1 = {...createMockChannel(), id: 'test-1'};
        const testChannel2 = {...createMockChannel(), id: 'test-2'};

        const testWindow = {...createMockAppWindow(), channel: testChannel1};
        (mockModel as any).windows = [testWindow];

        channelHandler.joinChannel(testWindow, testChannel2);

        expect(mockOnChannelChanged.mock.calls).toEqual([[testWindow, testChannel2, testChannel1]]);
    });

    it('If not changing channel, ChannelHandler fires a onChannelChanged signal', () => {
        const testChannel = createMockChannel();

        const testWindow = {...createMockAppWindow(), channel: testChannel};
        (mockModel as any).windows = [testWindow];

        channelHandler.joinChannel(testWindow, testChannel);

        expect(mockOnChannelChanged).toBeCalledTimes(0);
    });

    it('If the previous channel is now empty, ChannelHandler clears the context of the previous channel', () => {
        const testChannel1 = createMockChannel();
        const testChannel2 = createMockChannel();

        const testWindow = {...createMockAppWindow(), channel: testChannel1};
        (mockModel as any).windows = [testWindow];

        channelHandler.joinChannel(testWindow, testChannel2);

        expect(testChannel1.clearStoredContext).toBeCalledTimes(1);
    });

    it('If the previous channel is still populated, ChannelHandler does not clear the context of the previous channel', () => {
        const testChannel1 = createMockChannel();
        const testChannel2 = createMockChannel();

        const testWindow1 = {...createMockAppWindow(), channel: testChannel1};
        const testWindow2 = {...createMockAppWindow(), channel: testChannel1};

        (mockModel as any).windows = [testWindow1, testWindow2];

        channelHandler.joinChannel(testWindow1, testChannel2);

        expect(testChannel1.clearStoredContext).toBeCalledTimes(0);
    });
});

it('When a window is added to the Model, ChannelHandler fires a onChannelChanged signal', () => {
    const testWindow = createMockAppWindow();

    mockModel.onWindowAdded.emit(testWindow);

    expect(mockOnChannelChanged.mock.calls).toEqual([[testWindow, testWindow.channel, null]]);
});

describe('When a window is removed from the Model', () => {
    it('ChannelHandler fires a onChannelChanged signal', () => {
        const testWindow = createMockAppWindow();
        (mockModel as any).windows = [];

        mockModel.onWindowRemoved.emit(testWindow);

        expect(mockOnChannelChanged.mock.calls).toEqual([[testWindow, null, testWindow.channel]]);
    });

    it('If the window\'s channel is now empty, ChannelHandler clears the context of the channel', () => {
        const testChannel1 = createMockChannel();
        const testChannel2 = createMockChannel();

        const testWindow1 = {...createMockAppWindow(), channel: testChannel1};
        const testWindow2 = {...createMockAppWindow(), channel: testChannel2};

        (mockModel as any).windows = [testWindow2];

        mockModel.onWindowRemoved.emit(testWindow1);

        expect(testChannel1.clearStoredContext).toBeCalledTimes(1);
    });

    it('If the window\'s channel is still populated, ChannelHandler does not clear the context of the channel', () => {
        const testChannel = createMockChannel();

        const testWindow1 = {...createMockAppWindow(), channel: testChannel};
        const testWindow2 = {...createMockAppWindow(), channel: testChannel};

        (mockModel as any).windows = [testWindow2];

        mockModel.onWindowRemoved.emit(testWindow1);

        expect(testChannel.clearStoredContext).toBeCalledTimes(0);
    });
});

