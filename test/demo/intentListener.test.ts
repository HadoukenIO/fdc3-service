import 'jest';

import {fin} from './utils/fin';
import * as fdc3Remote from './utils/fdc3RemoteExecution';

const testManagerIdentity = {
    uuid: 'test-app',
    name: 'test-app'
};

const testAppIdentity = {
    uuid: 'test-app-1',
    name: 'test-app-1',
    appId: '100'
};

const validPayload = {
    intent: 'DialCall',
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

    describe('With an explicit target', () => {
        describe('When the target is running', () => {
            beforeEach(async () => {
                await fdc3Remote.open(testManagerIdentity, testAppIdentity.uuid);
            });

            test('When calling addIntentListner for the first time, the promise resolves and there are no errors', async () => {
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
                    expect(receivedContexts.length).toBe(1);
                    expect(receivedContexts[0]).toEqual(validPayload.context);
                });
            });

            describe('When the target is *not* registered to accept the raised intent', () => {
                test('When calling raiseIntent the promise rejects with an error', async () => {
                    const resultPromise = fdc3Remote.raiseIntent(testManagerIdentity, invalidPayload.intent, invalidPayload.context, testAppIdentity.appId);
                    // TODO: decide if this is this the error message we want when sending a targeted intent
                    await expect(resultPromise).rejects.toThrowError(/No applications available to handle this intent/);
                });
            });
            describe('When the target is not in the directory', () => {
                // Currently this will just open the resolver UI, which is probably the wrong behaviour
                // TODO: Make the service return an error when targeting an app which isn't in the directory
                test.skip('When calling raseIntent the promise rejects with an error', async () => {
                    const resultPromise = fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, 'this-app-does-not-exist');
                    // TODO: decide what the error should be
                    await expect(resultPromise).rejects.toThrow();
                });
            });
        });

        describe('When the target is not running', () => {

        });
    });
});
