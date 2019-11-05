import * as os from 'os';
import * as path from 'path';

import * as puppeteer from 'puppeteer';
import * as rimraf from 'rimraf';

declare const global: NodeJS.Global&{__BROWSER_GLOBAL__: puppeteer.Browser};

const DIR = path.join(os.tmpdir(), 'jest_puppeteer_global_setup');
module.exports = () => {
    // close the browser instance
    global.__BROWSER_GLOBAL__.disconnect();

    // clean-up the wsEndpoint file
    rimraf.sync(DIR);
};
