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
    manifestType: ''
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


    describe('', () => {
    });
});
