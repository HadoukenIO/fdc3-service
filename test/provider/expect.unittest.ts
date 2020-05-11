import 'reflect-metadata';

import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';
import {DeferredPromise} from 'openfin-service-async';

import {Model} from '../../src/provider/model/Model';
import {APIHandler} from '../../src/provider/APIHandler';
import {APIFromClientTopic} from '../../src/client/internal';
import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {Environment, EntityType} from '../../src/provider/model/Environment';
import {createMockEnvironmnent, createMockAppConnection} from '../mocks';
import {Application} from '../../src/client/main';
import {ContextChannel} from '../../src/provider/model/ContextChannel';
import {AppConnection} from '../../src/provider/model/AppConnection';
import {advanceTime, useMockTime} from '../utils/unit/time';
import {PartiallyWritable} from '../types';
import {Timeouts} from '../../src/provider/constants';
import {getId} from '../../src/provider/utils/getId';
import {LiveApp} from '../../src/provider/model/LiveApp';

jest.mock('../../src/provider/model/AppDirectory');
jest.mock('../../src/provider/APIHandler');

interface TestWindow {
    createdTime?: number;
    connectionTime?: number;
    closeTime?: number;
    appType: 'directory' | 'non-directory' | 'non-directory-external';
    windowType?: 'window' | 'view';
}

interface ExpectCall {
    callTime: number;
    finalizeTime: number;
    result: 'resolve' | 'reject-timeout' | 'reject-closed';
}

interface ExpectCallResult {
    promise: Promise<AppConnection>;
    time: number;
    call: ExpectCall;
}

type ResultParam = [string, ExpectCall];

type TestParam = [
    string,
    ExpectCall[]
];

const FAKE_TEST_DURATION = 10000;

let model: Model;

let mockAppDirectory: jest.Mocked<AppDirectory>;
let mockEnvironment: jest.Mocked<Environment>;
let mockApiHandler: jest.Mocked<APIHandler<APIFromClientTopic>>;

beforeEach(() => {
    mockAppDirectory = new AppDirectory(null!) as jest.Mocked<AppDirectory>;
    mockEnvironment = createMockEnvironmnent();
    mockApiHandler = new APIHandler<APIFromClientTopic>() as jest.Mocked<APIHandler<APIFromClientTopic>>;
    (mockApiHandler as PartiallyWritable<typeof mockApiHandler, 'onConnection'>).onConnection = new Signal<[Identity]>();
    (mockApiHandler as PartiallyWritable<typeof mockApiHandler, 'onDisconnection'>).onDisconnection = new Signal<[Identity]>();

    model = new Model(mockAppDirectory, mockEnvironment, mockApiHandler);

    jest.resetAllMocks();
    useMockTime();
});

const windowApp: TestWindow = {
    createdTime: 1000,
    connectionTime: 1100,
    appType: 'directory'
};
const viewApp: TestWindow = {
    ...windowApp,
    windowType: 'view'
};

describe.each<[string, TestWindow]>([
    ['window', windowApp],
    ['view', viewApp]
])('When creating a %s-based directory FDC3 app', (instanceName, testWindow) => {
    describe('When the window is registered quickly', () => {
        expectTest(testWindow, 3000, [
            [
                'When a window is expected long before it is created, the window promise rejects',
                {callTime: 500, finalizeTime: 500 + Timeouts.ENTITY_INITIALIZE, result: 'reject-timeout'}
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
                {callTime: 1500, finalizeTime: 1000 + Timeouts.WINDOW_CREATED_TO_REGISTERED, result: 'reject-timeout'}
            ],
            [
                'When a window is expected shortly before the window is registered, the window promise rejects',
                {callTime: 7500, finalizeTime: 7500, result: 'reject-timeout'}
            ]
        ]);
    });

    describe('When a window is closed while pending', () => {
        const neverCreatedWindow: TestWindow = {
            createdTime: 1000,
            closeTime: 1000,
            appType: 'directory'
        };

        expectTest(neverCreatedWindow, 3000, [
            [
                'When a window is expected shortly before it is created, the promise rejects',
                {callTime: 950, finalizeTime: 1200, result: 'reject-closed'}
            ]
        ]);
    });

    describe('When a window never connects', () => {
        const neverConnectingWindow: TestWindow = {
            createdTime: 1000,
            appType: 'directory'
        };

        expectTest(neverConnectingWindow, 3000, [
            [
                'When a window is expected after it is created, the promise rejects',
                {callTime: 1500, finalizeTime: 1000 + Timeouts.WINDOW_CREATED_TO_REGISTERED, result: 'reject-timeout'}
            ],
            [
                'When a window is expected shortly before it is created, the promise rejects',
                {callTime: 950, finalizeTime: 1000 + Timeouts.WINDOW_CREATED_TO_REGISTERED, result: 'reject-timeout'}
            ]
        ]);
    });

    describe('When a window is closed after being created', () => {
        const fastCloseWindow: TestWindow = {
            createdTime: 1000,
            connectionTime: 1100,
            closeTime: 2000,
            appType: 'directory'
        };

        expectTest(fastCloseWindow, 3000, [
            [
                'When a window is expected shortly after it is created, the promise rejects',
                {callTime: 1500, finalizeTime: 2000, result: 'reject-closed'}
            ]
        ]);
    });

    describe('When a window is closed after being registered', () => {
        const slowCloseWindow: TestWindow = {
            createdTime: 1000,
            connectionTime: 1100,
            closeTime: 4000,
            appType: 'directory'
        };

        expectTest(slowCloseWindow, 3000, [
            [
                'When a window is expected after being closed, the promise rejects',
                {callTime: 5000, finalizeTime: 5000 + Timeouts.ENTITY_INITIALIZE, result: 'reject-timeout'}
            ]
        ]);
    });
});

describe('When creating a non-directory FDC3 app', () => {
    const fastConnectWindow: TestWindow = {
        createdTime: 1000,
        connectionTime: 4000,
        appType: 'non-directory'
    };

    const slowConnectWindow: TestWindow = {
        createdTime: 1000,
        connectionTime: 7000,
        appType: 'non-directory'
    };

    describe.each<[string, TestWindow]>([
        ['window', fastConnectWindow],
        ['view', {...fastConnectWindow, windowType: 'view'}]
    ])('When the %s-based entity is registered quickly, and connection occurs before the app directory returns', (instanceName, testWindow) => {
        expectTest(testWindow, 5000, [
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

    describe.each<[string, TestWindow]>([
        ['window', fastConnectWindow],
        ['view', {...fastConnectWindow, windowType: 'view'}]
    ])('When the %s-based entity is registered quickly, and connection occurs after of the app directory returns', (instanceName, testWindow) => {
        expectTest(testWindow, 3000, [
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

    describe.each<[string, TestWindow]>([
        ['window', slowConnectWindow],
        ['view', {...slowConnectWindow, windowType: 'view'}]
    ])('When the %s-based entity registration is delayed due to a delayed connection', (instanceName, testWindow) => {
        expectTest(testWindow, 3000, [
            [
                'When a window is expected before the app directory has returned, the window promise rejects',
                {callTime: 2500, finalizeTime: 1000 + Timeouts.WINDOW_CREATED_TO_REGISTERED, result: 'reject-timeout'}
            ],
            [
                'When a window is expected after the app directory has returned but before it is registered, the window promise rejects',
                {callTime: 3500, finalizeTime: 1000 + Timeouts.WINDOW_CREATED_TO_REGISTERED, result: 'reject-timeout'}
            ],
            [
                'When a window is expected shortly before the window is registered, the window promise rejects',
                {callTime: 6500, finalizeTime: 6500, result: 'reject-timeout'}
            ]
        ]);
    });
});

describe('When creating an external connection', () => {
    // External connections won't have a corresponding window. These "windows" MUST have a createdTime of undefined to produce accurate scenarios.
    // Connections from external windows must connect within the WINDOW_EXPECT_TO_CREATED timeout, which is a much stricter requirement than normal OF windows

    const fastConnectWindow: TestWindow = {
        createdTime: undefined,
        connectionTime: 100,
        appType: 'non-directory-external'
    };

    const slowConnectWindow: TestWindow = {
        createdTime: undefined,
        connectionTime: 7000,
        appType: 'non-directory-external'
    };

    describe('When the window is registered within window creation timeout, and connection occurs before the app directory returns', () => {
        expectTest(fastConnectWindow, 5000, [
            [
                'When a window is expected shortly before it is created, the window promise resolves',
                {callTime: 950, finalizeTime: 950, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before it is connected, the window promise resolves',
                {callTime: 1500, finalizeTime: 1500, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before it is registered, the window promise resolves',
                {callTime: 4500, finalizeTime: 4500, result: 'resolve'}
            ]
        ]);
    });

    describe('When the window is registered within window creation timeout, and connection occurs after of the app directory returns', () => {
        expectTest(fastConnectWindow, 3000, [
            [
                'When a window is expected shortly before it is created, the window promise resolves',
                {callTime: 950, finalizeTime: 950, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before the app directory returns, the window promise resolves',
                {callTime: 1500, finalizeTime: 1500, result: 'resolve'}
            ],
            [
                'When a window is expected shortly after it is created but before it is registered, the window promise resolves',
                {callTime: 3500, finalizeTime: 3500, result: 'resolve'}
            ]
        ]);
    });

    describe('When the window registration occurs after window creation timeout, due to a delayed connection', () => {
        expectTest(slowConnectWindow, 3000, [
            [
                'When a window is expected before the app directory has returned, the window promise rejects',
                {callTime: 2500, finalizeTime: 2500 + Timeouts.ENTITY_INITIALIZE, result: 'reject-timeout'}
            ],
            [
                'When a window is expected after the app directory has returned but before it is registered, the window promise rejects',
                {callTime: 3500, finalizeTime: 3500 + Timeouts.ENTITY_INITIALIZE, result: 'reject-timeout'}
            ],
            [
                'When a window is expected shortly before the window is registered, the window promise rejects',
                {callTime: 6500, finalizeTime: 6500 + Timeouts.ENTITY_INITIALIZE, result: 'reject-timeout'}
            ]
        ]);
    });
});

function getEntityType(testWindow: TestWindow): EntityType {
    if (testWindow.appType === 'non-directory-external') {
        return EntityType.EXTERNAL_CONNECTION;
    } else if (testWindow.windowType === 'view') {
        return EntityType.VIEW;
    } else {
        return EntityType.WINDOW;
    }
}

function expectTest(testWindow: TestWindow, appDirectoryResultTime: number, resultParams: ResultParam[]): void {
    const testParams = buildTestParams(testWindow, resultParams);

    it.each(testParams)('%s', async (titleParam: string, expectCalls: ExpectCall[]) => {
        // Setup our environment
        const identity = {uuid: 'test-window', name: 'test-window'};
        const manifestUrl = testWindow.appType !== 'non-directory-external' ? 'test-manifest-url' : '';
        const mockApplication = {manifest: manifestUrl} as Application;
        const testWindowEntityType = getEntityType(testWindow);

        const appDirectoryResultPromise = new DeferredPromise();

        mockAppDirectory.getAppByUuid.mockImplementation(async (): Promise<Application | null> => {
            await appDirectoryResultPromise.promise;
            return testWindow.appType === 'directory' ? mockApplication : null;
        });

        mockEnvironment.wrapConnection.mockImplementationOnce((
            liveApp: LiveApp,
            testIdentity: Identity,
            entityType: EntityType,
            channel: ContextChannel
        ): AppConnection => {
            return createMockAppConnection({id: getId(testIdentity), identity: testIdentity, entityType, channel, appInfo: liveApp.appInfo!});
        });

        mockEnvironment.getEntityType.mockImplementationOnce(async (entityIdentity: Identity): Promise<EntityType> => {
            if (getId(entityIdentity) !== getId(identity)) {
                return EntityType.UNKNOWN;
            } else {
                return testWindowEntityType;
            }
        });

        // eslint-disable-next-line @typescript-eslint/require-await
        mockEnvironment.inferApplication.mockImplementationOnce(async (identityToInfer: Identity): Promise<Application> => {
            return mockApplication;
        });

        mockEnvironment.isKnownEntity.mockImplementation((testIdentity: Identity): boolean => {
            if (getId(testIdentity) === getId(identity)) {
                const time = Date.now();

                if (testWindow.createdTime !== undefined && time >= testWindow.createdTime) {
                    if (testWindow.closeTime === undefined || time < testWindow.closeTime) {
                        return true;
                    }
                }
            }

            return false;
        });

        mockApiHandler.isClientConnection.mockImplementation((testIdentity: Identity): boolean => {
            if (getId(testIdentity) === getId(identity)) {
                const time = Date.now();

                if (testWindow.connectionTime !== undefined && time >= testWindow.connectionTime) {
                    if (testWindow.closeTime === undefined || time < testWindow.closeTime) {
                        return true;
                    }
                }
            }

            return false;
        });

        maybeSetTimeout(() => {
            mockEnvironment.onApplicationCreated.emit(identity, new LiveApp(Promise.resolve()));
            if (testWindow.windowType === 'view') {
                // There will also be an event for the window creation at around the same time as the view creation
                const windowIdentity = {
                    uuid: identity.uuid,
                    name: `${identity.name}-window`
                };
                mockEnvironment.onWindowCreated.emit(windowIdentity, EntityType.WINDOW);
            }
            mockEnvironment.onWindowCreated.emit(identity, testWindowEntityType);
        }, testWindow.createdTime);
        maybeSetTimeout(() => mockApiHandler.onConnection.emit(identity), testWindow.connectionTime);
        maybeSetTimeout(() => {
            if (testWindow.windowType === 'view') {
                // There will also be an event for the window destruction at around the same time as the view destruction
                const windowIdentity = {
                    uuid: identity.uuid,
                    name: `${identity.name}-window`
                };
                mockEnvironment.onWindowClosed.emit(windowIdentity, EntityType.WINDOW);
            }
            mockEnvironment.onWindowClosed.emit(identity, testWindowEntityType);
        }, testWindow.closeTime);
        maybeSetTimeout(() => appDirectoryResultPromise.resolve(), appDirectoryResultTime);

        const resultAccumulator = setupExpectCalls(identity, expectCalls);
        await advanceTime(FAKE_TEST_DURATION);

        expect(resultAccumulator.length).toEqual(expectCalls.length);
        await checkExpectResults(identity, mockApplication, resultAccumulator);
    });
}

function buildTestParams(testWindow: TestWindow, resultParams: ResultParam[]): TestParam[] {
    if (testWindow.closeTime === undefined && ![testWindow.createdTime, testWindow.connectionTime].includes(undefined)) {
        resultParams.push([
            'When a window is expected after the window has been registered, the window promise resolves',
            {callTime: 9500, finalizeTime: 9500, result: 'resolve'}
        ]);
    }

    const testParams: TestParam[] = resultParams.map((resultParam) => ([resultParam[0], [resultParam[1]]] as TestParam));

    if (testParams.length > 1) {
        testParams.push([
            'When a window is expected multiple times, window promises resolve and reject independently',
            resultParams.map((resultParam) => resultParam[1])
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
    expectCalls.forEach((call: ExpectCall) => {
        setTimeout(async () => {
            const promise = model.expectConnection(identity);
            await promise.catch(() => {});
            results.push({promise, time: Date.now(), call});
        }, call.callTime);
    });

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
