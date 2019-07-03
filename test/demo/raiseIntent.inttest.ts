import 'jest';
import 'reflect-metadata';

import {ResolveError} from '../../src/client/errors';
import {Intent} from '../../src/client/intents';
import {RESOLVER_IDENTITY} from '../../src/provider/utils/constants';
import {Timeouts} from '../../src/provider/constants';

import {fin} from './utils/fin';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {delay} from './utils/delay';
import {
    TestAppData, DirectoryTestAppData, setupOpenDirectoryAppBookends, setupStartNonDirectoryAppBookends,
    setupStartNonDirectoryAppWithIntentListenerBookends, setupTeardown, setupQuitAppAfterEach, waitForAppToBeRunning, Boxed
} from './utils/common';
import {
    appStartupTime, testManagerIdentity, testAppInDirectory1, testAppInDirectory4,
    testAppNotInDirectory1, testAppNotInDirectory2, testAppWithPreregisteredListeners1, testAppNotFdc3
} from './constants';

/**
 * Intent registered by `testAppWithPreregisteredListeners1` right after opening
 */
const preregisteredIntent: Intent = {
    type: 'test.IntentNamePreregistered',
    context: {type: 'preregistered.context'}
};

/**
 * Alias for `testAppInDirectory4`, which is only in the directory registering the intent `test.IntentOnlyOnApp4`
 */
const testAppWithUniqueIntent = testAppInDirectory4;

/**
 * Intent that is only registered by a single app in the directory (`test-app-4`)
 */
const uniqueIntent: Intent = {
    type: 'test.IntentOnlyOnApp4',
    context: {type: 'dummyContext'}
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
 * An intent registered by multiple apps in the directory
 */
const intentInManyApps: Intent = {
    type: 'DialCall',
    context: {type: 'dial-call-context'}
};

/**
 * An intent not registered by any directory app, and no ad-hoc apps register it
 */
const nonExistentIntent: Intent = {
    type: 'some-nonexistent-intent',
    context: {type: 'some-nonexistent-context'}
};

/**
 * An intent not registered by any directory app, but ad-hoc apps may register it
 */
const intentNotInDirectory: Intent = {
    type: 'test.IntentNotInDirectory',
    context: {type: 'dummyContext'}
};

setupTeardown();

describe('Intent listeners and raising intents', () => {
    describe('With a target', () => {
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
                            const receivedContexts = await listener.getReceivedContexts();

                            expect(receivedContexts).toEqual([preregisteredIntent.context]);
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
                                const receivedContexts = await listener.getReceivedContexts();
                                expect(receivedContexts).toEqual([validIntent.context]);
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
                                    `Timeout waiting for intent listener to be added. intent = ${validIntent.type}`
                                );
                            }, appStartupTime + 1500);
                        });
                    });
                });
            });

            describe('When the target is running', () => {
                setupOpenDirectoryAppBookends(testAppInDirectory1);

                test('When calling addIntentListener for the first time, the promise resolves and there are no errors', async () => {
                    await expect(fdc3Remote.addIntentListener(testAppInDirectory1, validIntent.type)).resolves.not.toThrow();
                });

                describe('When the target is registered to accept the raised intent', () => {
                    let listener: fdc3Remote.RemoteIntentListener;

                    beforeEach(async () => {
                        listener = await fdc3Remote.addIntentListener(testAppInDirectory1, validIntent.type);
                    });

                    test('When calling raiseIntent from another app the listener is triggered exactly once with the correct context', async () => {
                        await raiseIntent(validIntent, testAppInDirectory1);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validIntent.context]);
                    });

                    test('When adding a duplicate intent listener, then calling raiseIntent from another app, \
both listeners are triggered exactly once with the correct context', async () => {
                        const duplicateListener = await fdc3Remote.addIntentListener(testAppInDirectory1, validIntent.type);

                        await raiseIntent(validIntent, testAppInDirectory1);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validIntent.context]);

                        const duplicateReceivedContexts = await duplicateListener.getReceivedContexts();
                        expect(duplicateReceivedContexts).toEqual([validIntent.context]);
                    });

                    test('When adding a distinct intent listener, then calling raiseIntent from another app, \
only the first listener is triggered', async () => {
                        const distinctListener = await fdc3Remote.addIntentListener(testAppInDirectory1, validIntent.type + 'distinguisher');

                        await raiseIntent(validIntent, testAppInDirectory1);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validIntent.context]);

                        const distinctReceivedContexts = await distinctListener.getReceivedContexts();
                        expect(distinctReceivedContexts).toEqual([]);
                    });

                    test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
                        await listener.unsubscribe();

                        await expect(raiseIntent(validIntent, testAppInDirectory1)).toThrowFDC3Error(
                            ResolveError.IntentTimeout,
                            `Timeout waiting for intent listener to be added. intent = ${validIntent.type}`
                        );
                    });

                    test('When calling unsubscribe from a second intent listener, then calling raiseIntent from another app, \
the first listener is triggered exactly once with the correct context, and the second is not triggered', async () => {
                        const shortLivedListener = await fdc3Remote.addIntentListener(testAppInDirectory1, validIntent.type);
                        await shortLivedListener.unsubscribe();

                        await raiseIntent(validIntent, testAppInDirectory1);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validIntent.context]);

                        const shortLivedReceivedContexts = await shortLivedListener.getReceivedContexts();
                        expect(shortLivedReceivedContexts).toEqual([]);
                    });
                });

                describe('When the target is *not* registered to accept the raised intent', () => {
                    test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                        await expect(raiseIntent(nonExistentIntent, testAppInDirectory1)).toThrowFDC3Error(
                            ResolveError.IntentTimeout,
                            `Timeout waiting for intent listener to be added. intent = ${nonExistentIntent.type}`
                        );
                    });
                });
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

                test('When calling addIntentListener for the first time, the promise resolves and there are no errors', async () => {
                    await expect(fdc3Remote.addIntentListener(testAppNotInDirectory1, validIntent.type)).resolves.not.toThrow();
                });

                describe('When the target has registered any listeners (so the FDC3 service has the window in the model)', () => {
                    let listener: fdc3Remote.RemoteIntentListener;

                    beforeEach(async () => {
                        listener = await fdc3Remote.addIntentListener(testAppNotInDirectory1, validIntent.type);
                    });

                    describe('When the target has *not* registered listeners for the raised intent', () => {
                        test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                            await expect(raiseIntent(nonExistentIntent, testAppNotInDirectory1)).toThrowFDC3Error(
                                ResolveError.IntentTimeout,
                                `Timeout waiting for intent listener to be added. intent = ${nonExistentIntent.type}`
                            );
                        });
                    });

                    describe('When the target has registered listeners for the raised intent', () => {
                        test('When calling raiseIntent from another app the listener is triggered exactly once with the correct context', async () => {
                            await raiseIntent(validIntent, testAppNotInDirectory1);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validIntent.context]);
                        });

                        test('When registering a duplicate intent listener, then calling raiseIntent from another app, \
both listeners are triggered exactly once with the correct context', async () => {
                            const duplicateListener = await fdc3Remote.addIntentListener(testAppNotInDirectory1, validIntent.type);

                            await raiseIntent(validIntent, testAppNotInDirectory1);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validIntent.context]);

                            const duplicateReceivedContexts = await duplicateListener.getReceivedContexts();
                            expect(duplicateReceivedContexts).toEqual([validIntent.context]);
                        });

                        test('When adding a distinct intent listener, then calling raiseIntent from another app, \
only the first listener is triggered', async () => {
                            const distinctListener = await fdc3Remote.addIntentListener(testAppNotInDirectory1, validIntent.type + 'distinguisher');

                            await raiseIntent(validIntent, testAppNotInDirectory1);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validIntent.context]);

                            const distinctReceivedContexts = await distinctListener.getReceivedContexts();
                            expect(distinctReceivedContexts).toEqual([]);
                        });

                        test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
                            await listener.unsubscribe();
                            await expect(raiseIntent(validIntent, testAppNotInDirectory1)).toThrowFDC3Error(
                                ResolveError.IntentTimeout,
                                `Timeout waiting for intent listener to be added. intent = ${validIntent.type}`
                            );
                        });

                        test('When calling unsubscribe from a second intent listener, then calling raiseIntent from another app, \
the first listener is triggered exactly once with the correct context, and the second is not triggered', async () => {
                            const shortLivedListener = await fdc3Remote.addIntentListener(testAppNotInDirectory1, validIntent.type);
                            await shortLivedListener.unsubscribe();

                            await raiseIntent(validIntent, testAppNotInDirectory1);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validIntent.context]);

                            const shortLivedReceivedContexts = await shortLivedListener.getReceivedContexts();
                            expect(shortLivedReceivedContexts).toEqual([]);
                        });
                    });
                });
            });
        });
    });

    describe('Without a target', () => {
        describe('0 apps in directory registered to accept the raised intent', () => {
            setupNoTargetAndNoDirectoryAppCanHandleIntentTests(intentNotInDirectory);
        });

        describe('1 app in directory registered to accept the raised intent', () => {
            describe('With the registered app running', () => {
                setupOpenDirectoryAppBookends(testAppWithUniqueIntent);

                describe('But the app does not have the listener registered on the model', () => {
                    // This case is equivalent to 0 apps in directory
                    setupNoTargetAndNoDirectoryAppCanHandleIntentTests(uniqueIntent);
                });

                describe('And the app has registered a listener for the intent', () => {
                    let directoryAppListener: fdc3Remote.RemoteIntentListener;

                    beforeEach(async () => {
                        directoryAppListener = await fdc3Remote.addIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                    });
                    describe('And no running ad-hoc apps with listeners registered for the raised intent', () => {
                        test('When calling raiseIntent from another app the listener is triggered exactly once with the correct context', async () => {
                            await raiseIntent(uniqueIntent);

                            const receivedContexts = await directoryAppListener.getReceivedContexts();
                            expect(receivedContexts).toEqual([uniqueIntent.context]);
                        });
                    });

                    describe('But there is a running ad-hoc app with a listener registered for the same intent', () => {
                        const adHocAppListener = setupStartNonDirectoryAppWithIntentListenerBookends(uniqueIntent, testAppNotInDirectory1);

                        describe('When calling raiseIntent from another app, the resolver is displayed with both apps.', () => {
                            test('When closing the resolver, an error is thrown', async () => {
                                await expect(raiseIntentExpectResolverAndClose(uniqueIntent)).toThrowFDC3Error(
                                    ResolveError.ResolverClosedOrCancelled,
                                    'Resolver closed or cancelled'
                                );
                            });
                            test('When choosing the directory app on the resolver, it receives intent', async () => {
                                await raiseIntentExpectResolverSelectApp(uniqueIntent, testAppWithUniqueIntent, directoryAppListener);
                            });
                            test('When choosing the ad-hoc app on the resolver, it receives intent', async () => {
                                await raiseIntentExpectResolverSelectApp(uniqueIntent, testAppNotInDirectory1, adHocAppListener.value);
                            });
                        });
                    });
                });
            });

            describe('With the registered app not running', () => {
                describe('And no running ad-hoc apps with listeners registered for the raised intent', () => {
                    let raiseIntentPromise: Promise<void>;

                    beforeEach(async () => {
                        raiseIntentPromise = raiseIntent(uniqueIntent);
                        // Wait for app to open after raising intent
                        await waitForAppToBeRunning(testAppWithUniqueIntent);
                    });

                    setupQuitAppAfterEach(testAppWithUniqueIntent);

                    describe('When the directory app does not register the intent listener after opening', () => {
                        test('When calling raiseIntent from another app, the app opens but it times out waiting for the listener to be added', async () => {
                            await expect(raiseIntentPromise).toThrowFDC3Error(
                                ResolveError.IntentTimeout,
                                `Timeout waiting for intent listener to be added. intent = ${uniqueIntent.type}`
                            );
                        });
                    });

                    describe('When the directory app registers the intent listener after opening', () => {
                        test('When calling raiseIntent from another app, the app opens and receives the intent with the correct context', async () => {
                            await fdc3Remote.addIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                            await raiseIntentPromise;

                            const listener = await fdc3Remote.getRemoteIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                            const receivedContexts = await listener.getReceivedContexts();

                            expect(receivedContexts).toEqual([uniqueIntent.context]);
                        });
                    });
                });

                describe('But there is a running ad-hoc app with a listener registered for the same intent', () => {
                    const adHocAppListener = setupStartNonDirectoryAppWithIntentListenerBookends(uniqueIntent, testAppNotInDirectory1);

                    describe('When calling raiseIntent from another app, the resolver is displayed with the directory + ad-hoc app', () => {
                        test('When closing the resolver, an error is thrown', async () => {
                            await expect(raiseIntentExpectResolverAndClose(uniqueIntent)).toThrowFDC3Error(
                                ResolveError.ResolverClosedOrCancelled,
                                'Resolver closed or cancelled'
                            );
                        });
                        describe('When choosing the directory app on the resolver, and the app registers the intent listener after opening', () => {
                            setupQuitAppAfterEach(testAppWithUniqueIntent);

                            test('It receives intent', async () => {
                                const raiseIntentPromise = (await raiseIntentAndExpectResolverToShow(uniqueIntent)).value;
                                await selectResolverApp(testAppWithUniqueIntent.name);

                                await waitForAppToBeRunning(testAppWithUniqueIntent);
                                await fdc3Remote.addIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                                await raiseIntentPromise;

                                const listener = await fdc3Remote.getRemoteIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                                const receivedContexts = await listener.getReceivedContexts();

                                expect(receivedContexts).toEqual([uniqueIntent.context]);
                            });
                        });

                        test('When choosing the ad-hoc app on the resolver, it receives intent', async () => {
                            await raiseIntentExpectResolverSelectApp(uniqueIntent, testAppNotInDirectory1, adHocAppListener.value);
                        });
                    });
                });
            });
        });

        describe('>1 app in directory registered to accept the raised intent', () => {
            describe('When calling raiseIntent from another app, the resolver is displayed with multiple apps', () => {
                test('When closing the resolver, an error is thrown', async () => {
                    await expect(raiseIntentExpectResolverAndClose(intentInManyApps)).toThrowFDC3Error(
                        ResolveError.ResolverClosedOrCancelled,
                        'Resolver closed or cancelled'
                    );
                });
                describe('When choosing on the resolver an app that preregisters the intent', () => {
                    setupQuitAppAfterEach(testAppWithPreregisteredListeners1);

                    test('It receives it', async () => {
                        await raiseIntentExpectResolverSelectApp(intentInManyApps, testAppWithPreregisteredListeners1);
                    });
                });
            });
        });
    });
});

/**
 * This case occurs when either:
 * - there are no directory apps for a given intent, or
 * - there are directory apps for the intent, but are running and haven't registered listeners for the intent
 * @param intent intent
 */
function setupNoTargetAndNoDirectoryAppCanHandleIntentTests(intent: Intent): void {
    describe('And no running ad-hoc apps with listeners registered for the raised intent', () => {
        test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
            await expect(raiseIntent(intent)).toThrowFDC3Error(
                ResolveError.NoAppsFound,
                'No applications available to handle this intent'
            );
        });
    });

    describe('But there are running ad-hoc apps with a listener registered for the raised intent', () => {
        const listener1 = setupStartNonDirectoryAppWithIntentListenerBookends(intent, testAppNotInDirectory1);

        describe('Just 1 ad-hoc app with a listener registered for the intent', () => {
            test('When calling raiseIntent the listener is triggered once', async () => {
                await raiseIntent(intent);

                const receivedContexts = await listener1.value.getReceivedContexts();
                expect(receivedContexts).toEqual([intent.context]);
            });

            test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
                await listener1.value.unsubscribe();
                await expect(raiseIntent(intent)).toThrowFDC3Error(
                    ResolveError.NoAppsFound,
                    'No applications available to handle this intent'
                );
            });
        });

        describe('2 ad-hoc apps, both of them with a listener registered for the intent', () => {
            const listener2 = setupStartNonDirectoryAppWithIntentListenerBookends(intent, testAppNotInDirectory2);

            describe('When calling raiseIntent, the resolver is displayed with both apps', () => {
                test('When closing the resolver, an error is thrown', async () => {
                    await expect(raiseIntentExpectResolverAndClose(intent)).toThrowFDC3Error(
                        ResolveError.ResolverClosedOrCancelled,
                        'Resolver closed or cancelled'
                    );
                });
                test('When choosing the first app on the resolver, it receives intent', async () => {
                    await raiseIntentExpectResolverSelectApp(intent, testAppNotInDirectory1, listener1.value);
                });
                test('When choosing the second app on the resolver, it receives intent', async () => {
                    await raiseIntentExpectResolverSelectApp(intent, testAppNotInDirectory2, listener2.value);
                });
            });

            test('When calling unsubscribe from the intent listener on the first app, then calling raiseIntent from another app, \
then the second listener is triggered exactly once with the correct context', async () => {
                await listener1.value.unsubscribe();
                await raiseIntent(intent);

                const receivedContexts = await listener1.value.getReceivedContexts();
                expect(receivedContexts).toEqual([]);

                const receivedContexts2 = await listener2.value.getReceivedContexts();
                expect(receivedContexts2).toEqual([intent.context]);
            });
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

async function raiseIntentExpectResolverAndClose(intent: Intent): Promise<void> {
    const raiseIntentPromise = (await raiseIntentAndExpectResolverToShow(intent)).value;

    // This prevents jest registering a test failure in the case where this rejects before the promise is returned, but does not intefere
    // with any later processing
    raiseIntentPromise.catch(() => {});

    await closeResolver();

    return raiseIntentPromise;
}

async function raiseIntentExpectResolverSelectApp(intent: Intent, app: TestAppData, listener?: fdc3Remote.RemoteIntentListener): Promise<void> {
    const raiseIntentPromise = (await raiseIntentAndExpectResolverToShow(intent)).value;
    await selectResolverApp(app.name);
    await raiseIntentPromise; // Now the intent resolves

    // If no intent listener provided, try to fetch it "live"
    const remoteListener = listener || await fdc3Remote.getRemoteIntentListener(app, intent.type);

    const receivedContexts = await remoteListener.getReceivedContexts();
    expect(receivedContexts).toEqual([intent.context]);
}

/**
 * Raises an intent and `expect`s that the resolver window shows, then closes it
 * @param intent intent to raise
 */
async function raiseIntentAndExpectResolverToShow(intent: Intent): Promise<Boxed<Promise<void>>> {
    // Raise intent but don't await - promise won't resolve until an app is selected on the resolver
    const raiseIntentPromise = raiseIntent(intent);

    while (!await fin.Window.wrapSync(RESOLVER_IDENTITY).isShowing()) {
        await delay(500);
    }

    const isResolverShowing = await fin.Window.wrapSync(RESOLVER_IDENTITY).isShowing();
    expect(isResolverShowing).toBe(true);

    return {value: raiseIntentPromise};
}

/**
 * Closes the resolver by remotely clicking the Cancel button in it
 */
async function closeResolver(): Promise<void> {
    const cancelClicked = await fdc3Remote.clickHTMLElement(RESOLVER_IDENTITY, '#cancel');
    if (!cancelClicked) {
        throw new Error('Error clicking cancel button on resolver. Make sure it has id="cancel".');
    }
    await delay(100); // Give the UI some time to process the click and close the window

    const isResolverShowing = await fin.Window.wrapSync(RESOLVER_IDENTITY).isShowing();
    expect(isResolverShowing).toBe(false);
}

/**
 * Selects an app on the resolver by remotely clicking on its button
 * @param appName name of app to open
 */
async function selectResolverApp(appName: string): Promise<void> {
    const appClicked = await fdc3Remote.clickHTMLElement(RESOLVER_IDENTITY, `.app-card[data-appname="${appName}"]`);
    if (!appClicked) {
        throw new Error(`App with name '${appName}' not found in resolver`);
    }
    await delay(100);

    const isResolverShowing = await fin.Window.wrapSync(RESOLVER_IDENTITY).isShowing();
    expect(isResolverShowing).toBe(false);
}

function raiseIntent(intent: Intent, target?: TestAppData): Promise<void> {
    return fdc3Remote.raiseIntent(
        testManagerIdentity,
        intent.type,
        intent.context,
        target ? target.name : undefined
    );
}
