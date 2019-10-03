import 'jest';
import fetch from 'node-fetch';

import {Application as DirectoryApp} from '../../src/client/directory';
import {Context, AppIntent} from '../../src/client/main';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {delay} from './utils/delay';
import {setupStartNonDirectoryAppBookends, setupOpenDirectoryAppBookends, setupTeardown} from './utils/common';
import {testManagerIdentity, testAppInDirectory1, testAppNotInDirectory1} from './constants';

const validIntent = 'DialCall';

const invalidIntent = 'some-nonexistent-intent';

setupTeardown();

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
                const appIntent = await findIntent(validIntent);

                // Compare the two arrays (sorted as order doesn't matter)
                expect(extractSortedAppNames(appIntent)).toEqual(expectedAppNames);
            });

            test('When calling resolve with an intent which no directory applications accept, the promise resolves to an empty array', async () => {
                // Resolve the invalid intent
                const appIntent = await findIntent(invalidIntent);

                // Expect no apps returned
                expect(extractSortedAppNames(appIntent)).toEqual([]);
            });

            describe('When a directory app is running', () => {
                setupOpenDirectoryAppBookends(testAppInDirectory1);

                describe('But it does not register a listener for an intent it is supposed to handle', () => {
                    test('When calling findIntent with the intent, the app is NOT returned', async () => {
                        const appsForIntent = getDirectoryAppsForIntent(directory, validIntent);
                        const expectedAppNames = appsForIntent.filter(app => app !== testAppInDirectory1.name);

                        const appIntent = await findIntent(validIntent);

                        expect(extractSortedAppNames(appIntent)).toEqual(expectedAppNames);
                    });
                });

                describe('And it has registered a listener for an intent it is supposed to handle', () => {
                    beforeEach(async () => {
                        await fdc3Remote.addIntentListener(testAppInDirectory1, validIntent);
                        await delay(300);
                    });

                    test('When calling findIntent with the intent, it is returned', async () => {
                        const expectedAppNames = getDirectoryAppsForIntent(directory, validIntent);

                        // Resolve the valid intent
                        const appIntent = await findIntent(validIntent);

                        // Compare the two arrays (sorted as order doesn't matter)
                        expect(extractSortedAppNames(appIntent)).toEqual(expectedAppNames);
                    });
                });
            });
        });

        describe('With an ad-hoc app running', () => {
            setupStartNonDirectoryAppBookends(testAppNotInDirectory1);

            describe('But the ad-hoc app has not registered a listener for the intent', () => {
                test('When calling findIntent with the intent, the ad-hoc app is NOT included in the results', async () => {
                    const expectedAppNames = getDirectoryAppsForIntent(directory, validIntent);

                    // Resolve the valid intent
                    const appIntent = await findIntent(validIntent);

                    // Compare the two arrays (sorted as order doesn't matter)
                    expect(extractSortedAppNames(appIntent)).toEqual(expectedAppNames);
                });
            });
            describe('And the ad-hoc app has registered a listener for the intent', () => {
                beforeEach(async () => {
                    await fdc3Remote.addIntentListener(testAppNotInDirectory1, validIntent);
                    await delay(300);
                });

                test('When calling findIntent with the intent, the ad-hoc app is returned among the results', async () => {
                    const directoryAppsForIntent = getDirectoryAppsForIntent(directory, validIntent);
                    const expectedAppNames = directoryAppsForIntent.concat([testAppNotInDirectory1.name]).sort();

                    // Resolve the valid intent
                    const appIntent = await findIntent(validIntent);

                    expect(extractSortedAppNames(appIntent)).toEqual(expectedAppNames);
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

function extractSortedAppNames(appIntent: AppIntent): string[] {
    return appIntent.apps.map(app => app.name).sort();
}

function findIntent(intent: string, context?: Context | undefined): Promise<AppIntent> {
    return fdc3Remote.findIntent(testManagerIdentity, intent, context);
}
