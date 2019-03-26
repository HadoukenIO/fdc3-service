import {AppWindow} from "./AppWindow";
import {ContextChannel} from "./ContextChannel";
import {injectable, inject} from "inversify";
import {Application} from "../../client/main";
import {Inject} from "../Injectables";
import {Environment} from "./Environment";
import {Identity} from "openfin/_v2/main";
import {AppDirectory} from "./AppDirectory";

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
    private _environment!: Environment;

    private _windows: AppWindow[];
    private _channels: ContextChannel[];

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

    public findWindow(appInfo: Application, options?: FindOptions): AppWindow|null {
        return this.findWindows(appInfo, options)[0] || null;
    }

    public findWindows(appInfo: Application, options?: FindOptions): AppWindow[] {
        const {prefer, require} = options || {prefer: undefined, require: undefined};
        const windows = this._windows.filter((app: AppWindow) => {
            if (app.appInfo.appId !== appInfo.appId) {
                return false;
            } else if (require !== undefined) {
                return this.matchesFilter(app, require);
            } else {
                return true;
            }
        });

        if (windows.length > 0 && prefer !== undefined) {
            const preferredWindows = windows.filter(app => this.matchesFilter(app, prefer));

            if (preferredWindows.length > 0) {
                return preferredWindows;
            }
        }

        return windows;
    }

    public async findOrCreate(appInfo: Application, options?: FindOptions): Promise<AppWindow> {
        const matchingWindow = this.findWindow(appInfo, options);

        if (matchingWindow) {
            await matchingWindow.focus();
            return matchingWindow;
        } else {
            return this._environment.createApplication(appInfo);
        }
    }

    private async onWindowCreated(identity: Identity, manifestUrl: string): Promise<void> {
        const apps = await this._directory.getAllApps();
        const appInfo = apps.find(app => app.manifest.startsWith(manifestUrl));

        if (appInfo) {
            const id: string = AppWindow.getId(identity);

            if (!this._windows.some(window => window.id === id)) {
                console.info(`Registering window ${id}`);
                this._windows.push(this._environment.wrapApplication(appInfo, identity));
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

    private matchesFilter(window: AppWindow, filter: FindFilter): boolean {
        switch(filter) {
            case FindFilter.WITH_CONTEXT_LISTENER:
                return window.contexts.length > 0;
            case FindFilter.WITH_INTENT_LISTENER:
                return window.intents.length > 0;
        }
    }
}
