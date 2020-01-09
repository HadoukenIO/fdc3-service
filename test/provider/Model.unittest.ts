import 'reflect-metadata';

import {Signal} from 'openfin-service-signal';
import {Identity} from 'openfin/_v2/main';

import {Model} from '../../src/provider/model/Model';
import {createMockAppDirectory, createMockEnvironmnent, createMockApiHandler, getterMock, createMockAppConnection} from '../mocks';
import {Application, AppDirIntent} from '../../src/client/main';
import {createFakeApp, createFakeIntent, createFakeContextType, createFakeIdentity} from '../demo/utils/fakes';
import {getId} from '../../src/provider/utils/getId';
import {EntityType} from '../../src/provider/model/Environment';
import {LiveApp} from '../../src/provider/model/LiveApp';
import {useMockTime, advanceTime, resolvePromiseChain} from '../utils/unit/time';
import {Timeouts} from '../../src/provider/constants';

const mockAppDirectory = createMockAppDirectory();
const mockEnvironment = createMockEnvironmnent();
const mockApiHandler = createMockApiHandler();

let model: Model;

beforeEach(() => {
    jest.resetAllMocks();
    useMockTime();

    getterMock(mockApiHandler, 'onConnection').mockReturnValue(new Signal<[Identity]>());
    getterMock(mockApiHandler, 'onDisconnection').mockReturnValue(new Signal<[Identity]>());

    mockEnvironment.onWindowCreated = new Signal<[Identity, EntityType]>();

    model = new Model(mockAppDirectory, mockEnvironment, mockApiHandler);
});

describe('When an app is in the directory with multiple intents', () => {
    let app: Application;

    let context1: string;
    let context2: string;

    let intent1: AppDirIntent;
    let intent2: AppDirIntent;
    let intent3: AppDirIntent;

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
        });

        mockAppDirectory.getAllApps.mockResolvedValue([app]);
    });

    describe('When the app is not running', () => {
        test('The model returns the app in app intents that handle a given context', async () => {
            await expectAppIntentsFromDirectory();
        });
    });

    describe('When the app is running, but no windows have connected to the service', () => {
        beforeEach(async () => {
            await setupAppRunningWithoutFdc3Connection(app);
        });

        describe('When the app is mature', () => {
            beforeEach(async () => {
                await advanceTime(Timeouts.APP_MATURITY);
            });

            test('The model does not return the app for any context', async () => {
                await expect(model.getAppIntentsByContext(context1)).resolves.toEqual([]);

                await expect(model.getAppIntentsByContext(context2)).resolves.toEqual([]);
            });
        });

        describe('When the app is not mature', () => {
            test('The model returns the app in app intents that handle a given context according to the directory', async () => {
                await expectAppIntentsFromDirectory();
            });
        });
    });

    describe('When the app is running, but has not added any intent listeners', () => {
        beforeEach(async () => {
            await setupAppRunningWithWindowWithIntentListeners(app, []);
        });

        describe('When the app is mature', () => {
            beforeEach(async () => {
                await advanceTime(Timeouts.APP_MATURITY);
            });

            test('The model does not return the app for any context', async () => {
                await expect(model.getAppIntentsByContext(context1)).resolves.toEqual([]);

                await expect(model.getAppIntentsByContext(context2)).resolves.toEqual([]);
            });
        });

        describe('When the app is not mature', () => {
            test('The model returns the app in app intents that handle a given context according to the directory', async () => {
                await expectAppIntentsFromDirectory();
            });
        });
    });

    describe('When the app is running, and has only added a listener for a single intent from the directory', () => {
        beforeEach(async () => {
            await setupAppRunningWithWindowWithIntentListeners(app, [intent1.name]);
        });

        describe('When the app is mature', () => {
            beforeEach(async () => {
                await advanceTime(Timeouts.APP_MATURITY);
            });

            test('The model returns the app in only the app intent for that intent', async () => {
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

        describe('When the app is not mature', () => {
            test('The model returns the app in app intents that handle a given context according to the directory', async () => {
                await expectAppIntentsFromDirectory();
            });
        });
    });

    describe('When the app is running, and has only added a listener for an intent not in the directory', () => {
        let arbitraryIntentType: string;

        beforeEach(async () => {
            arbitraryIntentType = createFakeIntent().name;

            await setupAppRunningWithWindowWithIntentListeners(app, [arbitraryIntentType]);
        });

        describe('When the app is mature', () => {
            beforeEach(async () => {
                await advanceTime(Timeouts.APP_MATURITY);
            });

            test('The model returns the app in only the app intent for that intent, for any context', async () => {
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

        describe('When the app is not mature', () => {
            test('The model returns the app in app intents that handle a given context according to the directory, plus the app intent \
for the non-directory intent', async () => {
                await expectAppIntentsFromDirectoryPlusAdHocIntent(arbitraryIntentType);
            });
        });
    });

    describe('When the app is running, and has added listeners for multiple intents', () => {
        let arbitraryIntentType: string;

        beforeEach(async () => {
            arbitraryIntentType = createFakeIntent().name;

            await setupAppRunningWithWindowWithIntentListeners(app, [intent1.name, intent2.name, intent3.name, arbitraryIntentType]);
        });

        describe('When the app is mature', () => {
            beforeEach(async () => {
                await advanceTime(Timeouts.APP_MATURITY);
            });

            test('The model returns the app in the expected the app intents, for each context', async () => {
                await expectAppIntentsFromDirectoryPlusAdHocIntent(arbitraryIntentType);
            });
        });

        describe('When the app is not mature', () => {
            test('The model returns the app in the expected the app intents, for each context', async () => {
                await expectAppIntentsFromDirectoryPlusAdHocIntent(arbitraryIntentType);
            });
        });
    });

    async function expectAppIntentsFromDirectory(): Promise<void> {
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
    }

    async function expectAppIntentsFromDirectoryPlusAdHocIntent(adHocIntentType: string): Promise<void> {
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
            },
            {
                intent: {
                    name: adHocIntentType,
                    displayName: adHocIntentType
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
            },
            {
                intent: {
                    name: adHocIntentType,
                    displayName: adHocIntentType
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
            },
            {
                intent: {
                    name: adHocIntentType,
                    displayName: adHocIntentType
                },
                apps: [app]
            }
        ]);
    }
});

async function setupAppRunningWithoutFdc3Connection(app: Application): Promise<void> {
    mockAppDirectory.getAppByUuid.mockImplementation(async (uuid) => uuid === app.appId ? app : null);

    mockEnvironment.wrapConnection.mockImplementation((liveApp, identity) => {
        const appWindow = createMockAppConnection({
            identity,
            id: getId(identity),
            appInfo: liveApp.appInfo
        });

        return appWindow;
    });

    mockEnvironment.isKnownEntity.mockImplementation((identity) => identity.uuid === app.appId);
    mockEnvironment.onApplicationCreated.emit({uuid: app.appId}, new LiveApp(Promise.resolve()));
    mockEnvironment.onWindowCreated.emit(createFakeIdentity({uuid: app.appId}), EntityType.WINDOW);

    await resolvePromiseChain();
}

async function setupAppRunningWithWindowWithIntentListeners(app: Application, intents: string[]): Promise<void> {
    mockEnvironment.isKnownEntity.mockImplementation((identity) => identity.uuid === app.appId);
    mockApiHandler.isClientConnection.mockImplementation((identity) => identity.uuid === app.appId);
    mockAppDirectory.getAppByUuid.mockImplementation(async (uuid) => uuid === app.appId ? app : null);

    mockEnvironment.wrapConnection.mockImplementation((liveApp, identity, entityType, channel) => {
        const appWindow = createMockAppConnection({
            identity,
            entityType,
            id: getId(identity),
            appInfo: liveApp.appInfo,
            intentListeners: intents,
            channel
        });

        appWindow.hasIntentListener.mockImplementation((intentType: string) => {
            return intents.includes(intentType);
        });

        return appWindow;
    });

    mockEnvironment.onApplicationCreated.emit({uuid: app.appId}, new LiveApp(Promise.resolve()));
    mockEnvironment.onWindowCreated.emit(createFakeIdentity({uuid: app.appId}), EntityType.WINDOW);

    await resolvePromiseChain();
}
