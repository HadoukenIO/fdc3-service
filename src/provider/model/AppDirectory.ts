import {injectable, inject} from 'inversify';
import {parallelMap} from 'openfin-service-async';
import {Signal} from 'openfin-service-signal';

import {Inject} from '../common/Injectables';
import {Application, AppName, AppDirIntent} from '../../client/directory';
import {AsyncInit} from '../controller/AsyncInit';
import {CustomConfigFields} from '../constants';
import {checkCustomConfigField, deduplicate} from '../utils/helpers';

import {ConfigStoreBinding} from './ConfigStore';
import {AppDirectoryStorage} from './AppDirectoryStorage';

enum StorageKeys {
    DIRECTORY_CACHE = 'fdc3@directoryCache'
}

interface CacheEntry {
    url: string;
    applications: Application[];
}

@injectable()
export class AppDirectory extends AsyncInit {
    /**
     * Test if an app *might* support an intent - i.e., were the app running with the appropriate listener added,
     * should we regard it as supporting this intent (and optionally context)
     */
    public static mightAppSupportIntent(app: Application, intentType: string, contextType?: string): boolean {
        if (contextType === undefined || app.intents === undefined) {
            return true;
        } else {
            const intent = app.intents.find((i) => i.name === intentType);
            return intent === undefined || intentSupportsContext(intent, contextType);
        }
    }

    /**
     * Test if an app *should* support an intent - i.e., were the app running, would we expect it to add a listener for
     * the given intent, and would we then regard it as supporting this intent (and optionally context)
     */
    public static shouldAppSupportIntent(app: Application, intentType: string, contextType?: string): boolean {
        if (app.intents === undefined) {
            return false;
        } else {
            const intent = app.intents.find((i) => i.name === intentType);
            return intent !== undefined && (contextType === undefined || intentSupportsContext(intent, contextType));
        }
    }

    public static getIntentDisplayName(apps: Application[], intentType: string): string {
        for (const app of apps) {
            const intent = app.intents && app.intents.find((i) => i.name === intentType);

            if (intent && intent.displayName !== undefined) {
                return intent.displayName;
            }
        }

        return intentType;
    }

    public static getUuidFromApp(app: Application): string {
        const customValue = checkCustomConfigField(app, CustomConfigFields.OPENFIN_APP_UUID);
        return customValue !== undefined ? customValue : app.appId;
    }

    public readonly directoryChanged: Signal<[]> = new Signal();

    private readonly _appDirectoryStorage: AppDirectoryStorage;
    private readonly _configStore: ConfigStoreBinding;

    private readonly _fetchedUrls: Set<string> = new Set();

    private _directory: Application[] = [];

    public constructor(
        @inject(Inject.APP_DIRECTORY_STORAGE) appDirectoryStorage: AppDirectoryStorage,
        @inject(Inject.CONFIG_STORE) configStore: ConfigStoreBinding
    ) {
        super();

        this._appDirectoryStorage = appDirectoryStorage;
        this._configStore = configStore;
    }

    public getAppByName(name: AppName): Promise<Application | null> {
        return Promise.resolve(this._directory.find((app: Application) => {
            return app.name === name;
        }) || null);
    }

    public getAppByUuid(uuid: string): Promise<Application | null> {
        return Promise.resolve(this._directory.find((app) => AppDirectory.getUuidFromApp(app) === uuid) || null);
    }

    /**
     * Retrieves all of the applications in the Application Directory.
     */
    public getAllApps(): Promise<Application[]> {
        return Promise.resolve(this._directory);
    }

    protected async init(): Promise<void> {
        this._appDirectoryStorage.changed.add(this.onStorageChanged, this);

        await this._configStore.initialized;
        await this.refreshDirectory();
    }

    private async onStorageChanged(): Promise<void> {
        await this.refreshDirectory();

        this.directoryChanged.emit();
    }

    private async refreshDirectory(): Promise<void> {
        const configUrl = this._configStore.config.query({level: 'desktop'}).applicationDirectory;

        const directoryShards = [
            {
                urls: configUrl ? [configUrl] : [],
                applications: []
            },
            ...this._appDirectoryStorage.getStoredDirectoryShards()
        ];

        const remoteDirectorySnippets = await parallelMap(directoryShards, async (shard) => {
            return parallelMap(shard.urls, async (url) => {
                // TODO: URLs will be fetched once per service run. Improve this logic [SERVICE-841]
                const fetchedSnippet = this._fetchedUrls.has(url) ? null : await this.fetchRemoteSnippet(url);
                this._fetchedUrls.add(url);

                if (fetchedSnippet) {
                    this.updateCache(url, fetchedSnippet);
                    return fetchedSnippet;
                } else {
                    return this.fetchCachedSnippet(url) || [];
                }
            });
        });

        const applications: Application[] = [];
        for (let i = 0; i < directoryShards.length; i++) {
            applications.push(...directoryShards[i].applications);

            for (const snippet of remoteDirectorySnippets[i]) {
                applications.push(...snippet);
            }
        }

        // TODO: Further validate app data [SERVICE-822]
        this._directory = deduplicate(applications, (a, b) => {
            return a.name === b.name || a.appId === b.appId || AppDirectory.getUuidFromApp(a) === AppDirectory.getUuidFromApp(b);
        });
    }

    private async fetchRemoteSnippet(url: string): Promise<Application[] | null> {
        const response = await fetch(url).catch(() => {
            console.warn(`Failed to fetch app directory snippet from ${url}`);
        });

        if (response && response.ok) {
            try {
                // TODO: Validate JSON we receive is valid against spec [SERVICE-620]
                const validate = await response.json();
                return validate;
            } catch (error) {
                console.warn(`Received invalid JSON data from ${url}. Ignoring fetch result`);
            }
        }

        return null;
    }

    private fetchCachedSnippet(url: string): Application[] | null {
        const jsonCache = localStorage.getItem(StorageKeys.DIRECTORY_CACHE);

        if (jsonCache) {
            try {
                const cache: CacheEntry[] = JSON.parse(jsonCache);

                for (const cacheEntry of cache) {
                    if (cacheEntry.url === url) {
                        return cacheEntry.applications;
                    }
                }
            } catch (error) {
                // Not likely to get here but figured it's better to safely to handle it.
                console.warn('Invalid JSON retrieved from cache');
            }
        }

        return null;
    }

    /**
     * Updates the URL and Applications in the local storage cache.
     * @param url Directory URL.
     * @param applications Directory Applications.
     */
    private updateCache(url: string, applications: Application[]) {
        const jsonCache = localStorage.getItem(StorageKeys.DIRECTORY_CACHE);

        if (jsonCache) {
            try {
                const cache: CacheEntry[] = JSON.parse(jsonCache);

                for (const cacheEntry of cache) {
                    if (cacheEntry.url === url) {
                        cacheEntry.applications = applications;

                        localStorage.setItem(StorageKeys.DIRECTORY_CACHE, JSON.stringify(cache));
                        return;
                    }
                }

                cache.push({url, applications});
                localStorage.setItem(StorageKeys.DIRECTORY_CACHE, JSON.stringify(cache));
                return;
            } catch (error) {
                // Not likely to get here but figured it's better to safely to handle it.
                console.warn('Invalid JSON retrieved from cache');
            }
        } else {
            localStorage.setItem(StorageKeys.DIRECTORY_CACHE, JSON.stringify([{url, applications}]));
        }
    }
}

function intentSupportsContext(intent: AppDirIntent, contextType: string): boolean {
    return intent.contexts === undefined || intent.contexts.length === 0 || intent.contexts.includes(contextType);
}
