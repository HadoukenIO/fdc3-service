import 'jest';

import {Identity} from 'openfin/_v2/main';

import {ResolveError} from '../../src/client/errors';
import {Context, AppIntent} from '../../src/client/main';

import {fin} from './utils/fin';
import * as fdc3Remote from './utils/fdc3RemoteExecution';

const testManagerIdentity = {
    uuid: 'test-app',
    name: 'test-app'
};

/**
 * A context missing the mandatory `type` field
 */
const invalidContext = {
    twitter: '@testname'
} as unknown as Context;

/**
 * A context not accepted by any intent in any directory app
 */
const unknownContext = {
    type: 'test.ContextTypeUnknown',
    name: 'Test Name'
};

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
        test('The promise resolves to an empty array', async () => {
            const receivedAppIntents = await findIntentsByContext(unknownContext);
            expect(receivedAppIntents).toEqual([]);
        });
    });

    describe('When calling findIntentsByContext with a context type accepted by some directory app', () => {
        const contactContext = {
            type: 'contact',
            name: 'Test Name'
        };
        test('The promise resolves to an array of all compatible AppIntents', async () => {
            const receivedAppIntents = await findIntentsByContext(contactContext);
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

function findIntentsByContext(context: Context): Promise<AppIntent[]> {
    return fdc3Remote.findIntentsByContext(testManagerIdentity, context);
}
