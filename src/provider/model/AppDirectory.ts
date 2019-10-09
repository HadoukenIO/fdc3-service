import {injectable, inject} from 'inversify';

import {Inject} from '../common/Injectables';
import {Application, AppName, Intent} from '../../client/directory';
import {AppIntent} from '../../client/main';
import {AsyncInit} from '../controller/AsyncInit';

import {ConfigStoreBinding} from './ConfigStore';

enum StorageKeys {
    URL = 'fdc3@url',
    APPLICATIONS = 'fdc3@applications'
}

@injectable()
export class AppDirectory extends AsyncInit {
    /**
     * Test if an app *might* support an intent - i.e., were the app is running and had the appropriate listener added,
     * should we regard it as supporting this intent (and optionally context)
     */
    public static mightAppSupportIntent(app: Application, intentType: string, contextType?: string): boolean {
        if (contextType === undefined || app.intents === undefined) {
            return true;
        } else {
            const intent = app.intents.find(intent => intent.name === intentType);
            return intent === undefined || AppDirectory.intentSupportsContext(intent, contextType);
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
            const intent = app.intents.find(intent => intent.name === intentType);
            return intent !== undefined && (contextType === undefined || AppDirectory.intentSupportsContext(intent, contextType));
        }
    }

    private static intentSupportsContext(intent: Intent, contextType: string): boolean {
        return intent.contexts === undefined || intent.contexts.length === 0 || intent.contexts.includes(contextType);
    }

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

    public async getAllAppsThatShouldSupportIntent(intentType: string, contextType?: string): Promise<Application[]> {
        return this._directory.filter(app => AppDirectory.shouldAppSupportIntent(app, intentType, contextType));
    }

    /**
     * Retrieves all of the applications in the Application Directory.
     */
    public async getAllApps(): Promise<Application[]> {
        return this._directory;
    }

    private async initializeDirectoryData(): Promise<void> {
        this._url = this._configStore.config.query({level: 'desktop'}).applicationDirectory;
        const fetchedData = await this.fetchOnlineData(this._url);
        const cachedData = this.fetchCacheData();

        if (fetchedData) {
            this.updateCache(this._url, fetchedData);
        }

        this._directory = fetchedData || cachedData || [];
    }

    private async fetchOnlineData(url: string): Promise<Application[]|null> {
        const response = await fetch(url).catch(() => {
            console.warn(`Failed to fetch app directory @ ${url}`);
        });

        if (response && response.ok) {
            try {
                // TODO SERVICE-620 validate JSON we receive is valid against spec
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
     * Updates the URL and Applications in the local storage cache.
     * @param url Directory URL.
     * @param applications Directory Applications.
     */
    private updateCache(url: string, applications: Application[]) {
        localStorage.setItem(StorageKeys.URL, url);
        localStorage.setItem(StorageKeys.APPLICATIONS, JSON.stringify(applications));
    }
}
