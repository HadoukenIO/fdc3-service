/**
 * API enabling FDC3 applications to specify an app directory for that application's domain.
 *
 * The FDC3 service builds its app directory by combining each domain-specific app directory provided by individual
 * FDC3 applications. An FDC3 application may only specify a directory for its own domain (defined to be the domain of
 * the file the calling OpenFin window is viewing), and this directory may only provide applications whose manifests
 * live on that domain.
 *
 * The app directory for a domain is specified or updated by calling the [[updateAppDirectory]] with a migration
 * handler callback. This callback will be called with an [[AppDirectory]] object which allows the current (possibly
 * empty) state of the app directory to the read and modified.
 *
 * Where app directories of different names provide applications of conflicting names, appIds, or UUIDs, the service
 * will arbitrarily choose one of the conflicting applications to include and discard the rest.
 *
 * The app directory for a given domain will have an associated version number, which will default to 1 when an app
 * directory is first created. The [[updateAppDirectory]] function allows this version number to be updated and
 * queried, which may be useful to your organization if you have several apps that may be trying to update their
 * domain's app directory in potentially differing and depricated ways. It is up to your organization how you wish to
 * use this feature.
 *
 * Callers of [[updateAppDirectory]] may also specify a namespace, which allows multiple independent app directories to
 * exist on the same domain. This may be useful if your organization has multiple internal groups with applications
 * hosted on the same domain.
 *
 * @module DirectoryAdmin
 */

/**
 * Contains API definitions for updating a domain's app directory shard
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
 * The required signature of the migration handler callback.
 */
export type UpdateAppDirectoryMigrationHandler = (directory: AppDirectory) => void | Promise<void>;

/**
 * Options that may be passed to [[updateAppDirectory]].
 */
export interface UpdateAppDirectoryOptions {
    /**
     * An optional namespace. If exists, must be a non-empty string. If this is specified, that app directory for this
     * namespace on this applications domain will be read and written to be [[updateAppDirectory]].
     */
    namespace?: string;

    /**
     * The maximum app directory version that the migration handler can handle. If exists, must be a positive integer.
     * If this is specified, and the current version of the app directory is greater than this version, the migration
     * handler will not be called.
     */
    maxSourceVersion?: number;

    /**
     * The version of the app directory outputted by the migration handler. If exists, must be a positive integer,
     * and should be greater than or equal to `maxSourceVersion` if that also exists. If this is specified, and the
     * current version of the app directory is greater than this version, the migration handler will not be called. If
     * this is not specied, the version of the app directory will be unchanged.
     */
    destinationVersion?: number;
}

/**
 * Placeholder
 */
export interface AppDirectory {
    sourceVersion: number;

    remoteSnippets: RemoteSnippetsDirectoryCollection;
    storedApplications: StoredApplicationDirectoryCollection;
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

    const namespaceKey = getNamespaceKey(options);

    if (options &&
        options.maxSourceVersion !== undefined &&
        options.destinationVersion !== undefined &&
        options.maxSourceVersion > options.destinationVersion
    ) {
        console.warn(`Update handler outputs version ${options.destinationVersion} but claims to require version \
${options.maxSourceVersion} or lower. \`destinationVersion\` should be greater than or equal to \`maxSourceVersion\``);
    }

    let json: string | undefined;
    let shardMap: StoredDirectoryShardMap;

    do {
        json = await readJson();
        shardMap = json ? await readShardMap(json) : {};

        const shard = shardMap[namespaceKey] || createDefaultShard();

        const remoteSnippets = new RemoteSnippetsDirectoryCollectionImpl(shard.remoteSnippets);
        const storedApplications = new StoredApplicationDirectoryCollectionImpl(shard.storedApplications, selfApplication);

        const version = shard.version;

        if (options && options.maxSourceVersion !== undefined && options.maxSourceVersion < version) {
            console.log(`Stored directory is version ${version}, but update handler requires \
${options.maxSourceVersion} or lower. Skipping directory update.`);
            break;
        }

        if (options && options.destinationVersion !== undefined && options.destinationVersion < version) {
            console.log(`Stored directory is version ${version}, but update handler outputs version \
${options.destinationVersion}. Skipping directory update.`);
            break;
        }

        await migrationHandler({
            sourceVersion: version,
            remoteSnippets,
            storedApplications
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

    private _valid: boolean;

    public get source(): ReadonlyArray<T> {
        return this._source;
    }

    protected constructor(source: T[]) {
        this._source = source;
        this._result = [...source];

        this._valid = true;
    }

    public add(arg: T | T[]): void {
        this.validityCheck();

        const values = Array.isArray(arg) ? arg : [arg];

        this._result.push(...values);
    }

    public remove(arg: T | T[] | U | U []): void {
        this.validityCheck();

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
        this.validityCheck();

        this._result = [];
    }

    public set(arg: T | T[]): void {
        this.validityCheck();

        const values = Array.isArray(arg) ? arg : [arg];

        this._result = [...values];
    }

    public build(): T[] {
        this._valid = false;
        return this._result;
    }

    protected abstract isId(value: T | U): value is U;
    protected abstract doesId(id: U, value: T): boolean;
    protected abstract doesEqual(a: T, b: T): boolean;

    private validityCheck(): void {
        if (!this._valid) {
            throw new Error('Attempting to use `Directory` object outside of update handler');
        }
    }
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

    // TODO: Use latest version of this from develop FinEnvironment
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
