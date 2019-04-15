import {injectable} from 'inversify';

import {Application} from '../../client/directory';

@injectable()
export class AppDirectory {
    private _directory: Application[];

    constructor() {
        // If using the demo app directory in production, return an empty array.
        if (process.env.NODE_ENV === 'production') {
            this._directory = [];
        } else {
            this._directory = require('../../../res/provider/sample-app-directory.json');
        }
    }

    public async getAppByName(name: string): Promise<Application|null> {
        return this._directory.find((app: Application) => {
            return app.name === name;
        }) || null;
    }

    public async getAppsByIntent(intentType: string): Promise<Application[]> {
        return this._directory.filter((app: Application) => {
            return app.intents && app.intents.some(intent => intent.name === intentType);
        });
    }

    public async getAllApps(): Promise<Application[]> {
        return this._directory;
    }
}
