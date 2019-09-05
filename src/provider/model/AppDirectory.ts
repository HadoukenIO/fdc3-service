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

// Demo development app directory url
export const DEV_APP_DIRECTORY_URL = 'http://localhost:3923/provider/sample-app-directory.json';

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

        this.updateUrl(this._configStore.config.query({level: 'desktop'}).applicationDirectory);
    }

    public async getAppByName(name: AppName): Promise<Application | null> {
        await this.refreshDirectory();
        return this._directory.find((app: Application) => {
            return app.name === name;
        }) || null;
    }

    public async getAppsByIntent(intentType: string): Promise<Application[]> {
        await this.refreshDirectory();
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
        await this.refreshDirectory();
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

    public async getAllApps(): Promise<Application[]> {
        await this.refreshDirectory();

        return this._directory;
    }

    /**
     * Refresh the AppDirectory.
     */
    private async refreshDirectory(): Promise<void> {
        const storedUrl = localStorage.getItem(StorageKeys.URL);
        const currentUrl = this._url;
        const applications = await this.fetchData(currentUrl, storedUrl);
        await this.updateDirectory(applications);
        await this.updateUrl(currentUrl);
    }

    /**
     * Fetch the AppDirectory.
     * @param url Location of the AppDirectory.
     * @param storedUrl Cache url
     */
    private async fetchData(url: string, storedUrl: string | null): Promise<Application[]> {
        const response = await fetch(url).catch(() => {
            console.warn(`Failed to fetch app directory @ ${url}`);
        });

        if (response && response.ok) {
            try {
                // validate the response is actually JSON
                const validate = await response.json();
                return validate;
            } catch (error) {
                console.log(`Received invalid JSON data from ${url}`);
            }
        }

        // Use cached apps if urls match
        if (url === storedUrl) {
            return JSON.parse(localStorage.getItem(StorageKeys.APPLICATIONS) || '[]');
        }

        // Use empty array if urls dont match
        return [];
    }

    /**
     * Update the application directory in memory and storage.
     * @param applications To place into the directory.
     */
    private async updateDirectory(applications: Application[]): Promise<void> {
        localStorage.setItem(StorageKeys.APPLICATIONS, JSON.stringify(applications));
        this._directory = applications;
    }

    /**
     * Update the application directory URL in memory and storage.
     * @param url Directory URL.
     */
    private async updateUrl(url: string) {
        localStorage.setItem(StorageKeys.URL, url);
        this._url = url;
    }
}
