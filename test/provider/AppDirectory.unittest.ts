import 'jest';
import 'reflect-metadata';

import {Application} from '../../src/client/directory';
import {AppIntent} from '../../src/client/main';
import {Injector} from '../../src/provider/common/Injector';
import {Inject} from '../../src/provider/common/Injectables';
import {DEV_APP_DIRECTORY_URL} from '../../src/provider/model/AppDirectory';

enum StorageKeys {
    URL = 'fdc3@url',
    APPLICATIONS = 'fdc3@applications'
}

const intentA = {
    name: 'testIntent.StartChat',
    contexts: ['testContext.User'],
    customConfig: {}
};
const intentB = {
    name: 'testIntent.SendEmail',
    contexts: ['testContext.User'],
    customConfig: {}
};
const intentC = {
    name: 'testIntent.StartChat',
    contexts: ['testContext.User', 'testContext.Bot'],
    customConfig: {}
};
const intentD = {
    name: 'testIntent.ShowChart',
    contexts: ['testContext.Instrument'],
    customConfig: {}
};
const fakeApp1 = {
    appId: '1',
    name: 'App 1',
    manifestType: '',
    manifest: '',
    intents: [intentA, intentB]
};
const fakeApp2 = {
    appId: '2',
    name: 'App 2',
    manifestType: '',
    manifest: '',
    intents: [intentC, intentD]
};

declare const global: NodeJS.Global & {localStorage: Store} & {fetch: (url: string) => Promise<Response>};

type Store = jest.Mocked<Pick<typeof localStorage, 'getItem' | 'setItem'>>;

const fakeApps: Application[] = [fakeApp1, fakeApp2];
const fakeAppsJSON = JSON.stringify(fakeApps);

// Define localStorage global/window
Object.defineProperty(global, 'localStorage', {
    value: {
        getItem: jest.fn(),
        setItem: jest.fn()
    },
    writable: true
});

const mockJson = jest.fn().mockImplementation(() => {
    return fakeApps;
});


beforeEach(() => {
    jest.restoreAllMocks();

    global.localStorage = {
        getItem: jest.fn().mockImplementation((key: string) => {
            switch (key) {
                case StorageKeys.APPLICATIONS:
                    return fakeAppsJSON;
                case StorageKeys.URL:
                    return DEV_APP_DIRECTORY_URL;
                default:
                    return null;
            }
        }),
        setItem: jest.fn((key: string, value: string) => {})
    };

    (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: mockJson
    });
});

describe('AppDirectory Unit Tests', () => {
    describe('When querying the Directory', () => {
        beforeEach(() => {
            mockJson.mockResolvedValue(fakeApps);
            const configStore = Injector.get<'CONFIG_STORE'>(Inject.CONFIG_STORE);
            configStore.config.add({level: 'desktop'}, {applicationDirectory: DEV_APP_DIRECTORY_URL});
        });

        it('Loads directory and URL from the store', async () => {
            const appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);

            expect(appDirectory['_directory']).toEqual([]);
            expect(appDirectory['_url']).toEqual(DEV_APP_DIRECTORY_URL);
        });

        describe('Refreshing the directory', () => {
            beforeEach(() => {
                mockJson.mockResolvedValue(fakeApps);
            });

            it('Fetches & updates the directory when URLs do not match', async () => {
                const appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);
                mockJson.mockResolvedValue([fakeApp1]);
                const spyGetItem = jest.spyOn(global.localStorage, 'getItem');
                const spyFetch = jest.spyOn(global, 'fetch');
                spyGetItem.mockImplementation(() => '__test_url__');
                appDirectory['_url'] = '*different_url*';

                const apps = await appDirectory.getAllApps();
                expect(apps).toEqual([fakeApp1]);
            });

            it('Use cached applications when the URLs are the same', async () => {
                const spyFetch = jest.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('')));
                const appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);
                const apps = await appDirectory.getAllApps();
                expect(apps).toEqual(fakeApps);
            });

            it('Use cached applications when fetching fails & URLs are the same', async () => {
                const spyFetch = jest.spyOn(global, 'fetch')
                    .mockImplementation(() => Promise.reject(new Error('')));
                const appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);
                const apps = await appDirectory.getAllApps();
                expect(apps).toEqual(fakeApps);
                expect(spyFetch).toBeCalled();
            });

            it('Return [] when fetching directory fails & URLs do not match', async () => {
                const spyFetch = jest.spyOn(global, 'fetch')
                    .mockImplementation(() => Promise.reject(new Error('')));
                const appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);
                appDirectory['_url'] = '**different_url**';
                const apps = await appDirectory.getAllApps();
                expect(apps).toEqual([]);
                expect(spyFetch).toBeCalled();
            });
        });

        it('getAllApps() returns all apps', async () => {
            const appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);
            const apps = await appDirectory.getAllApps();
            expect(apps).toEqual(fakeApps);
        });

        it('getAppByName() returns an application with the given name when it exists', async () => {
            const appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);
            const app = await appDirectory.getAppByName('App 1');
            expect(app).not.toBeNull();
        });

        it('getAppsByIntent() returns applications with the given intent when they exist', async () => {
            const appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);
            const apps = await appDirectory.getAppsByIntent('testIntent.SendEmail');
            expect(apps).toHaveLength(1);
        });
    });
});

describe('Given an App Directory with apps', () => {
    const appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);

    describe('When finding app intents by context with a context implemented by 2 intents in both apps', () => {
        beforeEach(() => {
            mockJson.mockResolvedValue(fakeApps);
        });
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
        beforeEach(() => {
            mockJson.mockResolvedValue(fakeApps);
        });
        it('Should return an empty array', async () => {
            const intents = await appDirectory.getAppIntentsByContext('testContext.NonExistent');

            expect(intents).toEqual([] as AppIntent[]);
        });
    });

    describe('When finding app intents by context with a context implemented by only 1 intent in 1 app', () => {
        beforeEach(() => {
            mockJson.mockResolvedValue(fakeApps);
        });
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
