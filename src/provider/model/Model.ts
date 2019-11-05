import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Application, AppName} from '../../client/directory';
import {Inject} from '../common/Injectables';
import {ChannelId, DEFAULT_CHANNEL_ID, AppIntent} from '../../client/main';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic} from '../../client/internal';
import {SYSTEM_CHANNELS, Timeouts} from '../constants';
import {withStrictTimeout, untilTrue, allowReject, untilSignal, asyncFilter} from '../utils/async';
import {Boxed} from '../utils/types';
import {getId} from '../utils/getId';
import {DeferredPromise} from '../common/DeferredPromise';

import {LiveApp} from './LiveApp';
import {AppWindow} from './AppWindow';
import {ContextChannel, DefaultContextChannel, SystemContextChannel} from './ContextChannel';
import {Environment, EntityType} from './Environment';
import {AppDirectory} from './AppDirectory';

interface ExpectedWindow {
    // Resolves when the window has been created by the environment. Resolves to the `registered` promise wrapped in a timeout
    created: Promise<Boxed<Promise<AppWindow>>>;

    // Resolves when the window has connected to FDC3
    connected: Promise<void>;

    // Resolves to the AppWindow when the window has been fully registered and is ready for use outside the Model
    registered: Promise<AppWindow>;

    // Rejects when the window is closed
    closed: Promise<void>;
}

const EXPECT_TIMEOUT_MESSAGE = 'Timeout on window registration exceeded';
const EXPECT_CLOSED_MESSAGE = 'Window closed before registration completed';

@injectable()
export class Model {
    public readonly onWindowAdded: Signal<[AppWindow]> = new Signal();
    public readonly onWindowRemoved: Signal<[AppWindow]> = new Signal();

    private readonly _directory: AppDirectory;
    private readonly _environment: Environment;
    private readonly _apiHandler: APIHandler<APIFromClientTopic>;

    private readonly _liveAppsByUuid: {[id: string]: LiveApp};
    private readonly _windowsById: {[id: string]: AppWindow};
    private readonly _channelsById: {[id: string]: ContextChannel};
    private readonly _expectedWindowsById: {[id: string]: ExpectedWindow};

    private readonly _onWindowRegisteredInternal: Signal<[AppWindow]> = new Signal();

    constructor(
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.ENVIRONMENT) environment: Environment,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>
    ) {
        this._liveAppsByUuid = {};
        this._windowsById = {};
        this._channelsById = {};
        this._expectedWindowsById = {};

        this._directory = directory;
        this._environment = environment;
        this._apiHandler = apiHandler;

        this._environment.applicationCreated.add(this.onApplicationCreated, this);
        this._environment.applicationClosed.add(this.onApplicationClosed, this);

        this._environment.windowCreated.add(this.onWindowCreated, this);
        this._environment.windowClosed.add(this.onWindowClosed, this);

        this._apiHandler.onConnection.add(this.onApiHandlerConnection, this);
        this._apiHandler.onDisconnection.add(this.onApiHandlerDisconnection, this);

        this._channelsById[DEFAULT_CHANNEL_ID] = new DefaultContextChannel(DEFAULT_CHANNEL_ID);
        for (const channel of SYSTEM_CHANNELS) {
            this._channelsById[channel.id] = new SystemContextChannel(channel.id, channel.visualIdentity);
        }
    }

    public get apps(): LiveApp[] {
        return Object.values(this._liveAppsByUuid);
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
            const expectedWindow = this.getOrCreateExpectedWindow(identity);

            // Allow a short time between the `expectWindow` call and the window being created
            const createdWithinTimeout = withStrictTimeout(Timeouts.WINDOW_EXPECT_TO_CREATED, expectedWindow.created, EXPECT_TIMEOUT_MESSAGE);

            const registeredWithinTimeout = (await createdWithinTimeout).value;
            const appWindow = await registeredWithinTimeout;

            return appWindow;
        }
    }

    /**
     * Returns all registered windows for an app satisfying our predicate, waiting for at least one window or until the app is mature
     */
    public async expectWindowsForApp(
        appInfo: Application,
        windowReadyNow: (window: AppWindow) => boolean,
        waitForWindowReady: (window: AppWindow) => Promise<void>
    ): Promise<AppWindow[]> {
        const uuid = AppDirectory.getUuidFromApp(appInfo);
        const windows = this._liveAppsByUuid[uuid] ? this._liveAppsByUuid[uuid].windows : [];

        const result: AppWindow[] = windows.filter(windowReadyNow);

        if (result.length > 0) {
            // If we have any windows that immediately satisfy our predicate, return those
            return result;
        } else {
            // Otherwise, wait until we have a single window that satisfies our predicate
            const deferredPromise = new DeferredPromise<AppWindow>();

            // Apply the async predicate to any incoming windows
            const slot = this._onWindowRegisteredInternal.add((window) => {
                if (window.appInfo.appId === appInfo.appId) {
                    waitForWindowReady(window).then(() => deferredPromise.resolve(window), () => {});
                }
            });

            // Apply the async predicate to any existing windows
            for (const window of windows) {
                waitForWindowReady(window).then(() => deferredPromise.resolve(window), () => {});
            }

            // Return a window once we have one, or timeout when the application is mature
            return Promise.race([
                deferredPromise.promise.then((window) => [window]),
                this.getOrCreateLiveApp(appInfo).then((liveApp) => liveApp.waitForAppMature().then(() => [], () => []))
            ]).then((window) => {
                slot.remove();
                return window;
            });
        }
    }

    public async getOrCreateLiveApp(appInfo: Application): Promise<LiveApp> {
        const uuid = AppDirectory.getUuidFromApp(appInfo);

        if (this._liveAppsByUuid[uuid]) {
            return this._liveAppsByUuid[uuid];
        } else {
            const deferredPromise = new DeferredPromise<LiveApp>();

            const slot = this._environment.applicationCreated.add((identity: Identity, liveApp: LiveApp) => {
                if (identity.uuid === uuid) {
                    slot.remove();
                    deferredPromise.resolve(liveApp);
                }
            });

            this._environment.createApplication(appInfo);

            return deferredPromise.promise;
        }
    }

    public getChannel(id: ChannelId): ContextChannel|null {
        return this._channelsById[id] || null;
    }

    public setChannel(channel: ContextChannel): void {
        this._channelsById[channel.id] = channel;
    }

    /**
     * Get apps that can handle an intent and optionally with specified context type
     *
     * Includes windows that are not in the app directory but have registered a listener for it if contextType is not specified
     * @param intentType The intent type we want to find supporting apps for
     * @param contextType The optional context type that we want apps to support with the given intent
     */
    public async getApplicationsForIntent(intentType: string, contextType?: string): Promise<Application[]> {
        // Get all live apps that support the given intent and context
        const liveApps = Object.values(this._liveAppsByUuid);

        const liveAppsForIntent = (await asyncFilter(liveApps, async (liveApp: LiveApp) => {
            const {appInfo, windows} = liveApp;

            const hasIntentListener = windows.some((window) => window.hasIntentListener(intentType));

            return hasIntentListener && appInfo !== undefined && AppDirectory.mightAppSupportIntent(appInfo, intentType, contextType);
        })).map((liveApp) => liveApp.appInfo!);

        // Get all directory apps that support the given intent and context
        const directoryApps = await asyncFilter(await this._directory.getAllApps(), async (app) => {
            const uuid = AppDirectory.getUuidFromApp(app);
            const liveApp: LiveApp | undefined = this._liveAppsByUuid[uuid];

            if (liveApp && liveApp.mature) {
                return false;
            }

            if (liveAppsForIntent.find((testLiveApp) => testLiveApp.appId === app.appId)) {
                return false;
            }

            return true;
        });

        const directoryAppsForIntent = directoryApps.filter((app) => AppDirectory.shouldAppSupportIntent(app, intentType, contextType));

        // Return apps in consistent order
        return [...liveAppsForIntent, ...directoryAppsForIntent].sort((a, b) => this.compareAppsForIntent(a, b, intentType, contextType));
    }

    /**
     * Get information about intents that can handle a given contexts, and the apps that can handle that intent with that context. Result
     * will be consistent with `getApplicationsForIntent`
     *
     * @param contextType The optional context type that we want to find intents to handle
     */
    public async getAppIntentsByContext(contextType: string): Promise<AppIntent[]> {
        const appIntentsBuilder = new AppIntentsBuilder();

        // Populate appIntentsBuilder from running apps
        this.windows.forEach((window) => {
            const intentTypes = window.intentListeners;
            const app = window.appInfo;

            intentTypes.filter((intentType) => AppDirectory.mightAppSupportIntent(app, intentType, contextType)).forEach((intentType) => {
                appIntentsBuilder.addApplicationForIntent(intentType, window.appInfo);
            });
        });

        // Populate appIntentsBuilder from non-mature directory apps
        const directoryApps = await asyncFilter(await this._directory.getAllApps(), async (app) => {
            const uuid = AppDirectory.getUuidFromApp(app);
            const liveApp: LiveApp | undefined = this._liveAppsByUuid[uuid];

            return !(liveApp && liveApp.mature);
        });

        directoryApps.forEach((app) => {
            const intents = app.intents || [];

            intents.filter((intent) => AppDirectory.shouldAppSupportIntent(app, intent.name, contextType)).forEach((intent) => {
                appIntentsBuilder.addApplicationForIntent(intent.name, app);
            });
        });

        // Build app intents
        const appIntents = appIntentsBuilder.build();

        // Normalize result and set display names
        appIntents.forEach((appIntent) => {
            appIntent.apps.sort((a, b) => this.compareAppsForIntent(a, b, appIntent.intent.name, contextType));
            appIntent.intent.displayName = AppDirectory.getIntentDisplayName(appIntent.apps, appIntent.intent.name);
        });

        appIntents.sort((a, b) => a.intent.name.localeCompare(b.intent.name, 'en'));

        return appIntents;
    }

    public findWindowsByAppName(name: AppName): AppWindow[] {
        const liveApp = Object.values(this._liveAppsByUuid).find((testLiveApp) => !!testLiveApp.appInfo && testLiveApp.appInfo.name === name);

        return liveApp ? liveApp.windows : [];
    }

    public async existsAppForName(name: AppName): Promise<boolean> {
        const directoryApp = await this._directory.getAppByName(name);

        if (directoryApp) {
            return true;
        } else {
            return !!this._liveAppsByUuid[name];
        }
    }

    private async onApplicationCreated(identity: Identity, liveApp: LiveApp): Promise<void> {
        const {uuid} = identity;
        this._liveAppsByUuid[uuid] = liveApp;

        await liveApp.waitForAppStarted();

        // Attempt to get appInfo from the app directory, otherwise infer from environment
        const appInfoFromDirectory = await this._directory.getAppByUuid(uuid);
        const appInfo = appInfoFromDirectory || await this._environment.inferApplication(identity);

        liveApp.setAppInfo(appInfo);
    }

    private onApplicationClosed(identity: Identity): void {
        const {uuid} = identity;
        const app = this._liveAppsByUuid[uuid];

        if (app) {
            app.setClosed();
            delete this._liveAppsByUuid[uuid];
        }
    }

    private onWindowCreated(identity: Identity): void {
        const expectedWindow = this.getOrCreateExpectedWindow(identity);

        const {uuid} = identity;
        const liveApp = this._liveAppsByUuid[uuid];

        // Only register windows once they are connected to the service
        allowReject(expectedWindow.connected.then(() => this.registerWindow(liveApp, identity)));
    }

    private onWindowClosed(identity: Identity): void {
        const uuid = identity.uuid;
        const id: string = getId(identity);

        const liveApp: LiveApp | undefined = this._liveAppsByUuid[uuid];
        const window = this._windowsById[id];

        if (window) {
            if (liveApp) {
                liveApp.removeWindow(window);
            }

            delete this._windowsById[id];
            this.onWindowRemoved.emit(window);
        } else if (this._expectedWindowsById[id]) {
            delete this._expectedWindowsById[id];
        }
    }

    private async onApiHandlerConnection(identity: Identity): Promise<void> {
        if (await this._environment.getEntityType(identity) === EntityType.EXTERNAL_CONNECTION) {
            const {uuid} = identity;

            // Any connections to the service from adapters should be immediately registered
            const appInfo = await this._environment.inferApplication(identity);
            const liveApp = new LiveApp(Promise.resolve());

            liveApp.setAppInfo(appInfo);
            this._liveAppsByUuid[uuid] = liveApp;

            await this.registerWindow(liveApp, identity);
        }
    }

    private async onApiHandlerDisconnection(identity: Identity): Promise<void> {
        // Although windows are only registered on connection, we do not unregister on disconnect, so channel membership is preserved on navigation
        // TODO [SERVICE-737] Handle differences in disconnect behaviour between windows and external connections
        const id = getId(identity);

        let appWindow: AppWindow | undefined;
        if (this._windowsById[id]) {
            appWindow = this._windowsById[id];
        } else if (this._expectedWindowsById[id]) {
            appWindow = await this._expectedWindowsById[id].registered.catch(() => undefined);
        }

        if (appWindow) {
            appWindow.removeAllListeners();
        }
    }

    /**
     * Registers an appWindow in the model
     * @param liveApp The app this window should be registered to
     * @param identity Window identity
     */
    private async registerWindow(liveApp: LiveApp, identity: Identity): Promise<void> {
        // Don't register windows for any app until the app's info is known
        await liveApp.waitForAppInfo();

        const id = getId(identity);

        const appWindow = this._environment.wrapWindow(liveApp, identity, this._channelsById[DEFAULT_CHANNEL_ID]);

        console.info(`Registering window ${appWindow.id}`);
        this._windowsById[appWindow.id] = appWindow;
        delete this._expectedWindowsById[id];

        liveApp.addWindow(appWindow);

        this.onWindowAdded.emit(appWindow);
        this._onWindowRegisteredInternal.emit(appWindow);
    }

    private getOrCreateExpectedWindow(identity: Identity): ExpectedWindow {
        const id = getId(identity);

        if (this._expectedWindowsById[id]) {
            return this._expectedWindowsById[id];
        } else {
            // A promise that never resolves but rejects when the window has closed
            const closed = allowReject(untilSignal(this._environment.windowClosed, (testIdentity) => {
                return getId(testIdentity) === id;
            }).then(() => {
                throw new Error(EXPECT_CLOSED_MESSAGE);
            }));

            // Create a promise that resolves once the window has been created
            const created = untilTrue(this._environment.windowCreated, () => {
                return this._environment.isWindowCreated(identity);
            });

            // Create a promise that resolves when the window has connected, or rejects when the window closes
            const connected = untilTrue(this._apiHandler.onConnection, () => {
                return this._apiHandler.isClientConnection(identity);
            }, closed);

            // Create a promise that resolves when the window has registered, or rejects when the window closes
            const registered = allowReject(untilTrue(this._onWindowRegisteredInternal, () => {
                return !!this._windowsById[id];
            }, closed).then(() => {
                return this._windowsById[id];
            }));

            const createdThenRegisteredWithinTimeout = created.then(() => {
                return {value: withStrictTimeout(Timeouts.WINDOW_CREATED_TO_REGISTERED, registered, EXPECT_TIMEOUT_MESSAGE)};
            });

            const expectedWindow: ExpectedWindow = {
                created: createdThenRegisteredWithinTimeout,
                connected,
                registered,
                closed
            };

            this._expectedWindowsById[id] = expectedWindow;

            return expectedWindow;
        }
    }

    private compareAppsForIntent(app1: Application, app2: Application, intentType: string, contextType?: string): number {
        const support1 = AppDirectory.shouldAppSupportIntent(app1, intentType, contextType);
        const support2 = AppDirectory.shouldAppSupportIntent(app2, intentType, contextType);

        if (support1 && !support2) {
            return -1;
        } else if (!support1 && support2) {
            return 1;
        }

        const running1 = this._liveAppsByUuid[AppDirectory.getUuidFromApp(app1)] !== undefined;
        const running2 = this._liveAppsByUuid[AppDirectory.getUuidFromApp(app2)] !== undefined;

        if (running1 && !running2) {
            return -1;
        } else if (!running1 && running2) {
            return 1;
        }

        return (app1.title || app1.name).localeCompare(app2.title || app2.name, 'en');
    }
}

class AppIntentsBuilder {
    private readonly _appsByIntentType: Map<string, Set<Application>> = new Map();

    public addApplicationForIntent(intentType: string, app: Application): void {
        const appsSet = this._appsByIntentType.get(intentType) || new Set<Application>();
        appsSet.add(app);
        this._appsByIntentType.set(intentType, appsSet);
    }

    public build(): AppIntent[] {
        const appIntents = Array.from(this._appsByIntentType.entries()).map((entry) => {
            const [intentType, appSet] = entry;

            return {
                intent: {
                    name: intentType,
                    displayName: intentType
                },
                apps: Array.from(appSet.values())
            };
        });

        return appIntents;
    }
}
