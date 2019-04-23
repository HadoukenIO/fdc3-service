import {injectable} from 'inversify';

import {Application} from '../../client/directory';

enum StorageKeys {
    URL = 'url',
    APPLICATIONS = 'applications'
}

// Demo development app directory url
const devURL = 'http://localhost:3923/provider/sample-app-directory.json';


@injectable()
export class AppDirectory {
    private _directory: Application[] = [];
    private _URL!: string;

    public constructor() {
        // Set default values
        this._URL = window.localStorage.getItem(StorageKeys.URL) || devURL;
        try {
            const directory = window.localStorage.getItem(StorageKeys.APPLICATIONS) || [];
            this._directory = (typeof directory === 'string') ? JSON.parse(directory) : directory;
        } catch (error) {
            // Clear store
            window.localStorage.removeItem(StorageKeys.APPLICATIONS);
        }
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
     * Update the application directory in memory and storage.
     * @param applications To place into the directory.
     */
    private async updateDirectory(applications: Application[]): Promise<void> {
        window.localStorage.setItem(StorageKeys.APPLICATIONS, JSON.stringify(applications));
        this._directory = applications;
    }

    /**
     * Update the application directory URL in memory and storage.
     * @param url Directory URL.
     */
    private async updateURL(url: string) {
        window.localStorage.setItem(StorageKeys.URL, url);
        this._URL = url;
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
        const storedURL = window.localStorage.getItem(StorageKeys.URL);
        const currentURL = this._URL;
        // Only update the directory if the URL has changed
        // or the directory is empty (the last request may have failed?)
        if (currentURL !== storedURL || this._directory.length === 0) {
            const applications = await this.fetchData(currentURL);
            await this.updateDirectory(applications);
            if (currentURL !== storedURL) {
                await this.updateURL(currentURL);
            }
        }
    }
}
