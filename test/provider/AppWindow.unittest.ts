import 'reflect-metadata';

import {Identity} from 'openfin/_v2/main';

import {createMockChannel} from '../mocks';
import {Application} from '../../src/client/main';
import {AppConnectionBase} from '../../src/provider/model/AppConnection';
import {ContextChannel} from '../../src/provider/model/ContextChannel';
import {useMockTime, unmockTime, advanceTime, resolvePromiseChain} from '../utils/unit/time';
import {EntityType} from '../../src/provider/model/Environment';

class TestAppWindow extends AppConnectionBase {
    private readonly _identity: Readonly<Identity>;

    constructor(identity: Identity, appInfo: Application, channel: ContextChannel, creationTime: number | undefined, appWindowNumber: number) {
        super(identity, EntityType.WINDOW, appInfo, channel, creationTime, appWindowNumber);

        this._identity = identity;
    }

    public get identity() {
        return this._identity;
    }

    public bringToFront = jest.fn<Promise<void>, []>();
    public focus = jest.fn<Promise<void>, []>();
}

const mockChannel = createMockChannel();

const fakeIdentity = {uuid: 'test', name: 'test'};
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
        testAppWindow = new TestAppWindow(fakeIdentity, fakeAppInfo, mockChannel, Date.now(), 0);
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
        const secondTestAppWindow = new TestAppWindow(fakeIdentity, fakeAppInfo, mockChannel, Date.now(), 0);
        secondTestAppWindow.addContextListener();

        expect(testAppWindow.hasContextListener()).toBe(false);
    });
});

describe('When querying if a window is ready to receive contexts', () => {
    let testAppWindow: TestAppWindow;

    beforeEach(() => {
        // All tests in this section will use fake timers to allow us to control the Promise races precisely
        useMockTime();

        testAppWindow = new TestAppWindow(fakeIdentity, fakeAppInfo, mockChannel, Date.now(), 0);
    });

    afterEach(() => {
        unmockTime();
    });

    test('A window with a context listener already registered returns true immediately', async () => {
        testAppWindow.addContextListener();

        // Use a jest spy to track the timing of when the promise resolves without awaiting
        const timingSpy = jest.fn();
        testAppWindow.isReadyToReceiveContext().then(timingSpy);

        // Do not advance time, but let any pending promises be actioned
        await resolvePromiseChain();

        // Promise should have resolved immediately, so spy should have been invoked
        expect(timingSpy).toHaveBeenCalledWith(true);
    });

    describe('When the window does not have a listener registered', () => {
        test('If the window was created longer than the timeout in the past, the promise resolves false immediately', async () => {
            // Fast forward time to well after the window's creation time
            await advanceTime(10000);

            // Use a jest spy to track the timing of when the promise resolves without awaiting
            const timingSpy = jest.fn();
            testAppWindow.isReadyToReceiveContext().then(timingSpy);

            // Do not advance time, but let any pending promises be actioned
            await resolvePromiseChain();

            // Promise should have resolved immediately, so spy should have been invoked
            expect(timingSpy).toHaveBeenCalledWith(false);
        });

        test('If the window registers a listener within the timeout, the promise resolves true shortly after registration', async () => {
            // Use a jest spy to track the timing of when the promise resolves without awaiting
            const timingSpy = jest.fn();
            testAppWindow.isReadyToReceiveContext().then(timingSpy);

            await advanceTime(1000);
            await resolvePromiseChain();
            expect(timingSpy).not.toHaveBeenCalled();

            testAppWindow.addContextListener();

            await advanceTime(5000);
            await resolvePromiseChain();
            expect(timingSpy).toHaveBeenCalled();
        });

        test('If the window has not registered a listener after 5 seconds, the promise resolves false', async () => {
            // Use a jest spy to track the timing of when the promise resolves without awaiting
            const timingSpy = jest.fn();
            testAppWindow.isReadyToReceiveContext().then(timingSpy);

            // Does not fail early
            await advanceTime(2000);
            await resolvePromiseChain();
            expect(timingSpy).not.toHaveBeenCalled();

            // Advance to the timeout and then slightly past it
            await advanceTime(3000);
            await resolvePromiseChain();

            expect(timingSpy).toHaveBeenCalledWith(false);
        });
    });
});
