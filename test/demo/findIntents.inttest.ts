import 'jest';

import {Context, AppIntent, IntentType} from '../../src/client/main';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {testManagerIdentity} from './constants';
import {setupTeardown} from './utils/common';

setupTeardown();

describe('Resolving intents by context, findIntent', () => {
    describe('When calling findIntent with an intent type and context type accepted by some directory app', () => {
        const intent = {
            type: 'DialCall'
        };
        const context = {
            type: 'fdc3.contact'
        };
        test('The promise resolves to an array of all AppIntents which has the specified intent with the specified context or no context at all', async () => {
            const receivedAppIntents = await findIntent(intent.type, context);
            expect(receivedAppIntents.apps).toHaveLength(4);
        });
    });

    describe('When calling findIntent with a intent type accepted by some directory app', () => {
        const intent = {
            type: 'DialCall'
        };
        test('The promise resolves to an array of all AppIntents which has the specified intent regardless of context specifications', async () => {
            const receivedAppIntents = await findIntent(intent.type);
            expect(receivedAppIntents.apps).toHaveLength(6);
        });
    });
});

function findIntent(intentType: IntentType, context?: Context): Promise<AppIntent> {
    return fdc3Remote.findIntent(testManagerIdentity, intentType, context);
}
