import {injectable} from 'inversify';
import * as localForage from 'localforage';

import {Application} from '../../client/directory';

enum StorageKeys {
    URL = 'url',
    APPLICATIONS = 'applications'
}


@injectable()
export class AppDirectory {
    private _store: LocalForage;
    private _directory: Application[] = [];
    private _URL!: string;

    public constructor() {
        this._store = localForage.createInstance({
            name: 'FDC3',
            storeName: 'app-directory'
        });
        // Set default values
        this._store.getItem<string>(StorageKeys.URL, (error, value) => {
            this.updateURL(value);
        });
        this._store.getItem<Application[]>(StorageKeys.APPLICATIONS, (error, value) => {
            if (value === null) {
                value = [];
            }
            this.updateDirectory(value);
        });
    }

    /**
     * Update the application directory in memory and storage.
     * @param applications To place into the directory.
     */
    private async updateDirectory(applications: Application[] = []): Promise<void> {
        await this._store.setItem(StorageKeys.APPLICATIONS, applications);
        this._directory = applications;
    }

    /**
     * Update the application directory URL in memory and storage.
     * @param url Directory URL.
     */
    private async updateURL(url: string) {
        await this._store.setItem(StorageKeys.URL, url);
        this._URL = url;
    }

    public async getAppByName(name: string): Promise<Application | null> {
        await this.fetchData().catch(console.error);
        return this._directory.find((app: Application) => {
            return app.name === name;
        }) || null;
    }

    public async getAppsByIntent(intentType: string): Promise<Application[]> {
        await this.fetchData().catch(console.error);
        return this._directory.filter((app: Application) => {
            return app.intents && app.intents.some(intent => intent.name === intentType);
        });
    }

    public async getAllApps(): Promise<Application[]> {
        await this.fetchData().catch(console.error);
        return this._directory;
    }

    private async fetchData(): Promise<void> {
        const storedURL = await localForage.getItem('url');
        // If using the demo app directory in production, return an empty array.
        if (process.env.NODE_ENV === 'production') {
            this.updateDirectory([]);
        } else {
            const URL = 'http://localhost:3923/provider/sample-app-directory.json';
            const response: Response = await fetch(URL);
            if (response.ok) {
                const applications = await response.json();
                this.updateDirectory(applications);
            } else {
                // Do not use stored data if the URL is different that the one stored
                if (storedURL !== this._URL) {
                    this.updateDirectory([]);
                }
                throw new Error('Error fetching app directory: ' + response.statusText);
            }
        }
    }
}
