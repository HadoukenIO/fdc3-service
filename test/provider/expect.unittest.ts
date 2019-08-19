import 'reflect-metadata';

import {Identity} from 'openfin/_v2/main';

import {Model, getId} from '../../src/provider/model/Model';
import {APIHandler} from '../../src/provider/APIHandler';
import {APIFromClientTopic} from '../../src/client/internal';
import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {Environment} from '../../src/provider/model/Environment';
import {createMockEnvironmnent, createMockAppWindow} from '../mocks';
import {Application} from '../../src/client/main';
import {ContextChannel} from '../../src/provider/model/ContextChannel';
import {AppWindow} from '../../src/provider/model/AppWindow';
import { DeferredPromise } from '../../src/provider/utils/async';
import { Boxed } from '../../src/provider/utils/types';

jest.mock('../../src/provider/model/AppDirectory');

type Timing = {
    pendingTime?: number,
    createdTime?: number,
    connectionTime?: number,
    closeTime?: number,
    appDirectoryResultTime?: number
};

type ExpectCall = {
    callTime: number,
    finalizeTime: number,
    result: 'resolve' | 'reject'
}

type ExpectCallResult = {
    promise: Promise<AppWindow>,
    time: number,
    call: ExpectCall
};

type ResultParam = [string, ExpectCall];

type TestParam = [
    string,
    'directory' | 'non-directory',
    Timing,
    ExpectCall[]
];

const REGISTRATION_TIMEOUT = 5000;
const PENDING_TIMEOUT = 100;

let model: Model;

let mockAppDirectory: jest.Mocked<AppDirectory>;
let mockEnvironment: jest.Mocked<Environment>;
let mockApiHandler: APIHandler<APIFromClientTopic>;

beforeEach(async () => {
    mockAppDirectory = new AppDirectory() as jest.Mocked<AppDirectory>;
    mockEnvironment = createMockEnvironmnent();
    mockApiHandler = new APIHandler<APIFromClientTopic>();

    model = new Model(mockAppDirectory, mockEnvironment, mockApiHandler);

    jest.resetAllMocks();
    jest.useFakeTimers();
});

describe('When creating a directory FDC3 app', () => {
    describe('When the window is registered quickly', () => {
        const timings = {
            pendingTime: 990,
            createdTime: 1000,
            appDirectoryResultTime: 3000
        };

        expectTest('directory', timings, [
            [
                'When a window is expected long before it is created, the window promise rejects',
                {callTime: 500, finalizeTime: 500 + PENDING_TIMEOUT, result: 'reject'}
            ],
            [
                'When a window is expected shortly before it is created, the window promise resolves',
                {callTime: 950, finalizeTime: 3000, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before it is registered, the window promise resolves',
                {callTime: 1500, finalizeTime: 3000, result: 'resolve'}
            ],
        ]);
    });

    describe('When the window registration is delayed due to a slow app directory', () => {
        const timings = {
            pendingTime: 990,
            createdTime: 1000,
            appDirectoryResultTime: 8000
        };

        expectTest('directory', timings, [
            [
                'When a window is expected while the window is being registered, the window promise rejects',
                {callTime: 1500, finalizeTime: 990 + REGISTRATION_TIMEOUT, result: 'reject'}
            ],
            [
                'When a window is expected shortly before the window is registered, the window promise rejects',
                {callTime: 7500, finalizeTime: 7500, result: 'reject'}
            ],
        ]);
    });
});

describe('When creating a non-directory FDC3 app', () => {
    describe('When the window is registered quickly, and connection occurs before the app directory returns', () => {
        const timings = {
            pendingTime: 990,
            createdTime: 1000,
            connectionTime: 2000,
            appDirectoryResultTime: 3000
        };

        expectTest('non-directory', timings, [
            [
                'When a window is expected shortly before it is created, the window promise resolves',
                {callTime: 950, finalizeTime: 3000, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before it is connected, the window promise resolves',
                {callTime: 1500, finalizeTime: 3000, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before it is registered, the window promise resolves',
                {callTime: 2500, finalizeTime: 3000, result: 'resolve'}
            ],
        ]);
    });

    describe('When the window is registered quickly, and connection occurs after of the app directory returns', () => {
        const timings = {
            pendingTime: 990,
            createdTime: 1000,
            connectionTime: 4000,
            appDirectoryResultTime: 3000
        };

        expectTest('non-directory', timings, [
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
            ],
        ]);
    });

    describe('When the window registration is delayed due to a delayed connection', () => {
        const timings = {
            pendingTime: 990,
            createdTime: 1000,
            connectionTime: 7000,
            appDirectoryResultTime: 3000
        };

        expectTest('non-directory', timings, [
            [
                'When a window is expected before the app directory has returned, the window promise rejects',
                {callTime: 2500, finalizeTime: 990 + REGISTRATION_TIMEOUT, result: 'reject'}
            ],
            [
                'When a window is expected after the app directory has returned but before it is registered, the window promise rejects',
                {callTime: 3500, finalizeTime: 990 + REGISTRATION_TIMEOUT, result: 'reject'}
            ],
            [
                'When a window is expected shortly before the window is registered, the window promise rejects',
                {callTime: 6500, finalizeTime: 6500, result: 'reject'}
            ],
        ]);
    });
});


function expectTest(appType: 'directory' | 'non-directory', timing: Timing, resultParams: ResultParam[]): void {

    resultParams.push([
        'When a window is expected after the window has been registered, the window promise resolves',
        {callTime: 9500, finalizeTime: 9500, result: 'resolve'}
    ]);

    const testParams: TestParam[] = resultParams.map(resultParam => ([resultParam[0], appType, timing, [resultParam[1]]] as TestParam));

    testParams.push([
        'When a window is expected multiple times, window promises resolve and reject independently',
        appType,
        timing,
        resultParams.map(resultParam => resultParam[1])
    ] as TestParam);

    it.each(testParams)('%s', async (titleParam: string, appType: 'directory' | 'non-directory', timing: Timing, expectCalls: ExpectCall[]) => {
        // Setup our environment
        const identity = {uuid: 'test-window', name: 'test-window'};
        const manifestUrl = 'test-manifest-url';
        const mockApplication = {manifest: manifestUrl} as Application;

        const appDirectoryResultPromise = new DeferredPromise();

        mockAppDirectory.getAllApps.mockImplementationOnce(async (): Promise<Application[]> => {
            await appDirectoryResultPromise.promise;
            return appType === 'directory' ? [mockApplication] : [];
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

        maybeSetTimeout(() => mockEnvironment.windowPending.emit(identity), timing.pendingTime);
        maybeSetTimeout(() => mockEnvironment.windowCreated.emit(identity, manifestUrl), timing.createdTime);
        maybeSetTimeout(() => mockApiHandler.onConnection.emit(identity), timing.connectionTime);
        maybeSetTimeout(() => mockEnvironment.windowClosed.emit(identity), timing.closeTime);
        maybeSetTimeout(() => appDirectoryResultPromise.resolve(), timing.appDirectoryResultTime);

        const time: Boxed<number> = {value: 0};

        const resultAccumulator = setupExpectCalls(identity, expectCalls, time);
        await advanceTime(10000, time);

        expect(resultAccumulator.length).toEqual(expectCalls.length);
        await checkExpectResults(identity, mockApplication, resultAccumulator);
    });
}

function maybeSetTimeout(fn: (() => void), time: number | undefined): void {
    if (time) {
        setTimeout(fn, time);
    }
}

function setupExpectCalls(identity: Identity, expectCalls: ExpectCall[], time: Boxed<number>): ExpectCallResult[]
{
    const results: ExpectCallResult[] = [];
    for (const call of expectCalls) {
        setTimeout(async () => {
            const promise = model.expectWindow(identity);
            await promise.catch(() => {});
            results.push({promise, time: time.value, call});
        }, call.callTime);
    }

    return results;
}

async function advanceTime(timeToAdvance: number, currentTime: {value: number}): Promise<void> {
    for (currentTime.value = 0; currentTime.value < timeToAdvance; currentTime.value++) {
        for (let j = 0; j < 100; j++) {
            await Promise.resolve();
        }
        jest.advanceTimersByTime(1);
    }
}

async function checkExpectResults(identity: Identity, mockApplication: Application, results: ExpectCallResult[]): Promise<void> {
    for (const result of results) {
        if (result.call.result === 'resolve') {
            await expect(result.promise).resolves.toMatchObject({
                id: getId(identity),
                identity,
                appInfo: mockApplication
            });
        } else {
            await expect(result.promise).rejects.toEqual(new Error('Timeout on promise exceeded'));
        }
        expect(result.time).toEqual(result.call.finalizeTime);
    }
}