import 'jest';

import {Context, AppIntent} from '../../src/client/main';

import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {testManagerIdentity, testAppInDirectory1, testAppInDirectory4, testAppNotFdc3, testAppInDirectory3} from './constants';
import {setupTeardown, setupOpenDirectoryAppBookends} from './utils/common';
import {delay, Duration} from './utils/delay';

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
                            appId: 'test-app-4',
                            name: testAppInDirectory4.name
                        })
                    ]
                }
            ]);
        });
    });

    describe('When calling findIntentsByContext with a context type accepted by some directory apps', () => {
        const context = {
            type: 'test.IntentNameContext',
            name: 'Test Name'
        };

        describe('When no apps are running', () => {
            test('The promise resolves to an array of all compatible AppIntents', async () => {
                const receivedAppIntents = await findIntentsByContext(context);

                expect(receivedAppIntents).toEqual([
                    {
                        intent: {
                            name: 'test.ContextTestIntent',
                            displayName: 'test.ContextTestIntent'
                        },
                        apps: [
                            expect.objectContaining({
                                appId: 'test-app-4',
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

        describe('When a directory app is running that has registered an unexpected intent listener', () => {
            setupOpenDirectoryAppBookends(testAppInDirectory3);

            beforeEach(async () => {
                await fdc3Remote.addIntentListener(testAppInDirectory3, 'test.IntentName');
            });

            test('The promise resolves to AppIntents that include the running app', async () => {
                const receivedAppIntents = await findIntentsByContext(context);

                expect(receivedAppIntents).toEqual([
                    {
                        intent: {
                            name: 'test.ContextTestIntent',
                            displayName: 'test.ContextTestIntent'
                        },
                        apps: [
                            expect.objectContaining({
                                appId: 'test-app-4',
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
                            }),
                            expect.objectContaining({
                                appId: 'test-app-3',
                                name: testAppInDirectory3.name
                            })
                        ]
                    }
                ]);
            });
        });
    });

    describe('When calling findIntentsByContext with a context type only explicitly accepted by a mature app that has not registered any listeners', () => {
        const context = {
            type: 'test.IntentOnlyOnTestAppNotFdc3Context',
            name: 'Test Name'
        };

        setupOpenDirectoryAppBookends(testAppNotFdc3);

        beforeEach(async () => {
            await delay(Duration.LONGER_THAN_APP_MATURITY);
        });

        test('The promise resolves to AppIntents for intents that take any context only', async () => {
            const receivedAppIntents = await findIntentsByContext(context);

            expect(receivedAppIntents).toEqual([
                {
                    intent: {
                        displayName: 'test.ContextTestIntent',
                        name: 'test.ContextTestIntent'
                    },
                    apps: [
                        expect.objectContaining({
                            appId: 'test-app-4',
                            name: testAppInDirectory4.name
                        })
                    ]
                }
            ]);
        });
    });

    describe('When calling findIntentsByContext with a context type only explicitly accepted by an immature app that has not registered any listeners', () => {
        const context = {
            type: 'test.IntentOnlyOnTestAppNotFdc3Context',
            name: 'Test Name'
        };

        setupOpenDirectoryAppBookends(testAppNotFdc3);

        test('The promise resolves to AppIntents for intents that include the immature app', async () => {
            const receivedAppIntents = await findIntentsByContext(context);

            expect(receivedAppIntents).toEqual([
                {
                    intent: {
                        displayName: 'test.ContextTestIntent',
                        name: 'test.ContextTestIntent'
                    },
                    apps: [
                        expect.objectContaining({
                            appId: 'test-app-4',
                            name: testAppInDirectory4.name
                        })
                    ]
                },
                {
                    intent: {
                        displayName: 'Test Intent',
                        name: 'test.IntentOnlyOnTestAppNotFdc3'
                    },
                    apps: [
                        expect.objectContaining({
                            appId: 'test-app-not-fdc3',
                            name: testAppNotFdc3.name
                        })
                    ]
                }
            ]);
        });
    });

    describe('When calling findIntentsByContext when a directory app has registered an unexpected intent listener', () => {
        const context = {
            type: 'test.IntentNameContext',
            name: 'Test Name'
        };

        setupOpenDirectoryAppBookends(testAppInDirectory3);

        beforeEach(async () => {
            await fdc3Remote.addIntentListener(testAppInDirectory3, 'test.IntentName');
        });

        test('The promise resolves to AppIntents that include the running app', async () => {
            const receivedAppIntents = await findIntentsByContext(context);

            expect(receivedAppIntents).toEqual([
                {
                    intent: {
                        name: 'test.ContextTestIntent',
                        displayName: 'test.ContextTestIntent'
                    },
                    apps: [
                        expect.objectContaining({
                            appId: 'test-app-4',
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
                        }),
                        expect.objectContaining({
                            appId: 'test-app-3',
                            name: testAppInDirectory3.name
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
