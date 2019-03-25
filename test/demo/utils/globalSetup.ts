import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as mkdirp from 'mkdirp';
import fetch from 'node-fetch';
import * as puppeteer from 'puppeteer';

declare const global: NodeJS.Global&{__BROWSER_GLOBAL__: puppeteer.Browser};

const DIR = path.join(os.tmpdir(), 'jest_puppeteer_global_setup');

module.exports = async () => {
    // Openfin should be running at this point
    const browserWSEndpoint = (await (await fetch('http://localhost:9222/json/version')).json()).webSocketDebuggerUrl;
    if (!browserWSEndpoint) {
        throw new Error('Could not get webSocket endpoint for puppeteer connection');
    }
    const browser = await puppeteer.connect({browserWSEndpoint});

    // store the browser instance so we can teardown it later
    // this global is only available in the teardown but not in TestEnvironments
    global.__BROWSER_GLOBAL__ = browser;

    // use the file system to expose the wsEndpoint for TestEnvironments
    mkdirp.sync(DIR);
    fs.writeFileSync(path.join(DIR, 'wsEndpoint'), browserWSEndpoint);
};
