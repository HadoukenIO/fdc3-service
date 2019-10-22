import 'jest';
import 'reflect-metadata';

import {Identity} from 'hadouken-js-adapter';
import {_Window} from 'hadouken-js-adapter/out/types/src/api/window/window';

import {Intent} from '../../../src/client/intents';
import {fin} from '../utils/fin';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {TestAppData, setupTeardown, setupQuitAppAfterEach, NonDirectoryTestAppData, quitApps} from '../utils/common';
import {testManagerIdentity, testAppNotInDirectory1, testAppWithPreregisteredListeners1, testAppInDirectory2} from '../constants';
import {IntentResolution, Context, ResolveError, ResolveErrorMessage} from '../../../src/client/main';
import {delay} from '../utils/delay';

/**
 * Intent registered by `testAppWithPreregisteredListeners1` right after opening
 */
const preregisteredIntent: Intent = {
    type: 'test.IntentNamePreregistered',
    context: {type: 'preregistered.IntentNamePreregisteredContext'}
};
const appHandlingIntent: TestAppData = testAppInDirectory2;

setupTeardown();

type ContextListener = jest.Mock | (() => any);

type TestParam = [
    string,
    TestAppData,
    ContextListener | undefined,
    any // The value IntentResolution.data should resolve to
];

const resolutionValueTests: TestParam[] = [
    ['a promise', appHandlingIntent, jest.fn(() => {
        return new Promise((resolve) => {
            resolve(1);
        });
    }), 1],
    ['a delayed async value', appHandlingIntent, jest.fn(async () => {
        await delay(1000);
        return 1;
    }), 1],
    ['a literal', appHandlingIntent, jest.fn(() => 1), 1]
];

// E.g. When an intent handler returns an error

describe('Intent resolution', () => {
    describe.each(resolutionValueTests)(
        'When an intent handler returns %s',
        (testTitle: string, intentHandlingApp: TestAppData, listener: ContextListener | undefined, expectedValue: any) => {
            setupQuitAppAfterEach(intentHandlingApp);

            beforeEach(async () => {
                await openDirectoryApp(intentHandlingApp);
            });

            describe('When an app has 1 window', () => {
                test('The expected value is resolved', async () => {
                    await fdc3Remote.addIntentListener(intentHandlingApp, preregisteredIntent.type, listener);
                    const resolution = raiseIntent(preregisteredIntent, intentHandlingApp);
                    await testExpectedResolution(resolution, expectedValue);
                });

                test('And has multiple intent handlers, the expected value is resolved', async () => {
                    const listeners = new Array(4).fill(null).map(async (_, i) => {
                        return fdc3Remote.addIntentListener(intentHandlingApp, preregisteredIntent.type, createDelayedFunction(() => i, 2000 * (i + 1)));
                    });
                    await Promise.all(listeners);
                    const resolution = raiseIntent(preregisteredIntent, intentHandlingApp);
                    await testExpectedResolution(resolution, expectedValue);
                });
            });

            describe('When an app has multiple windows', () => {
                let children: Identity[];
                const WINDOW_COUNT = 3;

                beforeEach(async () => {
                    children = await createChildWindows(intentHandlingApp, WINDOW_COUNT);
                });

                test('The expected value is resolved', async () => {
                    await fdc3Remote.addIntentListener(intentHandlingApp, preregisteredIntent.type, listener);
                    const resolution = raiseIntent(preregisteredIntent, intentHandlingApp);

                    await testExpectedResolution(resolution, expectedValue);
                });

                test('And a child window has the only intent listener, the expected value gets resolved', async () => {
                    await fdc3Remote.addIntentListener(children[1], preregisteredIntent.type, listener);
                    const resolution = raiseIntent(preregisteredIntent, intentHandlingApp);

                    await testExpectedResolution(resolution, expectedValue);
                });

                test('And all the windows return a value, the first to return is the value resolved', async () => {
                    const childListeners = children.map(async (id, i) => {
                        return fdc3Remote.addIntentListener(id, preregisteredIntent.type, createDelayedFunction(() => i, 2000 * (i + 1)));
                    });
                    await Promise.all(childListeners);
                    const resolution = raiseIntent(preregisteredIntent, intentHandlingApp);
                    await testExpectedResolution(resolution, expectedValue);
                });
            });
        }
    );

    describe('Error handling', () => {
        const intentHandlingApp: TestAppData = appHandlingIntent;
        const errorFn = () => {
            throw new Error();
        };
        setupQuitAppAfterEach(intentHandlingApp);
        beforeEach(async () => {
            await openDirectoryApp(intentHandlingApp);
        });

        describe('When there is a single window', () => {
            test('And there is 1 intent handler that throws an error, an error is thrown', async () => {
                await fdc3Remote.addIntentListener(intentHandlingApp, preregisteredIntent.type, errorFn);
                const resolution = raiseIntent(preregisteredIntent, intentHandlingApp);
                await expect(resolution).rejects.toThrowError();
            });

            test('And there is multiple intent handlers that do not throw an error, a value is returned', async () => {
                await fdc3Remote.addIntentListener(intentHandlingApp, preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(intentHandlingApp, preregisteredIntent.type, () => true);
                const resolution = raiseIntent(preregisteredIntent, intentHandlingApp);
                await expect(resolution).resolves.toHaveProperty('data', true);
            });

            test('And there is multiple intent handlers that return void, null is returned', async () => {
                await fdc3Remote.addIntentListener(intentHandlingApp, preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(intentHandlingApp, preregisteredIntent.type, () => {});
                const resolution = raiseIntent(preregisteredIntent, intentHandlingApp);
                await expect(resolution).resolves.toHaveProperty('data', null);
            });
        });

        describe('When there is multiple windows', () => {
            let children: Identity[];
            beforeEach(async () => {
                children = await createChildWindows(intentHandlingApp, 3);
            });

            test('And there is only 1 intent handler on a child window that throws, an error is thrown', async () => {
                await fdc3Remote.addIntentListener(children[0], preregisteredIntent.type, errorFn);
                const resolution = raiseIntent(preregisteredIntent, intentHandlingApp);
                await expect(resolution).rejects.toThrowError();
            });

            test('And there is an error on the main window, and a value returned on another window, the value is resolved', async () => {
                await fdc3Remote.addIntentListener(intentHandlingApp, preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(children[1], preregisteredIntent.type, () => true);
                const resolution = raiseIntent(preregisteredIntent, intentHandlingApp);
                await expect(resolution).resolves.toHaveProperty('data', true);
            });

            test('And there are multiple listeners across windows that error and only 1 returns void, null is resolved', async () => {
                await fdc3Remote.addIntentListener(intentHandlingApp, preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(intentHandlingApp, preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(children[0], preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(children[1], preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(children[2], preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(children[2], preregisteredIntent.type, () => {});
                const resolution = raiseIntent(preregisteredIntent, intentHandlingApp);
                await expect(resolution).resolves.toHaveProperty('data', null);
            });
        });
    });
});

async function testExpectedResolution(resolution: Promise<IntentResolution>, expectedValue: any): Promise<void> {
    if (expectedValue instanceof Error) {
        const errorRegex = new RegExp(ResolveErrorMessage[ResolveError.IntentHandlerException]);
        await expect(resolution).rejects.toThrowError(errorRegex);
    } else {
        await expect(resolution).resolves.toHaveProperty('data', expectedValue);
    }
}

function raiseIntent(intent: Intent, target: TestAppData): Promise<IntentResolution> {
    return fdc3Remote.raiseIntent(
        testManagerIdentity,
        intent.type,
        intent.context,
        target.name
    );
}

function createDelayedFunction(fn: (...args: any[]) => any, time: number): () => Promise<any> {
    return async () => {
        await delay(time);
        return fn();
    };
}

async function createChildWindows(target: Identity, number: number): Promise<Identity[]> {
    const ids = new Array(number)
        .fill(null)
        .map((_, i) => fdc3Remote.createFinWindow(target, {name: `child-window-${i}`, url: 'http://localhost:3923/test/test-app.html'}));
    return Promise.all(ids);
}

async function openDirectoryApp(app: TestAppData) {
    await fdc3Remote.open(testManagerIdentity, app.name);
    return testManagerIdentity;
}

async function openNonDirectoryApp(app: NonDirectoryTestAppData): Promise<Identity> {
    return (await fin.Application.startFromManifest(app.manifestUrl)).identity;
}
