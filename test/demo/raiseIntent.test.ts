import 'jest';

import {ResolveError} from '../../src/client/errors';
import {INTENT_LISTENER_TIMEOUT} from '../../src/provider/model/implementation/Fin';

import {fin} from './utils/fin';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {delay} from './utils/delay';

const testManagerIdentity = {
    uuid: 'test-app',
    name: 'test-app'
};

const validPayload = {
    intent: 'test.IntentName',
    context: {
        type: 'contact',
        name: 'Test Name',
        id: {
            twitter: '@testname'
        }
    }
};
const validPayloadPreregistered = {
    intent: 'test.IntentNamePreregistered',
    context: {
        type: 'contact',
        name: 'Test Name',
        id: {
            twitter: '@testname'
        }
    }
};
const invalidPayload = {
    intent: 'some-nonexistent-intent',
    context: {
        type: 'some-other-context',
        value: 10,
        id: {
            prop: 'id'
        }
    }
};

describe('Intent listeners and raising intents', () => {
    beforeEach(async () => {
        // The main launcher app should remain running for the duration of all tests.
        await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);
    });

    describe('With a target', () => {
        const testAppIdentity = {
            uuid: 'test-app-1',
            name: 'test-app-1',
            appId: '100'
        };
        describe('When the target is running', () => {
            beforeEach(async () => {
                await fdc3Remote.open(testManagerIdentity, testAppIdentity.uuid);
            });

            afterEach(async () => {
                await fin.Application.wrapSync(testAppIdentity).quit().catch(() => {});
            });

            test('When calling addIntentListener for the first time, the promise resolves and there are no errors', async () => {
                await expect(fdc3Remote.addIntentListener(testAppIdentity, validPayload.intent)).resolves.not.toThrow();
            });

            describe('When the target is registered to accept the raised intent', () => {
                let listener: fdc3Remote.RemoteIntentListener;

                beforeEach(async () => {
                    listener = await fdc3Remote.addIntentListener(testAppIdentity, validPayload.intent);
                });

                test('When calling raiseIntent from another app the listener is triggered exactly once with the correct context', async () => {
                    await fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppIdentity.appId);

                    const receivedContexts = await listener.getReceivedContexts();
                    expect(receivedContexts).toEqual([validPayload.context]);
                });
                test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it times out', async () => {
                    await listener.unsubscribe();
                    const resultPromise = fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppIdentity.appId);

                    await expect(resultPromise).rejects.toThrowError(`Timeout waiting for intent listener to be added. intent = ${validPayload.intent}`);
                }, INTENT_LISTENER_TIMEOUT + 500);
            });

            describe('When the target is *not* registered to accept the raised intent', () => {
                test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                    const resultPromise = fdc3Remote.raiseIntent(testManagerIdentity, invalidPayload.intent, invalidPayload.context, testAppIdentity.appId);
                    // TODO: decide if this is this the error message we want when sending a targeted intent
                    await expect(resultPromise).rejects.toThrowError(/No applications available to handle this intent/);
                    await expect(resultPromise).rejects.toHaveProperty('name', 'FDC3Error');
                    await expect(resultPromise).rejects.toHaveProperty('code', ResolveError.NoAppsFound);
                });
            });
            describe('When the target is not in the directory', () => {
                // Currently this will just open the resolver UI, which is probably the wrong behaviour
                // TODO: Make the service return an error when targeting an app which isn't in the directory
                test.skip('When calling raiseIntent the promise rejects with an error', async () => {
                    const resultPromise = fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, 'this-app-does-not-exist');
                    // TODO: decide what the error should be
                    await expect(resultPromise).rejects.toThrow();
                });
            });
        });

        describe('When the target is not running', () => {
            describe('And the listener is added right away', () => {
                const testAppIdentity = {
                    uuid: 'test-app-preregistered-1',
                    name: 'test-app-preregistered-1',
                    appId: '500'
                };

                describe('When the target is registered to accept the raised intent', () => {
                    test('The targeted app opens and its listener is triggered exactly once with the correct context', async () => {
                        await fdc3Remote.raiseIntent(
                            testManagerIdentity,
                            validPayloadPreregistered.intent,
                            validPayloadPreregistered.context,
                            testAppIdentity.appId
                        );

                        // App should now be running
                        await expect(fin.Application.wrapSync(testAppIdentity).isRunning()).resolves.toBe(true);

                        const listener = await fdc3Remote.getRemoteIntentListener(testAppIdentity, validPayloadPreregistered.intent);
                        const receivedContexts = await listener.getReceivedContexts();

                        expect(receivedContexts).toEqual([validPayloadPreregistered.context]);

                        await fin.Application.wrapSync(testAppIdentity).quit();
                    });
                });

                describe('When the target is *not* registered to accept the raised intent', () => {
                    // TBD: should the app open if the intent is not valid?
                    test.todo('When calling raiseIntent [behaviour TBD]');
                });
                describe('When the target is not in the directory', () => {
                    // Currently this will just open the resolver UI, which is probably the wrong behaviour
                    // TODO: Make the service return an error when targeting an app which isn't in the directory
                    test.skip('When calling raiseIntent the promise rejects with an error', async () => {
                        const resultPromise = fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, 'this-app-does-not-exist');
                        // TODO: decide what the error should be
                        await expect(resultPromise).rejects.toThrow();
                    });
                });
            });

            describe('And the listener is added after a delay', () => {
                const testAppIdentity = {
                    uuid: 'test-app-1',
                    name: 'test-app-1',
                    appId: '550'
                };
                test('The targeted app opens and its listener is triggered exactly once with the correct context, after the listener is set up', async () => {
                    // We dont await for this promise here because it wouldn't resolve.
                    // It's going to resolve only after we add the listener to the test app
                    const raiseIntentPromise = fdc3Remote.raiseIntent(
                        testManagerIdentity,
                        validPayload.intent,
                        validPayload.context,
                        testAppIdentity.appId
                    );

                    await delay(1500);
                    // App should now be running
                    await expect(fin.Application.wrapSync(testAppIdentity).isRunning()).resolves.toBe(true);

                    // We want to have a delay between the app running and the intent listener being set up,
                    // so that we can test the "add intent" handshake message.  If the app is fast enough setting up,
                    // the intent message may go through anyway, but we want to simulate the case where the app
                    // takes some time between starting up and actually setting up the intent listener.
                    await delay(1500);
                    await fdc3Remote.addIntentListener(testAppIdentity, validPayload.intent);

                    await raiseIntentPromise;

                    const listener = await fdc3Remote.getRemoteIntentListener(testAppIdentity, validPayload.intent);
                    const receivedContexts = await listener.getReceivedContexts();
                    expect(receivedContexts).toEqual([validPayload.context]);

                    await fin.Application.wrapSync(testAppIdentity).quit();
                });
            });
        });
    });

    describe('Without a target', () => {
        describe('With no apps registered to accept the raised intent', () => {
            test('When calling raiseIntent the promise rejects with an error', async () => {
                await expect(fdc3Remote.raiseIntent(testManagerIdentity, invalidPayload.intent, invalidPayload.context)).rejects.toThrow();
            });
        });

        // TODO: find a way to dynamically set the app directory for these tests
        describe('With one app registered to accept the raised intent', () => {
            describe('With the registered app running', () => {
                test.todo('When calling raiseIntent from another app the listener is triggered exactly once with the correct context');
            });

            describe('With the registered app not running', () => {
                test.todo('The targeted app opens and its listener is triggered exactly once with the correct context');
            });
        });

        describe('With multiple apps registered to accept the raised intent', () => {
            // TODO: figure out how to test the resolver UI properly
        });
    });
});
