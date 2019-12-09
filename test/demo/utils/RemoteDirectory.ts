import {Identity} from 'openfin/_v2/main';

import {Application} from '../../../src/client/main';

import {ofBrowser, handlePuppeteerError} from './fdc3RemoteExecution';
import {TestWindowContext} from './ofPuppeteer';

export class RemoteDirectory {
    private readonly _executionTarget: Identity;
    private readonly _index: number;

    public readonly remoteSnippets: RemoteDirectoryCollection<string>;
    public readonly storedApplications: RemoteStoredApplicationDirectoryCollection;

    public constructor(executionTarget: Identity, index: number) {
        this._executionTarget = executionTarget;
        this._index = index;

        this.remoteSnippets = new RemoteDirectoryCollection(executionTarget, this._index, 'remoteSnippets');
        this.storedApplications = new RemoteStoredApplicationDirectoryCollection(executionTarget, this._index);
    }

    public get sourceVersion(): Promise<number> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (this: TestWindowContext, remoteIndex: number): number {
            return this.directories[remoteIndex].sourceVersion;
        }, this._index).catch(handlePuppeteerError);
    }
}

class RemoteDirectoryCollection<T, U = T> {
    protected readonly _executionTarget: Identity;
    protected readonly _index: number;

    private readonly _aspect: 'remoteSnippets' | 'storedApplications';

    public constructor(executionTarget: Identity, index: number, aspect: 'remoteSnippets' | 'storedApplications') {
        this._executionTarget = executionTarget;
        this._index = index;
        this._aspect = aspect;
    }

    public get source(): Promise<T[]> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteIndex: number,
            remoteAspect: 'remoteSnippets' | 'storedApplications'
        ): T[] {
            return this.directories[remoteIndex][remoteAspect].source as any;
        }, this._index, this._aspect).catch(handlePuppeteerError);
    }

    public async add(arg: T | T[]): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteIndex: number,
            remoteAspect: 'remoteSnippets' | 'storedApplications',
            remoteArg: T | T[]
        ): void {
            this.directories[remoteIndex][remoteAspect].add(remoteArg as any);
        }, this._index, this._aspect, arg).catch(handlePuppeteerError);
    }

    public async set(arg: T | T[]): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteIndex: number,
            remoteAspect: 'remoteSnippets' | 'storedApplications',
            remoteArg: T | T[]
        ): void {
            this.directories[remoteIndex][remoteAspect].set(remoteArg as any);
        }, this._index, this._aspect, arg).catch(handlePuppeteerError);
    }

    public async remove(arg: T | T[] | U | U[]): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteIndex: number,
            remoteAspect: 'remoteSnippets' | 'storedApplications',
            remoteArg: T | T[] | U | U[]
        ): void {
            this.directories[remoteIndex][remoteAspect].remove(remoteArg as any);
        }, this._index, this._aspect, arg).catch(handlePuppeteerError);
    }

    public async removeAll(): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteIndex: number,
            remoteAspect: 'remoteSnippets' | 'storedApplications'
        ): void {
            this.directories[remoteIndex][remoteAspect].removeAll();
        }, this._index, this._aspect).catch(handlePuppeteerError);
    }
}

class RemoteStoredApplicationDirectoryCollection extends RemoteDirectoryCollection<Application, string> {
    public constructor(executionTarget: Identity, index: number) {
        super(executionTarget, index, 'storedApplications');
    }

    public async addSelf(application?: Partial<Application>): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteIndex: number,
            remoteApplication?: Partial<Application>
        ): void {
            this.directories[remoteIndex].storedApplications.addSelf(remoteApplication);
        }, this._index, application).catch(handlePuppeteerError);
    }
}
