import 'jest';
import {OrganizationContext} from '../../src/client/main';

import {fin} from './utils/fin';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {setupTeardown} from './utils/common';
import {testManagerIdentity, testAppInDirectory1, testAppUrl} from './constants';

const validContext: OrganizationContext = {type: 'fdc3.organization', name: 'OpenFin', id: {default: 'openfin'}};

setupTeardown();

// These tests all use the default channel for context broadcasts and listeners
// Context-passing in a channelled environment is tested in a seperate file
describe('Context listeners and broadcasting', () => {
    test('When calling broadcast with no apps running, the promise resolves and there are no errors', async () => {
        await expect(fdc3Remote.broadcast(testManagerIdentity, validContext)).resolves.not.toThrowError();
    });

    describe('Registering and unsubscribing context listeners', () => {
        beforeEach(async () => {
            // Open the app to be used in each test
            await fdc3Remote.open(testManagerIdentity, testAppInDirectory1.name);
        });

        afterEach(async () => {
            // Close down the app once done
            await fin.Application.wrapSync(testAppInDirectory1).quit(true);
        });

        test('When calling addContextListener for the first time the promise resolves and there are no errors', async () => {
            await expect(fdc3Remote.addContextListener(testAppInDirectory1)).resolves.toBeTruthy();
        });

        describe('With one context listener registered', () => {
            let listener: fdc3Remote.RemoteContextListener;

            beforeEach(async () => {
                listener = await fdc3Remote.addContextListener(testAppInDirectory1);
            });

            test('When calling broadcast from another app the listener is triggered exactly once with the correct context', async () => {
                // Send the context
                await fdc3Remote.broadcast(testManagerIdentity, validContext);

                await expect(listener).toHaveReceivedContexts([validContext]);
            });

            test('When broadcast is called from the app that is listening, its listeners doesn\'t get triggered', async () => {
                await fdc3Remote.broadcast(testAppInDirectory1, validContext);

                // Received contexts
                await expect(listener).toHaveReceivedContexts([]);
            });

            test('When calling addContextListener a second time there are no errors', async () => {
                // Add second listener
                await fdc3Remote.addContextListener(testAppInDirectory1);
            });

            test('When calling unsubsribe on the listener no errors are seen and the listener is no longer triggered when broadcast is called', async () => {
                await listener.unsubscribe();
                // Send the context
                await fdc3Remote.broadcast(testManagerIdentity, validContext);

                // Received contexts
                await expect(listener).toHaveReceivedContexts([]);
            });
        });

        describe('With two context listeners registered', () => {
            let listeners: fdc3Remote.RemoteContextListener[];

            beforeEach(async () => {
                // Register both listeners
                listeners = [await fdc3Remote.addContextListener(testAppInDirectory1), await fdc3Remote.addContextListener(testAppInDirectory1)];
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
                await fdc3Remote.broadcast(testAppInDirectory1, validContext);

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
                    const newListener = await fdc3Remote.addContextListener(testAppInDirectory1);

                    // Send the context
                    await fdc3Remote.broadcast(testManagerIdentity, validContext);

                    await expect(newListener).toHaveReceivedContexts([validContext]);
                });
            });
        });
    });

    describe('Broadcasting with multiple windows in the same app', () => {
        const testAppMainWindowIdentity = testAppInDirectory1;
        const testAppChildWindowName = testAppInDirectory1.name + '-child-window';
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
            await expect(testAppMainWindowListener).toHaveReceivedContexts([]);

            // Window on the same app as the one broadcasting DOES receive context
            await expect(testAppChildWindowListener).toHaveReceivedContexts([validContext]);
        });

        test('When child window broadcasts context, it does not receive its own context, but main window does', async () => {
            const testAppChildWindowIdentity = await fdc3Remote.createFinWindow(testAppMainWindowIdentity, {url: testAppUrl, name: testAppChildWindowName});

            const testAppMainWindowListener = await fdc3Remote.addContextListener(testAppMainWindowIdentity);
            const testAppChildWindowListener = await fdc3Remote.addContextListener(testAppChildWindowIdentity);

            await fdc3Remote.broadcast(testAppChildWindowIdentity, validContext);

            // Window broadcasting the context does NOT receive it
            await expect(testAppChildWindowListener).toHaveReceivedContexts([]);

            // Window on the same app as the one broadcasting DOES receive context
            await expect(testAppMainWindowListener).toHaveReceivedContexts([validContext]);
        });
    });
});
