import 'jest';
import fetch from 'node-fetch';
import {Identity} from 'openfin/_v2/main';

import {Application as DirectoryApp} from '../../src/client/directory';
import {Intents} from '../../src/client/intents';
import {Context} from '../../src/client/main';

import {fin} from './utils/fin';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {delay} from './utils/delay';

const testManagerIdentity = {
    uuid: 'test-app',
    name: 'test-app'
};

const testAppInDirectory = {
    uuid: 'test-app-1',
    name: 'test-app-1',
    appId: '100'
};

const testAppNotInDirectory: NonDirectoryApp = {
    uuid: 'test-app-not-in-directory',
    name: 'test-app-not-in-directory',
    manifestUrl: 'http://localhost:3923/test/configs/test-app-not-in-directory.json'
};

const validIntent = 'DialCall';

const invalidIntent = 'some-nonexistent-intent';

describe('Resolving applications by intent', () => {
    describe('Without context', () => {
        let directory: DirectoryApp[];

        beforeAll(async () => {
            // TODO: Replace this hard-coded string once possible (SERVICE-392?)
            // Fecth and store the current app directory
            directory = await fetch('http://localhost:3923/test/sample-app-directory.json').then(response => response.json());
        });

        describe('Without ad-hoc apps running', () => {
            test('When calling resolve with an intent which at least one directory application accepts, \
the returned object lists all and only those apps which accept the intent', async () => {
                // Query the actual app directory to find all apps which should be returned
                const expectedAppNames = getDirectoryAppsForIntent(directory, validIntent);

                // Resolve the valid intent
                const actualAppNames = await findIntent(validIntent).then(apps => apps.map(app => app.name));

                // Compare the two arrays (sorted as order doesn't matter)
                expect(actualAppNames.sort()).toEqual(expectedAppNames);
            });

            test('When calling resolve with an intent which no directory applications accept, the promise resolves to an empty array', async () => {
                // Resolve the invalid intent
                const actualApps = await findIntent(invalidIntent);

                // Expect no apps returned
                expect(actualApps).toEqual([]);
            });

            describe('When a directory app is running', () => {
                setupOpenDirectoryApp(testAppInDirectory);

                describe('But it does not register a listener for an intent it is supposed to handle', () => {
                    test('When calling findIntent with the intent, the app is NOT returned', async () => {
                        const appsForIntent = getDirectoryAppsForIntent(directory, validIntent);
                        const expectedAppNames = appsForIntent.filter(app => app !== testAppInDirectory.name);

                        const actualAppNames = await findIntent(validIntent).then(apps => apps.map(app => app.name));

                        expect(actualAppNames.sort()).toEqual(expectedAppNames);
                    });
                });

                describe('And it has registered a listener for an intent it is supposed to handle', () => {
                    beforeEach(async () => {
                        await fdc3Remote.addIntentListener(testAppInDirectory, validIntent);
                        await delay(300);
                    });

                    test('When calling findIntent with the intent, it is returned', async () => {
                        const expectedAppNames = getDirectoryAppsForIntent(directory, validIntent);

                        // Resolve the valid intent
                        const actualAppNames = await findIntent(validIntent).then(apps => apps.map(app => app.name));

                        // Compare the two arrays (sorted as order doesn't matter)
                        expect(actualAppNames.sort()).toEqual(expectedAppNames);
                    });
                });
            });
        });

        describe('With an ad-hoc app running', () => {
            beforeEach(async () => {
                setupStartNonDirectoryApp(testAppNotInDirectory);
            });

            describe('But the ad-hoc app has not registered a listener for the intent', () => {
                test('When calling findIntent with the intent, the ad-hoc app is NOT included in the results', async () => {
                    const expectedAppNames = getDirectoryAppsForIntent(directory, validIntent);

                    // Resolve the valid intent
                    const actualAppNames = await findIntent(validIntent).then(apps => apps.map(app => app.name));

                    // Compare the two arrays (sorted as order doesn't matter)
                    expect(actualAppNames.sort()).toEqual(expectedAppNames);
                });
            });
            describe('And the ad-hoc app has registered a listener for the intent', () => {
                beforeEach(async () => {
                    await fdc3Remote.addIntentListener(testAppNotInDirectory, validIntent);
                    await delay(300);
                });

                test('When calling findIntent with the intent, the ad-hoc app is returned among the results', async () => {
                    const directoryAppsForIntent = getDirectoryAppsForIntent(directory, validIntent);
                    const expectedAppNames = directoryAppsForIntent.concat([testAppNotInDirectory.name]).sort();

                    // Resolve the valid intent
                    const actualAppNames = await findIntent(validIntent).then(apps => apps.map(app => app.name));

                    // Compare the two arrays (sorted as order doesn't matter)
                    expect(actualAppNames.sort()).toEqual(expectedAppNames);
                });
            });
        });
    });

    describe('With context', () => {
        test.todo('TBD what resolving intent with context means as the spec is unclear');
    });
});

function getDirectoryAppsForIntent(directory: DirectoryApp[], targetIntent: string) {
    return directory.filter(app => app.intents && app.intents.some(intent => intent.name === targetIntent)).map(app => app.name).sort();
}

function findIntent(intent: string, context?: Context | undefined): Promise<DirectoryApp[]> {
    return fdc3Remote.findIntent(testManagerIdentity, intent, context)
        .then(appIntent => appIntent.apps);
}

// TODO: The below helper functions and types are copied from `raiseIntent` tests. Should put everything in a util file

function setupOpenDirectoryApp(app: AppIdentity) {
    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, app.name);
    });

    afterEach(async () => {
        await fin.Application.wrapSync(app).quit().catch(() => {});
    });
}

function setupStartNonDirectoryApp(app: NonDirectoryApp) {
    beforeEach(async () => {
        await fin.Application.startFromManifest(app.manifestUrl);
    });

    afterEach(async () => {
        await fin.Application.wrapSync(app).quit().catch(() => {});
    });
}

interface AppIdentity {
    uuid: string;
    name: string;
    appId?: string;
}

interface NonDirectoryApp extends AppIdentity {
    manifestUrl: string;
}
