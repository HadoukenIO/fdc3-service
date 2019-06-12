import 'jest';
import {OrganizationContext} from '../../src/client/main';

import {fin} from './utils/fin';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {testManagerIdentity} from './constants';

const testAppUrl = 'http://localhost:3923/test/test-app.html';

const validContext: OrganizationContext = {type: 'fdc3.organization', name: 'OpenFin', id: {default: 'openfin'}};

// These tests all use the default channel for context broadcasts and listeners
// Context-passing in a channelled environment is tested in a seperate file
describe('Context listeners and broadcasting', () => {
    beforeEach(async () => {
        // The main launcher app should remain running for the duration of all tests.
        await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);
    });

    test('When calling broadcast with no apps running, the promise resolves and there are no errors', async () => {
        await expect(fdc3Remote.broadcast(testManagerIdentity, validContext)).resolves.not.toThrowError();
    });

    describe('Registering and unsubscribing context listeners', () => {
        const testAppIdentity = {uuid: 'test-app-1', name: 'test-app-1'};
        beforeEach(async () => {
            // Open the app to be used in each test
            await fdc3Remote.open(testManagerIdentity, testAppIdentity.name);
        });

        afterEach(async () => {
            // Close down the app once done
            await fin.Application.wrapSync(testAppIdentity).quit(true);
        });

        test('When calling addContextListener for the first time the promise resolves and there are no errors', async () => {
            await expect(fdc3Remote.addContextListener(testAppIdentity)).resolves.toBeTruthy();
        });

        describe('With one context listener registered', () => {
            let listener: fdc3Remote.RemoteContextListener;

            beforeEach(async () => {
                listener = await fdc3Remote.addContextListener(testAppIdentity);
            });

            test('When calling broadcast from another app the listener is triggered exactly once with the correct context', async () => {
                // Send the context
                await fdc3Remote.broadcast(testManagerIdentity, validContext);

                const receivedContexts = await listener.getReceivedContexts();
                expect(receivedContexts).toEqual([validContext]);
            });

            test('When broadcast is called from the app that is listening, its listeners doesn\'t get triggered', async () => {
                await fdc3Remote.broadcast(testAppIdentity, validContext);

                // Received contexts
                const receivedContexts = await listener.getReceivedContexts();
                expect(receivedContexts).toEqual([]);
            });

            test('When calling addContextListener a second time there are no errors', async () => {
                // Add second listener
                await fdc3Remote.addContextListener(testAppIdentity);
            });

            test('When calling unsubsribe on the listener no errors are seen and the listener is no longer triggered when broadcast is called', async () => {
                await listener.unsubscribe();
                // Send the context
                await fdc3Remote.broadcast(testManagerIdentity, validContext);

                // Received contexts
                const receivedContexts = await listener.getReceivedContexts();
                expect(receivedContexts).toEqual([]);
            });
        });

        describe('With two context listeners registered', () => {
            let listeners: fdc3Remote.RemoteContextListener[];

            beforeEach(async () => {
                // Register both listeners
                listeners = [await fdc3Remote.addContextListener(testAppIdentity), await fdc3Remote.addContextListener(testAppIdentity)];
            });

            test('Calling broadcast from another app will trigger both listeners exactly once each', async () => {
                // Send the context
                await fdc3Remote.broadcast(testManagerIdentity, validContext);

                const receivedContexts = await Promise.all(listeners.map(listener => listener.getReceivedContexts()));
                for (const contextList of receivedContexts) {
                    expect(contextList).toEqual([validContext]);
                }
            });

            test('When calling broadcast from the first app, none of its own listeners will be triggered', async () => {
                await fdc3Remote.broadcast(testAppIdentity, validContext);

                const receivedContexts = await Promise.all(listeners.map(listener => listener.getReceivedContexts()));
                expect(receivedContexts).toEqual([[], []]);
            });

            test('With two contextListeners registered, calling unsubscribe on the second listener will return with no errors', async () => {
                await listeners[0].unsubscribe();
            });

            describe('When one listener is unsubsribed', () => {
                beforeEach(async () => {
                    // Unsubscribe first listener
                    await expect(listeners[0].unsubscribe()).resolves.not.toThrowError();
                });

                test('When calling broadcast, only the still-registered listener is triggered', async () => {
                    // Send the context
                    await fdc3Remote.broadcast(testManagerIdentity, validContext);
                    const receivedContexts = await Promise.all(listeners.map(listener => listener.getReceivedContexts()));

                    // First listener not triggered
                    expect(receivedContexts[0]).toEqual([]);

                    // Second listener triggered once
                    expect(receivedContexts[1]).toEqual([validContext]);
                });

                test('A third listener can be registered and triggered as expected', async () => {
                    const newListener = await fdc3Remote.addContextListener(testAppIdentity);

                    // Send the context
                    await fdc3Remote.broadcast(testManagerIdentity, validContext);
                    const receivedContexts = await newListener.getReceivedContexts();

                    expect(receivedContexts).toEqual([validContext]);
                });
            });
        });
    });

    describe('Broadcasting with multiple windows in the same app', () => {
        const testAppMainWindowIdentity = {uuid: 'test-app-1', name: 'test-app-1'};
        const testAppChildWindowName = 'test-app-1-child-window';
        beforeEach(async () => {
            await fdc3Remote.open(testManagerIdentity, testAppMainWindowIdentity.name);
        });

        afterEach(async () => {
            // This `.quit()` closes the main window as well as any child windows
            await fin.Application.wrapSync(testAppMainWindowIdentity).quit(true);
        });

        test('When main window broadcasts context, it does not receive its own context, but child window does', async () => {
            const testAppChildWindowIdentity = await fdc3Remote.createFinWindow(testAppMainWindowIdentity, {url: testAppUrl, name: testAppChildWindowName});

            const testAppMainWindowListener = await fdc3Remote.addContextListener(testAppMainWindowIdentity);
            const testAppChildWindowListener = await fdc3Remote.addContextListener(testAppChildWindowIdentity);

            await fdc3Remote.broadcast(testAppMainWindowIdentity, validContext);

            // Window broadcasting the context does NOT receive it
            const testAppMainWindowReceivedContexts = await testAppMainWindowListener.getReceivedContexts();
            expect(testAppMainWindowReceivedContexts).toEqual([]);

            // Window on the same app as the one broadcasting DOES receive context
            const testAppChildWindowReceivedContexts = await testAppChildWindowListener.getReceivedContexts();
            expect(testAppChildWindowReceivedContexts).toEqual([validContext]);
        });

        test('When child window broadcasts context, it does not receive its own context, but main window does', async () => {
            const testAppChildWindowIdentity = await fdc3Remote.createFinWindow(testAppMainWindowIdentity, {url: testAppUrl, name: testAppChildWindowName});

            const testAppMainWindowListener = await fdc3Remote.addContextListener(testAppMainWindowIdentity);
            const testAppChildWindowListener = await fdc3Remote.addContextListener(testAppChildWindowIdentity);

            await fdc3Remote.broadcast(testAppChildWindowIdentity, validContext);

            // Window broadcasting the context does NOT receive it
            const testAppChildWindowReceivedContexts = await testAppChildWindowListener.getReceivedContexts();
            expect(testAppChildWindowReceivedContexts).toEqual([]);

            // Window on the same app as the one broadcasting DOES receive context
            const testAppMainWindowReceivedContexts = await testAppMainWindowListener.getReceivedContexts();
            expect(testAppMainWindowReceivedContexts).toEqual([validContext]);
        });
    });
});
