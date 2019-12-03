import 'jest';
import 'reflect-metadata';

import {Store} from 'openfin-service-config';
import {Signal} from 'openfin-service-signal';

import {Application} from '../../src/client/directory';
import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {ConfigurationObject} from '../../gen/provider/config/fdc3-config';
import {createFakeApp, createFakeUrl} from '../demo/utils/fakes';
import {createMockAppDirectoryStorage, getterMock, createMockConfigStore} from '../mocks';
import {StoredAppDirectoryShard} from '../../src/client/internal';

enum StorageKeys {
    DIRECTORY_CACHE = 'fdc3@directoryCache'
}

type LocalStore = jest.Mocked<Pick<typeof localStorage, 'getItem' | 'setItem'>>;

// Define localStorage global/window
Object.defineProperty(global, 'localStorage', {
    value: {
        getItem: jest.fn(),
        setItem: jest.fn()
    }
});

Object.defineProperty(global, 'fetch', {
    value: jest.fn()
});

declare const global: NodeJS.Global & {localStorage: LocalStore} & {fetch: jest.Mock<Promise<Pick<Response, 'ok' | 'json'>>, [string]>};

const DEV_APP_DIRECTORY_URL = createFakeUrl();
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

const fakeApp3: Application = createFakeApp();

const mockAppDirectoryStorage = createMockAppDirectoryStorage();
const mockConfigStore = createMockConfigStore();

const fakeApps: Application[] = [fakeApp1, fakeApp2];
const cachedFakeApps: Application[] = [fakeApp1, fakeApp2, fakeApp3];

beforeEach(() => {
    jest.restoreAllMocks();
});

describe('When fetching initial data', () => {
    describe('When our source is a single URL', () => {
        beforeEach(async () => {
            setupConfigStoreWithUrl(DEV_APP_DIRECTORY_URL);
            setupEmptyDirectoryStorage();
        });

        describe('And we\'re online', () => {
            beforeEach(async () => {
                setupRemotesWithData([{url: DEV_APP_DIRECTORY_URL, applications: fakeApps}]);
                setupCacheWithData([{url: DEV_APP_DIRECTORY_URL, applications: cachedFakeApps}]);

                await createAppDirectory();
            });

            test('We fetch data from the application directory JSON', async () => {
                await expect(appDirectory.getAllApps()).resolves.toEqual(fakeApps);
            });

            test('Data is not retrieved from cache', () => {
                expect(appDirectory.getAllApps()).resolves.not.toContainEqual(fakeApp3);
            });
        });

        describe('And we\'re offline', () => {
            beforeEach(async () => {
                setupOfflineRemotes();
            });

            describe('With URL cached', () => {
                beforeEach(async () => {
                    setupCacheWithData([{url: DEV_APP_DIRECTORY_URL, applications: cachedFakeApps}]);
                    await createAppDirectory();
                });

                test('We fetch data from the cache', async () => {
                    await expect(appDirectory.getAllApps()).resolves.toEqual(cachedFakeApps);
                });

                test('Data is not fetched from live app directory', async () => {
                    await expect(appDirectory.getAllApps()).resolves.not.toEqual(fakeApps);
                });
            });

            describe('With different URL cached', () => {
                beforeEach(async () => {
                    setupCacheWithData([{url: createFakeUrl(), applications: cachedFakeApps}]);
                    await createAppDirectory();
                });

                test('We receive an empty array if the URLs do not match', async () => {
                    await expect(appDirectory.getAllApps()).resolves.toEqual([]);
                });
            });

            describe('With no cache', () => {
                beforeEach(async () => {
                    setupEmptyCache();
                    await createAppDirectory();
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

    describe('When our source is stored data', () => {
        beforeEach(() => {
            setupEmptyCache();
            setupDefaultConfigStore();
        });

        test('When we have multiple stored snippets, all are used by the directory', async () => {
            const storedApps1 = [createFakeApp()];
            const storedApps2 = [createFakeApp(), createFakeApp()];
            const storedApps3 = [createFakeApp(), createFakeApp(), createFakeApp()];

            setupDirectoryStorage([{urls: [], applications: storedApps1}, {urls: [], applications: storedApps2}, {urls: [], applications: storedApps3}]);

            await createAppDirectory();

            await expect(appDirectory.getAllApps()).resolves.toEqual([...storedApps1, ...storedApps2, ...storedApps3]);
        });

        test('When we have a mix of stored and remote snippets, all are used by the directory', async () => {
            const testUrl = createFakeUrl();

            const storedApps = [createFakeApp(), createFakeApp()];
            const remoteApps = [createFakeApp(), createFakeApp()];

            setupDirectoryStorage([{urls: [], applications: storedApps}, {urls: [testUrl], applications: []}]);
            setupRemotesWithData([{url: testUrl, applications: remoteApps}]);

            await createAppDirectory();

            await expect(appDirectory.getAllApps()).resolves.toEqual([...storedApps, ...remoteApps]);
        });

        test('When we have a mix of snippets and a service-level URL, all are used by the directory', async () => {
            const defaultUrl = createFakeUrl();
            const remoteUrl = createFakeUrl();

            const defaultApps = [createFakeApp(), createFakeApp(), createFakeApp()];
            const storedApps = [createFakeApp(), createFakeApp()];
            const remoteApps = [createFakeApp(), createFakeApp()];

            setupConfigStoreWithUrl(defaultUrl);
            setupRemotesWithData([{url: defaultUrl, applications: defaultApps}, {url: remoteUrl, applications: remoteApps}]);
            setupDirectoryStorage([{urls: [remoteUrl], applications: storedApps}]);

            await createAppDirectory();

            await expect(appDirectory.getAllApps()).resolves.toEqual([...defaultApps, ...storedApps, ...remoteApps]);
        });
    });
});

describe('When querying the directory', () => {
    beforeEach(async () => {
        setupConfigStoreWithUrl(DEV_APP_DIRECTORY_URL);
        setupEmptyDirectoryStorage();
        setupRemotesWithData([{url: DEV_APP_DIRECTORY_URL, applications: fakeApps}]);

        await createAppDirectory();
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setupDefaultConfigStore(): void {
    const config = new Store<ConfigurationObject>(require('../../gen/provider/config/defaults.json'));
    getterMock(mockConfigStore, 'config').mockReturnValue(config);
    getterMock(mockConfigStore, 'initialized').mockReturnValue(Promise.resolve());
}

function setupConfigStoreWithUrl(url: string): void {
    const config = new Store<ConfigurationObject>(require('../../gen/provider/config/defaults.json'));
    config.add({level: 'desktop'}, {applicationDirectory: url});

    getterMock(mockConfigStore, 'config').mockReturnValue(config);
    getterMock(mockConfigStore, 'initialized').mockReturnValue(Promise.resolve());
}

function setupEmptyDirectoryStorage(): void {
    getterMock(mockAppDirectoryStorage, 'changed').mockReturnValue(new Signal<[]>());
    mockAppDirectoryStorage.getStoredDirectoryShards.mockReturnValue([]);
}

function setupDirectoryStorage(data: StoredAppDirectoryShard[]): void {
    getterMock(mockAppDirectoryStorage, 'changed').mockReturnValue(new Signal<[]>());
    mockAppDirectoryStorage.getStoredDirectoryShards.mockReturnValue(data);
}

function setupOfflineRemotes(): void {
    global.fetch.mockImplementation(async (url: string) => {
        throw new Error();
    });
}

function setupRemotesWithData(data: {url: string; applications: Application[]}[]): void {
    global.fetch.mockImplementation(async (url: string) => {
        const result = data.find((entry) => entry.url === url);

        if (result) {
            return {
                ok: true,
                json: async () => result.applications
            };
        } else {
            throw new Error();
        }
    });
}

function setupEmptyCache(): void {
    global.localStorage.getItem.mockReturnValue(null);
}

function setupCacheWithData(data: {url: string; applications: Application[]}[]): void {
    global.localStorage.getItem.mockImplementation((key: string) => {
        switch (key) {
            case StorageKeys.DIRECTORY_CACHE:
                return JSON.stringify(data);
            default:
                return null;
        }
    });
}

async function createAppDirectory(): Promise<void> {
    appDirectory = new AppDirectory(mockAppDirectoryStorage, mockConfigStore);
    await appDirectory.delayedInit();
}
