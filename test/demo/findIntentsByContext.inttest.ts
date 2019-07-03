import 'jest';

import {Context, AppIntent} from '../../src/client/main';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {testManagerIdentity, testAppInDirectory1} from './constants';
import {setupTeardown} from './utils/common';

/**
 * A context missing the mandatory `type` field
 */
const invalidContext = {
    twitter: 'testname'
} as unknown as Context;

/**
 * A context not accepted by any intent in any directory app
 */
const unknownContext = {
    type: 'test.ContextTypeUnknown',
    name: 'Test Name'
};

setupTeardown();

describe('Resolving intents by context, findIntentsByContext', () => {
    describe('When calling findIntentsByContext with an invalid context', () => {
        test('The promise rejects with an FDC3Error', async () => {
            const findIntentsPromise = fdc3Remote.findIntentsByContext(testManagerIdentity, invalidContext);
            await expect(findIntentsPromise).rejects.toThrowError(new TypeError(`${JSON.stringify(invalidContext)} is not a valid Context`));
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
                            name: testAppInDirectory1.name
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
