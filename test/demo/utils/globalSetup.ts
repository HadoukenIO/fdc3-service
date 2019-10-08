import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as mkdirp from 'mkdirp';
import fetch from 'node-fetch';
import * as puppeteer from 'puppeteer';
import * as jsAdapter from 'hadouken-js-adapter';

declare const global: NodeJS.Global&{__BROWSER_GLOBAL__: puppeteer.Browser};

const DIR = path.join(os.tmpdir(), 'jest_puppeteer_global_setup');

module.exports = async () => {
    // Get the devtools port of the currently running openfin instance
    const fin = await jsAdapter.connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-jest-global-setup'});
    const cliArgs = await fin.System.getCommandLineArguments();
    const devToolsPortArgs = cliArgs.split(' ').filter(arg => arg.startsWith('--remote-debugging-port'));
    if (devToolsPortArgs.length !== 1) {
        throw new Error('Could not get devtools port for runtime');
    }
    const devToolsPort = Number.parseInt(devToolsPortArgs[0].split('=')[1]);

    // Get the browser process devtools endpoint and connect to it with puppeteer to check it works
    const fetchResponse = await fetch(`http://localhost:${devToolsPort}/json/version`).catch(async () => {
        console.log('Initial fetch failed. Trying again in 1 second.');
        await new Promise(res => setTimeout(res, 1000));
        return fetch(`http://localhost:${devToolsPort}/json/version`);
    });
    const browserWSEndpoint = (await fetchResponse.json()).webSocketDebuggerUrl;
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
