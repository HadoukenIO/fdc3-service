import 'jest';

import {Identity} from 'openfin/_v2/main';

import {Context, OrganizationContext} from '../../src/client/main';
import {OpenError, Timeouts} from '../../src/client/errors';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {fin} from './utils/fin';

const testManagerIdentity = {
    uuid: 'test-app',
    name: 'test-app'
};

describe('Opening applications with the FDC3 client', () => {
    beforeEach(async () => {
        // The main launcher app should remain running for the duration of all tests.
        await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);
    });

    describe('Without context', () => {
        const testAppIdentity1: Identity = {uuid: 'test-app-1', name: 'test-app-1'};
        const testAppIdentity2: Identity = {uuid: 'test-app-2', name: 'test-app-2'};

        afterEach(async () => {
            // Close all test apps and suppress any errors since the apps may not be running
            await fin.Application.wrapSync(testAppIdentity1).quit().catch(() => {});
            await fin.Application.wrapSync(testAppIdentity2).quit().catch(() => {});
        });

        test('When passing a valid app name the app opens and the promise resolves', async () => {
            // From the launcher app, call fdc3.open with a valid name
            await fdc3Remote.open(testManagerIdentity, testAppIdentity1.name!);

            // Check that the app is now running
            await expect(fin.Application.wrapSync(testAppIdentity1).isRunning()).resolves.toBe(true);
        });

        test('When passing an unknown app name the service returns an FDC3Error', async () => {
            // From the launcher app, call fdc3.open with an unregistered name
            const openPromise = fdc3Remote.open(testManagerIdentity, 'invalid-app-name');

            await expect(openPromise).toThrowFDC3Error(
                OpenError.AppNotFound,
                /No app in directory with name/
            );
        });

        describe('With an app already running', () => {
            beforeEach(async () => {
                // Start by opening a test app
                await fdc3Remote.open(testManagerIdentity, testAppIdentity1.name!);
            });

            test('When opening the already running app the app is focused and the promise resolves', async () => {
                // Focus another window so we do not get false positives from the first open focusing
                await fin.Window.wrapSync(testManagerIdentity).focus();

                // From the launcher app, call fdc3.open with a valid name
                await fdc3Remote.open(testManagerIdentity, testAppIdentity1.name!);

                // Check that the app is still running
                await expect(fin.Application.wrapSync(testAppIdentity1).isRunning()).resolves.toBe(true);
                // And that the app is focused
                await expect(fin.System.getFocusedWindow().then(w => w.uuid)).resolves.toBe(testAppIdentity1.uuid);
            });

            test('When opening a an app, the running-state of other apps has no effect', async () => {
                // From the launcher app, call fdc3.open with a second app name
                await fdc3Remote.open(testManagerIdentity, testAppIdentity2.name!);

                // Check that both apps are running
                await expect(fin.Application.wrapSync(testAppIdentity1).isRunning()).resolves.toBe(true);
                await expect(fin.Application.wrapSync(testAppIdentity2).isRunning()).resolves.toBe(true);
            });
        });
    });

    describe('With context', () => {
        const validContext: OrganizationContext = {type: 'fdc3.organization', name: 'OpenFin', id: {default: 'openfin'}};
        const invalidContext = {twitter: '@testname'} as unknown as Context; // Invalid because `type` is missing
        const testAppIdentity1: Identity = {uuid: 'test-app-preregistered-1', name: 'test-app-preregistered-1'};
        const testAppIdentity2: Identity = {uuid: 'test-app-preregistered-2', name: 'test-app-preregistered-2'};

        afterEach(async () => {
            // Close all test apps and suppress any errors since the apps may not be running
            await fin.Application.wrapSync(testAppIdentity1).quit().catch(() => {});
            await fin.Application.wrapSync(testAppIdentity2).quit().catch(() => {});
        });

        test.skip('When passing a valid app name and a valid context, the app opens and its context listener is triggered with the correct\
data [broken in provider re-arch, to be fixed in future story]', async () => {
            // From the launcher app, call fdc3.open with a valid name and context
            await fdc3Remote.open(testManagerIdentity, testAppIdentity1.name!, validContext);

            // Check that the app is now running
            await expect(fin.Application.wrapSync({uuid: testAppIdentity1.uuid}).isRunning()).resolves.toBe(true);

            // Retrieve the list of contexts the app received
            const preregisteredListener = await fdc3Remote.getRemoteContextListener(testAppIdentity1);
            const receivedContexts: Context[] = await preregisteredListener.getReceivedContexts();

            // Check that the app received the context passed in open and nothing else
            expect(receivedContexts).toEqual([validContext]);
        });

        test('When passing a known app name but invalid context, the service returns an FDC3Error', async () => {
            const openPromise = fdc3Remote.open(testManagerIdentity, testAppIdentity1.name!, invalidContext);

            await expect(openPromise).toThrowFDC3Error(
                OpenError.InvalidContext,
                `Context not valid. context = ${JSON.stringify(invalidContext)}`
            );
        });

        test('When passing an unknown app name with any context the service returns an FDC3Error', async () => {
            // From the launcher app, call fdc3.open with an invalid name and valid context
            const openPromise = fdc3Remote.open(testManagerIdentity, 'invalid-app-name', validContext);

            await expect(openPromise).toThrowFDC3Error(
                OpenError.AppNotFound,
                /No app in directory with name/
            );
        });

        describe('With an app already running', () => {
            beforeEach(async () => {
                // Start by opening a test app
                await fdc3Remote.open(testManagerIdentity, testAppIdentity1.name!);
            });

            test('When opening the running app it is focused, its context listener is triggered with the correct data, and the promise resolves', async () => {
                // Focus another window so we do not get false positives from the first open focusing
                await fin.Window.wrapSync(testManagerIdentity).focus();

                // From the launcher app, call fdc3.open the name of the running app
                await fdc3Remote.open(testManagerIdentity, testAppIdentity1.name!, validContext);

                // Check that the app is still running
                await expect(fin.Application.wrapSync({uuid: testAppIdentity1.uuid}).isRunning()).resolves.toBe(true);
                // And that the app is focused
                await expect(fin.System.getFocusedWindow().then(w => w.uuid)).resolves.toBe(testAppIdentity1.uuid);

                // Retrieve the list of contexts the app received
                const preregisteredListener = await fdc3Remote.getRemoteContextListener(testAppIdentity1);
                const receivedContexts: Context[] = await preregisteredListener.getReceivedContexts();

                // Check that the app received the context passed in open and nothing else
                expect(receivedContexts).toEqual([validContext]);
            });

            test.skip('When an app is already running, opening a second app with context works as expected \
and does not trigger the context listener of the already open app [broken in provider re-arch, to be fixed in future story]', async () => {
                // From the launcher app, call fdc3.open with the name of as second app
                await fdc3Remote.open(testManagerIdentity, testAppIdentity2.name!, validContext);
                // Check that the second app started
                await expect(fin.Application.wrapSync({uuid: testAppIdentity2.uuid}).isRunning()).resolves.toBe(true);

                // Retrieve the list of contexts the second app received
                const listener2 = await fdc3Remote.getRemoteContextListener(testAppIdentity2);
                const secondReceivedContexts: Context[] = await listener2.getReceivedContexts();

                // Check that the second app received the context passed in open and nothing else
                expect(secondReceivedContexts).toEqual([validContext]);

                // Retrieve the list of contexts the first app received
                const listener1 = await fdc3Remote.getRemoteContextListener(testAppIdentity1);
                const firstReceivedContexts: Context[] = await listener1.getReceivedContexts();

                // Check that the first app did not receive a context
                expect(firstReceivedContexts).toHaveLength(0);
            });
        });
    });

    test('When opening an app which fails to launch the promise rejects with a suitable error message', async () => {
        const openPromise = fdc3Remote.open(testManagerIdentity, 'test-app-invalid-manifest');

        // fin.Application.startFromManifest errors with this message when providing an inexistent manifest URL
        await expect(openPromise).toThrowFDC3Error(
            OpenError.ErrorOnLaunch,
            /Failed to download resource\. Status code: 404/
        );
    });

    test('When opening an app which takes too long to launch the promise rejects with a timeout FDC3Error', async () => {
        const appName = 'test-app-takes-long-to-load-manifest';
        const openPromise = fdc3Remote.open(testManagerIdentity, appName);

        // fin.Application.startFromManifest errors with this message when it times out trying to open an app
        await expect(openPromise).toThrowFDC3Error(
            OpenError.AppTimeout,
            `Timeout waiting for app '${appName}' to start from manifest`
        );
    }, Timeouts.APP_START_FROM_MANIFEST + 2000);
});
