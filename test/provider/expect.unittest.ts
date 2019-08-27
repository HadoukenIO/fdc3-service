import 'reflect-metadata';

import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Model, getId} from '../../src/provider/model/Model';
import {APIHandler} from '../../src/provider/APIHandler';
import {APIFromClientTopic} from '../../src/client/internal';
import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {Environment} from '../../src/provider/model/Environment';
import {createMockEnvironmnent, createMockAppWindow} from '../mocks';
import {Application} from '../../src/client/main';
import {ContextChannel} from '../../src/provider/model/ContextChannel';
import {AppWindow} from '../../src/provider/model/AppWindow';
import {advanceTime, time, useFakeTime} from '../demo/utils/time';
import {DeferredPromise} from '../../src/provider/common/DeferredPromise';
import {PartiallyWritable} from '../types';

jest.mock('../../src/provider/model/AppDirectory');
jest.mock('../../src/provider/APIHandler');

type TestWindow = {
    seenTime?: number,
    createdTime?: number,
    connectionTime?: number,
    closeTime?: number
    appType: 'directory' | 'non-directory',
}

type ExpectCall = {
    callTime: number,
    finalizeTime: number,
    result: 'resolve' | 'reject-timeout' | 'reject-closed'
}

type ExpectCallResult = {
    promise: Promise<AppWindow>,
    time: number,
    call: ExpectCall
};

type ResultParam = [string, ExpectCall];

type TestParam = [
    string,
    TestWindow,
    number,
    ExpectCall[]
];

const FAKE_TEST_DURATION = 10000;

const REGISTRATION_TIMEOUT = 5000;
const PENDING_TIMEOUT = 100;

let model: Model;

let mockAppDirectory: jest.Mocked<AppDirectory>;
let mockEnvironment: jest.Mocked<Environment>;
let mockApiHandler: jest.Mocked<APIHandler<APIFromClientTopic>>;

beforeEach(async () => {
    mockAppDirectory = new AppDirectory(null!) as jest.Mocked<AppDirectory>;
    mockEnvironment = createMockEnvironmnent();
    mockApiHandler = new APIHandler<APIFromClientTopic>() as jest.Mocked<APIHandler<APIFromClientTopic>>;
    (mockApiHandler as PartiallyWritable<typeof mockApiHandler, 'onConnection'>).onConnection = new Signal<[Identity]>();
    (mockApiHandler as PartiallyWritable<typeof mockApiHandler, 'onDisconnection'>).onDisconnection = new Signal<[Identity]>();

    model = new Model(mockAppDirectory, mockEnvironment, mockApiHandler);

    jest.resetAllMocks();
    useFakeTime();
});

describe('When creating a directory FDC3 app', () => {
    const testWindow: TestWindow = {
        seenTime: 990,
        createdTime: 1000,
        appType: 'directory'
    };

    describe('When the window is registered quickly', () => {
        expectTest(testWindow, 3000, [
            [
                'When a window is expected long before it is created, the window promise rejects',
                {callTime: 500, finalizeTime: 500 + PENDING_TIMEOUT, result: 'reject-timeout'}
            ],
            [
                'When a window is expected shortly before it is created, the window promise resolves',
                {callTime: 950, finalizeTime: 3000, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before it is registered, the window promise resolves',
                {callTime: 1500, finalizeTime: 3000, result: 'resolve'}
            ]
        ]);
    });

    describe('When the window registration is delayed due to a slow app directory', () => {
        expectTest(testWindow, 8000, [
            [
                'When a window is expected while the window is being registered, the window promise rejects',
                {callTime: 1500, finalizeTime: 990 + REGISTRATION_TIMEOUT, result: 'reject-timeout'}
            ],
            [
                'When a window is expected shortly before the window is registered, the window promise rejects',
                {callTime: 7500, finalizeTime: 7500, result: 'reject-timeout'}
            ]
        ]);
    });

    describe('When a window is closed while pending', () => {
        expectTest(
            {
                seenTime: 990,
                closeTime: 1000,
                appType: 'directory'
            },
            3000,
            [
                [
                    'When a window is expected shortly before it is created, the promise rejects',
                    {callTime: 950, finalizeTime: 1000, result: 'reject-closed'}
                ]
            ]
        );
    });

    describe('When a window is closed after being created', () => {
        expectTest(
            {
                seenTime: 990,
                createdTime: 1000,
                closeTime: 2000,
                appType: 'directory'
            },
            3000,
            [
                [
                    'When a window is expected shortly after it is created, the promise rejects',
                    {callTime: 1500, finalizeTime: 2000, result: 'reject-closed'}
                ]
            ]
        );
    });

    describe('When a window is closed after being registered', () => {
        expectTest(
            {
                seenTime: 990,
                createdTime: 1000,
                closeTime: 4000,
                appType: 'directory'
            },
            3000,
            [
                [
                    'When a window is expected after being closed, the promise rejects',
                    {callTime: 5000, finalizeTime: 5000 + PENDING_TIMEOUT, result: 'reject-timeout'}
                ]
            ]
        );
    });
});

describe('When creating a non-directory FDC3 app', () => {
    const fastConnectWindow: TestWindow = {
        seenTime: 990,
        createdTime: 1000,
        connectionTime: 4000,
        appType: 'non-directory'
    };

    const slowConnectWindow: TestWindow = {
        seenTime: 990,
        createdTime: 1000,
        connectionTime: 7000,
        appType: 'non-directory'
    };

    describe('When the window is registered quickly, and connection occurs before the app directory returns', () => {
        expectTest(fastConnectWindow, 5000, [
            [
                'When a window is expected shortly before it is created, the window promise resolves',
                {callTime: 950, finalizeTime: 5000, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before it is connected, the window promise resolves',
                {callTime: 1500, finalizeTime: 5000, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before it is registered, the window promise resolves',
                {callTime: 4500, finalizeTime: 5000, result: 'resolve'}
            ]
        ]);
    });

    describe('When the window is registered quickly, and connection occurs after of the app directory returns', () => {
        expectTest(fastConnectWindow, 3000, [
            [
                'When a window is expected shortly before it is created, the window promise resolves',
                {callTime: 950, finalizeTime: 4000, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before the app directory returns, the window promise resolves',
                {callTime: 1500, finalizeTime: 4000, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before it is registered, the window promise resolves',
                {callTime: 3500, finalizeTime: 4000, result: 'resolve'}
            ]
        ]);
    });

    describe('When the window registration is delayed due to a delayed connection', () => {
        expectTest(slowConnectWindow, 3000, [
            [
                'When a window is expected before the app directory has returned, the window promise rejects',
                {callTime: 2500, finalizeTime: 990 + REGISTRATION_TIMEOUT, result: 'reject-timeout'}
            ],
            [
                'When a window is expected after the app directory has returned but before it is registered, the window promise rejects',
                {callTime: 3500, finalizeTime: 990 + REGISTRATION_TIMEOUT, result: 'reject-timeout'}
            ],
            [
                'When a window is expected shortly before the window is registered, the window promise rejects',
                {callTime: 6500, finalizeTime: 6500, result: 'reject-timeout'}
            ]
        ]);
    });
});

function expectTest(testWindow: TestWindow, appDirectoryResultTime: number, resultParams: ResultParam[]): void {
    const testParams = buildTestParams(testWindow, appDirectoryResultTime, resultParams);

    it.each(testParams)('%s', async (titleParam: string, testWindow: TestWindow, appDirectoryResultTime: number, expectCalls: ExpectCall[]) => {
        // Setup our environment
        const identity = {uuid: 'test-window', name: 'test-window'};
        const manifestUrl = 'test-manifest-url';
        const mockApplication = {manifest: manifestUrl} as Application;

        const appDirectoryResultPromise = new DeferredPromise();

        mockAppDirectory.getAllApps.mockImplementationOnce(async (): Promise<Application[]> => {
            await appDirectoryResultPromise.promise;
            return testWindow.appType === 'directory' ? [mockApplication] : [];
        });

        mockEnvironment.wrapApplication.mockImplementationOnce((appInfo: Application, identity: Identity, channel: ContextChannel): AppWindow => {
            return {
                ...createMockAppWindow(),
                id: getId(identity),
                identity,
                appInfo
            };
        });

        mockEnvironment.inferApplication.mockImplementationOnce(async (indentity: Identity): Promise<Application> => {
            return mockApplication;
        });

        maybeSetTimeout(() => mockEnvironment.windowSeen.emit(identity), testWindow.seenTime);
        maybeSetTimeout(() => mockEnvironment.windowCreated.emit(identity, manifestUrl), testWindow.createdTime);
        maybeSetTimeout(() => mockApiHandler.onConnection.emit(identity), testWindow.connectionTime);
        maybeSetTimeout(() => mockEnvironment.windowClosed.emit(identity), testWindow.closeTime);
        maybeSetTimeout(() => appDirectoryResultPromise.resolve(), appDirectoryResultTime);

        const resultAccumulator = setupExpectCalls(identity, expectCalls);
        await advanceTime(FAKE_TEST_DURATION);

        expect(resultAccumulator.length).toEqual(expectCalls.length);
        await checkExpectResults(identity, mockApplication, resultAccumulator);
    });
}

function buildTestParams(testWindow: TestWindow, appDirectoryResultTime: number, resultParams: ResultParam[]): TestParam[] {
    if (testWindow.closeTime === undefined) {
        resultParams.push([
            'When a window is expected after the window has been registered, the window promise resolves',
            {callTime: 9500, finalizeTime: 9500, result: 'resolve'}
        ]);
    }

    const testParams: TestParam[] = resultParams.map(resultParam => ([resultParam[0], testWindow, appDirectoryResultTime, [resultParam[1]]] as TestParam));

    if (testParams.length > 1) {
        testParams.push([
            'When a window is expected multiple times, window promises resolve and reject independently',
            testWindow,
            appDirectoryResultTime,
            resultParams.map(resultParam => resultParam[1])
        ] as TestParam);
    }

    return testParams;
}

function maybeSetTimeout(fn: (() => void), time: number | undefined): void {
    if (time) {
        setTimeout(fn, time);
    }
}

function setupExpectCalls(identity: Identity, expectCalls: ExpectCall[]): ExpectCallResult[] {
    const results: ExpectCallResult[] = [];
    for (const call of expectCalls) {
        setTimeout(async () => {
            const promise = model.expectWindow(identity);
            await promise.catch(() => {});
            results.push({promise, time: time(), call});
        }, call.callTime);
    }

    return results;
}

async function checkExpectResults(identity: Identity, mockApplication: Application, results: ExpectCallResult[]): Promise<void> {
    for (const result of results) {
        if (result.call.result === 'resolve') {
            await expect(result.promise).resolves.toMatchObject({
                id: getId(identity),
                identity,
                appInfo: mockApplication
            });
        } else if (result.call.result === 'reject-timeout') {
            await expect(result.promise).rejects.toBeTruthy();
        } else {
            await expect(result.promise).rejects.toBeTruthy();
        }
        expect(result.time).toEqual(result.call.finalizeTime);
    }
}
