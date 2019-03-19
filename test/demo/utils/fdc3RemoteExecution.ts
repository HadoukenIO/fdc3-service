/**
 * This module contains util functions mirroring those in the client module, but with the
 * additional feature of invoking them on a remote window.
 * 
 * Most of call signatures are identical to the client API, but with an additional "executionTarget"
 * parameter as the first argument.
 * 
 * The Listner classes have been replaced with functions which will create the listeners and when triggered will
 * invoke the provided callback in the test's context (i.e. in node, not the window);
 */

import { Identity } from "openfin/_v2/main";
import { Context, IntentType, IApplication } from "../../../src/client";
import { OFPuppeteerBrowser, TestWindowContext } from "./puppeteer";

const ofBrowser = new OFPuppeteerBrowser(); // Port is had-coded. TODO: make port use some env var.

export async function open(executionTarget: Identity, name: string, context?: Context): Promise<void> {
    return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, name: string, context?: Context): Promise<void> {
        return this.OpenfinFDC3.open(name, context);
    }, name, context);
}

export async function resolve(executionTarget: Identity, intent: IntentType, context?: Context): Promise<IApplication[]> {
    return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, intent: IntentType, context?: Context): Promise<IApplication[]> {
        return this.OpenfinFDC3.resolve(intent, context);
    }, intent, context);
}

export async function broadcast(executionTarget: Identity, context: Context): Promise<void> {
    return ofBrowser.executeOnWindow(executionTarget, function(this: TestWindowContext, context: Context): Promise<void> {
        return this.OpenfinFDC3.broadcast(context);
    }, context);
}

/**
 * The handler argument can take any invokable object which accepts a single Context argument. 
 * 
 * This uses puppeteer.
 * 
 * 
 */
export async function addContextListener(executionTarget: Identity, handler: (context: Context) => void): Promise<void> {
    await ofBrowser.mountFunctionOnWindow(executionTarget, 'contextCallback', handler);

    return ofBrowser.executeOnWindow(executionTarget, async function(this: TestWindowContext & {contextCallback: typeof handler}): Promise<void> {
        const listener = new this.OpenfinFDC3.ContextListener(this.contextCallback);
        return;
    });
}