import "jest";
import {OFPuppeteerBrowser, TestWindowContext } from "./utils/puppeteer";

// Testing test utils...
describe('basic puppeteer functionality', () => {
    jest.setTimeout(100000);
    const ofBrowser = new OFPuppeteerBrowser();

    beforeAll(async () => {
        expect(ofBrowser.browser).not.toBeUndefined();
        await new Promise(res => setTimeout(res, 200));
    });


    afterEach(() => {
        jest.clearAllMocks();
    });

    it('can connect to the browser process', async () => {
        expect(ofBrowser.browser).toBeTruthy();
        expect(ofBrowser.browser!.pages()).resolves.toBeTruthy();
    });

    it('can execute code remotely on the main test app', async () => {
        const testManagerIdentity = {uuid: 'test-app', name: 'test-app'};

        const result = await ofBrowser.executeOnWindow(testManagerIdentity, () => {
            return 1 + 1;
        });

        expect(result).toBe(2);
    });

    it('can mount a function and trigger it remotely', async () => {
        const testManagerIdentity = {uuid: 'test-app', name: 'test-app'};
        const mockFn = jest.fn();

        await ofBrowser.mountFunctionOnWindow(testManagerIdentity, 'mountedFunction', mockFn);

        const expectedPayload = {a: 1, b: false, c: 'some-string', d: {someProp: 'a'}};
        await ofBrowser.executeOnWindow(testManagerIdentity, async function(this: TestWindowContext & {mountedFunction: typeof mockFn}, payload: typeof expectedPayload) {
            this.mountedFunction(payload);
        }, expectedPayload);

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith(expectedPayload);
    });

    it('can mount a function and trigger it remotely a second time', async () => {
        const testManagerIdentity = {uuid: 'test-app', name: 'test-app'};
        const mockFn = jest.fn();

        await ofBrowser.mountFunctionOnWindow(testManagerIdentity, 'mountedFunction2', mockFn);

        const expectedPayload = {a: 1, b: false, c: 'some-string', d: {someProp: 'a'}};
        await ofBrowser.executeOnWindow(testManagerIdentity, async function(this: TestWindowContext & {mountedFunction2: typeof mockFn}, payload: typeof expectedPayload) {
            this.mountedFunction2(payload);
        }, expectedPayload);

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith(expectedPayload);
    });
});