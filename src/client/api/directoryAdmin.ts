/**
 * Placeholder
 *
 * @module DirectoryAdmin
 */

import deepEqual from 'deep-equal';

import {Application, AppName} from '../types/directory';

// TODO: Remove once Storage API is in published runtime and types are updated [SERVICE-840]
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace fin {
    const Storage: any;
    // eslint-disable-next-line no-shadow
    const Application: any;
}

/**
 * Placeholder
 */
export type UpdateAppDirectoryMigrationHandler = (directory: AppDirectory) => void | Promise<void>;

/**
 * Placeholder
 */
export interface UpdateAppDirectoryOptions {
    namespace?: string;
    sourceVersionRange?: [number, number];
    destinationVersion?: number;
}

/**
 * Placeholder
 */
export interface AppDirectory {
    sourceVersion: number;

    remoteSnippets: RemoteSnippetsDirectoryCollection;
    storedApplications: StoredApplicationDirectoryCollection;

    setVersion: (value: number) => void;
}

/**
 * Placeholder
 */
export interface DirectoryCollection<T, U = T> {

    /**
     * Placeholder
     */
    readonly source: ReadonlyArray<T>;

    /**
     * Placeholder
     */
    add: (arg: T | T[]) => void;

    /**
     * Placeholder
     */
    remove: (arg: T | T[] | U | U[]) => void;

    /**
     * Placeholder
     */
    removeAll: () => void;

    /**
     * Placeholder
     */
    set: (arg: T | T[]) => void;
}

/**
 * Placeholder
 */
export interface RemoteSnippetsDirectoryCollection extends DirectoryCollection<string, string> {

}

/**
 * Placeholder
 */
export interface StoredApplicationDirectoryCollection extends DirectoryCollection<Application, string> {
    /**
     * Placeholder
     */
    addSelf: (application?: Partial<Application>) => void;
}

/**
 * @hidden
 */
export interface StoredDirectoryShard {
    version: number;
    remoteSnippets: string[];
    storedApplications: Application[];
}

/**
 * @hidden
 */
export interface StoredDirectoryShardMap {[key: string]: StoredDirectoryShard}

/**
 * @hidden
 */
export const APP_DIRECTORY_STORAGE_TAG: string = 'of-fdc3-service.directory';

/**
 * Placeholder
 *
 * @param migrationHandler Placeholder
 * @param options Placeholder
 */
export async function updateAppDirectory(migrationHandler: UpdateAppDirectoryMigrationHandler, options?: UpdateAppDirectoryOptions): Promise<void> {
    const selfApplication = await getSelfApplication();

    let json: string | undefined;
    let shardMap: StoredDirectoryShardMap;

    do {
        json = await readJson();
        shardMap = json ? await readShardMap(json) : {};

        const namespaceKey = getNamespaceKey(options);
        const shard = shardMap[namespaceKey] || createDefaultShard();

        const remoteSnippets = new RemoteSnippetsDirectoryCollectionImpl(shard.remoteSnippets);
        const storedApplications = new StoredApplicationDirectoryCollectionImpl(shard.storedApplications, selfApplication);

        let version = shard.version;

        const setVersion = (value: number) => {
            version = value;
        };

        await migrationHandler({
            sourceVersion: version,
            remoteSnippets,
            storedApplications,
            setVersion
        });

        const result: StoredDirectoryShard = {
            version,
            remoteSnippets: remoteSnippets.build(),
            storedApplications: storedApplications.build()
        };

        shardMap[namespaceKey] = result;
    } while (!await writeIfUnchanged(shardMap, json));
}

abstract class DirectoryCollectionBase<T, U = T> implements DirectoryCollection<T, U> {
    private readonly _source: ReadonlyArray<T>;
    private _result: T[];

    public get source(): ReadonlyArray<T> {
        return this._source;
    }

    protected constructor(source: T[]) {
        this._source = source;
        this._result = [...source];
    }

    public add(arg: T | T[]): void {
        const values = Array.isArray(arg) ? arg : [arg];

        this._result.push(...values);
    }

    public remove(arg: T | T[] | U | U []): void {
        const values = Array.isArray(arg) ? arg : [arg];

        if (values.length !== 0) {
            if (this.isId(values[1])) {
                const ids = values as U[];

                this._result = this._result.filter((resultItem) => !ids.some((id) => this.doesId(id, resultItem)));
            } else {
                const items = values as T[];

                this._result = this._result.filter((resultItem) => !items.some((item) => this.doesEqual(item, resultItem)));
            }
        }
    }

    public removeAll(): void {
        this._result = [];
    }

    public set(arg: T | T[]): void {
        const values = Array.isArray(arg) ? arg : [arg];

        this._result = [...values];
    }

    public build(): T[] {
        return this._result;
    }

    protected abstract isId(value: T | U): value is U;
    protected abstract doesId(id: U, value: T): boolean;
    protected abstract doesEqual(a: T, b: T): boolean;
}

class RemoteSnippetsDirectoryCollectionImpl extends DirectoryCollectionBase<string> implements RemoteSnippetsDirectoryCollection {
    public constructor(source: string[]) {
        super(source);
    }

    public isId(arg: string): arg is string {
        return true;
    }

    public doesId(id: string, value: string): boolean {
        return id === value;
    }

    public doesEqual(a: string, b: string): boolean {
        return a === b;
    }
}

class StoredApplicationDirectoryCollectionImpl extends DirectoryCollectionBase<Application, AppName> implements StoredApplicationDirectoryCollection {
    private readonly _templateSelf: Application;

    public constructor(source: Application[], templateSelf: Application) {
        super(source);

        this._templateSelf = templateSelf;
    }

    public addSelf(application?: Partial<Application>): void {
        const self = {...this._templateSelf, ...application};

        this.add(self);
    }

    public isId(arg: Application | AppName): arg is AppName {
        return typeof arg === 'string';
    }

    public doesId(id: AppName, value: Application): boolean {
        return value.name === id;
    }

    public doesEqual(a: Application, b: Application): boolean {
        return deepEqual(a, b);
    }
}

async function getSelfApplication(): Promise<Application> {
    const application = fin.Application.wrapSync(fin.Application.me);
    const applicationInfo = await application.getInfo();

    interface OFManifest {
        shortcut?: {name?: string; icon: string};
        // eslint-disable-next-line camelcase
        startup_app: {uuid: string; name?: string; icon?: string};
    }

    const {shortcut, startup_app: startupApp} = applicationInfo.manifest as OFManifest;

    const title = (shortcut && shortcut.name) || startupApp.name || startupApp.uuid;
    const icon = (shortcut && shortcut.icon) || startupApp.icon;

    const self = {
        appId: application.identity.uuid,
        name: application.identity.uuid,
        title,
        icons: icon ? [{icon}] : undefined,
        manifestType: 'openfin',
        manifest: applicationInfo.manifestUrl
    };

    return self;
}

function getNamespaceKey(options?: UpdateAppDirectoryOptions): string {
    return (options && options.namespace) ? `namespace-${options.namespace}` : 'default-namespace';
}

async function readJson(): Promise<string | undefined> {
    let json: string | undefined;

    try {
        // We expect this to throw if no directory shard has been written
        json = await fin.Storage.getItem(APP_DIRECTORY_STORAGE_TAG);
    } catch (e) {
        json = undefined;
    }

    return json;
}

async function readShardMap(json: string): Promise<StoredDirectoryShardMap> {
    return JSON.parse(json) as StoredDirectoryShardMap;
}

function createDefaultShard(): StoredDirectoryShard {
    return {
        version: 0,
        remoteSnippets: [],
        storedApplications: []
    };
}

async function writeIfUnchanged(shardMap: StoredDirectoryShardMap, json: string | undefined): Promise<boolean> {
    let oldJson: string | undefined;

    try {
        // We expect this to throw if no directory shard has been written
        oldJson = await fin.Storage.getItem(APP_DIRECTORY_STORAGE_TAG);
    } catch (e) {
        oldJson = undefined;
    }

    if (oldJson === json) {
        await fin.Storage.setItem(APP_DIRECTORY_STORAGE_TAG, JSON.stringify(shardMap));
        return true;
    } else {
        return false;
    }
}
