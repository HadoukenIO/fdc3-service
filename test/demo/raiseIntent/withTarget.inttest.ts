import 'jest';
import 'reflect-metadata';

import {allowReject} from 'openfin-service-async';

import {ResolveError, ApplicationError, SendContextError} from '../../../src/client/errors';
import {fin} from '../utils/fin';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {delay, Duration} from '../utils/delay';
import {TestAppData, DirectoryTestAppData, setupOpenDirectoryAppBookends, setupStartNonDirectoryAppBookends, setupTeardown, setupQuitAppAfterEach, waitForAppToBeRunning, reloadProvider} from '../utils/common';
import {appStartupTime, testManagerIdentity, testAppInDirectory1, testAppNotInDirectory1, testAppWithPreregisteredListeners1, testAppNotInDirectoryNotFdc3, testAppUrl} from '../constants';
import {Intent, IntentType} from '../../../src/provider/intents';
import {TestWindowContext} from '../utils/ofPuppeteer';

/**
 * Intent registered by `testAppWithPreregisteredListeners1` right after opening
 */
const preregisteredIntent: Intent = {
    type: 'IntentNamePreregistered',
    context: {type: 'test.IntentNamePreregisteredContext'}
};

/**
 * An intent registered by `testAppInDirectory`
 */
const validIntent: Intent = {
    type: 'IntentName',
    context: {
        type: 'test.IntentNameContext',
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
                        ResolveError.AppDoesNotHandleIntent,
                        `Application '${testAppInDirectory1.name}' does not handle intent '${nonExistentIntent.type}' \
with context '${nonExistentIntent.context.type}'`
                    );
                });
            });

            describe('When the target is registered to accept the raised intent', () => {
                describe('And the listener is added when the app starts', () => {
                    setupQuitAppAfterEach(testAppWithPreregisteredListeners1);

                    test('The targeted app opens and its listener is triggered exactly once with the correct context', async () => {
                        await raiseIntent(preregisteredIntent, testAppWithPreregisteredListeners1);

                        // App should now be running
                        await expect(fin.Application.wrapSync(testAppWithPreregisteredListeners1).isRunning()).resolves.toBe(true);

                        const listener = await fdc3Remote.getRemoteIntentListener(testAppWithPreregisteredListeners1, preregisteredIntent.type);

                        await expect(listener).toHaveReceivedContexts([preregisteredIntent.context]);
                    });
                });

                describe('And the listener is not added when the app starts', () => {
                    setupQuitAppAfterEach(testAppInDirectory1);

                    test('When the intent listener is added after a short delay, the targeted app opens and its listener is triggered \
just once, with the correct context', async () => {
                        // Raise the intent but only add the intent listener after the some time
                        await raiseDelayedIntentWithTarget(validIntent, testAppInDirectory1, Duration.SHORTER_THAN_APP_MATURITY);

                        // Since we are within listener handshake timeout, intent should be triggered correctly
                        const listener = await fdc3Remote.getRemoteIntentListener(testAppInDirectory1, validIntent.type);
                        await expect(listener).toHaveReceivedContexts([validIntent.context]);
                    }, appStartupTime + Duration.SHORTER_THAN_APP_MATURITY);

                    test('When the intent listener is added on a child window, the targeted app opens and its listener is triggered \
just once, with the correct context', async () => {
                        // Raise the intent, and wait for the app to be running
                        const raisePromise = raiseIntent(validIntent, testAppInDirectory1);
                        await waitForAppToBeRunning(testAppInDirectory1);

                        // Create a child window and add a listener on it
                        const childWindow = await fdc3Remote.createFinWindow(testAppInDirectory1, {url: testAppUrl, name: 'child-window'});
                        const listener = await fdc3Remote.addIntentListener(childWindow, validIntent.type);

                        await raisePromise;

                        // Check our listener received the context
                        await expect(listener).toHaveReceivedContexts([validIntent.context]);
                    });

                    test('When the intent listeners are added on multiple windows, the targeted app opens and the first window\'s \
listener is triggered just once, with the correct context', async () => {
                        // Raise the intent, and wait for the app to be running
                        const raisePromise = raiseIntent(validIntent, testAppInDirectory1);
                        await waitForAppToBeRunning(testAppInDirectory1);

                        const childWindow1 = await fdc3Remote.createFinWindow(testAppInDirectory1, {url: testAppUrl, name: 'child-window-1'});
                        const childWindow2 = await fdc3Remote.createFinWindow(testAppInDirectory1, {url: testAppUrl, name: 'child-window-2'});

                        // Add listeners
                        const listener1 = await fdc3Remote.addIntentListener(childWindow1, validIntent.type);
                        const listener2 = await fdc3Remote.addIntentListener(childWindow2, validIntent.type);
                        const listener3 = await fdc3Remote.addIntentListener(testAppInDirectory1, validIntent.type);
                        await raisePromise;

                        // Check only the first listener recevied the context
                        await expect(listener1).toHaveReceivedContexts([validIntent.context]);
                        await expect(listener2).toHaveReceivedContexts([]);
                        await expect(listener3).toHaveReceivedContexts([]);
                    });

                    test('When the intent listener is added after a long delay, the targeted app opens but it times out waiting for the \
listener to be added', async () => {
                        // Raise the intent but only add the intent listener after the listener handshake timeout has been exceeded
                        const raiseIntentPromise = raiseDelayedIntentWithTarget(
                            validIntent,
                            testAppInDirectory1,
                            Duration.LONGER_THAN_APP_MATURITY
                        );

                        await expect(raiseIntentPromise).toThrowFDC3Error(
                            SendContextError.NoHandler,
                            `Application has no handler for intent '${validIntent.type}'`
                        );
                    }, appStartupTime + Duration.LONGER_THAN_APP_MATURITY);
                });
            });
        });

        describe('When the target is running', () => {
            setupOpenDirectoryAppBookends(testAppInDirectory1);
            setupCommonRunningAppTests(testAppInDirectory1);
        });
    });

    describe('When the target is *not* in the directory', () => {
        describe('When the target is not running', () => {
            test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                await expect(raiseIntent(validIntent, testAppNotInDirectory1)).toThrowFDC3Error(
                    ApplicationError.NotFound,
                    `No application '${testAppNotInDirectory1.name}' found running or in directory`
                );
            });
        });

        describe('When the target is running but is not in the directory and does not connect to FDC3', () => {
            setupStartNonDirectoryAppBookends(testAppNotInDirectoryNotFdc3);

            test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                await expect(raiseIntent(validIntent, testAppNotInDirectoryNotFdc3)).toThrowFDC3Error(
                    ResolveError.AppDoesNotHandleIntent,
                    `Application '${testAppNotInDirectoryNotFdc3.name}' does not handle intent '${validIntent.type}' with context \
'${validIntent.context.type}'`
                );
            });
        });

        describe('When the target (which is an ad-hoc app) is running', () => {
            setupStartNonDirectoryAppBookends(testAppNotInDirectory1);
            setupCommonRunningAppTests(testAppNotInDirectory1);
        });
    });
});

describe('When reloading the provider', () => {
    setupOpenDirectoryAppBookends(testAppWithPreregisteredListeners1);

    test('Apps with a preregistered intent listener recieve intents', async () => {
        await reloadProvider();

        await raiseIntent(preregisteredIntent, testAppWithPreregisteredListeners1);
        const listener = await fdc3Remote.getRemoteIntentListener(testAppWithPreregisteredListeners1, preregisteredIntent.type);
        await expect(listener).toHaveReceivedContexts([preregisteredIntent.context]);
    });

    test('Apps that registered an intent listener recieve intents', async () => {
        const listener = await fdc3Remote.addIntentListener(testAppWithPreregisteredListeners1, validIntent.type);
        await reloadProvider();

        await raiseIntent(validIntent, testAppWithPreregisteredListeners1);
        await expect(listener).toHaveReceivedContexts([validIntent.context]);
    });
});

function setupCommonRunningAppTests(testAppData: TestAppData): void {
    describe('When the target has *not* registered listeners for the raised intent', () => {
        test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
            await expect(raiseIntent(nonExistentIntent, testAppData)).toThrowFDC3Error(
                ResolveError.AppDoesNotHandleIntent,
                `Application '${testAppData.name}' does not handle intent '${nonExistentIntent.type}' with context '${nonExistentIntent.context.type}'`
            );
        });

        test('When the target has a child window with an intent listener, when calling raiseIntent from another app, \
the child listener is triggered exactly once with the correct context', async () => {
            const childIdentity = {uuid: testAppData.uuid, name: `${testAppData.name}-child-window`};

            await fdc3Remote.createFinWindow(testAppData, {name: childIdentity.name, url: testAppUrl});
            const childListener = await fdc3Remote.addIntentListener(childIdentity, validIntent.type);

            await raiseIntent(validIntent, testAppData);

            await expect(childListener).toHaveReceivedContexts([validIntent.context]);
        });

        test('When an intent listener is added that takes a long time to resolve, when calling raiseIntent from another app, the promise rejects with an \
FDC3Error', async () => {
            await fdc3Remote.ofBrowser.executeOnWindow(testAppData, function (this: TestWindowContext, intentRemote: IntentType, delayRemote: number): void {
                this.fdc3.addIntentListener(intentRemote, async () => {
                    await new Promise((res) => {
                        this.setTimeout(res, delayRemote);
                    });
                });
            }, validIntent.type, Duration.LONGER_THAN_SERVICE_TO_CLIENT_API_CALL_TIMEOUT);
            await delay(Duration.LISTENER_HANDSHAKE);

            await expect(raiseIntent(validIntent, testAppData)).toThrowFDC3Error(
                SendContextError.HandlerTimeout,
                'Timeout waiting for application to handle intent'
            );
        });

        test('When an intent listener is added that throws and error, when calling raiseIntent from another app, the promise rejects with \
an FDC3Error', async () => {
            await fdc3Remote.ofBrowser.executeOnWindow(testAppData, function (this: TestWindowContext, intentRemote: IntentType): void {
                this.fdc3.addIntentListener(intentRemote, async () => {
                    throw new Error('Intent listener throwing error');
                });
            }, validIntent.type);
            await delay(Duration.LISTENER_HANDSHAKE);

            await expect(raiseIntent(validIntent, testAppData)).toThrowFDC3Error(
                SendContextError.HandlerError,
                'Error(s) thrown by application attempting to handle intent'
            );
        });

        test('When a mix of erroring and non-erroring intent listeners are added, when calling raiseIntent from another app, all listeners are triggered with \
the correct context and the promise resolves', async () => {
            await fdc3Remote.ofBrowser.executeOnWindow(testAppData, function (this: TestWindowContext, intentRemote: IntentType): void {
                this.fdc3.addIntentListener(intentRemote, async () => {
                    throw new Error('Intent listener throwing error');
                });
            }, validIntent.type);
            await delay(Duration.LISTENER_HANDSHAKE);

            const listener = await fdc3Remote.addIntentListener(testAppData, validIntent.type);

            await raiseIntent(validIntent, testAppData);

            await expect(listener).toHaveReceivedContexts([validIntent.context]);
        });

        test('When a mix of erroring and non-erroring intent listeners are added across multiple windows, when calling raiseIntent from another app, all \
listeners are triggered with the correct context and the promise resolves', async () => {
            const listener1 = await fdc3Remote.addIntentListener(testAppData, validIntent.type);

            const childWindow1 = await fdc3Remote.createFinWindow(testAppData, {url: testAppUrl, name: 'child-window-1'});
            const childWindow2 = await fdc3Remote.createFinWindow(testAppData, {url: testAppUrl, name: 'child-window-2'});

            await fdc3Remote.ofBrowser.executeOnWindow(childWindow1, function (this: TestWindowContext, intentRemote: IntentType): void {
                this.fdc3.addIntentListener(intentRemote, () => {
                    throw new Error('Intent listener throwing error');
                });
            }, validIntent.type);
            await delay(Duration.LISTENER_HANDSHAKE);

            const listener2 = await fdc3Remote.addIntentListener(childWindow2, validIntent.type);

            await raiseIntent(validIntent, testAppData);

            await expect(listener1).toHaveReceivedContexts([validIntent.context]);
            await expect(listener2).toHaveReceivedContexts([validIntent.context]);
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
            const distinctListener = await fdc3Remote.addIntentListener(testAppData, `${validIntent.type}distinguisher`);

            await raiseIntent(validIntent, testAppData);

            await expect(listener).toHaveReceivedContexts([validIntent.context]);

            await expect(distinctListener).toHaveReceivedContexts([]);
        });

        test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
            await listener.unsubscribe();

            // Wait for the app to be considered mature to ensure we get the expected error
            await delay(Duration.LONGER_THAN_APP_MATURITY);

            const expectedRaise = expect(raiseIntent(validIntent, testAppData));

            await expectedRaise.toThrowFDC3Error(
                ResolveError.AppDoesNotHandleIntent,
                `Application '${testAppData.name}' does not handle intent '${validIntent.type}' with context '${validIntent.context.type}'`
            );

            await expect(listener).toHaveReceivedContexts([]);
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
                const childIdentity = {uuid: testAppData.uuid, name: `${testAppData.name}-child-window-${i}`};

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

    allowReject(raiseIntentPromise);

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

async function raiseIntent(intent: Intent, target?: TestAppData): Promise<void> {
    await fdc3Remote.raiseIntent(
        testManagerIdentity,
        intent.type,
        intent.context,
        target ? target.name : undefined
    );
}
