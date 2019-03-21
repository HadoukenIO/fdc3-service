import 'jest';
import {OFPuppeteerBrowser, TestWindowContext} from './utils/ofPuppeteer';

// This file is exactly the same as testUtils.test.ts
// It is here to ensure that we can use the utils from multiple test files with
// no issues

// Testing test utils...
describe('basic puppeteer functionality', () => {
    const ofBrowser = new OFPuppeteerBrowser();


    afterEach(() => {
        jest.clearAllMocks();
    });



    it('can execute code remotely on the main test app', async () => {
        const testManagerIdentity = {uuid: 'test-app', name: 'test-app'};

        const result = await ofBrowser.executeOnWindow(testManagerIdentity, () => {
            return 1 + 1;
        });

        expect(result).toBe(2);
    });
});