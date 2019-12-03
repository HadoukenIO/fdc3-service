import 'jest';
import 'reflect-metadata';

import {Store} from 'openfin-service-config';
import {Signal} from 'openfin-service-signal';

import {Application} from '../../src/client/directory';
import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {ConfigurationObject} from '../../gen/provider/config/fdc3-config';
import {createFakeApp, createFakeUrl, createFakeIntent, createFakeContextType} from '../demo/utils/fakes';
import {createMockAppDirectoryStorage, getterMock, createMockConfigStore} from '../mocks';
import {StoredAppDirectoryShard} from '../../src/client/internal';
import {resolvePromiseChain} from '../utils/unit/time';

enum StorageKeys {
    DIRECTORY_CACHE = 'fdc3@directoryCache'
}

type LocalStore = jest.Mocked<Pick<typeof localStorage, 'getItem' | 'setItem'>>;

declare const global: NodeJS.Global & {localStorage: LocalStore} & {fetch: jest.Mock<Promise<Pick<Response, 'ok' | 'json'>>, [string]>};

Object.defineProperty(global, 'localStorage', {
    value: {
        getItem: jest.fn(),
        setItem: jest.fn()
    }
});

Object.defineProperty(global, 'fetch', {
    value: jest.fn()
});

const DEV_APP_DIRECTORY_URL = createFakeUrl();

const fakeApp1: Application = createFakeApp({
    customConfig: [{'name': 'appUuid', 'value': 'customUuid'}],
    intents: [createFakeIntent({contexts: [createFakeContextType(), createFakeContextType()]})]

});

const fakeApp2: Application = createFakeApp({
    intents: [createFakeIntent({contexts: [createFakeContextType(), createFakeContextType()]})]
});

const fakeApp3: Application = createFakeApp();

const mockAppDirectoryStorage = createMockAppDirectoryStorage();
const mockConfigStore = createMockConfigStore();

const fakeApps: Application[] = [fakeApp1, fakeApp2];
const cachedFakeApps: Application[] = [fakeApp1, fakeApp2, fakeApp3];

let appDirectory: AppDirectory;

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

        describe('When we have a mix of online, offline cached, and offline uncached remote snippets', () => {
            let onlineApps: Application[];
            let offlineCachedApps: Application[];

            beforeEach(async () => {
                const onlineUrl = createFakeUrl();
                const offlineCachedUrl = createFakeUrl();
                const offlineUncachedUrl = createFakeUrl();

                onlineApps = [createFakeApp(), createFakeApp()];
                offlineCachedApps = [createFakeApp(), createFakeApp()];

                setupRemotesWithData([{url: onlineUrl, applications: onlineApps}]);
                setupCacheWithData([{url: offlineCachedUrl, applications: offlineCachedApps}]);
                setupDirectoryStorage([
                    {urls: [onlineUrl], applications: []},
                    {urls: [offlineCachedUrl], applications: []},
                    {urls: [offlineUncachedUrl], applications: []}
                ]);

                await createAppDirectory();
            });

            test('All expect offline uncached snippets are used by the directory', async () => {
                await expect(appDirectory.getAllApps()).resolves.toEqual([...onlineApps, ...offlineCachedApps]);
            });

            test('All expect offline uncached snippets are cached by the directory', async () => {
                setupRemotesWithData([]);
                await createAppDirectory();

                await expect(appDirectory.getAllApps()).resolves.toEqual([...onlineApps, ...offlineCachedApps]);
            });
        });

        test('When stored snippets contain apps with conflicting names, the directory chooses one to use', async () => {
            const app1 = createFakeApp();
            const app2 = createFakeApp({name: app1.name});
            const app3 = createFakeApp({name: app1.name});

            setupDirectoryStorage([
                {urls: [], applications: [app1, createFakeApp()]},
                {urls: [], applications: [app2, createFakeApp()]},
                {urls: [], applications: [app3, createFakeApp()]}
            ]);

            await createAppDirectory();

            const allApps = await appDirectory.getAllApps();

            expect(allApps).toHaveLength(4);
            expect(allApps.filter((app) => app.name === app1.name)).toHaveLength(1);
        });

        test('When stored snippets contain apps with conflicting app IDs, the directory chooses one to use', async () => {
            const app1 = createFakeApp();
            const app2 = createFakeApp({appId: app1.appId});
            const app3 = createFakeApp({appId: app1.appId});

            setupDirectoryStorage([
                {urls: [], applications: [app1, createFakeApp()]},
                {urls: [], applications: [app2, createFakeApp()]},
                {urls: [], applications: [app3, createFakeApp()]}
            ]);

            await createAppDirectory();

            const allApps = await appDirectory.getAllApps();

            expect(allApps).toHaveLength(4);
            expect(allApps.filter((app) => app.name === app1.name)).toHaveLength(1);
        });

        test('When stored snippets contain apps with conflicting UUIDs, the directory chooses one to use', async () => {
            const app1 = createFakeApp();
            const app2 = createFakeApp({appId: app1.appId});
            const app3 = createFakeApp({customConfig: [{name: 'appUuid', value: app1.appId}]});

            setupDirectoryStorage([
                {urls: [], applications: [app1, createFakeApp()]},
                {urls: [], applications: [app2, createFakeApp()]},
                {urls: [], applications: [app3, createFakeApp()]}
            ]);

            await createAppDirectory();

            const allApps = await appDirectory.getAllApps();

            expect(allApps).toHaveLength(4);
            expect(allApps.filter((app) => app.name === app1.name)).toHaveLength(1);
        });

        test('When a mix of stored and remote snippets contain apps with conflicting names, the directory chooses one to use', async () => {
            const testUrl = createFakeUrl();

            const app1 = createFakeApp();
            const app2 = createFakeApp({name: app1.name});
            const app3 = createFakeApp({name: app1.name});

            setupDirectoryStorage([
                {urls: [], applications: [app1, createFakeApp()]},
                {urls: [], applications: [app2, createFakeApp()]},
                {urls: [testUrl], applications: []}
            ]);

            setupRemotesWithData([{url: testUrl, applications: [app3, createFakeApp()]}]);

            await createAppDirectory();

            const allApps = await appDirectory.getAllApps();

            expect(allApps).toHaveLength(4);
            expect(allApps.filter((app) => app.name === app1.name)).toHaveLength(1);
        });
    });
});

describe('When stored data changes', () => {
    let testUrl: string;

    let startStoredSnippet: Application[];
    let startRemoteSnippet: Application[];

    beforeEach(async () => {
        testUrl = createFakeUrl();

        startStoredSnippet = [createFakeApp(), createFakeApp(), createFakeApp()];
        startRemoteSnippet = [createFakeApp(), createFakeApp()];

        setupDefaultConfigStore();
        setupEmptyCache();
        setupDirectoryStorage([{urls: [testUrl], applications: startStoredSnippet}]);
        setupRemotesWithData([{url: testUrl, applications: startRemoteSnippet}]);

        await createAppDirectory();
    });

    test('When stored snippets change, the contents of the app directory changes', async () => {
        const endStoredSnippet = [createFakeApp(), createFakeApp()];

        changeDirectoryStorage([{urls: [testUrl], applications: endStoredSnippet}]);
        await resolvePromiseChain();

        await expect(appDirectory.getAllApps()).resolves.toEqual([...endStoredSnippet, ...startRemoteSnippet]);
    });

    test('When stored snippets change, existing remote snippets are not refetched', async () => {
        const endStoredSnippet = [createFakeApp(), createFakeApp()];
        global.fetch.mockReset();

        changeDirectoryStorage([{urls: [testUrl], applications: endStoredSnippet}]);
        await resolvePromiseChain();

        expect(global.fetch).not.toBeCalled();
    });

    test('When a URL is added to a shard, the new remote snippet is included in the app directory', async () => {
        const newUrl = createFakeUrl();
        const newRemoteSnippet = [createFakeApp(), createFakeApp()];

        setupRemotesWithData([{url: testUrl, applications: startRemoteSnippet}, {url: newUrl, applications: newRemoteSnippet}]);

        changeDirectoryStorage([{urls: [testUrl], applications: startStoredSnippet}, {urls: [newUrl], applications: []}]);
        await resolvePromiseChain();

        await expect(appDirectory.getAllApps()).resolves.toEqual([...startStoredSnippet, ...startRemoteSnippet, ...newRemoteSnippet]);
    });

    test('When a stored shared changes, the app directory fires a signal', async () => {
        const signalListener = jest.fn<void, []>();
        appDirectory.directoryChanged.add(signalListener);

        changeDirectoryStorage([]);
        await resolvePromiseChain();

        expect(signalListener).toBeCalled();
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

function changeDirectoryStorage(data: StoredAppDirectoryShard[]): void {
    mockAppDirectoryStorage.getStoredDirectoryShards.mockReturnValue(data);
    mockAppDirectoryStorage.changed.emit();
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
    const cache: Map<string, string> = new Map();
    const implementation = createCacheImplementation(cache);

    global.localStorage.getItem.mockImplementation(implementation[0]);
    global.localStorage.setItem.mockImplementation(implementation[1]);
}

function setupCacheWithData(data: {url: string; applications: Application[]}[]): void {
    const cache: Map<string, string> = new Map();
    cache.set(StorageKeys.DIRECTORY_CACHE, JSON.stringify(data));

    const implementation = createCacheImplementation(cache);

    global.localStorage.getItem.mockImplementation(implementation[0]);
    global.localStorage.setItem.mockImplementation(implementation[1]);
}

function createCacheImplementation(map: Map<string, string>): [(key: string) => string | null, (key: string, value: string) => void] {
    return [(key: string) => map.get(key) || null, (key: string, value: string) => map.set(key, value)];
}

async function createAppDirectory(): Promise<void> {
    appDirectory = new AppDirectory(mockAppDirectoryStorage, mockConfigStore);
    await appDirectory.delayedInit();
}
