import 'jest';
import 'reflect-metadata';

import {Identity} from 'hadouken-js-adapter';

import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {TestAppData, setupTeardown, setupOpenDirectoryAppBookends, DirectoryTestAppData} from '../utils/common';
import {testManagerIdentity, testAppInDirectory2, testAppUrl} from '../constants';
import {IntentResolution, RaiseIntentError} from '../../../src/client/main';
import {delay} from '../utils/delay';
import {Timeouts} from '../../../src/provider/constants';
import {Intent} from '../../../src/provider/intents';

/**
 * Intent registered by `testAppWithPreregisteredListeners1` right after opening
 */
const preregisteredIntent: Intent = {
    type: 'test.IntentNamePreregistered',
    context: {type: 'preregistered.IntentNamePreregisteredContext'}
};
const appHandlingIntent: DirectoryTestAppData = testAppInDirectory2;

setupTeardown();

type TestParam = [
    string,
    () => any,
    any // The value IntentResolution.data should resolve to
];

const resolutionTestParams: TestParam[] = [
    ['a delayed value', async () => {
        await delay(1000);
        return 'intent-result';
    }, 'intent-result'],
    ['a literal', () => 'intent-result', 'intent-result'],
    ['undefined', () => undefined, undefined]
];
describe('Intent resolution', () => {
    setupOpenDirectoryAppBookends(appHandlingIntent);

    describe.each(resolutionTestParams)(
        'When an intent handler returns %s',
        (testTitle: string, listener: () => any, expectedValue: any) => {
            describe('When an app has 1 window', () => {
                test('The expected value is resolved', async () => {
                    await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, listener);
                    const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                    await expect(resolution).resolves.toHaveProperty('data', expectedValue);
                });

                test('And has multiple intent handlers, the expected value is resolved', async () => {
                    const listeners = new Array(4).fill(null).map(async (_, i) => {
                        return fdc3Remote.addIntentListener(
                            appHandlingIntent,
                            preregisteredIntent.type,
                            createDelayedFunction(() => `delayed-value-${i}`, 2000 * (i + 1))
                        );
                    });
                    await Promise.all(listeners);
                    await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, listener);
                    const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                    let expected = expectedValue;
                    if (expected === undefined) {
                        expected = 'delayed-value-0';
                    }
                    await expect(resolution).resolves.toHaveProperty('data', expected);
                });
            });

            describe('When an app has multiple windows', () => {
                let children: Identity[];
                const WINDOW_COUNT = 3;

                beforeEach(async () => {
                    children = await createChildWindows(appHandlingIntent, WINDOW_COUNT);
                });

                test('The expected value is resolved', async () => {
                    await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, listener);
                    const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                    await expect(resolution).resolves.toHaveProperty('data', expectedValue);
                });

                test('And a child window has the only intent listener, the expected value gets resolved', async () => {
                    await fdc3Remote.addIntentListener(children[1], preregisteredIntent.type, listener);
                    const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                    await expect(resolution).resolves.toHaveProperty('data', expectedValue);
                });

                test('And all the windows return a value, the first to return a defined value is the value resolved', async () => {
                    const childListeners = children.map(async (id, i) => {
                        return fdc3Remote.addIntentListener(id, preregisteredIntent.type, createDelayedFunction(() => `delayed-value-${i}`, 2000 * (i + 1)));
                    });
                    await Promise.all(childListeners);
                    await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, listener);
                    const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                    let expected = expectedValue;
                    if (expected === undefined) {
                        expected = 'delayed-value-0';
                    }
                    await expect(resolution).resolves.toHaveProperty('data', expected);
                });
            });
        }
    );

    describe('Error handling', () => {
        const errorFn = () => {
            throw new Error();
        };

        describe('When there is a single window', () => {
            test('And there is 1 intent handler that throws an error, an FDC3 SendIntentError is thrown', async () => {
                await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, errorFn);
                const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                await expect(resolution).toThrowFDC3Error(RaiseIntentError.SendIntentError);
            });

            test('And there are multiple intent handlers that do not throw an error, a value is returned', async () => {
                await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, () => true);
                const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                await expect(resolution).resolves.toHaveProperty('data', true);
            });

            test('And there are multiple intent handlers that return void, undefined is returned', async () => {
                await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, () => {});
                const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                await expect(resolution).resolves.toHaveProperty('data', undefined);
            });
        });

        describe('When there are multiple windows', () => {
            let children: Identity[];
            beforeEach(async () => {
                children = await createChildWindows(appHandlingIntent, 3);
            });

            test('And there is 1 intent handler on a child window that throws after app maturity, an FDC3 SendIntentError is thrown', async () => {
                await fdc3Remote.addIntentListener(children[0], preregisteredIntent.type, errorFn);
                await delay(Timeouts.APP_MATURITY);
                const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                await expect(resolution).toThrowFDC3Error(RaiseIntentError.SendIntentError);
            });

            test('And there is 1 intent handler on a child window that throws while waiting for app maturity, an FDC3 error is thrown', async () => {
                await fdc3Remote.addIntentListener(children[0], preregisteredIntent.type, errorFn);
                const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                await expect(resolution).rejects.toThrowError();
            });

            test('And there is an error on the main window, and a value returned on another window, the value is resolved', async () => {
                await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(children[1], preregisteredIntent.type, () => true);
                const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                await expect(resolution).resolves.toHaveProperty('data', true);
            });

            test('And there are multiple listeners across windows that throw errors and only 1 returns void, undefined is resolved', async () => {
                await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(appHandlingIntent, preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(children[0], preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(children[1], preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(children[2], preregisteredIntent.type, errorFn);
                await fdc3Remote.addIntentListener(children[2], preregisteredIntent.type, () => {});
                const resolution = raiseIntent(preregisteredIntent, appHandlingIntent);
                await expect(resolution).resolves.toHaveProperty('data', undefined);
            });
        });
    });
});

function raiseIntent(intent: Intent, target: TestAppData): Promise<IntentResolution> {
    return fdc3Remote.raiseIntent(
        testManagerIdentity,
        intent.type,
        intent.context,
        target.name
    );
}

function createDelayedFunction<T>(fn: () => T, time: number): () => Promise<T> {
    return async () => {
        await delay(time);
        return fn();
    };
}

async function createChildWindows(target: Identity, number: number): Promise<Identity[]> {
    const ids = new Array(number)
        .fill(null)
        .map((_, i) => fdc3Remote.createFinWindow(target, {name: `child-window-${i}`, url: testAppUrl}));
    return Promise.all(ids);
}
