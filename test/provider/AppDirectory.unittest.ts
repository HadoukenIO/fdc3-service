import 'jest';
import 'reflect-metadata';

import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {Application} from '../../src/client/directory';


enum StorageKeys {
    URL = 'url',
    APPLICATIONS = 'applications'
}

const appTemplate: Application = {
    appId: 'id',
    name: 'test-app',
    manifest: '',
    manifestType: '',
    intents: [
        {
            name: 'Call',
            contexts: [
                'dial'
            ],
            customConfig: {}
        }
    ]
};

// Generate applications
const generateApplications = (amount: number): Application[] => {
    return Array(amount).fill(appTemplate).map((app, i) => ({
        ...app,
        appId: `id-${i}`,
        name: `${app.name}-${i}`
    }));
};

describe('AppDirectory Unit Tests', () => {
    let appDirectory: AppDirectory;
    let store: LocalForage;

    afterEach(async () => {
        await store.clear();
    });

    describe('Storage', () => {
        beforeEach(async () => {
            appDirectory = new AppDirectory();
        });

        afterEach(async () => {
            await store.clear();
        });

        it('Correctly sets up the store', async () => {
            store = appDirectory['_store'];
            // await store.ready();
            const url = await store.getItem(StorageKeys.URL);
            const applications = await store.getItem(StorageKeys.APPLICATIONS);
            expect(url).toEqual(null);
            expect(applications).toEqual(null);
        });

        describe('Storing fetchData', () => {
            it('Correctly sets applications in the store', async () => {
                appDirectory['fetchData'] = jest.fn(() => Promise.resolve([]));
                await appDirectory.getAllApps();
                const applications = await store.getItem(StorageKeys.APPLICATIONS);
                expect(applications).toEqual([]);
            });

            it('Correctly stores fetchData in the store and in memory', async () => {
                const fakeApps = generateApplications(3);
                appDirectory['fetchData'] = jest.fn(() => Promise.resolve(fakeApps));
                const returnedApplications = await appDirectory.getAllApps();
                const storedApplications = await store.getItem(StorageKeys.APPLICATIONS);
                expect(storedApplications).toEqual(fakeApps);
                expect(returnedApplications).toEqual(fakeApps);
            });
        });
    });

    describe('Calls to', () => {
        const fakeApps = generateApplications(3);
        beforeEach(async () => {
            appDirectory = new AppDirectory();
            appDirectory['fetchData'] = jest.fn(() => Promise.resolve(fakeApps));
        });

        it('getAppByName', async () => {
            const exists = await appDirectory.getAppByName('test-app-0');
            const doesNotExist = await appDirectory.getAppByName('non-existent-app');

            expect(exists).toBeDefined();
            expect(exists).toEqual(fakeApps[0]);
            expect(doesNotExist).toBeNull();
        });

        it('getAllApps', async () => {
            const apps = await appDirectory.getAllApps();
            expect(apps).toEqual(fakeApps);
        });

        it('getAppsByIntent', async () => {
            const apps = await appDirectory.getAppsByIntent('Call');
            expect(apps).toEqual(fakeApps);
        });
    });
});
