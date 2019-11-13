import 'jest';
import 'reflect-metadata';

import {ResolveError} from '../../../src/client/errors';
import {RESOLVER_IDENTITY} from '../../../src/provider/utils/constants';
import {fin} from '../utils/fin';
import * as fdc3Remote from '../utils/fdc3RemoteExecution';
import {delay, Duration} from '../utils/delay';
import {TestAppData, setupOpenDirectoryAppBookends, setupStartNonDirectoryAppWithIntentListenerBookends, setupTeardown, setupQuitAppAfterEach, waitForAppToBeRunning, closeResolver} from '../utils/common';
import {testManagerIdentity, testAppInDirectory4, testAppNotInDirectory1, testAppNotInDirectory2, testAppWithPreregisteredListeners1, testAppUrl, appStartupTime, testAppWithPreregisteredListeners2} from '../constants';
import {Boxed} from '../../../src/provider/utils/types';
import {allowReject, withTimeout} from '../../../src/provider/utils/async';
import {Intent} from '../../../src/provider/intents';

/**
 * Alias for `testAppInDirectory4`, which is only in the directory registering the intent `test.IntentOnlyOnApp4`
 */
const testAppWithUniqueIntent = testAppInDirectory4;

/**
 * Intent that is only registered by a single app in the directory (`test-app-4`)
 */
const uniqueIntent: Intent = {
    type: 'test.IntentOnlyOnApp4',
    context: {type: 'test.IntentOnlyOnApp4Context'}
};

/**
 * An intent registered by multiple apps in the directory
 */
const intentInManyApps: Intent = {
    type: 'DialCall',
    context: {type: 'fdc3.contact'}
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

            describe('But the app is mature and does not have the listener registered on the model', () => {
                beforeEach(async () => {
                    await delay(Duration.LONGER_THAN_APP_MATURITY);
                });

                // This case is equivalent to 0 apps in directory
                setupNoDirectoryAppCanHandleIntentTests(uniqueIntent);
            });

            type TestParam = [string, () => Promise<fdc3Remote.RemoteIntentListener>];
            const testParams: TestParam[] = [
                ['the app\'s main window', async () => {
                    return fdc3Remote.addIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                }],
                ['the app\'s child window', async () => {
                    const childIdentity = {uuid: testAppWithUniqueIntent.uuid, name: `${testAppWithUniqueIntent.name}-child-window`};

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
                    allowReject(raiseIntentPromise);

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
                    test('When the listener is registered on the main window, when calling raiseIntent from another app, the app opens \
and receives the intent with the correct context', async () => {
                        const listener = await fdc3Remote.addIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                        await raiseIntentPromise;

                        await expect(listener).toHaveReceivedContexts([uniqueIntent.context]);
                    });

                    test('When the listener is registered on the main window after a short delay, when calling raiseIntent from another \
app, the app opens and receives the intent with the correct context', async () => {
                        await delay(Duration.SHORTER_THAN_APP_MATURITY);

                        const listener = await fdc3Remote.addIntentListener(testAppWithUniqueIntent, uniqueIntent.type);
                        await raiseIntentPromise;

                        await expect(listener).toHaveReceivedContexts([uniqueIntent.context]);
                    }, appStartupTime + Duration.SHORTER_THAN_APP_MATURITY);

                    test('When listeners are registered on multiple windows after a short delay, when calling raiseIntent from another \
app, the app opens and the first window\'s listener the correct context', async () => {
                        await delay(Duration.SHORTER_THAN_APP_MATURITY);

                        const childWindow1 = await fdc3Remote.createFinWindow(testAppWithUniqueIntent, {url: testAppUrl, name: 'child-window-1'});
                        const childWindow2 = await fdc3Remote.createFinWindow(testAppWithUniqueIntent, {url: testAppUrl, name: 'child-window-2'});

                        const listener1 = await fdc3Remote.addIntentListener(childWindow1, uniqueIntent.type);
                        const listener2 = await fdc3Remote.addIntentListener(childWindow2, uniqueIntent.type);
                        const listener3 = await fdc3Remote.addIntentListener(testAppWithUniqueIntent, uniqueIntent.type);

                        await raiseIntentPromise;

                        await expect(listener1).toHaveReceivedContexts([uniqueIntent.context]);
                        await expect(listener2).toHaveReceivedContexts([]);
                        await expect(listener3).toHaveReceivedContexts([]);
                    }, appStartupTime + Duration.SHORTER_THAN_APP_MATURITY);

                    test('When the listener is registered on the main window after a long delay, when calling raiseIntent from another \
app, the app opens but the promise rejects', async () => {
                        await delay(Duration.LONGER_THAN_APP_MATURITY);

                        const listener = await fdc3Remote.addIntentListener(testAppWithUniqueIntent, uniqueIntent.type);

                        await expect(raiseIntentPromise).toThrowFDC3Error(
                            ResolveError.IntentTimeout,
                            `Timeout waiting for intent listener to be added for intent: ${uniqueIntent.type}`
                        );

                        await expect(listener).toHaveReceivedContexts([]);
                    }, appStartupTime + Duration.LONGER_THAN_APP_MATURITY);
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
                            await selectResolverAppAndExpectResolverToClose(testAppWithUniqueIntent);

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

            describe('When calling raiseIntent multiple times', () => {
                setupQuitAppAfterEach(testAppWithPreregisteredListeners1, testAppWithPreregisteredListeners2, testAppInDirectory4);

                test('Intents statisfied by many apps are queued and are resolved in order', async () => {
                    const order: number[] = [];

                    const frontPromise = (await raiseIntentAndExpectResolverToShow(intentInManyApps)).value.then(() => order.push(1));
                    const middlePromise = raiseIntent(intentInManyApps).then(() => order.push(2));
                    await delay(Duration.API_CALL);
                    const backPromise = raiseIntent(intentInManyApps).then(() => order.push(3));
                    await delay(Duration.API_CALL);

                    await selectResolverApp(testAppWithPreregisteredListeners1);
                    await frontPromise;

                    await expectResolverToShow();
                    await selectResolverApp(testAppWithPreregisteredListeners2);
                    await middlePromise;

                    await expectResolverToShow();
                    await selectResolverAppAndExpectResolverToClose(testAppWithPreregisteredListeners1);
                    await backPromise;

                    expect(order).toEqual([1, 2, 3]);
                });

                test('Intents statisfied by many apps are queued and are resolved in order, even when one resolution is cancelled', async () => {
                    const order: number[] = [];

                    const frontPromise = (await raiseIntentAndExpectResolverToShow(intentInManyApps)).value.then(() => order.push(1));
                    const middlePromise = raiseIntent(intentInManyApps).catch(() => order.push(2));
                    await delay(Duration.API_CALL);
                    const backPromise = raiseIntent(intentInManyApps).then(() => order.push(3));
                    await delay(Duration.API_CALL);

                    await selectResolverApp(testAppWithPreregisteredListeners1);
                    await frontPromise;

                    await expectResolverToShow();
                    await closeResolver();
                    await middlePromise;

                    await expectResolverToShow();
                    await selectResolverAppAndExpectResolverToClose(testAppWithPreregisteredListeners2);
                    await backPromise;

                    expect(order).toEqual([1, 2, 3]);
                });

                test('An intent satisfied by a single app will not be queued, even when the resolver is showing', async () => {
                    const order: number[] = [];

                    const frontPromise = (await raiseIntentAndExpectResolverToShow(intentInManyApps)).value.then(() => order.push(1));
                    const middlePromise = raiseIntent(uniqueIntent).then(() => order.push(2));
                    await delay(Duration.API_CALL);
                    const backPromise = raiseIntent(intentInManyApps).then(() => order.push(3));
                    await delay(Duration.API_CALL);

                    const appRunningPromise = waitForAppToBeRunning(testAppInDirectory4).then(async () => {
                        return fdc3Remote.addIntentListener(testAppInDirectory4, uniqueIntent.type);
                    });

                    await middlePromise;
                    await appRunningPromise;

                    await selectResolverApp(testAppWithPreregisteredListeners1);
                    await frontPromise;

                    await expectResolverToShow();
                    await selectResolverAppAndExpectResolverToClose(testAppWithPreregisteredListeners2);
                    await backPromise;

                    expect(order).toEqual([2, 1, 3]);
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

    allowReject(raiseIntentPromise);

    await closeResolverAndExpectToClose();

    return raiseIntentPromise;
}

async function raiseIntentExpectResolverSelectApp(intent: Intent, app: TestAppData, listener?: fdc3Remote.RemoteIntentListener): Promise<void> {
    const raiseIntentPromise = (await raiseIntentAndExpectResolverToShow(intent)).value;
    await selectResolverAppAndExpectResolverToClose(app);
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

    await expectResolverToShow();

    const isResolverShowing = await fin.Window.wrapSync(RESOLVER_IDENTITY).isShowing();
    expect(isResolverShowing).toBe(true);

    return {value: raiseIntentPromise};
}

/**
 * Remotely clicks the cancel button on the resolver, and checks the resolver closes
 */
async function closeResolverAndExpectToClose(): Promise<void> {
    await closeResolver();

    const isResolverShowing = await fin.Window.wrapSync(RESOLVER_IDENTITY).isShowing();
    expect(isResolverShowing).toBe(false);
}

/**
 * Selects an app on the resolver by remotely clicking on its button and checks the resolver closes
 */
async function selectResolverAppAndExpectResolverToClose(app: TestAppData): Promise<void> {
    await selectResolverApp(app);

    const isResolverShowing = await fin.Window.wrapSync(RESOLVER_IDENTITY).isShowing();
    expect(isResolverShowing).toBe(false);
}

/**
 * Selects an app on the resolver by remotely clicking on its button
 */
async function selectResolverApp(app: TestAppData): Promise<void> {
    const appClicked = await fdc3Remote.clickHTMLElement(RESOLVER_IDENTITY, `.app-card[data-appname="${app.name}"]`);
    if (!appClicked) {
        throw new Error(`App with name '${app.name}' not found in resolver`);
    }
    await delay(Duration.API_CALL);
}

async function expectResolverToShow(): Promise<void> {
    let timedOut = false;

    [timedOut] = await withTimeout(3000, new Promise<void>(async (resolve) => {
        while (!await fin.Window.wrapSync(RESOLVER_IDENTITY).isShowing() && !timedOut) {
            await delay(100);
        }

        resolve();
    }));

    if (timedOut) {
        throw new Error('Timeout waiting for resolver to show');
    }

    // Ensure that the resolver has received latest app data from service
    await delay(Duration.API_CALL);
}

async function raiseIntent(intent: Intent, target?: TestAppData): Promise<void> {
    await fdc3Remote.raiseIntent(
        testManagerIdentity,
        intent.type,
        intent.context,
        target ? target.name : undefined
    );
}
