import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';

import {Application, AppName, AppId} from '../../client/directory';
import {Inject} from '../common/Injectables';
import {Signal0, Signal1} from '../common/Signal';
import {ChannelId, DEFAULT_CHANNEL_ID} from '../../client/main';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic} from '../../client/internal';
import {DESKTOP_CHANNELS} from '../constants';

import {AppWindow} from './AppWindow';
import {ContextChannel, DefaultContextChannel, DesktopContextChannel} from './ContextChannel';
import {Environment} from './Environment';
import {AppDirectory} from './AppDirectory';

/**
 * Generates a unique `string` id for a window based on its application's uuid and window name
 * @param identity
 */
export function getId(identity: Identity): string {
    return `${identity.uuid}/${identity.name || identity.uuid}`;
}

@injectable()
export class Model {
    public readonly onWindowAdded: Signal1<AppWindow> = new Signal1<AppWindow>();
    public readonly onWindowRemoved: Signal1<AppWindow> = new Signal1<AppWindow>();

    private readonly _directory: AppDirectory;
    private readonly _environment: Environment;

    private readonly _windowsById: {[id: string]: AppWindow};
    private readonly _channelsById: {[id: string]: ContextChannel};

    private readonly _onWindowRegisteredInternal: Signal0 = new Signal0();

    constructor(
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.ENVIRONMENT) environment: Environment,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>
    ) {
        this._windowsById = {};
        this._channelsById = {};

        this._directory = directory;
        this._environment = environment;
        this._environment.windowCreated.add(this.onWindowCreated, this);
        this._environment.windowClosed.add(this.onWindowClosed, this);

        apiHandler.onConnection.add(this.onApiHandlerConnection, this);

        this._channelsById[DEFAULT_CHANNEL_ID] = new DefaultContextChannel(DEFAULT_CHANNEL_ID);
        for (const channel of DESKTOP_CHANNELS) {
            this._channelsById[channel.id] = new DesktopContextChannel(channel.id, channel.name, channel.color);
        }
    }

    public get windows(): AppWindow[] {
        return Object.values(this._windowsById);
    }

    public get channels(): ContextChannel[] {
        return Object.values(this._channelsById);
    }

    public getWindow(identity: Identity): AppWindow|null {
        return this._windowsById[getId(identity)] || null;
    }

    public getChannel(id: ChannelId): ContextChannel|null {
        return this._channelsById[id] || null;
    }

    public async findOrCreate(appInfo: Application): Promise<AppWindow[]> {
        const matchingWindows = this.findWindowsByAppId(appInfo.appId);

        if (matchingWindows.length > 0) {
            await Promise.all(matchingWindows.map(window => window.focus()));
            return matchingWindows;
        } else {
            const createPromise = this._environment.createApplication(appInfo, this._channelsById[DEFAULT_CHANNEL_ID]);
            const signalPromise = new Promise<AppWindow[]>(resolve => {
                const slot = this._onWindowRegisteredInternal.add(() => {
                    const matchingWindows = this.findWindowsByAppId(appInfo.appId);
                    if (matchingWindows.length > 0) {
                        slot.remove();
                        resolve(matchingWindows);
                    }
                });
            });
            return Promise.all([signalPromise, createPromise]).then(([windows]) => windows);
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

    public findWindowsByAppName(name: AppName): AppWindow[] {
        return this.findWindows(appWindow => appWindow.appInfo.name === name);
    }

    private async onWindowCreated(identity: Identity, manifestUrl: string): Promise<void> {
        const apps = await this._directory.getAllApps();
        const appInfoFromDirectory = apps.find(app => app.manifest.startsWith(manifestUrl));

        if (!appInfoFromDirectory) {
            // If the app is not in directory we ignore it. We'll add it to the model if and when it connects to FDC3
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

            this.onWindowRemoved.emit(window);
        }
    }

    private async onApiHandlerConnection(identity: Identity): Promise<void> {
        const appWindow = this.getWindow(identity);

        // Window is not in model - this should mean that the app is not in the directory, as directory apps are immediately added to model upon window creation
        if (!appWindow) {
            let appInfo: Application;

            // Attempt to copy appInfo from another appWindow in the model from the same app
            const appWindowsFromSameApp = this.findWindowsByAppId(identity.uuid);
            if (appWindowsFromSameApp.length > 0) {
                appInfo = appWindowsFromSameApp[0].appInfo;
            } else {
                // There are no appWindows in the model with the same app uuid - Produce minimal appInfo from window information
                // TODO: Think about this race condition - for a brief period a window can be connected but not in the model
                appInfo = await this.getApplicationInfo(identity);
            }

            this.registerWindow(appInfo, identity, false);
        }
    }

    /**
     * Registers an appWindow in the model
     * @param appInfo Application info, either from the app directory, or 'crafted' for a non-registered app
     * @param identity Window identity
     * @param isInAppDirectory boolean indicating whether the app is registered in the app directory
     */
    private registerWindow(appInfo: Application, identity: Identity, isInAppDirectory: boolean): AppWindow {
        const appWindow = this._environment.wrapApplication(appInfo, identity, this._channelsById[DEFAULT_CHANNEL_ID]);

        console.info(`Registering window [${isInAppDirectory ? '' : 'NOT '}in app directory] ${appWindow.id}`);
        this._windowsById[appWindow.id] = appWindow;
        this._onWindowRegisteredInternal.emit();

        this.onWindowAdded.emit(appWindow);

        return appWindow;
    }

    private findWindowsByAppId(appId: AppId): AppWindow[] {
        return this.findWindows(appWindow => appWindow.appInfo.appId === appId);
    }

    private findWindows(predicate: (appWindow: AppWindow) => boolean): AppWindow[] {
        return this.windows.filter(predicate);
    }

    /**
     * Retrieves application info from a window's identity
     * @param identity `Identity` of the window to get the app info from
     */
    private async getApplicationInfo(identity: Identity): Promise<Application> {
        type OFManifest = {
            shortcut?: {name?: string, icon: string},
            startup_app: {uuid: string, name?: string, icon?: string}
        };

        const application = fin.Application.wrapSync(identity);
        const applicationInfo = await application.getInfo();
        const {shortcut, startup_app} = applicationInfo.manifest as OFManifest;

        const title = (shortcut && shortcut.name) || startup_app.name || startup_app.uuid;
        const icon = (shortcut && shortcut.icon) || startup_app.icon;

        const appInfo: Application = {
            appId: application.identity.uuid,
            name: application.identity.uuid,
            title: title,
            icons: icon ? [{icon}] : undefined,
            manifestType: 'openfin',
            manifest: applicationInfo.manifestUrl
        };

        return appInfo;
    }
}
