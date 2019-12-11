/**
 * API enabling FDC3 applications to specify an app directory for that application's domain.
 *
 * The FDC3 service builds its app directory by combining each domain-specific app directory provided by individual
 * FDC3 applications. An FDC3 application may only specify a directory for its own domain (defined to be the domain of
 * the file the calling OpenFin window is viewing), and this directory may only provide applications whose manifests
 * live on that domain.
 *
 * The app directory for a domain is specified or updated by calling the [[updateAppDirectory]] with a migration
 * handler callback provided by the application. This callback will be called with an [[AppDirectory]] object which
 * allows the current (possibly empty) state of the app directory to the read and modified.
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
import {ApplicationOption} from 'openfin/_v2/api/application/applicationOption';

import {Application, AppName} from '../types/directory';
import {sanitizeFunction, sanitizePositiveInteger, sanitizeNonEmptyString, safeStringify, sanitizeApplication} from '../validation';
import {deduplicate} from '../internal';

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
     * An optional namespace. If exists, must be a non-empty string. If this is specified, the app directory for this
     * namespace on this application's domain will be read and written to by [[updateAppDirectory]].
     */
    namespace?: string;

    /**
     * The maximum app directory version that the migration handler can handle. If exists, must be a positive integer.
     * If this is specified, and the current version of the app directory is greater than this version, the migration
     * handler will not be called and the directory will not be modified.
     */
    maxSourceVersion?: number;

    /**
     * The version of the app directory outputted by the migration handler. If exists, must be a positive integer,
     * and should be greater than or equal to `maxSourceVersion` if that also exists. If this is specified, and the
     * current version of the app directory is greater than this version, the migration handler will not be called and
     * the directory will not be modified. If this is not specied, the version of the app directory will be unchanged,
     * or will be set to 1 when creating a new app directory.
     */
    destinationVersion?: number;
}

/**
 * Interface for the object passed to the migration handler, to allow reading and modifying the current app directory.
 * Note that storing this object and attempting to a call function on it beyond the duration of the migration handler
 * will cause an error to be thrown.
 */
export interface AppDirectory {
    /**
     * The current version of the app directory, or 0 if no app directory has yet been created.
     */
    sourceVersion: number;

    /**
     * A [[DirectoryCollection]] object that allows reading and modifying of remote snippets in the current app
     * directory. Remote snippets are URLs that contain a JSON array of [[Application]]s to be included in the app
     * directory. URLs not within the current appliction's domain will be ignored by the service.
     */
    remoteSnippets: RemoteSnippetsDirectoryCollection;

    /**
     * A [[DirectoryCollection]] object that allows reading and modifying of stored applications in the current app
     * directory. Stored applications are [[Application]]s stored locally.
     */
    storedApplications: StoredApplicationsDirectoryCollection;
}

/**
 * Interface for reading and modifying remote snippets and stored applications. Also see
 * [[RemoteSnippetsDirectoryCollection]] and [[StoredApplicationDirectoryCollection]].
 *
 * @typeparam T The type stored by this collection
 * @typeparam U An ID type that may be used to refer to an object stored by this collection
 */
export interface DirectoryCollection<T, U = T> {

    /**
     * Values held by this collection before any modification has occured.
     */
    readonly source: ReadonlyArray<T>;

    /**
     * Adds either a single value or multiple values to this collection. Any duplicate values will be ignored.
     *
     * @param arg The value or array of values to add
     */
    add: (arg: T | T[]) => void;

    /**
     * Removes either a single value or multiple values from this collection. The value or values to be removed may be
     * specified by either a value of type `T` that is deep-equal to the value to be removed, or a value of type `U`
     * that refers to the value to be removed (implementation specific to the implentation of this interface).
     *
     * @param arg The value or array of values, or ID of the value or array of IDs of the values, to remove
     */
    remove: (arg: T | T[] | U | U[]) => void;

    /**
     * Removes all values from this collection.
     */
    removeAll: () => void;

    /**
     * Removes all values from this collection, and then populates it with the value or values provided. Any duplicate
     * values will be ignored.
     *
     * @param arg The value or array of values to populate this collection with
     */
    set: (arg: T | T[]) => void;
}

/**
 * Inteface for reading and modifying remote snippets in the current app directory. Since these are specified as
 * `string`s there is no separate ID type.
 */
export interface RemoteSnippetsDirectoryCollection extends DirectoryCollection<string, string> {

}

/**
 * Interface for reading and modifying stored applications. When removing applications, applications can be refered to
 * by either a complete, deep-equal [[Application]] object, or by the application's [[AppName]].
 */
export interface StoredApplicationsDirectoryCollection extends DirectoryCollection<Application, string> {
    /**
     * Adds the current application to the app directory.
     *
     * @param application A partial [[Application]] of any values that should override those derrived by the service
     * @throws `Error` if the service is unable to determine the manifest URL for this application and it hasn't been
     * given in the `application` parameter.
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
 * Updates the app directory for the current domain/specified namespace, using a migration handler function provided by
 * the application. If no app directory has previously been written, the migration handler will be taken to be updating
 * an 'empty' app directory with version 0.
 *
 * For example, an organization may add its app directory by running the following at startup in its applications:
 *
 * ```ts
 * await updateAppDirectory((directory: AppDirectory) => {
 *     directory.remoteSnippets.set('http://your-domain.com/path-to-app-directory');
 * });
 *
 * ```
 *
 * This assumes your organization's applications host their manifests and HTML on your-domain.com. If the URL of your
 * organization's app directory then changes, you may run the following at your applications' startup:
 *
 * ```ts
 * await updateAppDirectory((directory: AppDirectory) => {
 *     directory.remoteSnippets.set('http://your-domain.com/new-path-to-app-directory', {destinationVersion: 2});
 * });
 *
 * ```
 *
 * The use of `destinationVersion` version ensures any older applications still being run won't be able to overwrite
 * the new app directory URL with the old app directory URL.
 *
 * @param migrationHandler The migration handler function that should perform the update to the app directory for the
 * current domain/specified namespace. This will be called with an [[AppDirectory]] object. Note that depending on
 * `options`, and any other applications attempting to write to the app directory, this function may be called zero,
 * one, or many times
 * @param options An optional [[UpdateAppDirectoryOptions]] object to control the behaviour of the current update
 * @throws `TypeError` if `migrationHandler` is not a function
 * @throws `TypeError` if `options` is not either undefined or an object, or any of its contained values do not meet
 * requirements specified in [[UpdateAppDirectoryOptions]]
 */
export async function updateAppDirectory(migrationHandler: UpdateAppDirectoryMigrationHandler, options?: UpdateAppDirectoryOptions): Promise<void> {
    migrationHandler = sanitizeFunction(migrationHandler);
    options = sanitizeOptions(options);

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
        const storedApplications = new StoredApplicationsDirectoryCollectionImpl(shard.storedApplications, selfApplication);

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
            version: (options && options.destinationVersion !== undefined) ? options.destinationVersion : version === 0 ? 1 : version,
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

        const values = Array.isArray(arg) ? arg.map((item) => this.sanitizeItem(item)) : [this.sanitizeItem(arg)];

        this._result = deduplicate([...this._result, ...values], (a, b) => this.doesEqual(a, b));
    }

    public remove(arg: T | T[] | U | U []): void {
        this.validityCheck();

        const values = Array.isArray(arg) ? arg : [arg];

        if (values.length !== 0) {
            if (this.isId(values[0])) {
                const ids = values as U[];

                this._result = this._result.filter((resultItem) => !ids.some((id) => this.doesId(id, resultItem)));
            } else {
                const items = (values as T[]).map((item) => this.sanitizeItem(item));

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

        const items = Array.isArray(arg) ? arg.map((item) => this.sanitizeItem(item)) : [this.sanitizeItem(arg)];

        this._result = deduplicate([...items], (a, b) => this.doesEqual(a, b));
    }

    public build(): T[] {
        this._valid = false;
        return this._result;
    }

    protected abstract isId(value: T | U): value is U;
    protected abstract doesId(id: U, value: T): boolean;
    protected abstract doesEqual(a: T, b: T): boolean;
    protected abstract sanitizeItem(a: T): T;

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

    public sanitizeItem(item: string): string {
        try {
            return sanitizeNonEmptyString(item);
        } catch (e) {
            throw new TypeError(`${safeStringify(item, 'The provided value')} is not a valid remote snippet URL`);
        }
    }
}

class StoredApplicationsDirectoryCollectionImpl extends DirectoryCollectionBase<Application, AppName> implements StoredApplicationsDirectoryCollection {
    private readonly _templateSelf: Application;

    public constructor(source: Application[], templateSelf: Application) {
        super(source);

        this._templateSelf = templateSelf;
    }

    public addSelf(application?: Partial<Application>): void {
        const self = {...this._templateSelf, ...application};

        if (!self.manifest) {
            throw new Error('Unable to determine manifest for current application and not provided');
        }

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

    public sanitizeItem(item: Application): Application {
        return sanitizeApplication(item);
    }
}

async function getSelfApplication(): Promise<Application> {
    interface OFManifest {
        shortcut?: {name?: string; icon: string};
        // eslint-disable-next-line camelcase
        startup_app: {uuid: string; name?: string; icon?: string};
    }

    const application = fin.Application.wrapSync(fin.Application.me);
    const applicationInfo = await application.getInfo();

    let {name: title, icon} = applicationInfo.initialOptions as ApplicationOption;

    // `manifest` is defined as required property but actually optional. Not present on programmatically-launched apps.
    if (applicationInfo.manifest) {
        const {shortcut, startup_app: startupApp} = applicationInfo.manifest as OFManifest;
        title = (shortcut && shortcut.name) || startupApp.name || startupApp.uuid;
        icon = (shortcut && shortcut.icon) || startupApp.icon;
    }

    return {
        appId: application.identity.uuid,
        name: application.identity.uuid,
        title,
        icons: icon ? [{icon}] : undefined,
        manifestType: 'openfin',
        // `manifestUrl` is defined as required property but actually optional. Not present on programmatically-launched apps.
        manifest: applicationInfo.manifestUrl || ''
    };
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

function sanitizeOptions(options: UpdateAppDirectoryOptions | undefined): UpdateAppDirectoryOptions | undefined {
    if (options === undefined) {
        return options;
    }

    if (options === null || typeof options !== 'object') {
        throw new TypeError(`${safeStringify(options, 'The provided value')} is not a valid UpdateAppDirectoryOptions`);
    }

    try {
        return {
            namespace: options.namespace === undefined ? undefined : sanitizeNonEmptyString(options.namespace),
            maxSourceVersion: options.maxSourceVersion === undefined ? undefined : sanitizePositiveInteger(options.maxSourceVersion),
            destinationVersion: options.destinationVersion === undefined ? undefined : sanitizePositiveInteger(options.destinationVersion)
        };
    } catch (e) {
        throw new TypeError(`${safeStringify(options, 'The provided value')} is not a valid UpdateAppDirectoryOptions. ${e.message}`);
    }
}
