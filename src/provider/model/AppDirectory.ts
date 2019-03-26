import {Application} from "../../client/directory";
import {injectable} from 'inversify';

@injectable()
export class AppDirectory {
    private _directory: Application[] = require('../../../res/provider/app-directory.json');

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
