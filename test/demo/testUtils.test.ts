import 'jest';
import {OFPuppeteerBrowser, TestWindowContext} from './utils/ofPuppeteer';



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
});