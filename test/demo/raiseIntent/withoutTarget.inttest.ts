import 'jest';
import 'reflect-metadata';

import {ResolveError} from '../../../src/client/errors';
import {Intent} from '../../../src/client/intents';
import {RESOLVER_IDENTITY} from '../../../src/provider/utils/constants';
import {fin} from '../utils/fin';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {delay} from '../utils/delay';
import {TestAppData, setupOpenDirectoryAppBookends, setupStartNonDirectoryAppWithIntentListenerBookends, setupTeardown, setupQuitAppAfterEach, waitForAppToBeRunning, Boxed} from '../utils/common';
import {testManagerIdentity, testAppInDirectory4, testAppNotInDirectory1, testAppNotInDirectory2, testAppWithPreregisteredListeners1, testAppUrl} from '../constants';

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
 * An intent registered by multiple apps in the directory
 */
const intentInManyApps: Intent = {
    type: 'DialCall',
    context: {type: 'dial-call-context'}
};

/**
 * An intent not registered by any directory app, but ad-hoc apps may register it
 */
const intentNotInDirectory: Intent = {
    type: 'test.IntentNotInDirectory',
    context: {type: 'dummyContext'}
};

setupTeardown();

describe('Intent listeners and raising intents without a target', () => {
    describe('0 apps in directory registered to accept the raised intent', () => {
        setupNoDirectoryAppCanHandleIntentTests(intentNotInDirectory);
    });

    describe('1 app in directory registered to accept the raised intent', () => {
        describe('With the registered app running', () => {
            setupOpenDirectoryAppBookends(testAppWithUniqueIntent);

            describe('But the app does not have the listener registered on the model', () => {
                // This case is equivalent to 0 apps in directory
                setupNoDirectoryAppCanHandleIntentTests(uniqueIntent);
            });

            type TestParam = [string, () => Promise<fdc3Remote.RemoteIntentListener>];
            const testParams: TestParam[] = [
                ['the app\'s main window', async () => {
                    return fdc3Remote.addIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                }],
                ['the app\'s child window', async () => {
                    const childIdentity = {uuid: testAppWithUniqueIntent.uuid, name: testAppWithUniqueIntent.name + '-child-window'};

                    await fdc3Remote.createFinWindow(testAppWithUniqueIntent, {name: childIdentity.name, url: testAppUrl});

                    return fdc3Remote.addIntentListener(childIdentity, uniqueIntent.type);
                }]
            ];

            describe.each(testParams)(
                'And %s has registered a listener for the intent',
                (titleParam: string, listenerCreator: (() => Promise<fdc3Remote.RemoteIntentListener>)) => {
                    let directoryAppListener: fdc3Remote.RemoteIntentListener;

                    beforeEach(async () => {
                        directoryAppListener = await listenerCreator();
                    });
                    describe('And no running ad-hoc apps with listeners registered for the raised intent', () => {
                        test('When calling raiseIntent from another app the listener is triggered exactly once with the correct context', async () => {
                            await raiseIntent(uniqueIntent);

                            await expect(directoryAppListener).toHaveReceivedContexts([uniqueIntent.context]);
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
                }
            );
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
                            `Timeout waiting for intent listener to be added for intent: ${uniqueIntent.type}`
                        );
                    });
                });

                describe('When the directory app registers the intent listener after opening', () => {
                    test('When the listener is registered on the main window, when calling raiseIntent from another app \
the app opens and receives the intent with the correct context', async () => {
                        await fdc3Remote.addIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                        await raiseIntentPromise;

                        const listener = await fdc3Remote.getRemoteIntentListener(testAppWithUniqueIntent, uniqueIntent.type);

                        await expect(listener).toHaveReceivedContexts([uniqueIntent.context]);
                    });

                    // TODO: Re-enable once we have at timeout to allow apps to add intent listeners on mulitple windows on startup (SERVICE-556)
                    test.skip('When the listener is registered on the child window, when calling raiseIntent from another app \
the app opens and receives the intent with the correct context', async () => {
                        const childIdentity = {uuid: testAppWithUniqueIntent.uuid, name: testAppWithUniqueIntent.name + '-child-window'};

                        await fdc3Remote.createFinWindow(testAppWithUniqueIntent, {name: childIdentity.name, url: testAppUrl});
                        await fdc3Remote.addIntentListener(childIdentity, uniqueIntent.type);

                        await raiseIntentPromise;

                        const listener = await fdc3Remote.getRemoteIntentListener(childIdentity, uniqueIntent.type);

                        await expect(listener).toHaveReceivedContexts([uniqueIntent.context]);
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

                            await expect(listener).toHaveReceivedContexts([uniqueIntent.context]);
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

/**
 * This case occurs when either:
 * - there are no directory apps for a given intent, or
 * - there are directory apps for the intent, but are running and haven't registered listeners for the intent
 * @param intent intent
 */
function setupNoDirectoryAppCanHandleIntentTests(intent: Intent): void {
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

    await expect(remoteListener).toHaveReceivedContexts([intent.context]);
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
