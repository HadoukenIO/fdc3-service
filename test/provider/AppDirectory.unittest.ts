import 'jest';
import 'reflect-metadata';

import {Jest} from '@jest/environment';

import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {Application} from '../../src/client/directory';


enum StorageKeys {
    URL = 'fdc3@url',
    APPLICATIONS = 'fdc3@applications'
}

enum Intents {
    CALL = 'Call',
    CHART = 'Chart'
}

const appTemplate: Application = {
    appId: 'id',
    name: 'test-app',
    manifest: '',
    manifestType: '',
    intents: [
        {
            name: Intents.CALL,
            contexts: [
                'dial'
            ],
            customConfig: {}
        }
    ]
};

const fakeApps: Application[] = [
    {
        ...appTemplate, appId: 'id-0', name: 'test-app-0', intents: [
            {
                name: Intents.CALL,
                contexts: [
                    'dial'
                ],
                customConfig: {}
            }
        ]
    },
    {
        ...appTemplate, appId: 'id-1', name: 'test-app-1', intents: [
            {
                name: Intents.CALL,
                contexts: [
                    'dial'
                ],
                customConfig: {}
            }
        ]
    },
    {
        ...appTemplate, appId: 'id-2', name: 'test-app-2', intents: [
            {
                name: Intents.CHART,
                contexts: [
                    'chart'
                ],
                customConfig: {}
            }
        ]
    }
];

declare const global: NodeJS.Global & {localStorage: Store} & {fetch: (url: string) => Promise<Response>};

type Store = jest.Mocked<Pick<typeof localStorage, 'getItem' | 'setItem'>>;

interface ResponseOptions {
    readonly status: number;
}

/** Mock implementation */
class Response {
    private readonly _blob: string;
    private readonly _options: ResponseOptions;

    public constructor(blob: string, options: ResponseOptions) {
        this._blob = blob;
        this._options = options;
    }

    public get ok() {
        const {status} = this._options;
        return status >= 200 && status <= 400;
    }

    public async json() {
        return JSON.parse(this._blob);
    }
}

const fakeAppsJSON = JSON.stringify(fakeApps);

// Define localStorage global/window
Object.defineProperty(global, 'localStorage', {
    value: {
        getItem: jest.fn(),
        setItem: jest.fn()
    },
    writable: true
});

describe('AppDirectory Unit Tests', () => {
    beforeEach(() => {
        // Reset localStorage
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
        global.fetch = jest.fn().mockImplementation(async (url: string) => {
            return new Response(fakeAppsJSON, {status: 200});
        });
    });

    describe('When directory is initialized', () => {
        it('Loads directory and URL from the store', async () => {
            const appDirectory = new AppDirectory();
            expect(appDirectory['_directory']).toEqual(fakeApps);
            expect(appDirectory['_url']).toEqual('http://localhost:3923/provider/sample-app-directory.json');
        });

        it('Handles corrupt cached JSON in the store & resets it', () => {
            global.localStorage.getItem.mockImplementation((key: string) => {
                return StorageKeys.APPLICATIONS ? '__not_valid_json__' : 'http://localhost';
            });

            const appDirectory = new AppDirectory();
            // Clear the corrupted data
            expect(localStorage.getItem).toBeCalled();
            expect(appDirectory['_directory']).toEqual([]);
        });
    });

    describe('When querying the Directory', () => {
        describe('Refreshing the directory', () => {
            it('Fetches & updates the directory when URLs do not match', async () => {
                const appDirectory = new AppDirectory();
                const newApplications = [{...appTemplate, name: 'test-app'}];
                const spyGetItem = jest.spyOn(global.localStorage, 'getItem');
                const spyFetch = jest.spyOn(global, 'fetch').mockImplementation(async () => {
                    return new Response(JSON.stringify(newApplications), {status: 200});
                });
                spyGetItem.mockImplementation(() => '__test_url__');
                appDirectory['_url'] = '*different_url*';

                const apps = await appDirectory.getAllApps();
                expect(spyFetch).toBeCalledTimes(1);
                expect(apps).toEqual(newApplications);
            });

            it('Cached applications are used when the URL are the same', async () => {
                const spyFetch = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response('[]', {status: 200}));
                const appDirectory = new AppDirectory();
                await appDirectory.getAllApps();
                expect(spyFetch).not.toBeCalled();
            });

            it('Uses cached applications when fetching the data fails', async () => {
                const spyFetch = jest.spyOn(global, 'fetch')
                    .mockImplementation(() => Promise.reject(new Error('')));
                const appDirectory = new AppDirectory();
                appDirectory['_url'] = '*new_url*';
                const apps = await appDirectory.getAllApps();
                expect(apps).not.toEqual([]);
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
            const app = await appDirectory.getAppByName('test-app-0');
            expect(app).not.toBeNull();
        });

        it('getAppsByIntent() returns applications with the given intent when they exist', async () => {
            const appDirectory = new AppDirectory();
            const apps = await appDirectory.getAppsByIntent(Intents.CHART);
            expect(apps).toHaveLength(1);
        });
    });
});
