import 'jest';

import {connect, Fin} from 'hadouken-js-adapter';

import {Context, OrganizationContext} from '../../src/client/main';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {OFPuppeteerBrowser, TestWindowContext} from './utils/ofPuppeteer';

const testManagerIdentity = {
    uuid: 'test-app',
    name: 'test-app'
};

describe('Opening applications with the FDC3 client', () => {
    let fin: Fin;

    beforeAll(async () => {
        // Establish a node adapter connection for the file. This needs to use a file-specific name since jest sandboxes the imports
        // from each test file, and other files may have already connected to the runtime with a generic uuid
        fin = await connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-open.ts'});
    });

    beforeEach(async () => {
        // The main launcher app should remain running for the duration of all tests.
        await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);
    });

    afterEach(async () => {
        // Close all test apps and suppress any errors since the apps may not be running
        await fin.Application.wrapSync({uuid: 'test-app-1'}).quit().catch(() => {});
        await fin.Application.wrapSync({uuid: 'test-app-2'}).quit().catch(() => {});
        await fin.Application.wrapSync({uuid: 'test-app-3'}).quit().catch(() => {});
        await fin.Application.wrapSync({uuid: 'test-app-4'}).quit().catch(() => {});
    });

    describe('Without context', () => {
        test('When passing a valid app name the app opens and the promise resolves', async () => {
            // From the launcher app, call fdc3.open with a valid name
            await fdc3Remote.open(testManagerIdentity, 'test-app-1');

            // Check that the app is now running
            await expect(fin.Application.wrapSync({uuid: 'test-app-1'}).isRunning()).resolves.toBe(true);
        }, 10000);

        test('When opening an already running app the app is focused and the promise resolves', async () => {
            // Start by opening a test app
            await fdc3Remote.open(testManagerIdentity, 'test-app-1');
            // Focus another window so we do not get false positives from the first open focusing
            await fin.Window.wrapSync(testManagerIdentity).focus();

            // From the launcher app, call fdc3.open with a valid name
            await fdc3Remote.open(testManagerIdentity, 'test-app-1');

            // Check that the app is still running
            await expect(fin.Application.wrapSync({uuid: 'test-app-1'}).isRunning()).resolves.toBe(true);
            // And that the app is focused
            await expect(fin.System.getFocusedWindow().then(w => w.uuid)).resolves.toBe('test-app-1');
        }, 10000);

        test('When passing an unknown app name the service returns an error', async () => {
            // Check to see that the launcher window is running before proceeding
            await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);

            // From the launcher app, call fdc3.open with an unregistered name
            // TODO: fill in the error message once proider work is done and we know what it will be (SERVICE-392)
            await expect(fdc3Remote.open(testManagerIdentity, 'invalid-app-name')).rejects.toThrowError();
        });

        test('When opening an app, the running-state of other apps has no effect', async () => {
            // Start by opening a test app
            await fdc3Remote.open(testManagerIdentity, 'test-app-1');

            // From the launcher app, call fdc3.open with a second app name
            await fdc3Remote.open(testManagerIdentity, 'test-app-2');

            // Check that both apps are running
            await expect(fin.Application.wrapSync({uuid: 'test-app-1'}).isRunning()).resolves.toBe(true);
            await expect(fin.Application.wrapSync({uuid: 'test-app-2'}).isRunning()).resolves.toBe(true);
        }, 10000);
    });

    describe('With context', () => {
        const validContext: OrganizationContext = {type: 'organization', name: 'OpenFin', id: {default: 'openfin'}};

        test('When passing a valid app name and a valid context, the app opens and its context listener is triggered with the correct data', async () => {
            const ofPuppeteer = new OFPuppeteerBrowser();

            // Check to see that the launcher window is running before proceeding
            await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);

            // From the launcher app, call fdc3.open with a valid name and context
            await fdc3Remote.open(testManagerIdentity, 'test-app-1', validContext);

            // Check that the app is now running
            await expect(fin.Application.wrapSync({uuid: 'test-app-1'}).isRunning()).resolves.toBe(true);

            // Retrieve the list of contexts the app received
            const receivedContexts: Context[] = await ofPuppeteer.executeOnWindow({uuid: 'test-app-1', name: 'test-app-1'}, function(this: TestWindowContext) {
                return this.receivedContexts;
            });

            // Check that the app received the context passed in open and nothing else
            expect(receivedContexts.length).toBe(1);
            expect(receivedContexts.slice(-1)[0]).toEqual(validContext);

            await fin.Application.wrapSync({uuid: 'test-app-1'}).quit().catch();
        });

        test(
            'When opening an already running app the app is focused, its context listener is triggered with the correct data, and the promise resolves',
            async () => {
                const ofPuppeteer = new OFPuppeteerBrowser();

                // Start by opening a test app
                await fdc3Remote.open(testManagerIdentity, 'test-app-1');
                // Focus another window so we do not get false positives from the first open focusing
                await fin.Window.wrapSync(testManagerIdentity).focus();

                // From the launcher app, call fdc3.open the name of the running app
                await fdc3Remote.open(testManagerIdentity, 'test-app-1', validContext);

                // Check that the app is still running
                await expect(fin.Application.wrapSync({uuid: 'test-app-1'}).isRunning()).resolves.toBe(true);
                // And that the app is focused
                await expect(fin.System.getFocusedWindow().then(w => w.uuid)).resolves.toBe('test-app-1');

                // Retrieve the list of contexts the app received
                const receivedContexts: Context[] =
                    await ofPuppeteer.executeOnWindow({uuid: 'test-app-1', name: 'test-app-1'}, function(this: TestWindowContext) {
                        return this.receivedContexts;
                    });

                // Check that the app received the context passed in open and nothing else
                expect(receivedContexts.length).toBe(1);
                expect(receivedContexts.slice(-1)[0]).toEqual(validContext);
            }
        );

        test.todo('When passing a known app name but invalid context, [behaviour TBD]');

        test('When passing an unknown app name with any context the service returns an error', async () => {
            // Check to see that the launcher window is running before proceeding
            await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);

            // From the launcher app, call fdc3.open with an invalid name and valid context
            // TODO: fill in the error message once proider work is done and we know what it will be (SERVICE-392)
            await expect(fdc3Remote.open(testManagerIdentity, 'invalid-app-name', validContext)).rejects.toThrowError();
        });

        test(
            'When an app is already running, opening a second app with context works as expected and does not trigger the context listener of the already open app',
            async () => {
                const ofPuppeteer = new OFPuppeteerBrowser();

                // Start by opening a test app
                await fdc3Remote.open(testManagerIdentity, 'test-app-1');

                // From the launcher app, call fdc3.open with the name of as second app
                await fdc3Remote.open(testManagerIdentity, 'test-app-2', validContext);
                // Check that the second app started
                await expect(fin.Application.wrapSync({uuid: 'test-app-2'}).isRunning()).resolves.toBe(true);

                // Retrieve the list of contexts the second app received
                const secondReceivedContexts: Context[] =
                    await ofPuppeteer.executeOnWindow({uuid: 'test-app-2', name: 'test-app-2'}, function(this: TestWindowContext) {
                        return this.receivedContexts;
                    });

                // Check that the second app received the context passed in open and nothing else
                expect(secondReceivedContexts.length).toBe(1);
                expect(secondReceivedContexts.slice(-1)[0]).toEqual(validContext);

                // Retrieve the list of contexts the first app received
                const firstReceivedContexts: Context[] =
                    await ofPuppeteer.executeOnWindow({uuid: 'test-app-1', name: 'test-app-1'}, function(this: TestWindowContext) {
                        return this.receivedContexts;
                    });

                // Check that the first app did not receive a context
                expect(firstReceivedContexts.length).toBe(0);
            },
            10000
        );
    });

    test('When opening an app which fails to launch the promise rejects with a suitable error message', async () => {
        // TODO: fill in the error message once proider work is done and we know what it will be (SERVICE-392)
        await expect(fdc3Remote.open(testManagerIdentity, 'test-app-invalid-manifest')).rejects.toThrowError();
    });
});
