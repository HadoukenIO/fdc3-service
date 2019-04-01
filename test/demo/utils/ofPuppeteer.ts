import {Fin, Identity} from 'openfin/_v2/main';
import * as puppeteer from 'puppeteer';
import {Browser, Page} from 'puppeteer';
import {connect} from 'hadouken-js-adapter';

import {Context, IntentType} from '../../../src/client/main';

// This gets mounted by jest as part of our setup
declare const global: NodeJS.Global&{__BROWSER__: puppeteer.Browser};

export type TestWindowContext = Window&{
    fin: Fin;
    OpenfinFDC3: typeof import('../../../src/client/main');
    receivedContexts: Context[];
    receivedIntents: {intent: IntentType, context: Context}[]
};

export class OFPuppeteerBrowser {
    private _pageIdentityCache: Map<Page, Identity>;
    private _identityPageCache: Map<string, Page>;

    private _browser: Browser;

    private _ready: Promise<void>;

    constructor() {
        this._pageIdentityCache = new Map<Page, Identity>();
        this._identityPageCache = new Map<string, Page>();
        this._browser = global.__BROWSER__;
        this._ready = this.registerCleaupListener();
    }

    private async registerCleaupListener() {
        const fin = await connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-puppeteer-' + Math.random().toString()});
        fin.System.addListener('window-closing', win => {
            const page = this._identityPageCache.get(getIdString(win));
            if (page) {
                this._identityPageCache.delete(getIdString(win));
                this._pageIdentityCache.delete(page);
            }
        });
        return;
    }

    private async getPage(identity: Identity): Promise<Page|undefined> {
        await this._ready;
        const idString = getIdString(identity);

        // Return cached value when available
        if (this._identityPageCache.has(idString)) {
            return this._identityPageCache.get(idString);
        }

        // Connect will always result in browser being defined, but typescript
        // doesn't know that.
        const pages = await this._browser!.pages();
        for (const page of pages) {
            const pageIdentity = await this.getIdentity(page);
            if (pageIdentity && pageIdentity.uuid === identity.uuid && pageIdentity.name === identity.name) {
                // Cache is updated by getIdentity, so no need to update here
                return page;
            }
        }

        // No pages found that match
        return undefined;
    }

    private async getIdentity(page: Page): Promise<Identity|undefined> {
        await this._ready;
        // Return cached value when available
        if (this._pageIdentityCache.has(page)) {
            return this._pageIdentityCache.get(page);
        }

        const identity: Identity|undefined = await page.evaluate(function(this: TestWindowContext): Identity|undefined {
            // Could be devtools or other non-fin-enabled windows so need a guard
            if (!fin) {
                return undefined;
            } else {
                return this.fin.Window.me;
            }
        });

        if (identity !== undefined) {
            // Update both forward and reverse maps
            this._pageIdentityCache.set(page, identity);
            this._identityPageCache.set(getIdString(identity), page);
        }

        return identity;
    }

    public async executeOnWindow<
        // tslint:disable-next-line: no-any Needed for tuple types.
        T extends any[], R, C extends TestWindowContext = TestWindowContext>(executionTarget: Identity, fn: (this: C, ...args: T) => R, ...args: T):
        Promise<R> {
        const page = await this.getPage(executionTarget);
        if (!page) {
            throw new Error('could not find specified executionTarget');
        }

        // Explicit cast needed to appease typescript. Puppeteer types make liberal
        // use of the any type, which confuses things here.
        // tslint:disable-next-line: no-any
        return page.evaluate(fn as (...args: any[]) => R, ...args);
    }

    // Using this function from multiple test files causes big issues with this
    // version of puppeteer. Should be fixed in later versions, but v1.3 is the
    // latest version that works with OF v10. TODO: Revisit with newer version of
    // puppeteer once v11 runtime is out (or at least usable)

    // public async mountFunctionOnWindow(executionTarget: Identity, name: string,
    // fn: Function) {
    //     const page = await this.getPage(executionTarget);
    //     if (!page) {
    //         throw new Error('could not find specified executionTarget');
    //     }

    //     // tslint:disable-next-line: no-any Explicit cast needed to appease
    //     typescript. Puppeteer types make liberal use of any, which confuses
    //     things here. return page.exposeFunction(name, fn as (...args: any[]) =>
    //     any);
    // }
}

function getIdString(identity: Identity): string {
    return `${identity.uuid}/${identity.name}`;
}
