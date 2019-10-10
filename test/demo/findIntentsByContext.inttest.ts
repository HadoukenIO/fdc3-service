import 'jest';

import {Context, AppIntent} from '../../src/client/main';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {testManagerIdentity, testAppInDirectory1, testAppInDirectory4} from './constants';
import {setupTeardown} from './utils/common';
import {delay} from './utils/delay';

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

    describe('When calling findIntentsByContext with a context not explicity registered by any app', () => {
        test('The promise resolves to AppIntents for intents that take any context', async () => {
            const receivedAppIntents = await findIntentsByContext(unknownContext);
            expect(receivedAppIntents).toEqual([
                {
                    intent: {
                        displayName: 'test.ContextTestIntent',
                        name: 'test.ContextTestIntent'
                    },
                    apps: [
                        expect.objectContaining({
                            appId: '400',
                            name: testAppInDirectory4.name
                        })
                    ]
                }
            ]);
        });
    });

    describe('When calling findIntentsByContext with a context type accepted by some directory app', () => {
        const contactContext = {
            type: 'test.IntentNameContext',
            name: 'Test Name'
        };
        test('The promise resolves to an array of all compatible AppIntents', async () => {
            const receivedAppIntents = await findIntentsByContext(contactContext);

            expect(receivedAppIntents).toEqual([
                {
                    intent: {
                        name: 'test.ContextTestIntent',
                        displayName: 'test.ContextTestIntent'
                    },
                    apps: [
                        expect.objectContaining({
                            appId: '400',
                            name: testAppInDirectory4.name
                        })
                    ]
                },
                {
                    intent: {
                        name: 'test.IntentName',
                        displayName: 'Test Intent'
                    },
                    apps: [
                        expect.objectContaining({
                            appId: 'test-app-1',
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
