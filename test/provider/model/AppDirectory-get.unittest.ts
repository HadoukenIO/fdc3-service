import 'jest';
import 'reflect-metadata';

import {Signal} from 'openfin-service-signal';

import {Application} from '../../../src/client/directory';
import {AppDirectory} from '../../../src/provider/model/AppDirectory';
import {createFakeApp, createFakeUrl, createFakeIntent, createFakeContextType} from '../../demo/utils/fakes';
import {createMockAppDirectoryStorage, getterMock} from '../../mocks';
import {resolvePromiseChain} from '../../utils/unit/time';
import {StoredAppDirectoryShard} from '../../../src/client/internal';
import {ScopedAppDirectoryShard, DomainShardScope} from '../../../src/provider/model/AppDirectoryStorage';

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

const fakeApps: Application[] = [fakeApp1, fakeApp2];
const cachedFakeApps: Application[] = [fakeApp1, fakeApp2, fakeApp3];

let appDirectory: AppDirectory;

beforeEach(() => {
    jest.restoreAllMocks();
});

describe('When fetching initial data', () => {
    describe('When our source is a single URL from the config store', () => {
        beforeEach(async () => {
            setupDirectoryStorage([], DEV_APP_DIRECTORY_URL);
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

                test('We receive an empty array', async () => {
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
        });

        test('When we have multiple stored snippets, all are used by the directory', async () => {
            const domain1: string = createFakeDomain();
            const domain2: string = createFakeDomain();
            const domain3: string = createFakeDomain();

            const storedApps1 = [createFakeAppForDomain(domain1)];
            const storedApps2 = [createFakeAppForDomain(domain2), createFakeAppForDomain(domain2)];
            const storedApps3 = [createFakeAppForDomain(domain3), createFakeAppForDomain(domain3), createFakeAppForDomain(domain3)];

            setupDirectoryStorage([
                {domain: domain1, shard: {urls: [], applications: storedApps1}},
                {domain: domain2, shard: {urls: [], applications: storedApps2}},
                {domain: domain3, shard: {urls: [], applications: storedApps3}}
            ]);

            await createAppDirectory();

            await expect(appDirectory.getAllApps()).resolves.toEqual([...storedApps1, ...storedApps2, ...storedApps3]);
        });

        test('When we have a mix of stored and remote snippets, all are used by the directory', async () => {
            const domain1: string = createFakeDomain();
            const domain2: string = createFakeDomain();

            const remoteUrl = createFakeUrlForDomain(domain2);

            const storedApps = [createFakeAppForDomain(domain1), createFakeAppForDomain(domain1)];
            const remoteApps = [createFakeAppForDomain(domain2), createFakeAppForDomain(domain2)];

            setupDirectoryStorage([
                {domain: domain1, shard: {urls: [], applications: storedApps}},
                {domain: domain2, shard: {urls: [remoteUrl], applications: []}}
            ]);
            setupRemotesWithData([{url: remoteUrl, applications: remoteApps}]);

            await createAppDirectory();

            await expect(appDirectory.getAllApps()).resolves.toEqual([...storedApps, ...remoteApps]);
        });

        test('When we have a mix of snippets and a config store URL, all are used by the directory', async () => {
            const domain: string = createFakeDomain();

            const defaultUrl = createFakeUrl();
            const remoteUrl = createFakeUrlForDomain(domain);

            const defaultApps = [createFakeApp(), createFakeApp(), createFakeApp()];
            const storedApps = [createFakeAppForDomain(domain), createFakeAppForDomain(domain)];
            const remoteApps = [createFakeAppForDomain(domain), createFakeAppForDomain(domain)];

            setupRemotesWithData([{url: defaultUrl, applications: defaultApps}, {url: remoteUrl, applications: remoteApps}]);
            setupDirectoryStorage([
                {domain, shard: {urls: [remoteUrl], applications: storedApps}}
            ], defaultUrl);

            await createAppDirectory();

            await expect(appDirectory.getAllApps()).resolves.toEqual([...defaultApps, ...storedApps, ...remoteApps]);
        });

        describe('When we have a mix of online, offline cached, and offline uncached remote snippets', () => {
            let onlineApps: Application[];
            let offlineCachedApps: Application[];

            beforeEach(async () => {
                const domain1: string = createFakeDomain();
                const domain2: string = createFakeDomain();
                const domain3: string = createFakeDomain();

                const onlineUrl = createFakeUrlForDomain(domain1);
                const offlineCachedUrl = createFakeUrlForDomain(domain2);
                const offlineUncachedUrl = createFakeUrlForDomain(domain3);

                onlineApps = [createFakeAppForDomain(domain1), createFakeAppForDomain(domain1)];
                offlineCachedApps = [createFakeAppForDomain(domain2), createFakeAppForDomain(domain2)];

                setupRemotesWithData([{url: onlineUrl, applications: onlineApps}]);
                setupCacheWithData([{url: offlineCachedUrl, applications: offlineCachedApps}]);
                setupDirectoryStorage([
                    {domain: domain1, shard: {urls: [onlineUrl], applications: []}},
                    {domain: domain2, shard: {urls: [offlineCachedUrl], applications: []}},
                    {domain: domain3, shard: {urls: [offlineUncachedUrl], applications: []}}
                ]);

                await createAppDirectory();
            });

            test('All except offline uncached snippets are used by the directory', async () => {
                await expect(appDirectory.getAllApps()).resolves.toEqual([...onlineApps, ...offlineCachedApps]);
            });

            test('All except offline uncached snippets are cached by the directory', async () => {
                setupRemotesWithData([]);
                await createAppDirectory();

                await expect(appDirectory.getAllApps()).resolves.toEqual([...onlineApps, ...offlineCachedApps]);
            });
        });

        test('When stored snippets contain apps with conflicting names, the directory chooses one to use', async () => {
            const domain1: string = createFakeDomain();
            const domain2: string = createFakeDomain();
            const domain3: string = createFakeDomain();

            const app1 = createFakeAppForDomain(domain1);
            const app2 = createFakeAppForDomain(domain2, {name: app1.name});
            const app3 = createFakeAppForDomain(domain3, {name: app1.name});

            setupDirectoryStorage([
                {domain: domain1, shard: {urls: [], applications: [app1, createFakeAppForDomain(domain1)]}},
                {domain: domain2, shard: {urls: [], applications: [app2, createFakeAppForDomain(domain2)]}},
                {domain: domain3, shard: {urls: [], applications: [app3, createFakeAppForDomain(domain3)]}}
            ]);

            await createAppDirectory();

            const allApps = await appDirectory.getAllApps();

            expect(allApps).toHaveLength(4);
            expect(allApps.filter((app) => app.name === app1.name)).toHaveLength(1);
        });

        test('When stored snippets contain apps with conflicting app IDs, the directory chooses one to use', async () => {
            const domain1: string = createFakeDomain();
            const domain2: string = createFakeDomain();
            const domain3: string = createFakeDomain();

            const app1 = createFakeAppForDomain(domain1);
            const app2 = createFakeAppForDomain(domain2, {appId: app1.appId});
            const app3 = createFakeAppForDomain(domain3, {appId: app1.appId});

            setupDirectoryStorage([
                {domain: domain1, shard: {urls: [], applications: [app1, createFakeAppForDomain(domain1)]}},
                {domain: domain2, shard: {urls: [], applications: [app2, createFakeAppForDomain(domain2)]}},
                {domain: domain3, shard: {urls: [], applications: [app3, createFakeAppForDomain(domain3)]}}
            ]);

            await createAppDirectory();

            const allApps = await appDirectory.getAllApps();

            expect(allApps).toHaveLength(4);
            expect(allApps.filter((app) => app.appId === app1.appId)).toHaveLength(1);
        });

        test('When stored snippets contain apps with conflicting UUIDs, the directory chooses one to use', async () => {
            const domain1: string = createFakeDomain();
            const domain2: string = createFakeDomain();
            const domain3: string = createFakeDomain();

            const app1 = createFakeAppForDomain(domain1);
            const app2 = createFakeAppForDomain(domain2, {appId: app1.appId});
            const app3 = createFakeAppForDomain(domain3, {customConfig: [{name: 'appUuid', value: app1.appId}]});

            setupDirectoryStorage([
                {domain: domain1, shard: {urls: [], applications: [app1, createFakeAppForDomain(domain1)]}},
                {domain: domain2, shard: {urls: [], applications: [app2, createFakeAppForDomain(domain2)]}},
                {domain: domain3, shard: {urls: [], applications: [app3, createFakeAppForDomain(domain3)]}}
            ]);

            await createAppDirectory();

            const allApps = await appDirectory.getAllApps();

            expect(allApps).toHaveLength(4);
            expect(allApps.filter((app) => AppDirectory.getUuidFromApp(app) === AppDirectory.getUuidFromApp(app1))).toHaveLength(1);
        });

        test('When a mix of stored and remote snippets contain apps with conflicting names, the directory chooses one to use', async () => {
            const domain1: string = createFakeDomain();
            const domain2: string = createFakeDomain();
            const domain3: string = createFakeDomain();

            const remoteUrl = createFakeUrlForDomain(domain3);

            const app1 = createFakeAppForDomain(domain1);
            const app2 = createFakeAppForDomain(domain2, {name: app1.name});
            const app3 = createFakeAppForDomain(domain3, {name: app1.name});

            setupDirectoryStorage([
                {domain: domain1, shard: {urls: [], applications: [app1, createFakeAppForDomain(domain1)]}},
                {domain: domain2, shard: {urls: [], applications: [app2, createFakeAppForDomain(domain2)]}},
                {domain: domain3, shard: {urls: [remoteUrl], applications: []}}
            ]);

            setupRemotesWithData([{url: remoteUrl, applications: [app3, createFakeAppForDomain(domain3)]}]);

            await createAppDirectory();

            const allApps = await appDirectory.getAllApps();

            expect(allApps).toHaveLength(4);
            expect(allApps.filter((app) => app.name === app1.name)).toHaveLength(1);
        });

        test('When a stored snippet contains an app from outside its domain, that app is not used by the directory', async () => {
            const insideDomain: string = createFakeDomain();
            const outsideDomain: string = createFakeDomain();

            const app1 = createFakeAppForDomain(insideDomain);
            const app2 = createFakeAppForDomain(outsideDomain);
            const app3 = createFakeAppForDomain(insideDomain);

            setupDirectoryStorage([
                {domain: insideDomain, shard: {urls: [], applications: [app1, app2, app3]}}
            ]);

            await createAppDirectory();

            await expect(appDirectory.getAllApps()).resolves.toEqual([app1, app3]);
        });

        test('When a stored shard references a remote snippet from outside its domain, that snippet is not used by the directory', async () => {
            const insideDomain: string = createFakeDomain();
            const outsideDomain: string = createFakeDomain();

            const app1 = createFakeAppForDomain(insideDomain);
            const app2 = createFakeAppForDomain(outsideDomain);
            const app3 = createFakeAppForDomain(insideDomain);

            const remoteSnippet = createFakeUrlForDomain(outsideDomain);

            setupDirectoryStorage([
                {domain: insideDomain, shard: {urls: [remoteSnippet], applications: [app1]}}
            ]);

            setupRemotesWithData([{url: remoteSnippet, applications: [app2, app3]}]);

            await createAppDirectory();

            await expect(appDirectory.getAllApps()).resolves.toEqual([app1]);
        });

        test('When a remote snippet contains an app from outside its domain, that app is not used by the directory', async () => {
            const insideDomain: string = createFakeDomain();
            const outsideDomain: string = createFakeDomain();

            const app1 = createFakeAppForDomain(insideDomain);
            const app2 = createFakeAppForDomain(outsideDomain);
            const app3 = createFakeAppForDomain(insideDomain);

            const remoteSnippet = createFakeUrlForDomain(insideDomain);

            setupDirectoryStorage([
                {domain: insideDomain, shard: {urls: [remoteSnippet], applications: [app1]}}
            ]);

            setupRemotesWithData([{url: remoteSnippet, applications: [app2, app3]}]);

            await createAppDirectory();

            await expect(appDirectory.getAllApps()).resolves.toEqual([app1, app3]);
        });
    });
});

describe('When stored data changes', () => {
    let testDomain: string;
    let testUrl: string;

    let startStoredSnippet: Application[];
    let startRemoteSnippet: Application[];

    beforeEach(async () => {
        testDomain = createFakeDomain();
        testUrl = createFakeUrlForDomain(testDomain);

        startStoredSnippet = [createFakeAppForDomain(testDomain), createFakeAppForDomain(testDomain), createFakeAppForDomain(testDomain)];
        startRemoteSnippet = [createFakeAppForDomain(testDomain), createFakeAppForDomain(testDomain)];

        setupEmptyCache();
        setupDirectoryStorage([
            {domain: testDomain, shard: {urls: [testUrl], applications: startStoredSnippet}}
        ]);
        setupRemotesWithData([{url: testUrl, applications: startRemoteSnippet}]);

        await createAppDirectory();
    });

    test('When stored snippets change, the contents of the app directory changes', async () => {
        const endStoredSnippet = [createFakeAppForDomain(testDomain), createFakeAppForDomain(testDomain)];

        changeDirectoryStorage([
            {domain: testDomain, shard: {urls: [testUrl], applications: endStoredSnippet}}
        ]);
        await resolvePromiseChain();

        await expect(appDirectory.getAllApps()).resolves.toEqual([...endStoredSnippet, ...startRemoteSnippet]);
    });

    test('When stored snippets change, existing remote snippets are not refetched', async () => {
        const endStoredSnippet = [createFakeAppForDomain(testDomain), createFakeAppForDomain(testDomain)];
        global.fetch.mockReset();

        changeDirectoryStorage([
            {domain: testDomain, shard: {urls: [testUrl], applications: endStoredSnippet}}
        ]);
        await resolvePromiseChain();

        expect(global.fetch).not.toBeCalled();
    });

    test('When a URL is added to a shard, the new remote snippet is included in the app directory', async () => {
        const newDomain = createFakeDomain();
        const newUrl = createFakeUrlForDomain(newDomain);
        const newRemoteSnippet = [createFakeAppForDomain(newDomain), createFakeAppForDomain(newDomain)];

        setupRemotesWithData([{url: testUrl, applications: startRemoteSnippet}, {url: newUrl, applications: newRemoteSnippet}]);

        changeDirectoryStorage([
            {domain: testDomain, shard: {urls: [testUrl], applications: startStoredSnippet}},
            {domain: newDomain, shard: {urls: [newUrl], applications: []}}
        ]);
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
        setupDirectoryStorage([], DEV_APP_DIRECTORY_URL);
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

function setupDirectoryStorage(data: {domain: string; shard: StoredAppDirectoryShard}[], url?: string): void {
    getterMock(mockAppDirectoryStorage, 'initialized').mockReturnValue(Promise.resolve());
    getterMock(mockAppDirectoryStorage, 'changed').mockReturnValue(new Signal<[]>());
    mockAppDirectoryStorage.getDirectoryShards.mockReturnValue(createDirectoryShards(data, url));
}

function changeDirectoryStorage(data: {domain: string; shard: StoredAppDirectoryShard}[], url?: string): void {
    getterMock(mockAppDirectoryStorage, 'initialized').mockReturnValue(Promise.resolve());
    mockAppDirectoryStorage.getDirectoryShards.mockReturnValue(createDirectoryShards(data, url));
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

function createFakeDomain(): string {
    return new URL(createFakeUrl()).hostname;
}

function createFakeUrlForDomain(domain: string): string {
    const url = new URL(createFakeUrl());
    url.hostname = domain;

    return url.toString();
}

function createFakeAppForDomain(domain: string, options: Partial<Application> = {}): Application {
    return createFakeApp({manifest: createFakeUrlForDomain(domain), ...options});
}

async function createAppDirectory(): Promise<void> {
    appDirectory = new AppDirectory(mockAppDirectoryStorage);
    await appDirectory.delayedInit();
}

function createDirectoryShards(data: {domain: string; shard: StoredAppDirectoryShard}[], url?: string): ScopedAppDirectoryShard[] {
    const result: ScopedAppDirectoryShard[] = [];

    if (url) {
        result.push({
            scope: {type: 'global'},
            shard: {urls: [url], applications: []}
        });
    }

    result.push(...data.map((domainShard) => ({
        scope: {type: 'domain', domain: domainShard.domain} as DomainShardScope,
        shard: domainShard.shard
    })));

    return result;
}
