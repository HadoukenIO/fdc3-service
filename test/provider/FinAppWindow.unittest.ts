import 'reflect-metadata';

import {_Window} from 'openfin/_v2/api/window/window';
import {Identity} from 'openfin/_v2/main';

import {FinAppWindow} from '../../src/provider/model/FinAppWindow';
import {createMockChannel} from '../mocks';
import {Application} from '../../src/client/main';

// Fake fin object exposing only the functionality used by FinAppWindow
const fin = {
    Window: {
        wrapSync: (identity: Identity): _Window => createMockFinWindow(identity)
    }
};

beforeAll(() => {
    // Expose fake fin in the global scope for imports
    Object.assign(global, {fin});
});
afterAll(() => {
    // Remove fake fin from global scope when we're done
    Object.assign(global, {fin: undefined});
});

beforeEach(() => {
    jest.resetAllMocks();
});

// Creates a minimal stub of an openfin Window object containing only
// the functionality used by FinAppWindow
function createMockFinWindow(identity: Identity): jest.Mocked<_Window> {
    return {
        identity,
        bringToFront: jest.fn<Promise<void>, []>(),
        focus: jest.fn<Promise<void>, []>()
    } as any as jest.Mocked<_Window>;
}

const mockChannel = createMockChannel();

const fakeIdentity = {uuid: 'test', name: 'test'};
const fakeAppInfo: Application = {
    appId: 'test',
    name: 'Test App',
    manifest: 'test.manifest',
    manifestType: 'openfin'
};

describe('When querying if a window has a context listener', () => {
    let testAppWindow: FinAppWindow;

    beforeEach(() => {
        testAppWindow = new FinAppWindow(fakeIdentity, fakeAppInfo, mockChannel, Date.now(), 0);
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

    test('Calling addContextListener then removeContextListener makes the query return true then false', () => {
        testAppWindow.addContextListener();
        expect(testAppWindow.hasContextListener()).toBe(true);
        testAppWindow.removeContextListener();
        expect(testAppWindow.hasContextListener()).toBe(false);
    });
});
