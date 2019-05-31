import 'jest';
import 'reflect-metadata';

import {ResolveError, OpenError, Timeouts} from '../../src/client/errors';

import {fin} from './utils/fin';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {delay} from './utils/delay';
import {appStartupTime} from './constants';

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
        describe('When the target is in the directory', () => {
            const testAppInDirectory = {
                uuid: 'test-app-1',
                name: 'test-app-1',
                appId: '100'
            };
            describe('When the target is not running', () => {
                describe('When the target is *not* registered to accept the raised intent', () => {
                    test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                        const resultPromise = fdc3Remote.raiseIntent(
                            testManagerIdentity,
                            invalidPayload.intent,
                            invalidPayload.context,
                            testAppInDirectory.name
                        );

                        await expect(resultPromise).toThrowFDC3Error(
                            ResolveError.TargetAppDoesNotHandleIntent,
                            `App '${testAppInDirectory.name}' does not handle intent '${invalidPayload.intent}'`
                        );
                    });
                });

                describe('When the target is registered to accept the raised intent', () => {
                    describe('And the listener is registered right after opening the app', () => {
                        const testAppWithPreregisteredListeners = {
                            uuid: 'test-app-preregistered-1',
                            name: 'test-app-preregistered-1',
                            appId: '500'
                        };
                        test('The targeted app opens and its listener is triggered exactly once with the correct context', async () => {
                            await fdc3Remote.raiseIntent(
                                testManagerIdentity,
                                validPayloadPreregistered.intent,
                                validPayloadPreregistered.context,
                                testAppWithPreregisteredListeners.name
                            );

                            // App should now be running
                            await expect(fin.Application.wrapSync(testAppWithPreregisteredListeners).isRunning()).resolves.toBe(true);

                            const listener = await fdc3Remote.getRemoteIntentListener(testAppWithPreregisteredListeners, validPayloadPreregistered.intent);
                            const receivedContexts = await listener.getReceivedContexts();

                            expect(receivedContexts).toEqual([validPayloadPreregistered.context]);

                            await fin.Application.wrapSync(testAppWithPreregisteredListeners).quit();
                        });
                    });

                    describe('And the listener is added after a delay', () => {
                        const testAppDelayedListenerIdentity = {
                            uuid: 'test-app-1',
                            name: 'test-app-1',
                            appId: '550'
                        };
                        test('The targeted app opens and its listener is triggered just once after it is set up, with the correct context', async () => {
                            // We dont await for this promise here because it wouldn't resolve.
                            // It's going to resolve only after we add the listener to the test app
                            const raiseIntentPromise = fdc3Remote.raiseIntent(
                                testManagerIdentity,
                                validPayload.intent,
                                validPayload.context,
                                testAppDelayedListenerIdentity.name
                            );

                            while (!await fin.Application.wrapSync(testAppDelayedListenerIdentity).isRunning()) {
                                await delay(500);
                            }
                            // App should now be running

                            // We want to have a delay between the app running and the intent listener being set up,
                            // so that we can test the "add intent" handshake message.  If the app is fast enough setting up,
                            // the intent message may go through anyway, but we want to simulate the case where the app
                            // takes some time between starting up and actually setting up the intent listener.
                            await delay(1500);
                            await fdc3Remote.addIntentListener(testAppDelayedListenerIdentity, validPayload.intent);

                            // Now the promise can resolve because the listener it was waiting for has just been registered
                            await raiseIntentPromise;

                            const listener = await fdc3Remote.getRemoteIntentListener(testAppDelayedListenerIdentity, validPayload.intent);
                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validPayload.context]);

                            await fin.Application.wrapSync(testAppDelayedListenerIdentity).quit();
                        }, appStartupTime + 1500);
                    });
                });
            });

            describe('When the target is running', () => {
                beforeEach(async () => {
                    await fdc3Remote.open(testManagerIdentity, testAppInDirectory.uuid);
                });

                afterEach(async () => {
                    await fin.Application.wrapSync(testAppInDirectory).quit().catch(() => {});
                });

                test('When calling addIntentListener for the first time, the promise resolves and there are no errors', async () => {
                    await expect(fdc3Remote.addIntentListener(testAppInDirectory, validPayload.intent)).resolves.not.toThrow();
                });

                describe('When the target is registered to accept the raised intent', () => {
                    let listener: fdc3Remote.RemoteIntentListener;

                    beforeEach(async () => {
                        listener = await fdc3Remote.addIntentListener(testAppInDirectory, validPayload.intent);
                    });

                    test('When calling raiseIntent from another app the listener is triggered exactly once with the correct context', async () => {
                        await fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppInDirectory.name);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validPayload.context]);
                    });

                    test('When adding a duplicate intent listener, then calling raiseIntent from another app, \
both listeners are triggered exactly once with the correct context', async () => {
                        const duplicateListener = await fdc3Remote.addIntentListener(testAppInDirectory, validPayload.intent);

                        await fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppInDirectory.name);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validPayload.context]);

                        const duplicateReceivedContexts = await duplicateListener.getReceivedContexts();
                        expect(duplicateReceivedContexts).toEqual([validPayload.context]);
                    });

                    test('When adding a distinct intent listener, then calling raiseIntent from another app, \
only the first listener is triggered', async () => {
                        const distinctListener = await fdc3Remote.addIntentListener(testAppInDirectory, validPayload.intent + 'distinguisher');

                        await fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppInDirectory.name);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validPayload.context]);

                        const distinctReceivedContexts = await distinctListener.getReceivedContexts();
                        expect(distinctReceivedContexts).toEqual([]);
                    });

                    test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
                        await listener.unsubscribe();
                        const promise = fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppInDirectory.name);

                        await expect(promise).toThrowFDC3Error(
                            ResolveError.IntentTimeout,
                            `Timeout waiting for intent listener to be added. intent = ${validPayload.intent}`
                        );
                    });

                    test('When calling unsubscribe from a second intent listener, then calling raiseIntent from another app, \
only the first listener is triggered exactly once with the correct context, and the second is not triggered', async () => {
                        const shortLivedListener = await fdc3Remote.addIntentListener(testAppInDirectory, validPayload.intent);
                        await shortLivedListener.unsubscribe();

                        await fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppInDirectory.name);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([validPayload.context]);

                        const shortLivedReceivedContexts = await shortLivedListener.getReceivedContexts();
                        expect(shortLivedReceivedContexts).toEqual([]);
                    });
                });

                describe('When the target is *not* registered to accept the raised intent', () => {
                    test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                        const promise = fdc3Remote.raiseIntent(testManagerIdentity, invalidPayload.intent, invalidPayload.context, testAppInDirectory.name);

                        await expect(promise).toThrowFDC3Error(
                            ResolveError.IntentTimeout,
                            `Timeout waiting for intent listener to be added. intent = ${invalidPayload.intent}`
                        );
                    });
                });
            });
        });

        describe('When the target is *not* in the directory', () => {
            const testAppNotInDirectory = {
                uuid: 'test-app-not-in-directory',
                name: 'test-app-not-in-directory',
                manifestUrl: 'http://localhost:3923/test/configs/test-app-not-in-directory.json'
            };
            describe('When the target is not running', () => {
                test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                    const promise = fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppNotInDirectory.name);

                    await expect(promise).toThrowFDC3Error(
                        ResolveError.TargetAppNotAvailable,
                        `Couldn't resolve intent target '${testAppNotInDirectory.name}'. No matching app in directory or currently running.`
                    );
                });
            });

            describe('When the target (which is an ad-hoc app) is running', () => {
                beforeEach(async () => {
                    await fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl);
                });

                afterEach(async () => {
                    await fin.Application.wrapSync(testAppNotInDirectory).quit().catch(() => {});
                });

                test('When calling addIntentListener for the first time, the promise resolves and there are no errors', async () => {
                    await expect(fdc3Remote.addIntentListener(testAppNotInDirectory, validPayload.intent)).resolves.not.toThrow();
                });

                describe('When the target has *not* registered any listeners (therefore the FDC3 service is *not* aware of the window)', () => {
                    test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                        const promise = fdc3Remote.raiseIntent(
                            testManagerIdentity,
                            validPayload.intent,
                            validPayload.context,
                            testAppNotInDirectory.name
                        );

                        await expect(promise).toThrowFDC3Error(
                            ResolveError.TargetAppNotAvailable,
                            `Couldn't resolve intent target '${testAppNotInDirectory.name}'. No matching app in directory or currently running.`
                        );
                    });
                });

                describe('When the target has registered any listeners (so the FDC3 service has the window in the model)', () => {
                    let listener: fdc3Remote.RemoteIntentListener;

                    beforeEach(async () => {
                        listener = await fdc3Remote.addIntentListener(testAppNotInDirectory, validPayload.intent);
                    });

                    describe('When the target has *not* registered listeners for the raised intent', () => {
                        test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                            const promise = fdc3Remote.raiseIntent(
                                testManagerIdentity,
                                invalidPayload.intent,
                                invalidPayload.context,
                                testAppNotInDirectory.name
                            );

                            await expect(promise).toThrowFDC3Error(
                                ResolveError.IntentTimeout,
                                `Timeout waiting for intent listener to be added. intent = ${invalidPayload.intent}`
                            );
                        });
                    });

                    describe('When the target has registered listeners for the raised intent', () => {
                        test('When calling raiseIntent from another app the listener is triggered exactly once with the correct context', async () => {
                            await fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppNotInDirectory.name);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validPayload.context]);
                        });

                        test('When registering a duplicate intent listener, then calling raiseIntent from another app, \
both listeners are triggered exactly once with the correct context', async () => {
                            const duplicateListener = await fdc3Remote.addIntentListener(testAppNotInDirectory, validPayload.intent);

                            await fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppNotInDirectory.name);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validPayload.context]);

                            const duplicateReceivedContexts = await duplicateListener.getReceivedContexts();
                            expect(duplicateReceivedContexts).toEqual([validPayload.context]);
                        });

                        test('When adding a distinct intent listener, then calling raiseIntent from another app, \
only the first listener is triggered', async () => {
                            const distinctListener = await fdc3Remote.addIntentListener(testAppNotInDirectory, validPayload.intent + 'distinguisher');

                            await fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppNotInDirectory.name);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validPayload.context]);

                            const distinctReceivedContexts = await distinctListener.getReceivedContexts();
                            expect(distinctReceivedContexts).toEqual([]);
                        });

                        test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
                            await listener.unsubscribe();
                            const promise = fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppNotInDirectory.name);

                            await expect(promise).toThrowFDC3Error(
                                ResolveError.IntentTimeout,
                                `Timeout waiting for intent listener to be added. intent = ${validPayload.intent}`
                            );
                        });

                        test('When calling unsubscribe from a second intent listener, then calling raiseIntent from another app, \
only the first listener is triggered exactly once with the correct context, and the second is not triggered', async () => {
                            const shortLivedListener = await fdc3Remote.addIntentListener(testAppNotInDirectory, validPayload.intent);
                            await shortLivedListener.unsubscribe();

                            await fdc3Remote.raiseIntent(testManagerIdentity, validPayload.intent, validPayload.context, testAppNotInDirectory.name);

                            const receivedContexts = await listener.getReceivedContexts();
                            expect(receivedContexts).toEqual([validPayload.context]);

                            const shortLivedReceivedContexts = await shortLivedListener.getReceivedContexts();
                            expect(shortLivedReceivedContexts).toEqual([]);
                        });
                    });
                });
            });
        });
    }); // With a target

    describe.only('Without a target', () => {
        describe('0 apps in directory registered to accept the raised intent', () => {
            const notInDirectory = {
                intent: 'test.IntentNotInDirectory',
                context: {type: 'dummyContext'}
            };

            describe('And no running ad-hoc apps with listeners registered for the raised intent', () => {
                test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                    const resultPromise = fdc3Remote.raiseIntent(testManagerIdentity, notInDirectory.intent, notInDirectory.context);

                    await expect(resultPromise).toThrowFDC3Error(
                        ResolveError.NoAppsFound,
                        'No applications available to handle this intent'
                    );
                });
            });

            describe('But there are running ad-hoc apps with a listener registered for the raised intent', () => {
                const testAppNotInDirectory = {
                    uuid: 'test-app-not-in-directory',
                    name: 'test-app-not-in-directory',
                    manifestUrl: 'http://localhost:3923/test/configs/test-app-not-in-directory.json'
                };
                let listener: fdc3Remote.RemoteIntentListener;

                beforeEach(async () => {
                    await fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl);
                    listener = await fdc3Remote.addIntentListener(testAppNotInDirectory, notInDirectory.intent);
                });

                afterEach(async () => {
                    await fin.Application.wrapSync(testAppNotInDirectory).quit().catch(() => {});
                });

                describe('Just 1 ad-hoc app with a listener registered for the intent', () => {
                    test('When calling raiseIntent the listener is triggered once', async () => {
                        await fdc3Remote.raiseIntent(testManagerIdentity, notInDirectory.intent, notInDirectory.context);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([notInDirectory.context]);
                    });

                    test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
                        await listener.unsubscribe();
                        const resultPromise = fdc3Remote.raiseIntent(testManagerIdentity, notInDirectory.intent, notInDirectory.context);

                        await expect(resultPromise).toThrowFDC3Error(
                            ResolveError.NoAppsFound,
                            'No applications available to handle this intent'
                        );
                    });
                });

                describe('2 ad-hoc apps, both of them with a listener registered for the intent', () => {
                    const testAppNotInDirectory2 = {
                        uuid: 'test-app-not-in-directory-2',
                        name: 'test-app-not-in-directory-2',
                        manifestUrl: 'http://localhost:3923/test/configs/test-app-not-in-directory-2.json'
                    };
                    let listener2: fdc3Remote.RemoteIntentListener;

                    beforeEach(async () => {
                        await fin.Application.startFromManifest(testAppNotInDirectory2.manifestUrl);
                        listener2 = await fdc3Remote.addIntentListener(testAppNotInDirectory2, notInDirectory.intent);
                    });

                    afterEach(async () => {
                        await fin.Application.wrapSync(testAppNotInDirectory2).quit().catch(() => {});
                    });

                    test.todo('When calling raiseIntent, the resolver is displayed with both apps');

                    test('When calling unsubscribe from the intent listener on the first app, then calling raiseIntent from another app, \
then the second listener is triggered exactly once with the correct context', async () => {
                        await listener.unsubscribe();
                        await fdc3Remote.raiseIntent(testManagerIdentity, notInDirectory.intent, notInDirectory.context);

                        const receivedContexts = await listener.getReceivedContexts();
                        expect(receivedContexts).toEqual([]);

                        const receivedContexts2 = await listener2.getReceivedContexts();
                        expect(receivedContexts2).toEqual([notInDirectory.context]);
                    });
                });
            });
        }); // 0 apps in directory

        describe('1 app in directory registered to accept the raised intent', () => {
            const onlyIn1App = {
                intent: 'test.IntentOnlyOnApp4',
                context: {type: 'dummyContext'}
            };
            const testAppWithUniqueIntent = {
                uuid: 'test-app-4',
                name: 'test-app-4',
                appId: '400'
            };

            describe('With the registered app running', () => {
                beforeEach(async () => {
                    await fdc3Remote.open(testManagerIdentity, testAppWithUniqueIntent.uuid);
                });

                afterEach(async () => {
                    await fin.Application.wrapSync(testAppWithUniqueIntent).quit().catch(() => {});
                });

                describe('But the app does not have the listener registered on the model', () => {
                    // This case is equivalent to 0 apps in directory
                    describe('And no running ad-hoc apps with listeners registered for the raised intent', () => {
                        test('When calling raiseIntent the promise rejects with an FDC3Error', async () => {
                            const resultPromise = fdc3Remote.raiseIntent(testManagerIdentity, onlyIn1App.intent, onlyIn1App.context);

                            await expect(resultPromise).toThrowFDC3Error(
                                ResolveError.NoAppsFound,
                                'No applications available to handle this intent'
                            );
                        });
                    });

                    describe('But there are running ad-hoc apps with a listener registered for the raised intent', () => {
                        const testAppNotInDirectory = {
                            uuid: 'test-app-not-in-directory',
                            name: 'test-app-not-in-directory',
                            manifestUrl: 'http://localhost:3923/test/configs/test-app-not-in-directory.json'
                        };
                        let listener: fdc3Remote.RemoteIntentListener;

                        beforeEach(async () => {
                            await fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl);
                            listener = await fdc3Remote.addIntentListener(testAppNotInDirectory, onlyIn1App.intent);
                        });

                        afterEach(async () => {
                            await fin.Application.wrapSync(testAppNotInDirectory).quit().catch(() => {});
                        });

                        describe('Just 1 ad-hoc app with a listener registered for the intent', () => {
                            test('When calling raiseIntent the listener is triggered once', async () => {
                                await fdc3Remote.raiseIntent(testManagerIdentity, onlyIn1App.intent, onlyIn1App.context);

                                const receivedContexts = await listener.getReceivedContexts();
                                expect(receivedContexts).toEqual([onlyIn1App.context]);
                            });

                            test('When calling unsubscribe from the intent listener, then calling raiseIntent from another app, it errors', async () => {
                                await listener.unsubscribe();
                                const resultPromise = fdc3Remote.raiseIntent(testManagerIdentity, onlyIn1App.intent, onlyIn1App.context);

                                await expect(resultPromise).toThrowFDC3Error(
                                    ResolveError.NoAppsFound,
                                    'No applications available to handle this intent'
                                );
                            });
                        });

                        describe('2 ad-hoc apps, both of them with a listener registered for the intent', () => {
                            const testAppNotInDirectory2 = {
                                uuid: 'test-app-not-in-directory-2',
                                name: 'test-app-not-in-directory-2',
                                manifestUrl: 'http://localhost:3923/test/configs/test-app-not-in-directory-2.json'
                            };
                            let listener2: fdc3Remote.RemoteIntentListener;

                            beforeEach(async () => {
                                await fin.Application.startFromManifest(testAppNotInDirectory2.manifestUrl);
                                listener2 = await fdc3Remote.addIntentListener(testAppNotInDirectory2, onlyIn1App.intent);
                            });

                            afterEach(async () => {
                                await fin.Application.wrapSync(testAppNotInDirectory2).quit().catch(() => {});
                            });

                            test.todo('When calling raiseIntent, the resolver is displayed with both apps');

                            test('When calling unsubscribe from the intent listener on the first app, then calling raiseIntent from another app, \
then the second listener is triggered exactly once with the correct context', async () => {
                                await listener.unsubscribe();
                                await fdc3Remote.raiseIntent(testManagerIdentity, onlyIn1App.intent, onlyIn1App.context);

                                const receivedContexts = await listener.getReceivedContexts();
                                expect(receivedContexts).toEqual([]);

                                const receivedContexts2 = await listener2.getReceivedContexts();
                                expect(receivedContexts2).toEqual([onlyIn1App.context]);
                            });
                        });
                    });
                }); // 1 app in directory, running, but hasn't registered listener

                describe('And the app has registered a listener for the intent', () => {
                    let listener: fdc3Remote.RemoteIntentListener;

                    beforeEach(async () => {
                        listener = await fdc3Remote.addIntentListener(testAppWithUniqueIntent, onlyIn1App.intent);
                    });
                    describe('And no running ad-hoc apps with listeners registered for the raised intent', () => {
                        // Raise directly
                        test.todo('When calling raiseIntent from another app the listener is triggered exactly once with the correct context');
                    });

                    describe('But there is a running ad-hoc app with a listener registered for the same intent', () => {
                        // Launch resolver
                        test.todo('When calling raiseIntent from another app, the resolver should be displayed with both apps');
                    });
                }); // 1 app in directory, running, has registered listener
            }); // 1 app in directory, running

            describe('With the registered app not running', () => {
                describe('And no running ad-hoc apps with listeners registered for the raised intent', () => {
                    describe('When the directory app does not register the intent listener after opening', () => {
                        test.todo('When calling raiseIntent from another app, the directory app should open and receive the intent with the correct context');
                    });

                    describe('When the directory app registers the intent listener after opening', () => {
                        // beforeEach ??
                        test.todo('When calling raiseIntent from another app, the app should open but a timeout error should be thrown');
                    });
                });

                describe('But there is a running ad-hoc app with a listener registered for the same intent', () => {
                    test.todo('When calling raiseIntent from another app, the resolver should be displayed with the directory + ad-hoc app');
                });
            }); // 1 app in directory, not running

            describe('But there is a running ad-hoc app with a listener registered for the raised intent', () => {
                const testAppNotInDirectory = {
                    uuid: 'test-app-not-in-directory',
                    name: 'test-app-not-in-directory',
                    manifestUrl: 'http://localhost:3923/test/configs/test-app-not-in-directory.json'
                };
                let listener: fdc3Remote.RemoteIntentListener;

                beforeEach(async () => {
                    await fin.Application.startFromManifest(testAppNotInDirectory.manifestUrl);
                    listener = await fdc3Remote.addIntentListener(testAppNotInDirectory, onlyIn1App.intent);
                });

                afterEach(async () => {
                    await fin.Application.wrapSync(testAppNotInDirectory).quit().catch(() => {});
                });
            });
        }); // 1 app in directory

        describe('>1 app in directory registered to accept the raised intent', () => {
            test.todo('TODO: figure out how to test the resolver UI properly');
        }); // >1 app in directory
    }); // Without a target
});
