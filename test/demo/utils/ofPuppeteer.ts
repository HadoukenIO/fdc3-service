import {Fin, Identity} from 'openfin/_v2/main';
import {Browser, Page, JSHandle} from 'puppeteer';
import {connect} from 'hadouken-js-adapter';

import {Context, ContextListener, IntentListener, Channel} from '../../../src/client/main';
import {Events, ChannelEvents} from '../../../src/client/internal';
import {IntentType} from '../../../src/provider/intents';

import {uuidv4} from './uuidv4';

declare const global: NodeJS.Global & {__BROWSER__: Browser};

export interface TestWindowEventListener {
    handler: (payload: any) => void;
    unsubscribe: () => void;
}

export interface TestWindowChannelEventListener {
    handler: (payload: any) => void;
    unsubscribe: () => void;
}

export type TestWindowContext = Window & {
    fin: Fin;
    fdc3: typeof import('../../../src/client/main');

    contextListeners: ContextListener[];
    intentListeners: {[intent: string]: IntentListener[]};
    eventListeners: TestWindowEventListener[];
    channelEventListeners: TestWindowChannelEventListener[];

    channelTransports: {[id: string]: TestChannelTransport};

    receivedContexts: {listenerID: number; context: Context}[];
    receivedEvents: {listenerID: number; payload: Events}[];
    receivedIntents: {listenerID: number; intent: IntentType; context: Context}[];
    receivedChannelEvents: {listenerID: number; payload: ChannelEvents}[];

    errorHandler(error: Error): never;
    serializeChannel(channel: Channel): TestChannelTransport;
};

// Helper type. Works better with puppeteer than the builtin Function type
type AnyFunction = (...args: any[]) => any;

export interface TestChannelTransport {
    id: string;
    channel: Channel;
    constructor: string;
}

export type BaseWindowContext = Window & {fin: Fin};

export class OFPuppeteerBrowser<WindowContext extends BaseWindowContext = BaseWindowContext> {
    private readonly _pageIdentityCache: Map<Page, Identity>;
    private readonly _identityPageCache: Map<string, Page>;
    private readonly _mountedFunctionCache: Map<Page, Map<Function, JSHandle>>;
    private readonly _browser: Browser;
    private readonly _ready: Promise<void>;

    constructor() {
        this._pageIdentityCache = new Map<Page, Identity>();
        this._identityPageCache = new Map<string, Page>();
        this._mountedFunctionCache = new Map<Page, Map<Function, JSHandle>>();
        this._browser = global.__BROWSER__;
        this._ready = this.registerCleanupListener();
    }

    public get browser() {
        return this._browser;
    }

    private async getPage(identity: Identity): Promise<Page|undefined> {
        await this._ready;
        const idString = getIdString(identity);

        // Return cached value when available
        if (this._identityPageCache.has(idString)) {
            return this._identityPageCache.get(idString);
        }

        const pages = await this._browser.pages();
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

    public async executeOnWindow<T extends any[], R, C extends WindowContext = WindowContext>(
        executionTarget: Identity,
        fn: (this: C, ...args: T) => R,
        ...args: T
    ): Promise<R> {
        const page = await this.getPage(executionTarget);
        if (!page) {
            throw new Error(`could not find specified executionTarget: ${JSON.stringify(executionTarget)}`);
        }
        return page.evaluate(fn as AnyFunction, ...args);
    }

    public async getOrMountRemoteFunction(executionTarget: Identity, fn: AnyFunction): Promise<JSHandle> {
        const page = await this.getPage(executionTarget);
        if (!page) {
            throw new Error(`could not find specified executionTarget: ${JSON.stringify(executionTarget)}`);
        }
        const cachedHandle = this.getRemoteFunctionHandle(page, fn);
        if (cachedHandle) {
            return cachedHandle;
        } else {
            const name = uuidv4();
            await page.exposeFunction(name, fn);
            const newHandle = await page.evaluateHandle(function (this: {[k: string]: AnyFunction}, remoteName) {
                return this[remoteName];
            }, name);
            if (!this._mountedFunctionCache.get(page)) {
                this._mountedFunctionCache.set(page, new Map<Function, JSHandle>());
            }
            this._mountedFunctionCache.get(page)!.set(fn, newHandle);
            return newHandle;
        }
    }

    private async getIdentity(page: Page): Promise<Identity|undefined> {
        await this._ready;
        // Return cached value when available
        if (this._pageIdentityCache.has(page)) {
            return this._pageIdentityCache.get(page);
        }

        const identity: Identity|undefined = await page.evaluate(function (this: BaseWindowContext): Identity|undefined {
            // Could be devtools or other non-fin-enabled windows so need a guard
            if (!this.fin) {
                return undefined;
            } else {
                const {uuid, name} = this.fin.Window.me;
                return {uuid, name};
            }
        });

        if (identity !== undefined) {
            // Update both forward and reverse maps
            this._pageIdentityCache.set(page, identity);
            this._identityPageCache.set(getIdString(identity), page);
        }

        return identity;
    }

    private async registerCleanupListener() {
        const fin = await connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: `TEST-puppeteer-${Math.random().toString()}`});
        fin.System.addListener('window-closing', (win) => {
            const page = this._identityPageCache.get(getIdString(win));
            if (page) {
                this._identityPageCache.delete(getIdString(win));
                this._pageIdentityCache.delete(page);
                this._mountedFunctionCache.delete(page);
            }
        });
        return;
    }

    private getRemoteFunctionHandle(page: Page, localFunction: AnyFunction) {
        return this._mountedFunctionCache.has(page) && this._mountedFunctionCache.get(page)!.get(localFunction);
    }
}

function getIdString(identity: Identity): string {
    return `${identity.uuid}/${identity.name}`;
}
