import 'reflect-metadata';

import {Signal} from 'openfin-service-signal';
import {Identity} from 'openfin/_v2/main';

import {Model} from '../../src/provider/model/Model';
import {createMockAppDirectory, createMockEnvironmnent, createMockApiHandler, getterMock, createMockAppWindow} from '../mocks';
import {Application} from '../../src/client/main';
import {createFakeApp, createFakeIntent, createFakeContextType, createFakeIdentity} from '../demo/utils/fakes';
import {getId} from '../../src/provider/utils/getId';
import { Intent } from '../../src/client/internal';

const mockAppDirectory = createMockAppDirectory();
const mockEnvironment = createMockEnvironmnent();
const mockApiHandler = createMockApiHandler();

let model: Model;

beforeEach(() => {
    jest.resetAllMocks();

    getterMock(mockApiHandler, 'onConnection').mockReturnValue(new Signal<[Identity]>());
    getterMock(mockApiHandler, 'onDisconnection').mockReturnValue(new Signal<[Identity]>());

    mockEnvironment.windowCreated = new Signal<[Identity]>();

    model = new Model(mockAppDirectory, mockEnvironment, mockApiHandler);
});

describe('When an app is in the directory with multiple intents', () => {
    let app: Application;

    let context1: string;
    let context2: string;

    let intent1: Intent;
    let intent2: Intent;
    let intent3: Intent;

    beforeEach(() => {
        context1 = createFakeContextType();
        context2 = createFakeContextType();

        intent1 = createFakeIntent({
            contexts: [context1, context2]
        });

        intent2 = createFakeIntent({
            contexts: [context1]
        });

        intent3 = createFakeIntent();

        app = createFakeApp({
            intents: [intent1, intent2, intent3]
        })

        mockAppDirectory.getAllApps.mockResolvedValue([app]);
    });

    describe('When the app is not running', () => {
        test('The model returns the app in intents that handle a given context', async () => {
            await expect(model.getAppIntentsByContext(context1)).resolves.toEqual([
                {
                    intent: {
                        name: intent1.name,
                        displayName: intent1.name
                    },
                    apps: [app]
                },
                {
                    intent: {
                        name: intent2.name,
                        displayName: intent2.name
                    },
                    apps: [app]
                },
                {
                    intent: {
                        name: intent3.name,
                        displayName: intent3.name
                    },
                    apps: [app]
                }
            ]);

            await expect(model.getAppIntentsByContext(context2)).resolves.toEqual([
                {
                    intent: {
                        name: intent1.name,
                        displayName: intent1.name
                    },
                    apps: [app]
                },
                {
                    intent: {
                        name: intent3.name,
                        displayName: intent3.name
                    },
                    apps: [app]
                }
            ]);

            await expect(model.getAppIntentsByContext(createFakeContextType())).resolves.toEqual([
                {
                    intent: {
                        name: intent3.name,
                        displayName: intent3.name
                    },
                    apps: [app]
                }
            ]);
        });
    });

    describe('When the app is running, and has only added a listener for a single intent from the directory', () => {
        beforeEach(async () => {
            setupWindowForApp(app, [intent1.name]);
        });

        test('The model returns the app in only that intent', async () => {
            await expect(model.getAppIntentsByContext(context1)).resolves.toEqual([
                {
                    intent: {
                        name: intent1.name,
                        displayName: intent1.name
                    },
                    apps: [app]
                }
            ]);

            await expect(model.getAppIntentsByContext(context2)).resolves.toEqual([
                {
                    intent: {
                        name: intent1.name,
                        displayName: intent1.name
                    },
                    apps: [app]
                }
            ]);

            await expect(model.getAppIntentsByContext(createFakeContextType())).resolves.toEqual([]);
        });
    });

    describe('When the app is running, and has only added a listener for an intent not in the directory', () => {
        let arbitraryIntentType: string;

        beforeEach(async () => {
            arbitraryIntentType = createFakeIntent().name;

            setupWindowForApp(app, [arbitraryIntentType]);
        });

        test('The model returns the app in only that intent for any context', async () => {
            const contexts = [context1, context2, createFakeContextType()];

            for (const context in contexts) {
                await expect(model.getAppIntentsByContext(context)).resolves.toEqual([
                    {
                        intent: {
                            name: arbitraryIntentType,
                            displayName: arbitraryIntentType
                        },
                        apps: [app]
                    }
                ]);
            }
        });
    });

    describe('When the app is running, but no windows have connected to the service', () => {
        beforeEach(async () => {
            mockEnvironment.isRunning.mockResolvedValue(true);
        });

        test('The model does not return the app for any context', async () => {
            await expect(model.getAppIntentsByContext(context1)).resolves.toEqual([]);

            await expect(model.getAppIntentsByContext(context2)).resolves.toEqual([]);
        });
    });
});

function setupWindowForApp(app: Application, intents: string[]): void {
    mockEnvironment.isRunning.mockResolvedValue(true);
    mockEnvironment.isWindowCreated.mockReturnValue(true);
    mockApiHandler.isClientConnection.mockReturnValue(true);

    mockAppDirectory.getAppByUuid.mockResolvedValue(app);

    const identity = createFakeIdentity({uuid: app.appId});

    const appWindow = {
        ...createMockAppWindow(),
        identity,
        id: getId(identity),
        appInfo: app
    };

    mockEnvironment.wrapApplication.mockReturnValue(appWindow);
    mockEnvironment.windowCreated.emit(appWindow.identity);

    appWindow.intentListeners = intents;
    appWindow.hasIntentListener.mockImplementation((intentType: string) => {
        return intents.includes(intentType);
    });
}
