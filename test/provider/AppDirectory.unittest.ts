import 'jest';
import 'reflect-metadata';

import {Store} from 'openfin-service-config';

import {Application} from '../../src/client/directory';
import {AppIntent} from '../../src/client/main';
import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {ConfigurationObject} from '../../gen/provider/config/fdc3-config';
import {ConfigStoreBinding} from '../../src/provider/model/ConfigStore';

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
    appId: '1',
    name: 'App 1',
    manifestType: '',
    manifest: '',
    customConfig: [
        {
            'name': 'appUuid',
            'value': 'customUuid'
        }
    ],
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
    appId: '2',
    name: 'App 2',
    manifestType: '',
    manifest: '',
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

    it('Can get application by name', async () => {
        const app = await appDirectory.getAppByName('App 1');
        expect(app).not.toBeNull();
    });

    describe('With a custom appUuid is not defined', () => {
        it('Can get application by uuid using appId', async () => {
            const app = await appDirectory.getAppByUuid('2');
            expect(app).not.toBeNull();
        });
    });

    describe('With a custom appUuid is defined', () => {
        it('Can get application by uuid with appUuid property in customConfig', async () => {
            const app = await appDirectory.getAppByUuid('customUuid');
            expect(app).not.toBeNull();
        });

        it('Cannot get application by uuid using appId', async () => {
            const app = await appDirectory.getAppByUuid('1');
            expect(app).toBeNull();
        });
    });

    it('Can get application by intent', async () => {
        const apps = await appDirectory.getAppsByIntent('testIntent.SendEmail');
        expect(apps).toHaveLength(1);
    });
});

describe('Given an App Directory with apps', () => {
    beforeEach(async () => {
        await createAppDirectory(DEV_APP_DIRECTORY_URL);
    });

    describe('When finding app intents by context with a context implemented by 2 intents in both apps', () => {
        it('Should return 2 intents', async () => {
            const intents = await appDirectory.getAppIntentsByContext('testContext.User');

            expect(intents).toEqual([
                {
                    intent: {name: 'testIntent.SendEmail', displayName: 'testIntent.SendEmail'},
                    apps: [fakeApp1]
                },
                {
                    intent: {name: 'testIntent.StartChat', displayName: 'testIntent.StartChat'},
                    apps: [fakeApp1, fakeApp2]
                }
            ] as AppIntent[]);
        });
    });

    describe('When finding app intents by context with a context not implemented by any intent', () => {
        it('Should return an empty array', async () => {
            const intents = await appDirectory.getAppIntentsByContext('testContext.NonExistent');

            expect(intents).toEqual([] as AppIntent[]);
        });
    });

    describe('When finding app intents by context with a context implemented by only 1 intent in 1 app', () => {
        it('Should return 1 intent in 1 app', async () => {
            const intents = await appDirectory.getAppIntentsByContext('testContext.Instrument');

            expect(intents).toEqual([
                {
                    intent: {name: 'testIntent.ShowChart', displayName: 'testIntent.ShowChart'},
                    apps: [fakeApp2]
                }
            ] as AppIntent[]);
        });
    });
});
