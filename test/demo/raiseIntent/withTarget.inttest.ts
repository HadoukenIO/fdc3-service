import 'jest';
import 'reflect-metadata';

import {Identity} from 'hadouken-js-adapter';

import {ResolveError} from '../../../src/client/errors';
import {Intent} from '../../../src/client/intents';
import {Timeouts} from '../../../src/provider/constants';
import {fin} from '../utils/fin';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {delay} from '../utils/delay';
import {TestAppData, DirectoryTestAppData, setupOpenDirectoryAppBookends, setupStartNonDirectoryAppBookends, setupTeardown, setupQuitAppAfterEach, waitForAppToBeRunning} from '../utils/common';
import {appStartupTime, testManagerIdentity, testAppInDirectory1, testAppNotInDirectory1, testAppWithPreregisteredListeners1, testAppNotFdc3, testAppUrl} from '../constants';

/**
 * Intent registered by `testAppWithPreregisteredListeners1` right after opening
 */
const preregisteredIntent: Intent = {
    type: 'test.IntentNamePreregistered',
    context: {type: 'preregistered.context'}
};

/**
 * An intent registered by `testAppInDirectory`
 */
const validIntent: Intent = {
    type: 'test.IntentName',
    context: {
        type: 'contact',
        name: 'Test Name',
        id: {
            twitter: 'testname'
        }
    }
};

/**
 * An intent not registered by any directory app, and no ad-hoc apps register it
 */
const nonExistentIntent: Intent = {
    type: 'some-nonexistent-intent',
    context: {type: 'some-nonexistent-context'}
};

setupTeardown();

describe('Intent listeners and raising intents with a target', () => {
    describe('When the target is in the directory', () => {
        describe('When the target is not running', () => {
            describe('When the target is *not* registered to accept the raised intent', () => {
                test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                    await expect(raiseIntent(nonExistentIntent, testAppInDirectory1)).toThrowFDC3Error(
                        ResolveError.TargetAppDoesNotHandleIntent,
                        `App '${testAppInDirectory1.name}' does not handle intent '${nonExistentIntent.type}'`
                    );
                });
            });

            describe('When the target is registered to accept the raised intent', () => {
                describe('And the listener is registered right after opening the app', () => {
                    setupQuitAppAfterEach(testAppWithPreregisteredListeners1);

                    test('The targeted app opens and its listener is triggered exactly once with the correct context', async () => {
                        await raiseIntent(preregisteredIntent, testAppWithPreregisteredListeners1);

                        // App should now be running
                        await expect(fin.Application.wrapSync(testAppWithPreregisteredListeners1).isRunning()).resolves.toBe(true);

                        const listener = await fdc3Remote.getRemoteIntentListener(testAppWithPreregisteredListeners1, preregisteredIntent.type);

                        await expect(listener).toHaveReceivedContexts([preregisteredIntent.context]);
                    });
                });

                describe('And the listener is added after a delay', () => {
                    setupQuitAppAfterEach(testAppInDirectory1);

                    describe('Delay is short enough for the intent handshake to succeed', () => {
                        test('The targeted app opens and its listener is triggered just once after it is set up, with the correct context', async () => {
                            // Raise the intent but only add the intent listener after the some time
                            await raiseDelayedIntentWithTarget(validIntent, testAppInDirectory1, 1500);

                            // Since the time is under the listener handshake timeout, intent should be triggered correctly
                            const listener = await fdc3Remote.getRemoteIntentListener(testAppInDirectory1, validIntent.type);
                            await expect(listener).toHaveReceivedContexts([validIntent.context]);
                        }, appStartupTime + 1500);
                    });

                    describe('Delay is longer than the threshold to add intent listeners', () => {
                        test('The targeted app opens but it times out waiting for the listener to be added', async () => {
                            // Raise the intent but only add the intent listener after the listener handshake timeout has been exceeded
                            const raiseIntentPromise = raiseDelayedIntentWithTarget(
                                validIntent,
                                testAppInDirectory1,
                                Timeouts.ADD_INTENT_LISTENER + 2000
                            );

                            await expect(raiseIntentPromise).toThrowFDC3Error(
                                ResolveError.IntentTimeout,
                                `Timeout waiting for intent listener to be added for intent: ${validIntent.type}`
                            );
                        }, appStartupTime + 1500);
                    });
                });
            });
        });

        describe('When the target is running', () => {
            setupOpenDirectoryAppBookends(testAppInDirectory1);
            setupCommonTests(testAppInDirectory1);
        });
    });

    describe('When the target is *not* in the directory', () => {
        describe('When the target is not running', () => {
            test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                await expect(raiseIntent(validIntent, testAppNotInDirectory1)).toThrowFDC3Error(
                    ResolveError.TargetAppNotAvailable,
                    `Couldn't resolve intent target '${testAppNotInDirectory1.name}'. No matching app in directory or currently running.`
                );
            });
        });

        describe('When the target is running but is not in the directory and does not connect to FDC3', () => {
            setupStartNonDirectoryAppBookends(testAppNotFdc3);

            test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                await expect(raiseIntent(validIntent, testAppNotFdc3)).toThrowFDC3Error(
                    ResolveError.TargetAppNotAvailable,
                    `Couldn't resolve intent target '${testAppNotFdc3.name}'. No matching app in directory or currently running.`
                );
            });
        });

        describe('When the target (which is an ad-hoc app) is running', () => {
            setupStartNonDirectoryAppBookends(testAppNotInDirectory1);
            setupCommonTests(testAppNotInDirectory1);
        });
    });
});

function setupCommonTests(testAppData: TestAppData): void {
    describe('When the target has *not* registered listeners for the raised intent', () => {
        test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
            await expect(raiseIntent(nonExistentIntent, testAppData)).toThrowFDC3Error(
                ResolveError.IntentTimeout,
                `Timeout waiting for intent listener to be added for intent: ${nonExistentIntent.type}`
            );
        });

        test('When the target has a child window with an intent listener, when calling raiseIntent from another app, \
the child listener is triggered exactly once with the correct context', async () => {
            const childIdentity = {uuid: testAppData.uuid, name: testAppData.name + '-child-window'};

            await fdc3Remote.createFinWindow(testAppData, {name: childIdentity.name, url: testAppUrl});
            const childListener = await fdc3Remote.addIntentListener(childIdentity, validIntent.type);

            await raiseIntent(validIntent, testAppData);

            await expect(childListener).toHaveReceivedContexts([validIntent.context]);
        });
    });

    test('When calling addIntentListener for the first time, the promise resolves and there are no errors', async () => {
        await expect(fdc3Remote.addIntentListener(testAppData, validIntent.type)).resolves.not.toThrow();
    });

    describe('When the target has registered listeners for the raised intent', () => {
        let listener: fdc3Remote.RemoteIntentListener;

        beforeEach(async () => {
            listener = await fdc3Remote.addIntentListener(testAppData, validIntent.type);
        });

        test('When calling raiseIntent from another app the listener is triggered exactly once with the correct context', async () => {
            await raiseIntent(validIntent, testAppData);

            await expect(listener).toHaveReceivedContexts([validIntent.context]);
        });

        test('When registering a duplicate intent listener, then calling raiseIntent from another app, \
both listeners are triggered exactly once with the correct context', async () => {
            const duplicateListener = await fdc3Remote.addIntentListener(testAppData, validIntent.type);

            await raiseIntent(validIntent, testAppData);

            await expect(listener).toHaveReceivedContexts([validIntent.context]);

            await expect(duplicateListener).toHaveReceivedContexts([validIntent.context]);
        });

        test('When adding a distinct intent listener, then calling raiseIntent from another app, \
only the first listener is triggered', async () => {
            const distinctListener = await fdc3Remote.addIntentListener(testAppData, validIntent.type + 'distinguisher');

            await raiseIntent(validIntent, testAppData);

            await expect(listener).toHaveReceivedContexts([validIntent.context]);

            await expect(distinctListener).toHaveReceivedContexts([]);
        });


        test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
            await listener.unsubscribe();

            await expect(raiseIntent(validIntent, testAppData)).toThrowFDC3Error(
                ResolveError.IntentTimeout,
                `Timeout waiting for intent listener to be added for intent: ${validIntent.type}`
            );
        });

        test('When calling unsubscribe from a second intent listener, then calling raiseIntent from another app, \
the first listener is triggered exactly once with the correct context, and the second is not triggered', async () => {
            const shortLivedListener = await fdc3Remote.addIntentListener(testAppData, validIntent.type);
            await shortLivedListener.unsubscribe();

            await raiseIntent(validIntent, testAppData);

            await expect(listener).toHaveReceivedContexts([validIntent.context]);

            await expect(shortLivedListener).toHaveReceivedContexts([]);
        });

        type TestParam = [string, number];
        const testParams: TestParam[] = [
            [
                'a child window',
                1
            ], [
                'two child windows',
                2
            ]
        ];

        test.each(testParams)('When the target has %s with an intent listener, when calling raiseIntent from another app, \
all listeners are triggered exactly once with the correct context', async (titleParam: string, childWindowCount: number) => {
            const childListeners: fdc3Remote.RemoteContextListener[] = [];

            for (let i = 0; i < childWindowCount; i++) {
                const childIdentity = {uuid: testAppData.uuid, name: testAppData.name + `-child-window-${i}`};

                await fdc3Remote.createFinWindow(testAppData, {name: childIdentity.name, url: testAppUrl});
                childListeners.push(await fdc3Remote.addIntentListener(childIdentity, validIntent.type));
            }

            await raiseIntent(validIntent, testAppData);

            for (const childListener of childListeners) {
                await expect(childListener).toHaveReceivedContexts([validIntent.context]);
            }
            await expect(listener).toHaveReceivedContexts([validIntent.context]);
        });
    });
}

/**
 * Raise an intent against a target app (waiting for it to start if not already), and add an intent listener after some delay.
 * Returns the promise from raising the intent
 * @param intent intent to raise
 * @param targetApp target app
 * @param delayMs time in milliseconds to wait after the app is running and before the intent listener is added
 */
async function raiseDelayedIntentWithTarget(intent: Intent, targetApp: DirectoryTestAppData, delayMs: number): Promise<void> {
    // We dont await for this promise - that's up to the function caller.
    // It's going to resolve only after we add the listener to the test app
    const raiseIntentPromise = raiseIntent(intent, targetApp);

    // This prevents jest registering a test failure in the case where this rejects before the promise is returned, but does not intefere
    // with any later processing
    raiseIntentPromise.catch(() => {});

    await waitForAppToBeRunning(targetApp);

    // App should now be running

    // We want to have a delay between the app running and the intent listener being set up,
    // so that we can test the "add intent" handshake message. If the app is fast enough setting up,
    // the intent message may go through anyway, but we want to simulate the case where the app
    // takes some time between starting up and actually setting up the intent listener.
    await delay(delayMs);

    await fdc3Remote.addIntentListener(targetApp, intent.type);

    // At this point the promise can be resolved if the listener it was waiting for has just been registered,
    // or rejected due to `raiseIntent` timing out
    return raiseIntentPromise;
}

function raiseIntent(intent: Intent, target?: TestAppData): Promise<void> {
    return fdc3Remote.raiseIntent(
        testManagerIdentity,
        intent.type,
        intent.context,
        target ? target.name : undefined
    );
}
