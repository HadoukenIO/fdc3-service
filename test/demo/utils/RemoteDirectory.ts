import {Identity} from 'openfin/_v2/main';

import {Application} from '../../../src/client/main';

import {ofBrowser, handlePuppeteerError} from './fdc3RemoteExecution';
import {TestWindowContext} from './ofPuppeteer';

export class RemoteDirectory {
    private readonly _executionTarget: Identity;
    private readonly _id: string;

    public readonly remoteSnippets: RemoteDirectoryCollection<string>;
    public readonly storedApplications: RemoteDirectoryCollection<Application>;

    public constructor(executionTarget: Identity, id: string) {
        this._executionTarget = executionTarget;
        this._id = id;

        this.remoteSnippets = new RemoteDirectoryCollection(executionTarget, this._id, 'remoteSnippets');
        this.storedApplications = new RemoteDirectoryCollection(executionTarget, this._id, 'storedApplications');
    }

    public get sourceVersion(): Promise<number> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (this: TestWindowContext, remoteId: string): number {
            return this.directories[remoteId].sourceVersion;
        }, this._id).catch(handlePuppeteerError);
    }

    public async setVersion(version: number): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (this: TestWindowContext, remoteId: string, remoteVersion: number): void {
            this.directories[remoteId].setVersion(remoteVersion);
        }, this._id, version).catch(handlePuppeteerError);
    }
}

class RemoteDirectoryCollection<T> {
    private readonly _executionTarget: Identity;
    private readonly _id: string;
    private readonly _aspect: 'remoteSnippets' | 'storedApplications';

    public constructor(executionTarget: Identity, id: string, aspect: 'remoteSnippets' | 'storedApplications') {
        this._executionTarget = executionTarget;
        this._id = id;
        this._aspect = aspect;
    }

    public async add(arg: T | T[]): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteId: string,
            remoteAspect: 'remoteSnippets' | 'storedApplications',
            remoteArg: T | T[]
        ): void {
            this.directories[remoteId][remoteAspect].add(remoteArg as any);
        }, this._id, this._aspect, arg).catch(handlePuppeteerError);
    }

    public async set(arg: T | T[]): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteId: string,
            remoteAspect: 'remoteSnippets' | 'storedApplications',
            remoteArg: T | T[]
        ): void {
            this.directories[remoteId][remoteAspect].set(remoteArg as any);
        }, this._id, this._aspect, arg).catch(handlePuppeteerError);
    }

    /* remove: (arg: T | T[] | U | U[]) => void;
    removeAll: () => void;
    set: (arg: T | T[]) => void;*/
}
