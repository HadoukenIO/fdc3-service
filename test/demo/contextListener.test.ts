import 'jest';
import {connect, Fin} from 'hadouken-js-adapter';

import {OrganizationContext} from '../../src/client/main';

import * as fdc3Remote from './utils/fdc3RemoteExecution';

const testManagerIdentity = {
    uuid: 'test-app',
    name: 'test-app'
};

const validContext: OrganizationContext = {type: 'organization', name: 'OpenFin', id: {default: 'openfin'}};

describe('Context listeners and broadcasting', () => {
    let fin: Fin;

    beforeAll(async () => {
        // Establish a node adapter connection for the file. This needs to use a file-specific name since jest sandboxes the imports
        // from each test file, and other files may have already connected to the runtime with a generic uuid
        fin = await connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-contextListner'});
    });

    beforeEach(async () => {
        // The main launcher app should remain running for the duration of all tests.
        await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);
    });

    describe('Registering and unsubscribing context listeners', () => {
        const testAppIdentity = {uuid: 'test-app-1', name: 'test-app-1'};
        beforeEach(async () => {
            // Open the app to be used in each test
            await fdc3Remote.open(testManagerIdentity, testAppIdentity.uuid);
        });

        afterEach(async () => {
            // Close down the app once done
            await fin.Application.wrapSync(testAppIdentity).quit(true);
        });

        test('When calling addContextListener for the first time the function resolves and there are no errors', async () => {
            await fdc3Remote.addContextListener(testAppIdentity);
        });

        describe('With one context listener registered', () => {
            let listener: fdc3Remote.RemoteContextListener;

            beforeEach(async () => {
                listener = await fdc3Remote.addContextListener(testAppIdentity);
            });

            test('When calling broadcast from another app the listener is triggered exactly once with the correct context', async () => {
                await fdc3Remote.broadcast(testManagerIdentity, validContext);

                const receivedContexts = await listener.getReceivedContexts();
                expect(receivedContexts.length).toBe(1);
                expect(receivedContexts[0]).toEqual(validContext);
            });

            test.todo('When broadcast is called from the same app [behavior TBD - do apps receive their own broadcasts?]');

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
                expect(receivedContexts.length).toBe(0);
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

                const receivedContexts = await Promise.all(listeners.map(l => l.getReceivedContexts()));
                for (const contextList of receivedContexts) {
                    expect(contextList.length).toBe(1);
                    expect(contextList[0]).toEqual(validContext);
                }
            });

            test.todo('When calling broadcast from the first app [behavior TBD - do apps receive their own broadcasts?]');

            test('With two contextListeners registered, calling unsubscribe on the second listener will return with no errors', async () => {
                await listeners[0].unsubscribe();
            });

            describe('When one listener is unsubsribed', () => {
                beforeEach(async () => {
                    // Unsubscribe first listener
                    await listeners[0].unsubscribe();
                });

                test.todo('When calling broadcast, only the still-registered listener is triggered');
            });
        });
    });
});
