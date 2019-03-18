import * as puppeteer from 'puppeteer';
import {Browser, Page, Target} from 'puppeteer';
import { Identity, Fin } from 'openfin/_v2/main';

const fetch = require('node-fetch');

export type TestWindowContext = Window & {
    fin: Fin;
    OpenfinFDC3: typeof import("../../../src/client/index")
};

const pageIdentityCache = new Map<Page, Identity>();
// Reverse lookup uses stringified version of identity ("uuid/name")
const identityPageCache = new Map<string, Page>();

export const browserPromise = getBrowser();
async function getBrowser(): Promise<Browser> {
    const wsDebuggingURL =(await (await fetch('http://localhost:9222/json/version')).json()).webSocketDebuggerUrl;

    console.log('Puppeteer is connecting...');
    const browser: Browser = await puppeteer.connect({browserWSEndpoint:wsDebuggingURL});
    console.log('Puppeteer connected...');
    await registerBrowserListeners(browser);
    return browser;
}
async function registerBrowserListeners(browser: Browser) {
    browser.on('targetcreated', async (target: Target) => {
        if (target.type() === 'page') {
            const page = await target.page();
            // Cache all newly created pages
            await getIdentity(page);
        }
    });
    browser.on('targetdestroyed', async (target: Target) => {
        if (target.type() === 'page') {
            // Remove page from the cache
            const page = await target.page();
            const identity = pageIdentityCache.get(page);
            if (identity) {
                // Remove the closed page from both forward and reverse caches.
                pageIdentityCache.delete(page);
                identityPageCache.delete(getIdString(identity));
            }
        }
    });
}

export async function getPage(identity:Identity): Promise<Page|undefined> {
    const idString = getIdString(identity);

    // Return cached value when available
    if (identityPageCache.has(idString)) {
        return identityPageCache.get(idString);
    }

    const pages = await (await browserPromise).pages();
    for (const page of pages) {
        const pageIdentity = await getIdentity(page);
        if (pageIdentity && pageIdentity.uuid === identity.uuid && pageIdentity.name === identity.name) {
            // Cache is updated by getIdentity, so no need to update here
            return page;
        }
    }

    // No pages found that match
    return undefined;
}

export async function getIdentity(page: Page): Promise<Identity | undefined> {
    // Return cached value when available
    if (pageIdentityCache.has(page)) {
        return pageIdentityCache.get(page);
    } 

    const identity: Identity | undefined = await page.evaluate(function(this: TestWindowContext): Identity | undefined {
        // This could be run on devtools or other non fin-enabled windows so need a guard
        if (!fin) {
            return undefined;
        } else {
            return this.fin.Window.me;
        }
    });

    if (identity !== undefined) {
        // Update both forward and reverse maps
        pageIdentityCache.set(page, identity);
        identityPageCache.set(getIdString(identity), page);
    }

    return identity;
}

function getIdString(identity: Identity): string {
    return `${identity.uuid}/${identity.name}`;
}

// tslint:disable-next-line: no-any Needed for tuple types.
export async function executeOnWindow<T extends any[], R, C extends TestWindowContext = TestWindowContext>(executionTarget: Identity, fn: (this: C, ...args: T) => R, ...args: T): Promise<R> {
    const page = await getPage(executionTarget);
    if (!page) {
        throw new Error('could not find specified executionTarget');
    }

    // tslint:disable-next-line: no-any Explicit cast needed to appease typescript. Puppeteer types make liberal use of any, which confuses things here.
    return page.evaluate(fn as (...args: any[]) => R, ...args);
}

export async function mountFunctionOnWindow(executionTarget: Identity, name: string, fn: Function) {
    const page = await getPage(executionTarget);
    if (!page) {
        throw new Error('could not find specified executionTarget');
    }
    
    // tslint:disable-next-line: no-any Explicit cast needed to appease typescript. Puppeteer types make liberal use of any, which confuses things here.
    return page.exposeFunction(name, fn as (...args: any[]) => any);
}