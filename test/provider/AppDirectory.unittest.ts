import 'jest';
import 'reflect-metadata';

import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {Application} from '../../src/client/directory';
import {AppIntent} from '../../src/client/main';

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

const mockJson = jest.fn();

beforeEach(() => {
    jest.restoreAllMocks();

    global.localStorage = {
        getItem: jest.fn().mockImplementation((key: string) => {
            switch (key) {
                case StorageKeys.APPLICATIONS:
                    return fakeAppsJSON;
                case StorageKeys.URL:
                    return 'http://localhost:3923/provider/sample-app-directory.json';
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
    describe('When directory is initialized', () => {
        it('Loads directory and URL from the store', async () => {
            const appDirectory = new AppDirectory();
            expect(appDirectory['_directory']).toEqual(fakeApps);
            expect(appDirectory['_url']).toEqual('http://localhost:3923/provider/sample-app-directory.json');
        });

        it('Handles corrupt cached JSON in the store & resets it', () => {
            global.localStorage.getItem.mockImplementation((key: string) => {
                return key === StorageKeys.APPLICATIONS ? '__not_valid_json__' : 'http://localhost';
            });

            const appDirectory = new AppDirectory();
            // Clear the corrupted data
            expect(localStorage.getItem).toBeCalled();
            expect(appDirectory['_directory']).toEqual([]);
        });
    });

    describe('When querying the Directory', () => {
        beforeEach(() => {
            mockJson.mockResolvedValue(fakeApps);
        });

        describe('Refreshing the directory', () => {
            beforeEach(() => {
                mockJson.mockResolvedValue(fakeApps);
            });

            it('Fetches & updates the directory when URLs do not match', async () => {
                const appDirectory = new AppDirectory();
                mockJson.mockResolvedValue([fakeApp1]);
                const spyGetItem = jest.spyOn(global.localStorage, 'getItem');
                const spyFetch = jest.spyOn(global, 'fetch');
                spyGetItem.mockImplementation(() => '__test_url__');
                appDirectory['_url'] = '*different_url*';

                const apps = await appDirectory.getAllApps();
                expect(spyFetch).toBeCalledTimes(1);
                expect(apps).toEqual([fakeApp1]);
            });

            it('Use cached applications when the URLs are the same', async () => {
                const spyFetch = jest.spyOn(global, 'fetch');
                const appDirectory = new AppDirectory();
                const apps = await appDirectory.getAllApps();
                console.log('getItem', global.localStorage.getItem(StorageKeys.URL));
                console.log('memory url', appDirectory['_url']);
                expect(spyFetch).not.toBeCalled();
                expect(apps).toEqual(fakeApps);
            });

            it('Use cached applications when fetchData fails', async () => {
                const spyFetch = jest.spyOn(global, 'fetch')
                    .mockResolvedValue(Promise.reject(new Error('')));
                const appDirectory = new AppDirectory();
                appDirectory['_url'] = '*new_url*';
                const apps = await appDirectory.getAllApps();
                console.log(apps);
                expect(apps).toEqual(fakeApps);
                expect(spyFetch).toBeCalled();
            });
        });

        it('getAllApps() returns all apps', async () => {
            const appDirectory = new AppDirectory();
            const apps = await appDirectory.getAllApps();
            expect(apps).toEqual(fakeApps);
        });

        it('getAppByName() returns an application with the given name when it exists', async () => {
            const appDirectory = new AppDirectory();
            const app = await appDirectory.getAppByName('App 1');
            expect(app).not.toBeNull();
        });

        it('getAppsByIntent() returns applications with the given intent when they exist', async () => {
            const appDirectory = new AppDirectory();
            const apps = await appDirectory.getAppsByIntent('testIntent.SendEmail');
            expect(apps).toHaveLength(1);
        });
    });
});

describe('Given an App Directory with apps', () => {
    const appDirectory = new AppDirectory();

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
