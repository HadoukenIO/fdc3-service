// Had problems with this as a typescript file, so leaving as js for now
const fs = require('fs');
const os = require('os');
const path = require('path');

const NodeEnvironment = require('jest-environment-node');
const puppeteer = require('puppeteer');
const jsAdapter = require('hadouken-js-adapter');

const DIR = path.join(os.tmpdir(), 'jest_puppeteer_global_setup');

// Connect to openfin once and use the same connection object throughout the tests
const finPromise = jsAdapter.connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-jest-env'});

// Connect puppeteer once and use the same connection object throughout the tests
const wsEndpoint = fs.readFileSync(path.join(DIR, 'wsEndpoint'), 'utf8');
if (!wsEndpoint) {
    throw new Error('wsEndpoint not found');
}
const puppeteerPromise = puppeteer.connect({
    browserWSEndpoint: wsEndpoint
});

class PuppeteerEnvironment extends NodeEnvironment {
    constructor(config) {
        super(config);
    }

    async setup() {
        await super.setup();
        // get the wsEndpoint
        if (!wsEndpoint) {
            throw new Error('wsEndpoint not found');
        }

        // expose puppeteer connection
        this.global.__BROWSER__ = await puppeteerPromise;

        // expose js-adapter connection
        this.global.__FIN__ = await finPromise;
    }

    async teardown() {
        await super.teardown();
    }

    runScript(script) {
        return super.runScript(script);
    }
}

module.exports = PuppeteerEnvironment;
