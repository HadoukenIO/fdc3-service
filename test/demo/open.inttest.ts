import 'jest';

import {Context, OrganizationContext} from '../../src/client/main';
import {OpenError} from '../../src/client/errors';
import {Timeouts} from '../../src/provider/constants';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {fin} from './utils/fin';
import {quitApps, setupOpenDirectoryAppBookends, setupTeardown} from './utils/common';
import {
    testManagerIdentity, testAppInDirectory1, testAppInDirectory2,
    testAppWithPreregisteredListeners1, testAppWithPreregisteredListeners2
} from './constants';

setupTeardown();

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

            test('When passing an unknown app name the service returns an FDC3Error', async () => {
                // From the launcher app, call fdc3.open with an unregistered name
                const openPromise = open('invalid-app-name');

                await expect(openPromise).toThrowFDC3Error(
                    OpenError.AppNotFound,
                    /No app in directory with name/
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
                await expect(fin.System.getFocusedWindow().then(w => w.uuid)).resolves.toBe(testAppInDirectory1.uuid);
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
            await quitApps(testAppWithPreregisteredListeners1);
        });

        describe('With the app not running', () => {
            test('When passing a valid app name and a valid context, the app opens and its context listener is triggered with the correct data', async () => {
                // From the launcher app, call fdc3.open with a valid name and context
                await open(testAppWithPreregisteredListeners1.name, validContext);

                // Check that the app is now running
                await expect(fin.Application.wrapSync(testAppWithPreregisteredListeners1).isRunning()).resolves.toBe(true);

                const preregisteredListener = await fdc3Remote.getRemoteContextListener(testAppWithPreregisteredListeners1);

                // Check that the app received the context passed in open and nothing else
                await expect(preregisteredListener).toHaveReceivedContexts([validContext]);
            });

            test('When passing a known app name but invalid context, the service returns an FDC3Error', async () => {
                const openPromise = open(testAppWithPreregisteredListeners1.name, invalidContext);

                await expect(openPromise).rejects.toThrowError(new TypeError(`${JSON.stringify(invalidContext)} is not a valid Context`));
            });

            test('When passing an unknown app name with any context the service returns an FDC3Error', async () => {
                // From the launcher app, call fdc3.open with an invalid name and valid context
                const openPromise = open('invalid-app-name', validContext);

                await expect(openPromise).toThrowFDC3Error(
                    OpenError.AppNotFound,
                    /No app in directory with name/
                );
            });
        });

        describe('With an app already running', () => {
            setupOpenDirectoryAppBookends(testAppWithPreregisteredListeners1);

            test('When opening the running app it is focused, its context listener is triggered with the correct data, and the promise resolves', async () => {
                // Focus another window so we do not get false positives from the first open focusing
                await fin.Window.wrapSync(testManagerIdentity).focus();

                // From the launcher app, call fdc3.open the name of the running app
                await open(testAppWithPreregisteredListeners1.name, validContext);

                // Check that the app is still running
                await expect(fin.Application.wrapSync({uuid: testAppWithPreregisteredListeners1.uuid}).isRunning()).resolves.toBe(true);
                // And that the app is focused
                await expect(fin.System.getFocusedWindow().then(w => w.uuid)).resolves.toBe(testAppWithPreregisteredListeners1.uuid);

                const preregisteredListener = await fdc3Remote.getRemoteContextListener(testAppWithPreregisteredListeners1);

                // Check that the app received the context passed in open and nothing else
                await expect(preregisteredListener).toHaveReceivedContexts([validContext]);
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
            OpenError.ErrorOnLaunch,
            /Failed to download resource\. Status code: 404/
        );
    });

    test('When opening an app which takes too long to launch the promise rejects with a timeout FDC3Error', async () => {
        const appName = 'test-app-takes-long-to-load-manifest';
        const openPromise = open(appName);

        // fin.Application.startFromManifest errors with this message when it times out trying to open an app
        await expect(openPromise).toThrowFDC3Error(
            OpenError.AppTimeout,
            `Timeout waiting for app '${appName}' to start from manifest`
        );
    }, Timeouts.APP_START_FROM_MANIFEST + 2000);
});

function open(appName: string, context?: Context | undefined): Promise<void> {
    return fdc3Remote.open(testManagerIdentity, appName, context);
}
