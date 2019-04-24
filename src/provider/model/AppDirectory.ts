import {injectable} from 'inversify';

import {Application} from '../../client/directory';
import {AppIntent} from '../../client/main';

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

    public async getAppIntentsByContext(contextType: string): Promise<AppIntent[]> {
        await this.fetchData();
        const appIntentsByName: { [intentName: string]: AppIntent } = {};
        console.log('getAppIntentsByContext', contextType, this._directory);
        this._directory.forEach((app: Application) => {
            (app.intents || []).forEach(intent => {
                if (intent.contexts && intent.contexts.includes(contextType)) {
                    if (appIntentsByName[intent.name]) {
                        appIntentsByName[intent.name].apps.push(app);
                    } else {
                        appIntentsByName[intent.name] = {
                            intent: {
                                name: intent.name,
                                displayName: intent.displayName || intent.name
                            },
                            apps: [app]
                        };
                    }
                }
            });
        });
        console.log('getAppIntentsByContext', appIntentsByName,);
        Object.values(appIntentsByName).forEach(appIntent => {
            appIntent.apps.sort((a, b) => a.appId.localeCompare(b.appId));
        });
        return Object.values(appIntentsByName).sort((a, b) => a.intent.name.localeCompare(b.intent.name));
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
