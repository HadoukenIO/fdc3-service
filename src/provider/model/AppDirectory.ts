import {injectable} from 'inversify';

import {Application, AppName} from '../../client/directory';
import {AppIntent} from '../../client/main';

enum StorageKeys {
    URL = 'fdc3@url',
    APPLICATIONS = 'fdc3@applications'
}

// Demo development app directory url
const devUrl = 'http://localhost:3923/provider/sample-app-directory.json';


@injectable()
export class AppDirectory {
    private _directory: Application[] = [];
    private _url!: string;

    public constructor() {
        // Set default values
        this._url = devUrl;
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
        // If using the demo app directory in production, set an empty array.
        if (process.env.NODE_ENV === 'production') {
            await this.updateDirectory([]);
            return;
        }
        const storedUrl = localStorage.getItem(StorageKeys.URL);
        const currentUrl = this._url;
        const applications = await this.fetchData(currentUrl, storedUrl);
        await this.updateDirectory(applications);
        await this.updateURL(currentUrl);
    }

    /**
     * Fetch the AppDirectory.
     * @param url Location of the AppDirectory.
     * @param storedUrl Cache url
     */
    private async fetchData(url: string, storedUrl: string | null): Promise<Application[]> {
        // @ts-ignore
        const response = await global.fetch(url).catch(() => {
            console.warn(`Failed to fetch app directory @ ${url}`);
        });

        if (response && response.ok) {
            return response.json();
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
    private async updateURL(url: string) {
        localStorage.setItem(StorageKeys.URL, url);
        this._url = url;
    }
}
