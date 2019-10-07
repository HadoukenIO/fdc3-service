import 'reflect-metadata';

import {Identity} from 'openfin/_v2/main';

import {createMockChannel} from '../mocks';
import {Application} from '../../src/client/main';
import {AbstractAppWindow} from '../../src/provider/model/AppWindow';
import {ContextChannel} from '../../src/provider/model/ContextChannel';

class TestAppWindow extends AbstractAppWindow {
    private readonly _identity: Readonly<Identity>;

    constructor(identity: Identity, appInfo: Application, channel: ContextChannel, creationTime: number | undefined, appWindowNumber: number) {
        super(identity, appInfo, channel, creationTime, appWindowNumber);

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
});
