import {Identity} from 'openfin/_v2/main';

import {Application, RemoteSnippetsDirectoryCollection, StoredApplicationsDirectoryCollection} from '../../../src/client/main';

import {ofBrowser, handlePuppeteerError} from './fdc3RemoteExecution';
import {TestWindowContext} from './ofPuppeteer';

export class RemoteDirectory {
    private readonly _executionTarget: Identity;
    private readonly _index: number;

    public readonly remoteSnippets: RemoteRemoteSnippetsDirectoryCollection;
    public readonly storedApplications: RemoteStoredApplicationDirectoryCollection;

    public constructor(executionTarget: Identity, index: number) {
        this._executionTarget = executionTarget;
        this._index = index;

        this.remoteSnippets = new RemoteRemoteSnippetsDirectoryCollection(executionTarget, this._index);
        this.storedApplications = new RemoteStoredApplicationDirectoryCollection(executionTarget, this._index);
    }

    public get sourceVersion(): Promise<number> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (this: TestWindowContext, remoteIndex: number): number {
            return this.directories[remoteIndex].sourceVersion;
        }, this._index).catch(handlePuppeteerError);
    }
}

class RemoteDirectoryCollection<
    T extends (RemoteSnippetsDirectoryCollection & {type: 'remoteSnippets'}) | (StoredApplicationsDirectoryCollection & {type: 'storedApplications'})
> {
    protected readonly _executionTarget: Identity;
    protected readonly _index: number;

    private readonly _aspect: T['type'];

    public constructor(executionTarget: Identity, index: number, aspect: T['type']) {
        this._executionTarget = executionTarget;
        this._index = index;
        this._aspect = aspect;
    }

    public get source(): Promise<T['source']> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteIndex: number,
            remoteAspect: T['type']
        ): T['source'] {
            return this.directories[remoteIndex][remoteAspect].source as T['source'];
        }, this._index, this._aspect).catch(handlePuppeteerError);
    }

    public async add(arg: Parameters<T['add']>[0]): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteIndex: number,
            remoteAspect: T['type'],
            remoteArg: Parameters<T['add']>[0]
        ): void {
            this.directories[remoteIndex][remoteAspect].add(remoteArg as any);
        }, this._index, this._aspect, arg).catch(handlePuppeteerError);
    }

    public async set(arg: Parameters<T['set']>[0]): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteIndex: number,
            remoteAspect: T['type'],
            remoteArg: Parameters<T['set']>[0]
        ): void {
            this.directories[remoteIndex][remoteAspect].set(remoteArg as any);
        }, this._index, this._aspect, arg).catch(handlePuppeteerError);
    }

    public async remove(arg: Parameters<T['remove']>[0]): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteIndex: number,
            remoteAspect: T['type'],
            remoteArg: Parameters<T['remove']>[0]
        ): void {
            this.directories[remoteIndex][remoteAspect].remove(remoteArg as any);
        }, this._index, this._aspect, arg).catch(handlePuppeteerError);
    }

    public async removeAll(): Promise<void> {
        return ofBrowser.executeOnWindow(this._executionTarget, function (
            this: TestWindowContext,
            remoteIndex: number,
            remoteAspect: T['type']
        ): void {
            this.directories[remoteIndex][remoteAspect].removeAll();
        }, this._index, this._aspect).catch(handlePuppeteerError);
    }
}

class RemoteRemoteSnippetsDirectoryCollection extends RemoteDirectoryCollection<RemoteSnippetsDirectoryCollection & {type: 'remoteSnippets'}> {
    public constructor(executionTarget: Identity, index: number) {
        super(executionTarget, index, 'remoteSnippets');
    }
}

class RemoteStoredApplicationDirectoryCollection extends RemoteDirectoryCollection<StoredApplicationsDirectoryCollection & {type: 'storedApplications'}> {
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
