import {injectable} from 'inversify';
import * as localForage from 'localforage';

import {Application} from '../../client/directory';

enum StorageKeys {
    URL = 'url',
    APPLICATIONS = 'applications'
}

// Demo development app directory url
const devURL = 'http://localhost:3923/provider/sample-app-directory.json';


@injectable()
export class AppDirectory {
    private _store: LocalForage;
    private _directory: Application[] = [];
    private _URL!: string;

    public constructor() {
        this._store = localForage.createInstance({
            name: 'FDC3',
            version: 1.0,
            storeName: 'app-directory'
        });
        // Set default values
        this._store.getItem<string>(StorageKeys.URL, (error, value) => {
            // Use dev hardcoded url
            if (value === null) {
                value = devURL;
            }
            this._URL = value;
        });
        this._store.getItem<Application[]>(StorageKeys.APPLICATIONS, (error, value) => {
            if (value === null) {
                value = [];
            }
            this._directory = value;
        });
    }

    /**
     * Update the application directory in memory and storage.
     * @param applications To place into the directory.
     */
    private async updateDirectory(applications: Application[]): Promise<void> {
        await this._store.setItem<Application[]>(StorageKeys.APPLICATIONS, applications);
        this._directory = applications;
    }

    /**
     * Update the application directory URL in memory and storage.
     * @param url Directory URL.
     */
    private async updateURL(url: string) {
        await this._store.setItem<string>(StorageKeys.URL, url);
        this._URL = url;
    }

    public async getAppByName(name: string): Promise<Application | null> {
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

    public async getAllApps(): Promise<Application[]> {
        await this.refreshDirectory();
        return this._directory;
    }

    /**
     * Fetch the AppDirectory.
     * @param url Location of the AppDirectory.
     */
    private async fetchData(url: string): Promise<Application[]> {
        const response: Response = await fetch(url);
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Error fetching app directory: ' + response.statusText);
        }
    }

    /**
     * Refresh the AppDirectory.
     */
    private async refreshDirectory(): Promise<void> {
        // If using the demo app directory in production, set an empty array.
        if (process.env.NODE_ENV === 'production') {
            this.updateDirectory([]);
            return;
        }
        const storedURL = await localForage.getItem<string>('url');
        const currentURL = this._URL;
        // Only update the directory if the URL has changed
        // or the directory is empty (the last request may have failed?)
        if (currentURL !== storedURL || (currentURL === storedURL && this._directory.length === 0)) {
            try {
                const applications = await this.fetchData(currentURL);
                await this.updateDirectory(applications);
                if (currentURL !== storedURL) {
                    await this.updateURL(currentURL);
                }
            } catch (error) {
                // Dont update
                return;
            }
        }
    }
}
