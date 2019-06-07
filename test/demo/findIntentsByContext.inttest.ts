import 'jest';
import {Context} from '../../src/client/context';
import {ResolveError} from '../../src/client/errors';

import {fin} from './utils/fin';
import * as fdc3Remote from './utils/fdc3RemoteExecution';

const testManagerIdentity = {
    uuid: 'test-app',
    name: 'test-app'
};

const invalidContext = {
    twitter: '@testname'
} as unknown as Context;

describe('Resolving intents by context, findIntentsByContext', () => {
    beforeEach(async () => {
        // The main launcher app should remain running for the duration of all tests.
        await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);
    });

    describe('When calling findIntentsByContext with an invalid context', () => {
        test('The promise rejects with an FDC3Error', async () => {
            const findIntentsPromise = fdc3Remote.findIntentsByContext(testManagerIdentity, invalidContext);
            await expect(findIntentsPromise).toThrowFDC3Error(
                ResolveError.InvalidContext,
                `Context not valid. context = ${JSON.stringify(invalidContext)}`
            );
        });
    });

    describe('When calling findIntentsByContext with a context type not accepted by any directory app', () => {
        const context = {
            type: 'test.ContextTypeUnknown',
            name: 'Test Name'
        };

        test('The promise resolves to an empty array', async () => {
            const receivedAppIntents = await fdc3Remote.findIntentsByContext(testManagerIdentity, context);
            expect(receivedAppIntents).toEqual([]);
        });
    });

    describe('When calling findIntentsByContext with a context type accepted by some directory app', () => {
        const context = {
            type: 'contact',
            name: 'Test Name'
        };
        test('The promise resolves to an array of all compatible AppIntents', async () => {
            const receivedAppIntents = await fdc3Remote.findIntentsByContext(testManagerIdentity, context);
            expect(receivedAppIntents).toEqual([
                {
                    intent: {
                        displayName: 'Dial',
                        name: 'DialCall'
                    },
                    apps: [
                        expect.objectContaining({
                            appId: '100',
                            name: 'test-app-1'
                        })
                    ]
                }
            ]);
        });
    });
});
