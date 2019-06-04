import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';

import {Application, AppName, AppId} from '../../client/directory';
import {Inject} from '../common/Injectables';
import {Signal0} from '../common/Signal';

import {AppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {Environment} from './Environment';
import {AppDirectory} from './AppDirectory';

export enum FindFilter {
    WITH_CONTEXT_LISTENER,
    WITH_INTENT_LISTENER
}

export interface FindOptions {
    prefer?: FindFilter;
    require?: FindFilter;
}

/**
 * Generates a unique `string` id for a window based on its application's uuid and window name
 * @param identity
 */
export function getId(identity: Identity): string {
    return `${identity.uuid}/${identity.name || identity.uuid}`;
}

@injectable()
export class Model {
    private readonly _directory: AppDirectory;
    private readonly _environment: Environment;

    private readonly _windowsById: {[id: string]: AppWindow};
    private readonly _channels: ContextChannel[];
    private readonly onWindowAdded: Signal0 = new Signal0();

    constructor(
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.ENVIRONMENT) environment: Environment
    ) {
        this._windowsById = {};
        this._channels = [];

        this._directory = directory;
        this._environment = environment;
        this._environment.windowCreated.add(this.onWindowCreated, this);
        this._environment.windowClosed.add(this.onWindowClosed, this);
    }

    public get windows(): ReadonlyArray<AppWindow> {
        return Object.values(this._windowsById);
    }

    public get channels(): ReadonlyArray<ContextChannel> {
        return this._channels;
    }

    public getWindow(identity: Identity): AppWindow|null {
        return this._windowsById[getId(identity)] || null;
    }

    public findWindowByAppId(appId: AppId, options?: FindOptions): AppWindow|null {
        return this.findWindow(appWindow => appWindow.appInfo.appId === appId, options);
    }

    public findWindowByAppName(name: AppName, options?: FindOptions): AppWindow|null {
        return this.findWindow(appWindow => appWindow.appInfo.name === name, options);
    }

    /**
     * Registers an appWindow in the model
     * @param appInfo Application info, either from the app directory, or 'crafted' for a non-registered app
     * @param identity Window identity
     * @param isInAppDirectory boolean indicating whether the app is registered in the app directory
     */
    public registerWindow(appInfo: Application, identity: Identity, isInAppDirectory: boolean): AppWindow {
        const appWindow = this._environment.wrapApplication(appInfo, identity);
        console.info(`Registering window [${isInAppDirectory ? '' : 'NOT '}in app directory] ${appWindow.id}`);
        this._windowsById[appWindow.id] = appWindow;
        this.onWindowAdded.emit();

        return appWindow;
    }

    public async findOrCreate(appInfo: Application, prefer?: FindFilter): Promise<AppWindow> {
        const matchingWindow = this.findWindowByAppId(appInfo.appId, {prefer});

        if (matchingWindow) {
            await matchingWindow.focus();
            return matchingWindow;
        } else {
            const createPromise = this._environment.createApplication(appInfo);
            const signalPromise = new Promise<AppWindow>(resolve => {
                const slot = this.onWindowAdded.add(() => {
                    const matchingWindow = this.findWindowByAppId(appInfo.appId, {prefer});
                    if (matchingWindow) {
                        slot.remove();
                        resolve(matchingWindow);
                    }
                });
            });
            return Promise.all([signalPromise, createPromise]).then(([app])=> app);
        }
    }

    /**
     * Gets apps that can handle an intent
     *
     * Includes windows that are not in the app directory but have registered a listener for it
     * @param intentType intent type
     */
    public async getApplicationsForIntent(intentType: string): Promise<Application[]> {
        const allAppWindows = this.windows;

        // Include appInfos for any appWindows in model that have registered a listener for the intent
        const appsInModelWithIntent = allAppWindows
            .filter(appWindow => appWindow.hasIntentListener(intentType))
            .reduce<Application[]>((apps, appWindow) => {
                if (apps.some(app => app.appId === appWindow.appInfo.appId)) {
                    // AppInfo has already been added by another window on the same app also listening for the same intent
                    return apps;
                }
                return apps.concat([appWindow.appInfo]);
            }, []);

        // Include only directory apps without appWindows in the model, as these take precedence
        const directoryAppsWithIntent = await this._directory.getAppsByIntent(intentType);
        const directoryAppsNotInModel = directoryAppsWithIntent
            .filter(directoryApp => !allAppWindows.some(appWindow => appWindow.appInfo.appId === directoryApp.appId));

        return [...appsInModelWithIntent, ...directoryAppsNotInModel];
    }

    private findWindow(predicate: (appWindow: AppWindow) => boolean, options?: FindOptions): AppWindow|null {
        return this.findWindows(predicate, options)[0] || null;
    }

    private findWindows(predicate: (appWindow: AppWindow) => boolean, options?: FindOptions): AppWindow[] {
        const {prefer, require} = options || {prefer: undefined, require: undefined};
        const windows = this.windows.filter(appWindow => {
            if (!predicate(appWindow)) {
                return false;
            } else if (require !== undefined) {
                return Model.matchesFilter(appWindow, require);
            } else {
                return true;
            }
        });

        if (windows.length > 0 && prefer !== undefined) {
            const preferredWindows = windows.filter(appWindow => Model.matchesFilter(appWindow, prefer));

            if (preferredWindows.length > 0) {
                return preferredWindows;
            }
        }

        return windows;
    }

    private async onWindowCreated(identity: Identity, manifestUrl: string): Promise<void> {
        const apps = await this._directory.getAllApps();
        const appInfoFromDirectory = apps.find(app => app.manifest.startsWith(manifestUrl));

        if (!appInfoFromDirectory) {
            // If the app is not in directory we ignore it. We'll add it to the model if and when it adds its first intent listener
            return;
        }

        const id: string = getId(identity);
        if (this._windowsById[id]) {
            console.info(`Ignoring window created event for ${id} - window was already registered`);
            return;
        }

        this.registerWindow(appInfoFromDirectory, identity, true);
    }

    private onWindowClosed(identity: Identity): void {
        const id: string = getId(identity);
        const window = this._windowsById[id];

        if (window) {
            console.info(`Removing window ${id}`);
            delete this._windowsById[id];
        }
    }

    private static matchesFilter(window: AppWindow, filter: FindFilter): boolean {
        switch (filter) {
            case FindFilter.WITH_CONTEXT_LISTENER:
                return window.contexts.length > 0;
            case FindFilter.WITH_INTENT_LISTENER:
                return window.intentListeners.length > 0;
        }
    }
}
