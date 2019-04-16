import {injectable} from 'inversify';

import {Application} from '../../client/directory';

@injectable()
export class AppDirectory {
    private _directory!: Application[];

    public async getAppByName(name: string): Promise<Application|null> {
        await this.fetchData();
        return this._directory.find((app: Application) => {
            return app.name === name;
        }) || null;
    }

    public async getAppsByIntent(intentType: string): Promise<Application[]> {
        await this.fetchData();
        return this._directory.filter((app: Application) => {
            return app.intents && app.intents.some(intent => intent.name === intentType);
        });
    }

    public async getAllApps(): Promise<Application[]> {
        await this.fetchData();
        return this._directory;
    }

    private async fetchData(): Promise<void> {
        if (!this._directory) {
            // If using the demo app directory in production, return an empty array.
            if (process.env.NODE_ENV === 'production') {
                this._directory = [];
            } else {
                const response: Response = await fetch('http://localhost:3923/provider/sample-app-directory.json');
                if (response.ok) {
                    this._directory = await response.json();
                } else {
                    throw new Error('Error fetching app directory: ' + response.statusText);
                }
            }
        }
    }
}
