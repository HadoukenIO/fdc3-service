// Had problems with this as a typescript file, so leaving as js for now
const fs = require('fs');
const os = require('os');
const path = require('path');

const NodeEnvironment = require('jest-environment-node');
const puppeteer = require('puppeteer');

const DIR = path.join(os.tmpdir(), 'jest_puppeteer_global_setup');

class PuppeteerEnvironment extends NodeEnvironment {
    constructor(config) {
        super(config);
    }

    async setup() {
        await super.setup();
        // get the wsEndpoint
        const wsEndpoint = fs.readFileSync(path.join(DIR, 'wsEndpoint'), 'utf8');
        if (!wsEndpoint) {
            throw new Error('wsEndpoint not found');
        }

        // connect to puppeteer
        this.global.__BROWSER__ = await puppeteer.connect({
            browserWSEndpoint: wsEndpoint
        });
    }

    async teardown() {
        await this.global.__BROWSER__.disconnect();
        await super.teardown();
    }

    runScript(script) {
        return super.runScript(script);
    }
}

module.exports = PuppeteerEnvironment;
