import {injectable, inject} from 'inversify';

import {Inject} from '../common/Injectables';
import {Application, AppName, AppDirIntent} from '../../client/directory';
import {AsyncInit} from '../controller/AsyncInit';
import {CustomConfigFields} from '../constants';
import {checkCustomConfigField} from '../utils/helpers';

import {ConfigStoreBinding} from './ConfigStore';

enum StorageKeys {
    URL = 'fdc3@url',
    APPLICATIONS = 'fdc3@applications'
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

    private readonly _configStore: ConfigStoreBinding;
    private _directory: Application[] = [];
    private _url!: string;

    public constructor(@inject(Inject.CONFIG_STORE) configStore: ConfigStoreBinding) {
        super();

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
        await this._configStore.initialized;
        await this.initializeDirectoryData();
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

function intentSupportsContext(intent: AppDirIntent, contextType: string): boolean {
    return intent.contexts === undefined || intent.contexts.length === 0 || intent.contexts.includes(contextType);
}
