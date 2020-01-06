import 'jest';

import {allowReject} from 'openfin-service-async';

import {Context, OrganizationContext} from '../../src/client/main';
import {ApplicationError, SendContextError} from '../../src/client/errors';
import {Timeouts} from '../../src/provider/constants';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {fin} from './utils/fin';
import {quitApps, setupOpenDirectoryAppBookends, setupTeardown, waitForAppToBeRunning} from './utils/common';
import {testManagerIdentity, testAppInDirectory1, testAppInDirectory2, testAppWithPreregisteredListeners1, testAppWithPreregisteredListeners2, testAppNotFdc3, testAppUrl, appStartupTime} from './constants';
import {delay, Duration} from './utils/delay';
import {TestWindowContext} from './utils/ofPuppeteer';

setupTeardown();

const invalidAppName = 'invalid-app-name';

describe('Opening applications with the FDC3 client', () => {
    describe('Without context', () => {
        describe('With the app not running', () => {
            test('When passing a valid app name the app opens and the promise resolves', async () => {
                // From the launcher app, call fdc3.open with a valid name
                await open(testAppInDirectory1.name);

                // Check that the app is now running
                await expect(fin.Application.wrapSync(testAppInDirectory1).isRunning()).resolves.toBe(true);

                await quitApps(testAppInDirectory1);
            });

            test('When passing a valid app name of an app that never connects to FDC3 the app opens and the promise resolves', async () => {
                // From the launcher app, call fdc3.open with a valid name
                await open(testAppNotFdc3.name);

                // Check that the app is now running
                await expect(fin.Application.wrapSync(testAppNotFdc3).isRunning()).resolves.toBe(true);

                await quitApps(testAppNotFdc3);
            });

            test('When passing an unknown app name the promise rejects with an FDC3Error', async () => {
                // From the launcher app, call fdc3.open with an unregistered name
                const openPromise = open(invalidAppName);

                await expect(openPromise).toThrowFDC3Error(
                    ApplicationError.NotFound,
                    `No application '${invalidAppName}' found running or in directory`
                );
            });
        });

        describe('With an app already running', () => {
            setupOpenDirectoryAppBookends(testAppInDirectory1);

            test('When opening the already running app the app is focused and the promise resolves', async () => {
                // Focus another window so we do not get false positives from the first open focusing
                await fin.Window.wrapSync(testManagerIdentity).focus();

                // From the launcher app, call fdc3.open with a valid name
                await open(testAppInDirectory1.name);

                // Check that the app is still running
                await expect(fin.Application.wrapSync(testAppInDirectory1).isRunning()).resolves.toBe(true);
                // And that the app is focused
                await expect(fin.System.getFocusedWindow().then((w) => w.uuid)).resolves.toBe(testAppInDirectory1.uuid);
            });

            test('When opening an app, the running-state of other apps has no effect', async () => {
                // From the launcher app, call fdc3.open with a second app name
                await open(testAppInDirectory2.name);

                // Check that both apps are running
                await expect(fin.Application.wrapSync(testAppInDirectory1).isRunning()).resolves.toBe(true);
                await expect(fin.Application.wrapSync(testAppInDirectory2).isRunning()).resolves.toBe(true);

                await quitApps(testAppInDirectory2);
            });
        });
    });

    describe('With context', () => {
        const validContext: OrganizationContext = {type: 'fdc3.organization', name: 'OpenFin', id: {default: 'openfin'}};
        const invalidContext = {twitter: 'testname'} as unknown as Context; // Invalid because `type` is missing

        afterEach(async () => {
            // Close all test apps and suppress any errors since the apps may not be running
            await quitApps(testAppWithPreregisteredListeners1, testAppInDirectory1);
        });

        describe('With the app not running', () => {
            describe('When passing a valid app name and a valid context', () => {
                test('When the app adds its listeners on startup, the app opens and its context listener is triggered with the correct data', async () => {
                    // From the launcher app, call fdc3.open with a valid name and context
                    await open(testAppWithPreregisteredListeners1.name, validContext);

                    // Check that the app is now running
                    await expect(fin.Application.wrapSync(testAppWithPreregisteredListeners1).isRunning()).resolves.toBe(true);

                    const preregisteredListener = await fdc3Remote.getRemoteContextListener(testAppWithPreregisteredListeners1);

                    // Check that the app received the context passed in open and nothing else
                    await expect(preregisteredListener).toHaveReceivedContexts([validContext]);
                });

                test('When the app adds its listener after a short delay, the app opens and its context listener is triggered with the \
correct data', async () => {
                    // From the launcher app, call fdc3.open with a valid name and context
                    const openPromise = open(testAppInDirectory1.name, validContext);

                    // Wait a short delay after the app is running
                    await waitForAppToBeRunning(testAppInDirectory1);
                    await delay(Duration.SHORTER_THAN_APP_MATURITY);

                    // Add a listener
                    const listener = await fdc3Remote.addContextListener(testAppInDirectory1);

                    await openPromise;

                    // Check that the app received the context passed in open and nothing else
                    await expect(listener).toHaveReceivedContexts([validContext]);
                });

                test('When the app adds its listener on a child window, the app opens and its context listener is triggered with the \
correct data', async () => {
                    // From the launcher app, call fdc3.open with a valid name and context
                    const openPromise = open(testAppInDirectory1.name, validContext);

                    await waitForAppToBeRunning(testAppInDirectory1);

                    // Create a child window and add a listener on it
                    const childWindow = await fdc3Remote.createFinWindow(testAppInDirectory1, {url: testAppUrl, name: 'child-window'});
                    const listener = await fdc3Remote.addContextListener(childWindow);

                    await openPromise;

                    // Check that the app received the context passed in open and nothing else
                    await expect(listener).toHaveReceivedContexts([validContext]);
                });

                test('When the app adds listeners on multiple windows, the app opens and the first window\'s context listener is \
triggered with the correct data', async () => {
                    // From the launcher app, call fdc3.open with a valid name and context
                    const openPromise = open(testAppInDirectory1.name, validContext);

                    await waitForAppToBeRunning(testAppInDirectory1);

                    const childWindow1 = await fdc3Remote.createFinWindow(testAppInDirectory1, {url: testAppUrl, name: 'child-window-1'});
                    const childWindow2 = await fdc3Remote.createFinWindow(testAppInDirectory1, {url: testAppUrl, name: 'child-window-2'});

                    // Add listeners
                    const listener1 = await fdc3Remote.addContextListener(childWindow1);
                    const listener2 = await fdc3Remote.addContextListener(childWindow2);
                    const listener3 = await fdc3Remote.addContextListener(testAppInDirectory1);

                    await openPromise;

                    // Check that only the first listener received the context passed in open
                    await expect(listener1).toHaveReceivedContexts([validContext]);
                    await expect(listener2).toHaveReceivedContexts([]);
                    await expect(listener3).toHaveReceivedContexts([]);
                });

                test('When the app adds its listener after a long delay, the app opens but the promise rejects and its context listener \
is not triggered', async () => {
                    // From the launcher app, call fdc3.open with a valid name and context
                    const openPromise = allowReject(open(testAppInDirectory1.name, validContext));

                    // Wait a long delay after the app is running
                    await waitForAppToBeRunning(testAppInDirectory1);
                    await delay(Duration.LONGER_THAN_APP_MATURITY);

                    // Add a listener
                    const listener = await fdc3Remote.addContextListener(testAppInDirectory1);

                    await expect(openPromise).toThrowFDC3Error(SendContextError.NoHandler, 'Context provided, but application has no handler for context');

                    // Check the listener did not receive the context in open
                    await expect(listener).toHaveReceivedContexts([]);
                }, appStartupTime + Duration.LONGER_THAN_APP_MATURITY);
            });

            test('When passing a known app name but invalid context, the promise rejects with an FDC3Error', async () => {
                const openPromise = open(testAppWithPreregisteredListeners1.name, invalidContext);

                await expect(openPromise).rejects.toThrowError(new TypeError(`${JSON.stringify(invalidContext)} is not a valid Context`));
            });

            test('When passing an unknown app name with any context the promise rejects with an FDC3Error', async () => {
                // From the launcher app, call fdc3.open with an invalid name and valid context
                const openPromise = open(invalidAppName, validContext);

                await expect(openPromise).toThrowFDC3Error(
                    ApplicationError.NotFound,
                    `No application '${invalidAppName}' found running or in directory`
                );
            });
        });

        describe('With an app already running', () => {
            setupOpenDirectoryAppBookends(testAppWithPreregisteredListeners1);

            test('When opening the running app it is focused, its context listener is triggered with the correct data, and the promise resolves', async () => {
                // Focus another window so we do not get false positives from the first open focusing
                await fin.Window.wrapSync(testManagerIdentity).focus();

                // From the launcher app, call fdc3.open with the name of the running app
                await open(testAppWithPreregisteredListeners1.name, validContext);

                // Check that the app is still running
                await expect(fin.Application.wrapSync({uuid: testAppWithPreregisteredListeners1.uuid}).isRunning()).resolves.toBe(true);
                // And that the app is focused
                await expect(fin.System.getFocusedWindow().then((w) => w.uuid)).resolves.toBe(testAppWithPreregisteredListeners1.uuid);

                const preregisteredListener = await fdc3Remote.getRemoteContextListener(testAppWithPreregisteredListeners1);

                // Check that the app received the context passed in open and nothing else
                await expect(preregisteredListener).toHaveReceivedContexts([validContext]);
            });

            test('When the running app has multiple listeners registered, its context listeners are triggered with the correct data, and \
the promise resolves', async () => {
                // Create/get our listeners
                const listener1 = await fdc3Remote.getRemoteContextListener(testAppWithPreregisteredListeners1);
                const listener2 = await fdc3Remote.addContextListener(testAppWithPreregisteredListeners1);

                const childWindow = await fdc3Remote.createFinWindow(testAppWithPreregisteredListeners1, {url: testAppUrl, name: 'child-window'});

                const listener3 = await fdc3Remote.addContextListener(childWindow);

                // From the launcher app, call fdc3.open the name of the running app
                await open(testAppWithPreregisteredListeners1.name, validContext);

                // Check that the each listener received the context passed in open and nothing else
                await expect(listener1).toHaveReceivedContexts([validContext]);
                await expect(listener2).toHaveReceivedContexts([validContext]);
                await expect(listener3).toHaveReceivedContexts([validContext]);
            });

            test('When opening the running app it is focused, its context listener is triggered with the correct data, and the promise resolves', async () => {
                // Focus another window so we do not get false positives from the first open focusing
                await fin.Window.wrapSync(testManagerIdentity).focus();

                // From the launcher app, call fdc3.open the name of the running app
                await open(testAppWithPreregisteredListeners1.name, validContext);

                // Check that the app is still running
                await expect(fin.Application.wrapSync({uuid: testAppWithPreregisteredListeners1.uuid}).isRunning()).resolves.toBe(true);
                // And that the app is focused
                await expect(fin.System.getFocusedWindow().then((w) => w.uuid)).resolves.toBe(testAppWithPreregisteredListeners1.uuid);

                const preregisteredListener = await fdc3Remote.getRemoteContextListener(testAppWithPreregisteredListeners1);

                // Check that the app received the context passed in open and nothing else
                await expect(preregisteredListener).toHaveReceivedContexts([validContext]);
            });

            test.only('When the running app has a listener that throws an error, the promise rejects with an FDC3 error', async () => {
                // Remove the pre-registered listener
                const preregisteredListener = await fdc3Remote.getRemoteContextListener(testAppWithPreregisteredListeners1);
                await preregisteredListener.unsubscribe();

                // Setup an erroring listener
                await fdc3Remote.ofBrowser.executeOnWindow(testAppWithPreregisteredListeners1, function (this: TestWindowContext): void {
                    this.fdc3.addContextListener(() => {
                        throw new Error('Context listener throwing error');
                    });
                });

                await delay(30000);
                // From the launcher app, call fdc3.open with a valid name and context
                const promise = allowReject(open(testAppWithPreregisteredListeners1.name, validContext));
                // Check the promise rejects as expected
                await expect(promise).toThrowFDC3Error(
                    SendContextError.HandlerError,
                    'Error(s) thrown by application attempting to handle context'
                );
            });

            test('When the running app has a mix of erroring and non-erroring listeners, all listeners are triggered, and the promise \
resolves', async () => {
                // Setup our first non-erroring listener
                const listener1 = await fdc3Remote.getRemoteContextListener(testAppWithPreregisteredListeners1);

                // Setup an erroring listener
                await fdc3Remote.ofBrowser.executeOnWindow(testAppWithPreregisteredListeners1, function (this: TestWindowContext): void {
                    this.fdc3.addContextListener(() => {
                        throw new Error('Context listener throwing error');
                    });
                });

                // Setup our final non-erroring listener
                const listener2 = await fdc3Remote.addContextListener(testAppWithPreregisteredListeners1);

                // From the launcher app, call fdc3.open with a valid name and context
                await open(testAppWithPreregisteredListeners1.name, validContext);

                // Check that our listeners recieved the expected context
                await expect(listener1).toHaveReceivedContexts([validContext]);
                await expect(listener2).toHaveReceivedContexts([validContext]);
            });

            test('When the running app has a mix of erroring and non-erroring listeners across multiple windows, all listeners are \
triggered, and the promise resolves', async () => {
                // Setup our first non-erroring listener
                const listener1 = await fdc3Remote.getRemoteContextListener(testAppWithPreregisteredListeners1);

                // Create child windows and setup an erroring listener
                const childWindow1 = await fdc3Remote.createFinWindow(testAppWithPreregisteredListeners1, {url: testAppUrl, name: 'child-window-1'});
                const childWindow2 = await fdc3Remote.createFinWindow(testAppWithPreregisteredListeners1, {url: testAppUrl, name: 'child-window-2'});

                await fdc3Remote.ofBrowser.executeOnWindow(childWindow1, function (this: TestWindowContext): void {
                    this.fdc3.addContextListener(() => {
                        throw new Error('Context listener throwing error');
                    });
                });

                // Setup our final non-erroring listener
                const listener2 = await fdc3Remote.addContextListener(childWindow2);

                // From the launcher app, call fdc3.open with a valid name and context
                await open(testAppWithPreregisteredListeners1.name, validContext);

                // Check that our listeners recieved the expected context
                await expect(listener1).toHaveReceivedContexts([validContext]);
                await expect(listener2).toHaveReceivedContexts([validContext]);
            });

            test('When an app is already running, opening a second app with context works as expected \
and does not trigger the context listener of the already open app', async () => {
                // From the launcher app, call fdc3.open with the name of as second app
                await open(testAppWithPreregisteredListeners2.name, validContext);
                // Check that the second app started
                await expect(fin.Application.wrapSync(testAppWithPreregisteredListeners2).isRunning()).resolves.toBe(true);

                // Retrieve the list of contexts the second app received
                const listener2 = await fdc3Remote.getRemoteContextListener(testAppWithPreregisteredListeners2);
                const receivedContexts2 = await listener2.getReceivedContexts();

                // Check that the second app received the context passed in open and nothing else
                expect(receivedContexts2).toEqual([validContext]);

                // Retrieve the list of contexts the first app received
                const listener1 = await fdc3Remote.getRemoteContextListener(testAppWithPreregisteredListeners1);
                const receivedContexts1 = await listener1.getReceivedContexts();

                // Check that the first app did not receive a context
                expect(receivedContexts1).toEqual([]);

                await quitApps(testAppWithPreregisteredListeners2);
            });
        });
    });

    test('When opening an app which fails to launch the promise rejects with a suitable error message', async () => {
        const openPromise = open('test-app-invalid-manifest');

        // fin.Application.startFromManifest errors with this message when providing an inexistent manifest URL
        await expect(openPromise).toThrowFDC3Error(
            ApplicationError.LaunchError,
            /Failed to download resource\. Status code: 404/
        );
    });

    test('When opening an app which takes too long to launch the promise rejects with a timeout FDC3Error', async () => {
        const appName = 'test-app-takes-long-to-load-manifest';
        const openPromise = open(appName);

        // fin.Application.startFromManifest errors with this message when it times out trying to open an app
        await expect(openPromise).toThrowFDC3Error(
            ApplicationError.LaunchTimeout,
            `Timeout waiting for application '${appName}' to start from manifest`
        );
    }, Timeouts.APP_START_FROM_MANIFEST + 2000);

    describe('When opening an app that delays registering a context listener, but less than the timeout', () => {
        const testAppDelayedPreregisterShort = {uuid: 'test-app-delayed-preregister-short', name: 'test-app-delayed-preregister-short'};
        const validContext: OrganizationContext = {type: 'fdc3.organization', name: 'OpenFin', id: {default: 'openfin'}};

        let openPromise: Promise<void>;

        beforeEach(() => {
            openPromise = open(testAppDelayedPreregisterShort.name, validContext);
        });

        afterEach(async () => {
            await quitApps(testAppDelayedPreregisterShort);
        });

        test('The promise resolves and the app opens', async () => {
            await openPromise;

            await expect(fin.Application.wrapSync(testAppDelayedPreregisterShort).isRunning()).resolves.toBe(true);
        });

        test('The context is received by the listener', async () => {
            await openPromise;

            await delay(Duration.SHORTER_THAN_APP_MATURITY);
            const preregisteredListener = await fdc3Remote.getRemoteContextListener(testAppDelayedPreregisterShort);
            await expect(preregisteredListener).toHaveReceivedContexts([validContext]);
        });
    });

    describe('When opening an app that takes longer than the timeout to register a context listener', () => {
        const testAppDelayedPreregisterLong = {uuid: 'test-app-delayed-preregister-long', name: 'test-app-delayed-preregister-long'};
        const validContext: OrganizationContext = {type: 'fdc3.organization', name: 'OpenFin', id: {default: 'openfin'}};

        let openPromise: Promise<void>;

        beforeEach(() => {
            openPromise = open(testAppDelayedPreregisterLong.name, validContext);
        });

        afterEach(async () => {
            await quitApps(testAppDelayedPreregisterLong);
        });

        test('The promise rejects and the app opens', async () => {
            await expect(openPromise).toThrowFDC3Error(SendContextError.NoHandler, 'Context provided, but application has no handler for context');
            await expect(fin.Application.wrapSync(testAppDelayedPreregisterLong).isRunning()).resolves.toBe(true);
        });

        test('The context is not received by the listener', async () => {
            await expect(openPromise).toThrowFDC3Error(SendContextError.NoHandler, 'Context provided, but application has no handler for context');

            await delay(Duration.LONGER_THAN_APP_MATURITY);
            const preregisteredListener = await fdc3Remote.getRemoteContextListener(testAppDelayedPreregisterLong);
            await expect(preregisteredListener).toHaveReceivedContexts([]);
        });
    });
});

function open(appName: string, context?: Context | undefined): Promise<void> {
    return fdc3Remote.open(testManagerIdentity, appName, context);
}
