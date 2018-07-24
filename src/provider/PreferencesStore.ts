import {IApplication} from '../client/directory';
import * as fdc3 from '../client/index';

/**
 * The type given to application identifiers
 */
type ApplicationID = number;

/**
 * Maps an intent ID to the ID of the user's preferred application for handling that intent.
 */
type IntentPreferences = {
    [intentType: string]: ApplicationID
};

/**
 * This store holds user preferences, and tracks the preferred app for handling each intent.
 *
 * These preferences can be both global and per-application. If both exist, per-application preferences will take
 * priority. This store deals with FDC3 application id's (as found in the app directory), and not OpenFin UUID's.
 *
 * Methods within this class are null-tolerant. Passing null for any UUID/directoryId will result in null being
 * returned.
 *
 * Note that user preferences aren't currently saved to any kind of permanent storage, and so are lost when the
 * service is terminated.
 */
export class PreferencesStore {
    private globalPrefs: IntentPreferences;
    private appIntentPrefs: {[appId: string]: IntentPreferences};

    constructor() {
        this.globalPrefs = {};
        this.appIntentPrefs = {};
    }

    public getPreferredApp(sourceApp: ApplicationID, intent: fdc3.IntentType): ApplicationID|null {
        const appPrefs: IntentPreferences = this.appIntentPrefs[sourceApp];
        return (appPrefs && appPrefs[intent]) || this.globalPrefs[intent] || null;
    }

    public setGlobalPreference(intent: fdc3.IntentType, targetApp: ApplicationID): void {
        this.globalPrefs[intent] = targetApp;
        this.save();
    }

    public clearGlobalPreference(intent: fdc3.IntentType): void {
        delete this.globalPrefs[intent];
        this.save();
    }

    public setAppPreference(sourceApp: ApplicationID, intent: fdc3.IntentType, targetApp: ApplicationID): void {
        let appPrefs: IntentPreferences = this.appIntentPrefs[sourceApp];

        if (!appPrefs) {
            appPrefs = {};
            this.appIntentPrefs[sourceApp] = appPrefs;
        }

        appPrefs[intent] = targetApp;
        this.save();
    }

    public clearAppPreference(sourceApp: ApplicationID, intent: fdc3.IntentType): void {
        const appPrefs: IntentPreferences = this.appIntentPrefs[sourceApp];

        if (appPrefs) {
            delete appPrefs[sourceApp];
            this.save();
        }
    }

    private save(): void {
        // TODO...
    }
}
