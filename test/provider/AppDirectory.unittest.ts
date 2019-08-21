import 'jest';
import 'reflect-metadata';

import {Store} from 'openfin-service-config';

import {Application} from '../../src/client/directory';
import {AppIntent, Intent} from '../../src/client/main';
import {Injector} from '../../src/provider/common/Injector';
import {Inject} from '../../src/provider/common/Injectables';
import {DEV_APP_DIRECTORY_URL, AppDirectory} from '../../src/provider/model/AppDirectory';
import {ConfigurationObject} from '../../gen/provider/config/fdc3-config';
import {createMockEnvironmnent} from '../mocks';
import {Environment} from '../../src/provider/model/Environment';
import {ResolverResult} from '../../src/provider/controller/ResolverHandler';

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

declare const global: NodeJS.Global & {localStorage: LocalStore} & {fetch: (url: string) => Promise<Response>};

type LocalStore = jest.Mocked<Pick<typeof localStorage, 'getItem' | 'setItem'>>;

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

function setAppDirectoryUrl(url: string): void {
    const configStore = Injector.get<'CONFIG_STORE'>(Inject.CONFIG_STORE);
    configStore.config.add({level: 'desktop'}, {applicationDirectory: url});
}

beforeAll(async () => {
    const store = new Store<ConfigurationObject>(require('../../gen/provider/config/defaults.json'));
    Injector.rebind<'ENVIRONMENT'>(Inject.ENVIRONMENT).toConstantValue(createMockEnvironmnent() as Environment);
    Injector.rebind<'CONFIG_STORE'>(Inject.CONFIG_STORE).toConstantValue({
        config: store,
        initialized: Promise.resolve()
    });
    Injector.rebind<'RESOLVER'>(Inject.RESOLVER).toConstantValue({
        handleIntent: async (intent: Intent): Promise<ResolverResult> => {
            return {app: null!};
        },
        cancel: async (): Promise<void> => {},
        initialized: Promise.resolve()
    });

    await Injector.init();
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

    mockJson.mockResolvedValue(fakeApps);
});

describe('AppDirectory Unit Tests', () => {
    describe('When querying the Directory', () => {
        beforeEach(() => {
            setAppDirectoryUrl(DEV_APP_DIRECTORY_URL);
        });

        it('Loads directory and URL from the store', async () => {
            const appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);

            expect(appDirectory['_directory']).toEqual([]);
            expect(appDirectory['_url']).toEqual(DEV_APP_DIRECTORY_URL);
        });

        describe('Refreshing the directory', () => {
            it('Fetches & updates the directory when URLs do not match', async () => {
                const appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);
                mockJson.mockResolvedValue([fakeApp1]);
                const spyGetItem = jest.spyOn(global.localStorage, 'getItem');
                spyGetItem.mockImplementation(() => '__test_url__');
                setAppDirectoryUrl('*different_url*');

                const apps = await appDirectory.getAllApps();
                expect(apps).toEqual([fakeApp1]);
            });

            it('Use cached applications when the URLs are the same', async () => {
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

                setAppDirectoryUrl('**DIFFERENT URL**');

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
    let appDirectory: AppDirectory;

    describe('When finding app intents by context with a context implemented by 2 intents in both apps', () => {
        beforeEach(() => {
            appDirectory = Injector.get<'APP_DIRECTORY'>(Inject.APP_DIRECTORY);
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
