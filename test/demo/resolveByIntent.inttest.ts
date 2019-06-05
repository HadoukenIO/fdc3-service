import 'jest';
import fetch from 'node-fetch';
import {Identity} from 'openfin/_v2/main';

import {Application as DirectoryApp} from '../../src/client/directory';
import {Intents} from '../../src/client/intents';
import {Context} from '../../src/client/main';

import * as fdc3Remote from './utils/fdc3RemoteExecution';

const testManagerIdentity = {
    uuid: 'test-app',
    name: 'test-app'
};

describe('Resolving applications by intent', () => {
    describe('Without context', () => {
        let directory: DirectoryApp[];
        const validIntent = Intents.DIAL_CALL;
        const invalidIntent = 'some-nonexistent-intent';

        beforeAll(async () => {
            // TODO: Replace this hard-coded string once possible (SERVICE-392?)
            // Fecth and store the current app directory
            directory = await fetch('http://localhost:3923/provider/sample-app-directory.json').then(response => response.json());
        });

        test('When calling resolve with an intent which at least one directory application accepts, \
the returned object lists all and only those apps which accept the intent', async () => {
            // Query the actual app directory to find all apps which should be returned
            const expectedAppNames = directory.filter(app => app.intents && app.intents.some(intent => intent.name === validIntent)).map(app => app.name);

            // Resolve the valid intent
            const actualAppNames = await findIntent(validIntent).then(apps => apps.map(app => app.name));

            // Compare the two arrays (sorted as order doesn't matter)
            expect(actualAppNames.sort()).toEqual(expectedAppNames.sort());
        });

        test('When calling resolve with an intent which no directory applications accept, the promise resolves to an empty array', async () => {
            // Resolve the invalid intent
            const actualApps = await findIntent(invalidIntent);

            // Expect no apps returned
            expect(actualApps).toEqual([]);
        });
    });

    describe('With context', () => {
        test.todo('TBD what resolving intent with context means as the spec is unclear');
    });
});

function findIntent(intent: string, context: Context | undefined = undefined, sendFromIdentity?: Identity): Promise<DirectoryApp[]> {
    return fdc3Remote.findIntent(sendFromIdentity || testManagerIdentity, intent, context)
        .then(appIntent => appIntent.apps);
}
