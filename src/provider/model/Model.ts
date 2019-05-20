import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';

import {Application} from '../../client/main';
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

@injectable()
export class Model {
    @inject(Inject.APP_DIRECTORY)
    private _directory!: AppDirectory;

    @inject(Inject.ENVIRONMENT)
    private readonly _environment!: Environment;

    private readonly _windows: AppWindow[];
    private readonly _channels: ContextChannel[];
    private readonly onWindowAdded: Signal0 = new Signal0();

    constructor(@inject(Inject.ENVIRONMENT) environment: Environment) {
        this._windows = [];
        this._channels = [];

        environment.windowCreated.add(this.onWindowCreated, this);
        environment.windowClosed.add(this.onWindowClosed, this);
    }

    public get windows(): ReadonlyArray<AppWindow> {
        return this._windows;
    }

    public get channels(): ReadonlyArray<ContextChannel> {
        return this._channels;
    }

    public getWindow(identity: Identity): AppWindow|null {
        return this._windows.find(w => w.id === AppWindow.getId(identity)) || null;
    }

    public findWindow(appInfo: Application, options?: FindOptions): AppWindow|null {
        return this.findWindows(appInfo, options)[0] || null;
    }

    public findWindows(appInfo: Application, options?: FindOptions): AppWindow[] {
        const {prefer, require} = options || {prefer: undefined, require: undefined};
        const windows = this._windows.filter(appWindow => {
            if (appWindow.appInfo.appId !== appInfo.appId) {
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

    public async findOrCreate(appInfo: Application, prefer?: FindFilter): Promise<AppWindow> {
        const matchingWindow = this.findWindow(appInfo, {prefer});

        if (matchingWindow) {
            await matchingWindow.focus();
            return matchingWindow;
        } else {
            const createPromise = this._environment.createApplication(appInfo);
            const signalPromise = new Promise<AppWindow>(resolve => {
                const slot = this.onWindowAdded.add(() => {
                    const matchingWindow = this.findWindow(appInfo, {prefer});
                    if (matchingWindow) {
                        slot.remove();
                        resolve(matchingWindow);
                    }
                });
            });
            return Promise.all([signalPromise, createPromise]).then(([app])=> app);
        }
    }

    private async onWindowCreated(identity: Identity, manifestUrl: string): Promise<void> {
        const apps = await this._directory.getAllApps();
        const appInfo = apps.find(app => app.manifest.startsWith(manifestUrl));

        if (appInfo) {
            const id: string = AppWindow.getId(identity);

            if (!this._windows.some(window => window.id === id)) {
                console.info(`Registering window ${id}`);
                const appWindow = this._environment.wrapApplication(appInfo, identity);
                this._windows.push(appWindow);
                this.onWindowAdded.emit();
            } else {
                console.info(`Ignoring window created event for ${id} - window was already registered`);
            }
        }
    }

    private onWindowClosed(identity: Identity): void {
        const id: string = AppWindow.getId(identity);
        const index = this._windows.findIndex(window => window.id === id);

        if (index >= 0) {
            console.info(`Removing window ${id}`);
            this._windows.splice(index, 1);
        }
    }

    private static matchesFilter(window: AppWindow, filter: FindFilter): boolean {
        switch (filter) {
            case FindFilter.WITH_CONTEXT_LISTENER:
                return window.contexts.length > 0;
            case FindFilter.WITH_INTENT_LISTENER:
                return window.hasAnyIntentListener();
        }
    }
}
