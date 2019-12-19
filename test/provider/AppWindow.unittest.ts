import 'reflect-metadata';

import {Identity} from 'openfin/_v2/main';
import {DeferredPromise} from 'openfin-service-async';

import {createMockChannel} from '../mocks';
import {useMockTime, unmockTime, advanceTime, resolvePromiseChain} from '../utils/unit/time';
import {Application} from '../../src/client/main';
import {Timeouts} from '../../src/provider/constants';
import {AppConnectionBase} from '../../src/provider/model/AppConnection';
import {ContextChannel} from '../../src/provider/model/ContextChannel';
import {EntityType} from '../../src/provider/model/Environment';
import {SemVer} from '../../src/provider/utils/SemVer';

class TestAppWindow extends AppConnectionBase {
    public bringToFront: jest.Mock<Promise<void>, []> = jest.fn<Promise<void>, []>();
    public focus: jest.Mock<Promise<void>, []> = jest.fn<Promise<void>, []>();

    private readonly _identity: Readonly<Identity>;

    constructor(identity: Identity, version: SemVer, appInfo: Application, maturityPromise: Promise<void>, channel: ContextChannel, entityNumber: number) {
        super(identity, EntityType.WINDOW, version, appInfo, maturityPromise, channel, entityNumber);

        this._identity = identity;
    }

    public get identity() {
        return this._identity;
    }
}

const mockChannel = createMockChannel();

const fakeIdentity = {uuid: 'test', name: 'test'};
const fakeVersion = new SemVer('1.0.0');
const fakeAppInfo: Application = {
    appId: 'test',
    name: 'Test App',
    manifest: 'test.manifest',
    manifestType: 'openfin'
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('When querying if a window has a context listener', () => {
    let testAppWindow: TestAppWindow;

    beforeEach(() => {
        testAppWindow = new TestAppWindow(fakeIdentity, fakeVersion, fakeAppInfo, createMaturityPromise(), mockChannel, 0);
    });

    test('A freshly-initialized window returns false', () => {
        expect(testAppWindow.hasContextListener()).toBe(false);
    });

    test('Calling addContextListener once makes the query return true', () => {
        testAppWindow.addContextListener();
        expect(testAppWindow.hasContextListener()).toBe(true);
    });

    test('Calling addContextListener several times makes the query return true', () => {
        for (let i = 0; i < 5; i++) {
            testAppWindow.addContextListener();
        }
        expect(testAppWindow.hasContextListener()).toBe(true);
    });

    test('Calling removeContextListener on a fresh window has no effect', () => {
        testAppWindow.removeContextListener();
        expect(testAppWindow.hasContextListener()).toBe(false);
    });

    test('Calling addContextListener then removeContextListener makes the query return true then false', () => {
        testAppWindow.addContextListener();
        expect(testAppWindow.hasContextListener()).toBe(true);
        testAppWindow.removeContextListener();
        expect(testAppWindow.hasContextListener()).toBe(false);
    });

    test('The state of one TestAppWindow does not affect another', () => {
        const secondTestAppWindow = new TestAppWindow(fakeIdentity, fakeVersion, fakeAppInfo, createMaturityPromise(), mockChannel, 0);
        secondTestAppWindow.addContextListener();

        expect(testAppWindow.hasContextListener()).toBe(false);
    });
});

describe('When querying if a window is ready to receive contexts', () => {
    let testAppWindow: TestAppWindow;

    beforeEach(() => {
        // All tests in this section will use fake timers to allow us to control the Promise races precisely
        useMockTime();

        testAppWindow = new TestAppWindow(fakeIdentity, fakeVersion, fakeAppInfo, createMaturityPromise(), mockChannel, 0);
    });

    afterEach(() => {
        unmockTime();
    });

    test('A window with a context listener already registered resolves immediately', async () => {
        testAppWindow.addContextListener();

        // Use a jest spy to track the timing of when the promise resolves without awaiting
        const timingSpy = jest.fn();
        testAppWindow.waitForReadyToReceiveContext().then(timingSpy);

        // Do not advance time, but let any pending promises be actioned
        await resolvePromiseChain();

        // Promise should have resolved immediately, so spy should have been invoked
        expect(timingSpy).toHaveBeenCalledTimes(1);
    });

    describe('When the window does not have a listener registered', () => {
        test('If the window was created longer than the timeout in the past, the promise rejects immediately', async () => {
            // Fast forward time to well after the window's creation time
            await advanceTime(10000);

            // Use a jest spy to track the timing of when the promise resolves without awaiting
            const timingSpy = jest.fn();
            testAppWindow.waitForReadyToReceiveContext().catch(timingSpy);

            // Do not advance time, but let any pending promises be actioned
            await resolvePromiseChain();

            // Promise should have resolved immediately, so spy should have been invoked
            expect(timingSpy).toHaveBeenCalledTimes(1);
        });

        test('If the window registers a listener within the timeout, the promise resolves shortly after registration', async () => {
            // Use a jest spy to track the timing of when the promise resolves without awaiting
            const timingSpy = jest.fn();
            testAppWindow.waitForReadyToReceiveContext().then(timingSpy);

            await advanceTime(1000);
            await resolvePromiseChain();
            expect(timingSpy).not.toHaveBeenCalled();

            testAppWindow.addContextListener();

            await advanceTime(5000);
            await resolvePromiseChain();
            expect(timingSpy).toHaveBeenCalled();
        });

        test('If the window has not registered a listener after 5 seconds, the promise rejects', async () => {
            // Use a jest spy to track the timing of when the promise resolves without awaiting
            const timingSpy = jest.fn();
            testAppWindow.waitForReadyToReceiveContext().catch(timingSpy);

            // Does not fail early
            await advanceTime(2000);
            await resolvePromiseChain();
            expect(timingSpy).not.toHaveBeenCalled();

            // Advance to the timeout and then slightly past it
            await advanceTime(3000);
            await resolvePromiseChain();

            expect(timingSpy).toHaveBeenCalledTimes(1);
        });
    });
});

function createMaturityPromise(): Promise<void> {
    const deferredPromise = new DeferredPromise();
    setTimeout(deferredPromise.resolve, Timeouts.APP_MATURITY);

    return deferredPromise.promise;
}
