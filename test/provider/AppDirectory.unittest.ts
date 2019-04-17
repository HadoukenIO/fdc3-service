import 'jest';
import 'reflect-metadata';

import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {Application} from '../../src/client/directory';


describe('Storage', () => {
    let appDirectory: AppDirectory;
    let store: LocalForage;
    beforeEach(async () => {
        appDirectory = new AppDirectory();
    });

    afterEach(async () => {
        await store.clear();
    });

    it('Correctly sets up the store', async () => {
        store = appDirectory['_store'];
        await store.ready();
        const url = await store.getItem('url');
        const applications = await store.getItem('applications');
        expect(url).toEqual(null);
        expect(applications).toEqual([]);
    });

    it('Stores applications from the app directory path', async () => {

    });
});