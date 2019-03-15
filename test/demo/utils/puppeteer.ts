import * as puppeteer from 'puppeteer';
import {Browser, Page} from 'puppeteer';

const fetch = require('node-fetch');

export const browserPromise = getBrowser();

async function getBrowser(): Promise<Browser> {
    const wsDebuggingURL =(await (await fetch('http://localhost:9222/json/version')).json()).webSocketDebuggerUrl;
    console.log('Browser websocket is ' + wsDebuggingURL, '\n\n');

    const browser: Browser = await puppeteer.connect({browserWSEndpoint:wsDebuggingURL});
    return browser;
}

export async function getPage(title:string): Promise<Page|undefined> {
    const browser = await browserPromise;

    const pages = await browser.pages();
    const titles = await Promise.all(pages.map(p => p.title()));

    const pageIndex = titles.indexOf('test-app');
    if (pageIndex > -1) {
        return pages[pageIndex];
    } else {
        return undefined;
    }
}