import {injectable, inject} from 'inversify';

import {Inject} from '../common/Injectables';
import {Application, AppName} from '../../client/directory';
import {AppIntent} from '../../client/main';
import {AsyncInit} from '../controller/AsyncInit';

import {ConfigStoreBinding} from './ConfigStore';

enum StorageKeys {
    URL = 'fdc3@url',
    APPLICATIONS = 'fdc3@applications'
}

@injectable()
export class AppDirectory extends AsyncInit {
    private readonly _configStore: ConfigStoreBinding;
    private _directory: Application[] = [];
    private _url!: string;

    public constructor(@inject(Inject.CONFIG_STORE) configStore: ConfigStoreBinding) {
        super();

        this._configStore = configStore;
    }

    protected async init(): Promise<void> {
        await this._configStore.initialized;
        await this.initializeDirectoryData();
    }

    public async getAppByName(name: AppName): Promise<Application | null> {
        return this._directory.find((app: Application) => {
            return app.name === name;
        }) || null;
    }

    public async getAppsByIntent(intentType: string): Promise<Application[]> {
        return this._directory.filter((app: Application) => {
            return app.intents && app.intents.some(intent => intent.name === intentType);
        });
    }

    /**
     * Get information about intents that expect contexts of a given type, and the apps that handle those intents
     *
     * Note this only considers directory apps and not "ad hoc" windows, as the latter don't specify context types when adding intent listeners
     * @param contextType type of context to find intents for
     */
    public async getAppIntentsByContext(contextType: string): Promise<AppIntent[]> {
        const appIntentsByName: {[intentName: string]: AppIntent} = {};
        this._directory.forEach((app: Application) => {
            (app.intents || []).forEach(intent => {
                if (intent.contexts && intent.contexts.includes(contextType)) {
                    if (!appIntentsByName[intent.name]) {
                        appIntentsByName[intent.name] = {
                            intent: {
                                name: intent.name,
                                displayName: intent.displayName || intent.name
                            },
                            apps: []
                        };
                    }
                    appIntentsByName[intent.name].apps.push(app);
                }
            });
        });

        Object.values(appIntentsByName).forEach(appIntent => {
            appIntent.apps.sort((a, b) => a.appId.localeCompare(b.appId, 'en'));
        });

        return Object.values(appIntentsByName).sort((a, b) => a.intent.name.localeCompare(b.intent.name, 'en'));
    }

    /**
     * Retrieves all of the applications in the Application Directory.
     */
    public getAllApps(): Application[] {
        return this._directory;
    }

    private async initializeDirectoryData(): Promise<void> {
        this._url = this._configStore.config.query({level: 'desktop'}).applicationDirectory;
        const fetchedData = await this.fetchOnline(this._url);
        const cachedData = this.fetchCacheData();

        if (fetchedData) {
            this.updateUrl(this._url);
            this.updateDirectory(fetchedData);
        } else if (cachedData) {
            this.updateDirectory(cachedData);
        } else {
            this.updateDirectory([]);
        }
    }

    private async fetchOnline(url: string): Promise<Application[]|null> {
        const response = await fetch(url).catch(() => {
            console.warn(`Failed to fetch app directory @ ${url}`);
        });

        if (response && response.ok) {
            try {
                // validate the response is actually JSON
                const validate = await response.json();
                return validate;
            } catch (error) {
                console.warn(`Received invalid JSON data from ${url}. Ignoring fetch result`);
            }
        }

        return null;
    }

    private fetchCacheData(): Application[]|null {
        if (localStorage.getItem(StorageKeys.URL) === this._url) {
            const cache = localStorage.getItem(StorageKeys.APPLICATIONS);

            if (cache) {
                try {
                    const validate = JSON.parse(cache);
                    return validate;
                } catch (error) {
                    // Not likely to get here but figured it's better to safely to handle it.
                    console.warn('Invalid JSON retrieved from cache');
                }
            }
        }

        return null;
    }

    /**
     * Update the application directory in memory and storage.
     * @param applications To place into the directory.
     */
    private updateDirectory(applications: Application[]): void {
        localStorage.setItem(StorageKeys.APPLICATIONS, JSON.stringify(applications));
        this._directory = applications;
    }

    /**
     * Update the application directory URL in memory and storage.
     * @param url Directory URL.
     */
    private updateUrl(url: string): void {
        localStorage.setItem(StorageKeys.URL, url);
        this._url = url;
    }
}
