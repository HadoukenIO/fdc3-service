import 'jest';
import 'reflect-metadata';

import {Store} from 'openfin-service-config';

import {Application} from '../../src/client/directory';
import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {ConfigurationObject} from '../../gen/provider/config/fdc3-config';
import {ConfigStoreBinding} from '../../src/provider/model/ConfigStore';
import {createFakeApp, createFakeIntent, createFakeContextType} from '../demo/utils/fakes';

enum StorageKeys {
    URL = 'fdc3@url',
    APPLICATIONS = 'fdc3@applications'
}

type LocalStore = jest.Mocked<Pick<typeof localStorage, 'getItem' | 'setItem'>>;

// Define localStorage global/window
Object.defineProperty(global, 'localStorage', {
    value: {
        getItem: jest.fn(),
        setItem: jest.fn()
    },
    writable: true
});

declare const global: NodeJS.Global & {localStorage: LocalStore} & {fetch: (url: string) => Promise<Response>};

const DEV_APP_DIRECTORY_URL = 'http://openfin.co';
let appDirectory: AppDirectory;

const fakeApp1: Application = createFakeApp({
    customConfig: [
        {
            'name': 'appUuid',
            'value': 'customUuid'
        }
    ],
    intents: [
        {
            name: 'StartChat',
            contexts: ['testContext.User'],
            customConfig: {}
        }, {
            name: 'SendEmail',
            contexts: ['testContext.User'],
            customConfig: {}
        }
    ]
});

const fakeApp2: Application = createFakeApp({
    intents: [{
        name: 'StartChat',
        contexts: ['testContext.User', 'testContext.Bot'],
        customConfig: {}
    }, {
        name: 'ShowChart',
        contexts: ['testContext.Instrument'],
        customConfig: {}
    }]
});

const fakeApps: Application[] = [fakeApp1, fakeApp2];
const cachedFakeApps: Application[] = [fakeApp1, fakeApp1, fakeApp2, fakeApp2];
const mockFetchReturnJson = jest.fn().mockResolvedValue(fakeApps);

/**
 * Creates a new Application Directory with the specified URL
 */
async function createAppDirectory(url?: string): Promise<void> {
    const configStore: ConfigStoreBinding = {
        config: new Store<ConfigurationObject>(require('../../gen/provider/config/defaults.json')),
        initialized: Promise.resolve()
    };

    configStore.config.add({level: 'desktop'}, {applicationDirectory: url});
    appDirectory = new AppDirectory(configStore);
    await appDirectory.delayedInit();
}

beforeEach(() => {
    jest.restoreAllMocks();

    global.localStorage = {
        getItem: jest.fn().mockImplementation((key: string) => {
            switch (key) {
                case StorageKeys.APPLICATIONS:
                    return JSON.stringify(cachedFakeApps);
                case StorageKeys.URL:
                    return DEV_APP_DIRECTORY_URL;
                default:
                    return null;
            }
        }),
        setItem: jest.fn((key: string, value: string) => {})
    };

    // Replace the fetch result with our mocked directory
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: mockFetchReturnJson
    });
    mockFetchReturnJson.mockResolvedValue(fakeApps);
});

describe('When Fetching Initial Data', () => {
    describe('And config applicationDirectory is undefined', () => {
        beforeEach(async () => {
            await createAppDirectory(undefined);
        });

        test('The default public application directory is used', async () => {
            await expect(appDirectory.getAllApps()).resolves.toEqual(fakeApps);
        });
    });

    describe('And config applicationDirectory is falsey', () => {
        beforeEach(async () => {
            mockFetchReturnJson.mockRejectedValue({});
            await createAppDirectory('');
        });

        test('The application directory will be empty', async () => {
            await expect(appDirectory.getAllApps()).resolves.toEqual([]);
        });
    });

    describe('And we\'re online', () => {
        beforeEach(async () => {
            await createAppDirectory(DEV_APP_DIRECTORY_URL);
        });

        test('We fetch data from the application directory JSON', async () => {
            await expect(appDirectory.getAllApps()).resolves.toEqual(fakeApps);
        });

        test('Data is not retrieved from cache', () => {
            expect(appDirectory).not.toEqual([...fakeApps, ...fakeApps]);
        });
    });

    describe('And we\'re offline', () => {
        beforeEach(async () => {
            global.fetch = jest.fn().mockRejectedValue('');
            await createAppDirectory(DEV_APP_DIRECTORY_URL);
        });

        describe('With cache', () => {
            test('We fetch data from the cache', async () => {
                await expect(appDirectory.getAllApps()).resolves.toEqual(cachedFakeApps);
            });

            test('Data is not fetched from live app directory', async () => {
                await expect(appDirectory.getAllApps()).resolves.not.toEqual(fakeApps);
            });

            test('We receive an empty array if the URLs do not match', async () => {
                const spyGetItem = jest.spyOn(global.localStorage, 'getItem');
                spyGetItem.mockImplementation(() => '__test_url__');

                await createAppDirectory(DEV_APP_DIRECTORY_URL);

                await expect(appDirectory.getAllApps()).resolves.toEqual([]);
            });
        });

        describe('With no cache', () => {
            beforeEach(async () => {
                global.localStorage = {
                    getItem: jest.fn().mockImplementation((key: string) => {
                        switch (key) {
                            case StorageKeys.APPLICATIONS:
                                return null;
                            case StorageKeys.URL:
                                return DEV_APP_DIRECTORY_URL;
                            default:
                                return null;
                        }
                    }),
                    setItem: jest.fn((key: string, value: string) => {})
                };

                await createAppDirectory(DEV_APP_DIRECTORY_URL);
            });

            test('We receive an empty array', (async () => {
                await expect(appDirectory.getAllApps()).resolves.toEqual([]);
            }));

            test('Data is not fetched from live app directory', async () => {
                await expect(appDirectory.getAllApps()).resolves.not.toEqual(fakeApps);
            });
        });
    });
});

describe('When querying the Directory', () => {
    beforeEach(async () => {
        await createAppDirectory(DEV_APP_DIRECTORY_URL);
    });

    it('Can get all apps', async () => {
        const apps = await appDirectory.getAllApps();
        expect(apps).toEqual(fakeApps);
    });

    it('Can get applicaiton by name', async () => {
        const app = await appDirectory.getAppByName(fakeApp2.name);
        expect(app).not.toBeNull();
    });

    describe('With a custom appUuid is not defined', () => {
        it('Can get application by uuid using appId', async () => {
            const app = await appDirectory.getAppByUuid(fakeApp2.appId);
            expect(app).not.toBeNull();
        });
    });

    describe('With a custom appUuid is defined', () => {
        it('Can get application by uuid with appUuid property in customConfig', async () => {
            const app = await appDirectory.getAppByUuid('customUuid');
            expect(app).not.toBeNull();
        });

        it('Cannot get application by uuid using appId', async () => {
            const app = await appDirectory.getAppByUuid(fakeApp1.appId);
            expect(app).toBeNull();
        });
    });
});

describe('When querying individual applications', () => {
    describe('When an app has an intent with no contexts', () => {
        const intent = createFakeIntent();

        const intentType = intent.name;

        const app = createFakeApp({
            intents: [intent]
        });

        it('The app might support that intent', () => {
            expect(AppDirectory.mightAppSupportIntent(app, intentType)).toBe(true);
        });

        it('The app might support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.mightAppSupportIntent(app, arbitraryIntentType)).toBe(true);
        });

        it('The app might support that intent with an arbitrary context', () => {
            const arbitraryContextType = createFakeContextType();

            expect(AppDirectory.mightAppSupportIntent(app, intentType, arbitraryContextType)).toBe(true);
        });

        it('The app is expected to support that intent', () => {
            expect(AppDirectory.shouldAppSupportIntent(app, intentType)).toBe(true);
        });

        it('The app is not expected to support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.shouldAppSupportIntent(app, arbitraryIntentType)).toBe(false);
        });

        it('The app is expected to support that intent with an arbitrarycontext', () => {
            const arbitraryContextType = createFakeContextType();

            expect(AppDirectory.shouldAppSupportIntent(app, intentType, arbitraryContextType)).toBe(true);
        });
    });

    describe('When an app has an intent with multiple contexts', () => {
        const contexts = [createFakeContextType(), createFakeContextType(), createFakeContextType()];

        const intent = createFakeIntent({
            contexts
        });

        const intentType = intent.name;

        const app = createFakeApp({
            intents: [intent]
        });

        it('The app might support that intent', () => {
            expect(AppDirectory.mightAppSupportIntent(app, intentType)).toBe(true);
        });

        it('The app might support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.mightAppSupportIntent(app, arbitraryIntentType)).toBe(true);
        });

        it('The app might support that intent with each of its contexts', () => {
            for (const context of contexts) {
                expect(AppDirectory.mightAppSupportIntent(app, intentType, context)).toBe(true);
            }
        });

        it('The app will not support that intent with an arbitrary context', () => {
            const arbitraryContextType = createFakeContextType();

            expect(AppDirectory.mightAppSupportIntent(app, intentType, arbitraryContextType)).toBe(false);
        });

        it('The app is expected to support that intent', () => {
            expect(AppDirectory.shouldAppSupportIntent(app, intentType)).toBe(true);
        });

        it('The app is not expected to support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.shouldAppSupportIntent(app, arbitraryIntentType)).toBe(false);
        });

        it('The app is expected to support that intent with each of its contexts', () => {
            for (const context of contexts) {
                expect(AppDirectory.shouldAppSupportIntent(app, intentType, context)).toBe(true);
            }
        });

        it('The app is not expect to support that intent with an arbitrary context', () => {
            const arbitraryContextType = createFakeContextType();

            expect(AppDirectory.mightAppSupportIntent(app, intentType, arbitraryContextType)).toBe(false);
        });
    });

    describe('When an app has multiple intents', () => {
        const intent1Contexts = [createFakeContextType(), createFakeContextType(), createFakeContextType()];

        const intent1 = createFakeIntent({
            contexts: intent1Contexts
        });

        const intent2Contexts = [createFakeContextType()];

        const intent2 = createFakeIntent({
            contexts: intent2Contexts
        });

        const intent3 = createFakeIntent({
            contexts: []
        });

        const intent4 = createFakeIntent();

        const intents = [intent1, intent2, intent3, intent4];

        const app = createFakeApp({
            intents
        });

        it('The app might support each of its intents', () => {
            for (const intent of intents) {
                expect(AppDirectory.mightAppSupportIntent(app, intent.name)).toBe(true);
            }
        });

        it('The app might support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.mightAppSupportIntent(app, arbitraryIntentType)).toBe(true);
        });

        it('The app might support each intent with each of its contexts', () => {
            for (const intent of intents) {
                for (const context of intent.contexts || []) {
                    expect(AppDirectory.mightAppSupportIntent(app, intent.name, context)).toBe(true);
                }
            }
        });

        it('For intents with no contexts, the app might support those intents with an arbitrarycontext', () => {
            const arbitraryContextType = createFakeContextType();

            for (const intent of [intent3, intent4]) {
                expect(AppDirectory.mightAppSupportIntent(app, intent.name, arbitraryContextType)).toBe(true);
            }
        });

        it('For intents with contexts, the app will not support those intents with an arbitrarycontext', () => {
            const arbitraryContextType = createFakeContextType();

            for (const intent of [intent1, intent2]) {
                expect(AppDirectory.mightAppSupportIntent(app, intent.name, arbitraryContextType)).toBe(false);
            }
        });

        it('The app is expected to support each of its intents', () => {
            for (const intent of intents) {
                expect(AppDirectory.shouldAppSupportIntent(app, intent.name)).toBe(true);
            }
        });

        it('The app is not expected to support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.shouldAppSupportIntent(app, arbitraryIntentType)).toBe(false);
        });

        it('For intents with contexts, the app is expected to support each of those intents with each intent\'s contexts', () => {
            for (const intent of intents) {
                for (const context of intent.contexts || []) {
                    expect(AppDirectory.shouldAppSupportIntent(app, intent.name, context)).toBe(true);
                }
            }
        });

        it('For intents with contexts, the app is not expected to support each of those intents with contexts of a different intent', () => {
            expect(AppDirectory.shouldAppSupportIntent(app, intent1.name, intent2Contexts[0])).toBe(false);
            expect(AppDirectory.shouldAppSupportIntent(app, intent2.name, intent1Contexts[0])).toBe(false);
        });

        it('For intents with no contexts, the app is expected to support each of those intents with an arbitrary context', () => {
            const arbitraryContextType = createFakeContextType();

            for (const intent of [intent3, intent4]) {
                expect(AppDirectory.shouldAppSupportIntent(app, intent.name, arbitraryContextType)).toBe(true);
            }
        });
    });
});
