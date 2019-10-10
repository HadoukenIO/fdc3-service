import 'jest';
import 'reflect-metadata';

import {Store} from 'openfin-service-config';

import {Application} from '../../src/client/directory';
import {AppIntent} from '../../src/client/main';
import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {ConfigurationObject} from '../../gen/provider/config/fdc3-config';
import {ConfigStoreBinding} from '../../src/provider/model/ConfigStore';
import {createFakeApp} from '../demo/utils/unit/fakes';

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

const fakeApp1: Application = {
    ...createFakeApp(),
    intents: [
        {
            name: 'testIntent.StartChat',
            contexts: ['testContext.User'],
            customConfig: {}
        }, {
            name: 'testIntent.SendEmail',
            contexts: ['testContext.User'],
            customConfig: {}
        }
    ]
};

const fakeApp2: Application = {
    ...createFakeApp(),
    intents: [{
        name: 'testIntent.StartChat',
        contexts: ['testContext.User', 'testContext.Bot'],
        customConfig: {}
    }, {
        name: 'testIntent.ShowChart',
        contexts: ['testContext.Instrument'],
        customConfig: {}
    }]
};

const fakeApps: Application[] = [fakeApp1, fakeApp2];
const cachedFakeApps: Application[] = [fakeApp1, fakeApp1, fakeApp2, fakeApp2];
const mockFetchReturnJson = jest.fn().mockResolvedValue(fakeApps);

/**
 * Creates a new Application Directory with the specified URL
 */
async function createAppDirectory(url: string): Promise<void> {
    const configStore: ConfigStoreBinding = {
        config: new Store<ConfigurationObject>(require('../../gen/provider/config/defaults.json')),
        initialized: Promise.resolve()
    };

    configStore.config.add({level: 'desktop'}, {applicationDirectory: url});
    appDirectory = new AppDirectory(configStore);
    await appDirectory.delayedInit();
}

beforeEach(async () => {
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
    (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: mockFetchReturnJson
    });
    mockFetchReturnJson.mockResolvedValue(fakeApps);
});

describe('When Fetching Initial Data', () => {
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
        const app = await appDirectory.getAppByName(fakeApp1.name);
        expect(app).not.toBeNull();
    });

    it('Can get application by intent', async () => {
        const apps = await appDirectory.getAllAppsThatShouldSupportIntent('testIntent.SendEmail');
        expect(apps).toHaveLength(1);
    });
});

describe('When querying individual applications', () => {
    describe('When an app has an intent with no contexts', () => {
        it('The app might support that intent', () => {

        });

        it('The app might support an arbitrary intent', () => {

        });

        it('The app might support that intent with an arbitray context', () => {

        });

        it('The app is expected to support that intent', () => {

        });

        it('The app is not expected to support an arbitrary intent', () => {

        });

        it('The app is not expected to support that intent with an arbitray context', () => {

        });
    });

    describe('When an app has an intent with multiple contexts', () => {
        it('The app might support that intent', () => {

        });

        it('The app might support an arbitrary intent', () => {

        });

        it('The app might support that intent with each of its contexts', () => {

        });

        it('The app will not support that intent with an arbitrary context', () => {

        });

        it('The app is expected to support that intent', () => {

        });

        it('The app is not expected to support an arbitrary intent', () => {

        });

        it('The app is expected to support that intent with each of its contexts', () => {

        });

        it('The app is not expect to support that intent with an arbitrary context', () => {

        });
    });

    describe('When an app has multiple intents', () => {
        it('The app might support each of its intents', () => {

        });

        it('The app might support an arbitrary intent', () => {

        });

        it('The app might support each intent with each of its contexts', () => {

        });

        it('For intents with no contexts, the app might support those intents with an arbitray context', () => {

        });

        it('For intents with contexts, the app will not support those intents with an arbitray context', () => {

        });

        it('The app is expected to support each of its intents', () => {

        });

        it('The app is not expected to support an arbitrary intent', () => {

        });

        it('For intents with contexts, the app is expected to support each of those intents with each intent\'s contexts', () => {

        });

        it('For intents with contexts, the app is not expected to support each of those intents with contexts of a different intent', () => {

        });

        it('For intents with no contexts, the app is expected to support each of those intents with an arbitrary context', () => {

        });
    });
});
