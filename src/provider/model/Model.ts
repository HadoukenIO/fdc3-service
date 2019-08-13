import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Application, AppName, AppId} from '../../client/directory';
import {Inject} from '../common/Injectables';
import {ChannelId, DEFAULT_CHANNEL_ID} from '../../client/main';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic} from '../../client/internal';
import {DESKTOP_CHANNELS} from '../constants';
import {DeferredPromise, withTimeout} from '../utils/async';

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

interface ExpectedWindow {
    pendingDeferredPromise: DeferredPromise<void> | null;
    createdDeferredPromise: DeferredPromise<void>;
    registerDeferredPromise: DeferredPromise<void>;
    windowDeferredPromise: DeferredPromise<AppWindow>;
    status: 'pending' | 'resolved' | 'rejected';
}

@injectable()
export class Model {
    public readonly onWindowAdded: Signal<[AppWindow]> = new Signal();
    public readonly onWindowRemoved: Signal<[AppWindow]> = new Signal();

    private readonly _directory: AppDirectory;
    private readonly _environment: Environment;

    private readonly _windowsById: {[id: string]: AppWindow};
    private readonly _channelsById: {[id: string]: ContextChannel};

    private readonly _onWindowRegisteredInternal = new Signal();

    private readonly _expectedWindows: Map<string, ExpectedWindow> = new Map();

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
        apiHandler.onDisconnection.add(this.onApiHandlerDisconnection, this);

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

    public async expectWindow(identity: Identity): Promise<AppWindow> {
        const id = getId(identity);

        if (this._windowsById[id]) {
            return this._windowsById[id];
        } else {
            let expectedWindow: ExpectedWindow;

            if (this._expectedWindows.has(id)) {
                expectedWindow = this._expectedWindows.get(id)!;
            } else {
                expectedWindow = this.createExpectedWindow('unseen', identity);
            }

            return expectedWindow.windowDeferredPromise.promise;
        }
    }

    public getChannel(id: ChannelId): ContextChannel|null {
        return this._channelsById[id] || null;
    }

    public async findOrCreate(appInfo: Application): Promise<AppWindow[]> {
        const matchingWindows = this.findWindowsByAppId(appInfo.appId);

        if (matchingWindows.length > 0) {
            // Sort windows into the order they were created
            matchingWindows.sort((a: AppWindow, b: AppWindow) => a.appWindowNumber - b.appWindowNumber);

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

    private onWindowPending(identity: Identity): void {
        const id = getId(identity);

        let expectedWindow: ExpectedWindow;
        if (this._expectedWindows.has(id)) {
            expectedWindow = this._expectedWindows.get(id)!;

            if (expectedWindow.status !== 'rejected') {
                expectedWindow.pendingDeferredPromise!.resolve();
            } else {
                this.createExpectedWindow('pending', identity);
            }
        } else {
            this.createExpectedWindow('pending', identity);
        }
    }

    private async onWindowCreated(identity: Identity, manifestUrl: string): Promise<void> {
        const id = getId(identity);

        // Registration is asynchronous and sensitive to race conditions. We use a deferred promise
        // to signal to other sensitive operations that it is safe to proceed.
        const expectedWindow = this._expectedWindows.get(id)!;

        const apps = await this._directory.getAllApps();
        const appInfoFromDirectory = apps.find(app => app.manifest.startsWith(manifestUrl));

        // If the app is not in directory we ignore it. We'll add it to the model if and when it connects to FDC3
        if (appInfoFromDirectory && !this._windowsById[id]) {
            this.registerWindow(appInfoFromDirectory, identity, true);
        } else if (this._windowsById[id]) {
            console.info(`Ignoring window created event for ${id} - window was already registered`);
        }

        // Registration finished, allow any other sensitive operations to proceed
        expectedWindow.createdDeferredPromise.resolve();
    }

    private onWindowClosed(identity: Identity): void {
        const id: string = getId(identity);
        const window = this._windowsById[id];

        if (window) {
            console.info(`Removing window ${id}`);
            delete this._windowsById[id];

            this.onWindowRemoved.emit(window);
        } else if (this._expectedWindows.has(id)) {
            this._expectedWindows.get(id)!.windowDeferredPromise.reject();
            this._expectedWindows.delete(id);
        }
    }

    private async onApiHandlerConnection(identity: Identity): Promise<void> {
        // TODO: What happens if this gets called before pending?

        const id = getId(identity);

        // Wait for windowCreated handler to finish to avoid race conditions that
        // can occur when these two run "concurrently"
        this.expectWindow(identity);
        await this._expectedWindows.get(id)!.createdDeferredPromise;

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
                // TODO: Think about this race condition - for a brief period a window can be connected but not in the model (SERVICE-551)
                appInfo = await this._environment.inferApplication(identity);
            }

            this.registerWindow(appInfo, identity, false);
        }
    }

    private async onApiHandlerDisconnection(identity: Identity): Promise<void> {
        const appWindow = this.getWindow(identity);
        // Remove all listeners but keep in the model
        if (appWindow) {
            appWindow.removeAllListeners();
        }
    }

    /**
     * Registers an appWindow in the model
     * @param appInfo Application info, either from the app directory, or 'crafted' for a non-registered app
     * @param identity Window identity
     * @param isInAppDirectory boolean indicating whether the app is registered in the app directory
     */
    private registerWindow(appInfo: Application, identity: Identity, isInAppDirectory: boolean): AppWindow {
        const id = getId(identity);

        const expectedWindow = this._expectedWindows.get(id)!;

        const appWindow = this._environment.wrapApplication(appInfo, identity, this._channelsById[DEFAULT_CHANNEL_ID]);

        console.info(`Registering window [${isInAppDirectory ? '' : 'NOT '}in app directory] ${appWindow.id}`);
        this._windowsById[appWindow.id] = appWindow;
        this._expectedWindows.delete(id);

        this.onWindowAdded.emit(appWindow);
        this._onWindowRegisteredInternal.emit();

        expectedWindow.registerDeferredPromise.resolve();

        return appWindow;
    }

    private findWindowsByAppId(appId: AppId): AppWindow[] {
        return this.findWindows(appWindow => appWindow.appInfo.appId === appId);
    }

    private findWindows(predicate: (appWindow: AppWindow) => boolean): AppWindow[] {
        return this.windows.filter(predicate);
    }

    private createExpectedWindow(state: 'pending' | 'unseen', identity: Identity): ExpectedWindow {
        const id = getId(identity);

        const pendingDeferredPromise = state === 'pending' ? null : new DeferredPromise();
        const createdDeferredPromise = new DeferredPromise<void>();
        const registerDeferredPromise = new DeferredPromise<void>();
        const windowDeferredPromise = new DeferredPromise<AppWindow>();

        const expectedWindow: ExpectedWindow = {
            pendingDeferredPromise,
            createdDeferredPromise,
            registerDeferredPromise,
            windowDeferredPromise,
            status: 'pending'
        };

        (async () => {
            if (pendingDeferredPromise) {
                await withTimeout(100, pendingDeferredPromise.promise);
            }

            await withTimeout(5000, registerDeferredPromise.promise);

            expectedWindow.status = 'resolved';
            windowDeferredPromise.resolve(this._windowsById[getId(identity)]);
        })().catch(() => {
            expectedWindow.status = 'rejected';
            windowDeferredPromise.reject();
        });

        this._expectedWindows.set(id, expectedWindow);

        return expectedWindow;
    }
}
