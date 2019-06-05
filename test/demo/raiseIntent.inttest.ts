import 'jest';
import 'reflect-metadata';

import {Identity} from 'openfin/_v2/main';

import {ResolveError, Timeouts, FDC3Error} from '../../src/client/errors';
import {SELECTOR_IDENTITY} from '../../src/client/internal';
import {Intent} from '../../src/client/intents';

import {fin} from './utils/fin';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {delay} from './utils/delay';
import {appStartupTime} from './constants';

const resolverWindowIdentity = SELECTOR_IDENTITY;

const testManagerIdentity: AppIdentity = {
    uuid: 'test-app',
    name: 'test-app'
};

const testAppInDirectory = {
    uuid: 'test-app-1',
    name: 'test-app-1',
    appId: '100'
};

/**
 * App in directory, registers listeners right after opening
 */
const testAppWithPreregisteredListeners = {
    uuid: 'test-app-preregistered-1',
    name: 'test-app-preregistered-1',
    appId: '500'
};

/**
 * Intent registered by `testAppWithPreregisteredListeners` right after opening
 */
const preregisteredIntent: Intent = {
    type: 'test.IntentNamePreregistered',
    context: {type: 'preregistered.context'}
};

/**
 * App in directory which is the only that registers a given intent (`test.IntentOnlyOnApp4`)
 */
const testAppWithUniqueIntent = {
    uuid: 'test-app-4',
    name: 'test-app-4',
    appId: '400'
};

/**
 * Intent that is only handled by a single app in the directory (`test-app-4`)
 */
const uniqueIntent: Intent = {
    type: 'test.IntentOnlyOnApp4',
    context: {type: 'dummyContext'}
};

/**
 * App not registered in directory
 */
const testAppNotInDirectory: NonDirectoryApp = {
    uuid: 'test-app-not-in-directory',
    name: 'test-app-not-in-directory',
    manifestUrl: 'http://localhost:3923/test/configs/test-app-not-in-directory.json'
};

/**
 * Another app not registered in directory
 */
const testAppNotInDirectory2: NonDirectoryApp = {
    uuid: 'test-app-not-in-directory-2',
    name: 'test-app-not-in-directory-2',
    manifestUrl: 'http://localhost:3923/test/configs/test-app-not-in-directory-2.json'
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
            twitter: '@testname'
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

describe('Intent listeners and raising intents', () => {
    beforeEach(async () => {
        // The main launcher app should remain running for the duration of all tests.
        await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);
    });

    describe('With a target', () => {
        describe('When the target is in the directory', () => {
            describe('When the target is not running', () => {
                describe('When the target is *not* registered to accept the raised intent', () => {
                    test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                        await expect(raiseIntent(nonExistentIntent, testAppInDirectory)).toThrowFDC3Error(
                            ResolveError.TargetAppDoesNotHandleIntent,
                            `App '${testAppInDirectory.name}' does not handle intent '${nonExistentIntent.type}'`
                        );
                    });
                });

                describe('When the target is registered to accept the raised intent', () => {
                    describe('And the listener is registered right after opening the app', () => {
                        test('The targeted app opens and its listener is triggered exactly once with the correct context', async () => {
                            await raiseIntent(preregisteredIntent, testAppWithPreregisteredListeners);

                            // App should now be running
                            await expect(fin.Application.wrapSync(testAppWithPreregisteredListeners).isRunning()).resolves.toBe(true);

                            const listener = await fdc3Remote.getRemoteIntentListener(testAppWithPreregisteredListeners, preregisteredIntent.type);
                            const receivedContexts = await listener.getReceivedContexts();

                            expect(receivedContexts).toEqual([preregisteredIntent.context]);

                            await fin.Application.wrapSync(testAppWithPreregisteredListeners).quit();
                        });
                    });

                    describe('And the listener is added after a delay', () => {
                        afterEach(async () => {
                            await fin.Application.wrapSync(testAppInDirectory).quit();
                        });
                        describe('Delay is short enough for the intent handshake to succeed', () => {
                            test('The targeted app opens and its listener is triggered just once after it is set up, with the correct context', async () => {
                                // Raise the intent but only add the intent listener after the some time
                                await raiseDelayedIntentWithTarget(validIntent, testAppInDirectory, 1500);

                                // Since the time is under the listener handshake timeout, intent should be triggered correctly
                                const listener = await fdc3Remote.getRemoteIntentListener(testAppInDirectory, validIntent.type);
                                const receivedContexts = await listener.getReceivedContexts();
                                expect(receivedContexts).toEqual([validIntent.context]);
                            }, appStartupTime + 1500);
                        });

                        describe('Delay is longer than the threshold to add intent listeners', () => {
                            test('The targeted app opens but it times out waiting for the listener to be added', async () => {
                                // Raise the intent but only add the intent listener after the listener handshake timeout has been exceeded
                                const raiseIntentPromise = raiseDelayedIntentWithTarget(
                                    validIntent,
                                    testAppInDirectory,
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
                setupOpenDirectoryApp(testAppInDirectory);

                test('When calling addIntentListener for the first time, the promise resolves and there are no errors', async () => {
                    await expect(fdc3Remote.addIntentListener(testAppInDirectory, validIntent.type)).resolves.not.toThrow();
                });

                describe('When the target is registered to accept the raised intent', () => {
                    let listener: fdc3Remote.RemoteIntentListener;

                    beforeEach(async () => {
                        listener = await fdc3Remote.addIntentListener(testAppInDirectory, validIntent.type);
                    });

                    test('When calling raiseIntent from another app the listener is triggered exactly once with the correct context', async () => {
                        await raiseIntent(validIntent, testAppInDirectory);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validIntent.context]);
                    });

                    test('When adding a duplicate intent listener, then calling raiseIntent from another app, \
both listeners are triggered exactly once with the correct context', async () => {
                        const duplicateListener = await fdc3Remote.addIntentListener(testAppInDirectory, validIntent.type);

                        await raiseIntent(validIntent, testAppInDirectory);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validIntent.context]);

                        const duplicateReceivedContexts = await duplicateListener.getReceivedContexts();
                        expect(duplicateReceivedContexts).toEqual([validIntent.context]);
                    });

                    test('When adding a distinct intent listener, then calling raiseIntent from another app, \
only the first listener is triggered', async () => {
                        const distinctListener = await fdc3Remote.addIntentListener(testAppInDirectory, validIntent.type + 'distinguisher');

                        await raiseIntent(validIntent, testAppInDirectory);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validIntent.context]);

                        const distinctReceivedContexts = await distinctListener.getReceivedContexts();
                        expect(distinctReceivedContexts).toEqual([]);
                    });

                    test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
                        await listener.unsubscribe();

                        await expect(raiseIntent(validIntent, testAppInDirectory)).toThrowFDC3Error(
                            ResolveError.IntentTimeout,
                            `Timeout waiting for intent listener to be added. intent = ${validIntent.type}`
                        );
                    });

                    test('When calling unsubscribe from a second intent listener, then calling raiseIntent from another app, \
only the first listener is triggered exactly once with the correct context, and the second is not triggered', async () => {
                        const shortLivedListener = await fdc3Remote.addIntentListener(testAppInDirectory, validIntent.type);
                        await shortLivedListener.unsubscribe();

                        await raiseIntent(validIntent, testAppInDirectory);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validIntent.context]);

                        const shortLivedReceivedContexts = await shortLivedListener.getReceivedContexts();
                        expect(shortLivedReceivedContexts).toEqual([]);
                    });
                });

                describe('When the target is *not* registered to accept the raised intent', () => {
                    test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                        await expect(raiseIntent(nonExistentIntent, testAppInDirectory)).toThrowFDC3Error(
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
                    await expect(raiseIntent(validIntent, testAppNotInDirectory)).toThrowFDC3Error(
                        ResolveError.TargetAppNotAvailable,
                        `Couldn't resolve intent target '${testAppNotInDirectory.name}'. No matching app in directory or currently running.`
                    );
                });
            });

            describe('When the target (which is an ad-hoc app) is running', () => {
                setupStartNonDirectoryApp();

                test('When calling addIntentListener for the first time, the promise resolves and there are no errors', async () => {
                    await expect(fdc3Remote.addIntentListener(testAppNotInDirectory, validIntent.type)).resolves.not.toThrow();
                });

                describe('When the target has *not* registered any listeners (therefore the FDC3 service is *not* aware of the window)', () => {
                    test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                        await expect(raiseIntent(validIntent, testAppNotInDirectory)).toThrowFDC3Error(
                            ResolveError.TargetAppNotAvailable,
                            `Couldn't resolve intent target '${testAppNotInDirectory.name}'. No matching app in directory or currently running.`
                        );
                    });
                });

                describe('When the target has registered any listeners (so the FDC3 service has the window in the model)', () => {
                    let listener: fdc3Remote.RemoteIntentListener;

                    beforeEach(async () => {
                        listener = await fdc3Remote.addIntentListener(testAppNotInDirectory, validIntent.type);
                    });

                    describe('When the target has *not* registered listeners for the raised intent', () => {
                        test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                            await expect(raiseIntent(nonExistentIntent, testAppNotInDirectory)).toThrowFDC3Error(
                                ResolveError.IntentTimeout,
                                `Timeout waiting for intent listener to be added. intent = ${nonExistentIntent.type}`
                            );
                        });
                    });

                    describe('When the target has registered listeners for the raised intent', () => {
                        test('When calling raiseIntent from another app the listener is triggered exactly once with the correct context', async () => {
                            await raiseIntent(validIntent, testAppNotInDirectory);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validIntent.context]);
                        });

                        test('When registering a duplicate intent listener, then calling raiseIntent from another app, \
both listeners are triggered exactly once with the correct context', async () => {
                            const duplicateListener = await fdc3Remote.addIntentListener(testAppNotInDirectory, validIntent.type);

                            await raiseIntent(validIntent, testAppNotInDirectory);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validIntent.context]);

                            const duplicateReceivedContexts = await duplicateListener.getReceivedContexts();
                            expect(duplicateReceivedContexts).toEqual([validIntent.context]);
                        });

                        test('When adding a distinct intent listener, then calling raiseIntent from another app, \
only the first listener is triggered', async () => {
                            const distinctListener = await fdc3Remote.addIntentListener(testAppNotInDirectory, validIntent.type + 'distinguisher');

                            await raiseIntent(validIntent, testAppNotInDirectory);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validIntent.context]);

                            const distinctReceivedContexts = await distinctListener.getReceivedContexts();
                            expect(distinctReceivedContexts).toEqual([]);
                        });

                        test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
                            await listener.unsubscribe();
                            await expect(raiseIntent(validIntent, testAppNotInDirectory)).toThrowFDC3Error(
                                ResolveError.IntentTimeout,
                                `Timeout waiting for intent listener to be added. intent = ${validIntent.type}`
                            );
                        });

                        test('When calling unsubscribe from a second intent listener, then calling raiseIntent from another app, \
only the first listener is triggered exactly once with the correct context, and the second is not triggered', async () => {
                            const shortLivedListener = await fdc3Remote.addIntentListener(testAppNotInDirectory, validIntent.type);
                            await shortLivedListener.unsubscribe();

                            await raiseIntent(validIntent, testAppNotInDirectory);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validIntent.context]);

                            const shortLivedReceivedContexts = await shortLivedListener.getReceivedContexts();
                            expect(shortLivedReceivedContexts).toEqual([]);
                        });
                    });
                });
            });
        });
    }); // With a target

    describe('Without a target', () => {
        describe('0 apps in directory registered to accept the raised intent', () => {
            noTarget_noDirectoryAppCanHandleIntent(intentNotInDirectory);
        }); // 0 apps in directory

        describe('1 app in directory registered to accept the raised intent', () => {
            describe('With the registered app running', () => {
                setupOpenDirectoryApp(testAppWithUniqueIntent);

                describe('But the app does not have the listener registered on the model', () => {
                    // This case is equivalent to 0 apps in directory
                    noTarget_noDirectoryAppCanHandleIntent(uniqueIntent);
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
                        const adHocAppListener = setupStartNonDirectoryAppWithIntentListener(uniqueIntent, testAppNotInDirectory);

                        describe('When calling raiseIntent from another app, the resolver is displayed with both apps.', () => {
                            test('When closing the selector, an error is thrown', async () => {
                                await expect(raiseIntentExpectResolverAndClose(uniqueIntent)).toThrowFDC3Error(
                                    ResolveError.ResolverClosedOrCancelled,
                                    'Selector closed or cancelled'
                                );
                            });
                            test_raiseIntentExpectResolverSelectApp(
                                'When choosing the directory app on the selector, it receives intent',
                                () => [uniqueIntent, testAppWithUniqueIntent, directoryAppListener]
                            );
                            test_raiseIntentExpectResolverSelectApp(
                                'When choosing the ad-hoc app on the selector, it receives intent',
                                () => [uniqueIntent, testAppNotInDirectory, adHocAppListener.current]
                            );
                        });
                    });
                }); // 1 app in directory, running, has registered listener
            }); // 1 app in directory, running

            describe('With the registered app not running', () => {
                describe('And no running ad-hoc apps with listeners registered for the raised intent', () => {
                    let raiseIntentPromise: Promise<void>;
                    beforeEach(async () => {
                        raiseIntentPromise = raiseIntent(uniqueIntent);
                        // Wait for app to open after raising intent
                        while (!await fin.Application.wrapSync(testAppWithUniqueIntent).isRunning()) {
                            await delay(500);
                        }
                        await expect(fin.Application.wrapSync(testAppWithUniqueIntent).isRunning()).resolves.toBe(true);
                    });
                    afterEach(async () => {
                        await fin.Application.wrapSync(testAppWithUniqueIntent).quit();
                    });

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
                            await delay(2000); // For some reason a 'could not find specified executionTarget' error is thrown without a delay here

                            await fdc3Remote.addIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                            await raiseIntentPromise;

                            const listener = await fdc3Remote.getRemoteIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                            const receivedContexts = await listener.getReceivedContexts();

                            expect(receivedContexts).toEqual([uniqueIntent.context]);
                        });
                    });
                });

                describe('But there is a running ad-hoc app with a listener registered for the same intent', () => {
                    const adHocAppListener = setupStartNonDirectoryAppWithIntentListener(uniqueIntent, testAppNotInDirectory);

                    describe('When calling raiseIntent from another app, the resolver is displayed with the directory + ad-hoc app', () => {
                        test('When closing the selector, an error is thrown', async () => {
                            await expect(raiseIntentExpectResolverAndClose(uniqueIntent)).toThrowFDC3Error(
                                ResolveError.ResolverClosedOrCancelled,
                                'Selector closed or cancelled'
                            );
                        });
                        test.todo('When choosing the directory app on the selector, it receives intent (needs to register listener after opening)');
                        test_raiseIntentExpectResolverSelectApp(
                            'When choosing the ad-hoc app on the selector, it receives intent',
                            () => [uniqueIntent, testAppNotInDirectory, adHocAppListener.current]
                        );
                    });
                });
            }); // 1 app in directory, not running
        }); // 1 app in directory

        describe('>1 app in directory registered to accept the raised intent', () => {
            describe('When calling raiseIntent from another app, the resolver is displayed with multiple apps', () => {
                test('When closing the selector, an error is thrown', async () => {
                    await expect(raiseIntentExpectResolverAndClose(intentInManyApps)).toThrowFDC3Error(
                        ResolveError.ResolverClosedOrCancelled,
                        'Selector closed or cancelled'
                    );
                });
                test_raiseIntentExpectResolverSelectApp(
                    'When choosing on the selector an app that preregisters the intent, it receives it',
                    () => [intentInManyApps, testAppWithPreregisteredListeners]
                );
            });
        }); // >1 app in directory
    }); // Without a target
});

//
// Common / reusable cases
//

/**
 * Raise an intent against a target app (waiting for it to start if not already), and add an intent listener after some delay.
 * Returns the promise from raising the intent
 * @param intent intent to raise
 * @param targetApp target app
 * @param delayMs time in milliseconds to wait after the app is running and before the intent listener is added
 */
async function raiseDelayedIntentWithTarget(intent: Intent, targetApp: AppIdentity, delayMs: number) {
    let err: FDC3Error | undefined = undefined;

    // We dont await for this promise - that's up to the function caller.
    // It's going to resolve only after we add the listener to the test app
    const raiseIntentPromise = raiseIntent(intent, targetApp).catch(e => {
        err = e;
    });

    while (!await fin.Application.wrapSync(targetApp).isRunning()) {
        await delay(500);
    }
    // App should now be running

    // We want to have a delay between the app running and the intent listener being set up,
    // so that we can test the "add intent" handshake message. If the app is fast enough setting up,
    // the intent message may go through anyway, but we want to simulate the case where the app
    // takes some time between starting up and actually setting up the intent listener.
    await delay(delayMs);

    await fdc3Remote.addIntentListener(targetApp, intent.type);

    // At this point the promise can be resolved if the listener it was waiting for has just been registered,
    // or rejected due to `raiseIntent` timing out
    if (err) {
        throw err;
    }
    return raiseIntentPromise;
}

/**
 * Raises an intent and `expect`s that the resolver window shows, then closes it
 * @param intent intent to raise
 */
async function raiseIntentAndExpectResolverToShow(intent: Intent) {
    // Raise intent but don't await - promise won't resolve until an app is selected on the resolver
    const raiseIntentPromise = raiseIntent(intent);

    while (!await fin.Window.wrapSync(resolverWindowIdentity).isShowing()) {
        await delay(500);
    }

    const isResolverShowing = await fin.Window.wrapSync(resolverWindowIdentity).isShowing();
    expect(isResolverShowing).toBe(true);

    return [raiseIntentPromise] as [Promise<void>];
}

function raiseIntentExpectResolverAndClose(intent: Intent): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
        const [raiseIntentPromise] = await raiseIntentAndExpectResolverToShow(intent);
        raiseIntentPromise.catch(async e => {
            // After the resolver is cancelled, wait for some time before rejecting to give the resolver window enough time to close.
            await delay(500);
            reject(e);
        });
        await closeResolver();
    });
}

async function test_raiseIntentExpectResolverSelectApp(title: string, getParams: () =>
    [Intent, AppIdentity, fdc3Remote.RemoteIntentListener?]) {
    test(title, async () => {
        const [intent, app, listener] = getParams();
        const [raiseIntentPromise] = await raiseIntentAndExpectResolverToShow(intent);
        await selectResolverApp(app.name);
        await raiseIntentPromise; // Now the intent resolves

        // If no intent listener provided, try to fetch it "live"
        const remoteListener = listener || await fdc3Remote.getRemoteIntentListener(app, intent.type);

        const receivedContexts = await remoteListener.getReceivedContexts();
        expect(receivedContexts).toEqual([intent.context]);
    });
}

/**
 * Closes the resolver by remotely clicking the Cancel button in it
 */
async function closeResolver() {
    const cancelClicked = await fdc3Remote.clickHTMLElement(resolverWindowIdentity, '#btn-cancel');
    if (!cancelClicked) {
        throw new Error('Error clicking cancel button on resolver. Make sure it has id="btn-cancel".');
    }
    await delay(100); // Give the UI some time to process the click and close the window

    const isResolverShowing = await fin.Window.wrapSync(resolverWindowIdentity).isShowing();
    expect(isResolverShowing).toBe(false);
}

/**
 * Selects an app on the resolver by remotely clicking on its button and subsequently on the 'open' button
 * @param appName name of app to open
 */
async function selectResolverApp(appName: string) {
    const appClicked = await fdc3Remote.clickHTMLElement(resolverWindowIdentity, `#${appName}`);
    if (!appClicked) {
        throw new Error(`App with name '${appName}' not found in resolver`);
    }
    await delay(100);
    const openClicked = await fdc3Remote.clickHTMLElement(resolverWindowIdentity, '#btn-open');
    if (!openClicked) {
        throw new Error('Error clicking open button on resolver. Make sure it has id="btn-open".');
    }
    await delay(100);

    const isResolverShowing = await fin.Window.wrapSync(resolverWindowIdentity).isShowing();
    expect(isResolverShowing).toBe(false);
}

/**
 * This case occurs when either:
 * - there are no directory apps for a given intent, or
 * - there are directory apps for the intent, but are running and haven't registered listeners for the intent
 * @param intent intent
 */
function noTarget_noDirectoryAppCanHandleIntent(intent: Intent) {
    describe('And no running ad-hoc apps with listeners registered for the raised intent', () => {
        test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
            await expect(raiseIntent(intent)).toThrowFDC3Error(
                ResolveError.NoAppsFound,
                'No applications available to handle this intent'
            );
        });
    });

    describe('But there are running ad-hoc apps with a listener registered for the raised intent', () => {
        const listener = setupStartNonDirectoryAppWithIntentListener(intent, testAppNotInDirectory);

        describe('Just 1 ad-hoc app with a listener registered for the intent', () => {
            test('When calling raiseIntent the listener is triggered once', async () => {
                await raiseIntent(intent);

                const receivedContexts = await listener.current.getReceivedContexts();
                expect(receivedContexts).toEqual([intent.context]);
            });

            test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
                await listener.current.unsubscribe();
                await expect(raiseIntent(intent)).toThrowFDC3Error(
                    ResolveError.NoAppsFound,
                    'No applications available to handle this intent'
                );
            });
        });

        describe('2 ad-hoc apps, both of them with a listener registered for the intent', () => {
            const listener2 = setupStartNonDirectoryAppWithIntentListener(intent, testAppNotInDirectory2);

            describe('When calling raiseIntent, the resolver is displayed with both apps', () => {
                test('When closing the selector, an error is thrown', async () => {
                    await expect(raiseIntentExpectResolverAndClose(intent)).toThrowFDC3Error(
                        ResolveError.ResolverClosedOrCancelled,
                        'Selector closed or cancelled'
                    );
                });
                test_raiseIntentExpectResolverSelectApp(
                    'When choosing the directory app on the selector, it receives intent',
                    () => [intent, testAppNotInDirectory, listener.current]
                );
                test_raiseIntentExpectResolverSelectApp(
                    'When choosing the ad-hoc app on the selector, it receives intent',
                    () => [intent, testAppNotInDirectory2, listener2.current]
                );
            });

            test('When calling unsubscribe from the intent listener on the first app, then calling raiseIntent from another app, \
then the second listener is triggered exactly once with the correct context', async () => {
                await listener.current.unsubscribe();
                await raiseIntent(intent);

                const receivedContexts = await listener.current.getReceivedContexts();
                expect(receivedContexts).toEqual([]);

                const receivedContexts2 = await listener2.current.getReceivedContexts();
                expect(receivedContexts2).toEqual([intent.context]);
            });
        });
    });
}

/**
 * Registers `beforeEach` to open an app in the directory via FDC3's `open` method, and `afterEach` to quit
 * @param app app identity
 */
function setupOpenDirectoryApp(app: AppIdentity) {
    beforeEach(async () => {
        await fdc3Remote.open(testManagerIdentity, app.uuid);
    });

    afterEach(async () => {
        await fin.Application.wrapSync(app).quit().catch(() => {});
    });
}

/**
 * Registers `beforeEach` to start an app from its `manifestUrl`, and `afterEach` to quit
 * @param app app info. Defaults to `test-app-not-in-directory`
 */
function setupStartNonDirectoryApp(app: NonDirectoryApp = testAppNotInDirectory) {
    beforeEach(async () => {
        await fin.Application.startFromManifest(app.manifestUrl);
    });

    afterEach(async () => {
        await fin.Application.wrapSync(app).quit().catch(() => {});
    });
}

/**
 * Registers `beforeEach` to start an app from its `manifestUrl` and add an intent listener, and `afterEach` to quit the app
 * @param intent intent to add listener to. Listener is returned, boxed in an object
 * @param app app info. Defaults to `test-app-not-in-directory`
 */
function setupStartNonDirectoryAppWithIntentListener(intent: Intent, app: NonDirectoryApp): Boxed<fdc3Remote.RemoteIntentListener> {
    setupStartNonDirectoryApp(app);
    const listener: Boxed<fdc3Remote.RemoteIntentListener> = {current: undefined!};

    beforeEach(async () => {
        listener.current = await fdc3Remote.addIntentListener(app, intent.type);
    });

    return listener;
}

//
// Utilities
//

type Boxed<T> = { current: T }

interface AppIdentity {
    uuid: string;
    name: string;
    appId?: string;
}

interface NonDirectoryApp extends AppIdentity {
    manifestUrl: string;
}

function raiseIntent(intent: Intent, target?: AppIdentity, sendFromIdentity?: Identity): Promise<void> {
    return fdc3Remote.raiseIntent(
        sendFromIdentity || testManagerIdentity,
        intent.type,
        intent.context,
        target ? target.name : undefined
    );
}
