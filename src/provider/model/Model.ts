import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Application, AppName, AppId} from '../../client/directory';
import {Inject} from '../common/Injectables';
import {ChannelId, DEFAULT_CHANNEL_ID, AppIntent} from '../../client/main';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic} from '../../client/internal';
import {SYSTEM_CHANNELS, Timeouts} from '../constants';
import {withStrictTimeout, untilTrue, allowReject, untilSignal, asyncFilter, asyncMap} from '../utils/async';
import {Boxed} from '../utils/types';
import {getId} from '../utils/getId';

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

interface WindowGroup {
    application: Application;
    windows: AppWindow[]
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

    private readonly _windowsById: {[id: string]: AppWindow};
    private readonly _channelsById: {[id: string]: ContextChannel};
    private readonly _expectedWindowsById: {[id: string]: ExpectedWindow};

    private readonly _onWindowRegisteredInternal = new Signal<[]>();

    constructor(
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.ENVIRONMENT) environment: Environment,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>
    ) {
        this._windowsById = {};
        this._channelsById = {};
        this._expectedWindowsById = {};

        this._directory = directory;
        this._environment = environment;
        this._apiHandler = apiHandler;

        this._environment.windowCreated.add(this.onWindowCreated, this);
        this._environment.windowClosed.add(this.onWindowClosed, this);

        this._apiHandler.onConnection.add(this.onApiHandlerConnection, this);
        this._apiHandler.onDisconnection.add(this.onApiHandlerDisconnection, this);

        this._channelsById[DEFAULT_CHANNEL_ID] = new DefaultContextChannel(DEFAULT_CHANNEL_ID);
        for (const channel of SYSTEM_CHANNELS) {
            this._channelsById[channel.id] = new SystemContextChannel(channel.id, channel.visualIdentity);
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
            const expectedWindow = this.getOrCreateExpectedWindow(identity);

            // Allow a short time between the `expectWindow` call and the window being created
            const createdWithinTimeout = withStrictTimeout(Timeouts.WINDOW_EXPECT_TO_CREATED, expectedWindow.created, EXPECT_TIMEOUT_MESSAGE);

            const registeredWithinTimeout = (await createdWithinTimeout).value;
            const appWindow = await registeredWithinTimeout;

            return appWindow;
        }
    }

    public getChannel(id: ChannelId): ContextChannel|null {
        return this._channelsById[id] || null;
    }

    public setChannel(channel: ContextChannel): void {
        this._channelsById[channel.id] = channel;
    }

    /**
     * Returns all registered windows for an app, waiting for at least one window
     */
    public async expectWindowsForApp(appInfo: Application): Promise<AppWindow[]> {
        // TODO: This dangerous method doesn't give proper timeouts. Will likely be changed extensively/removed when we revisit timeouts [SERVICE-556]
        let matchingWindows = this.findWindowsByAppId(appInfo.appId);

        if (matchingWindows.length === 0) {
            const signalPromise = new Promise<AppWindow[]>(resolve => {
                const slot = this._onWindowRegisteredInternal.add(() => {
                    const matchingWindows = this.findWindowsByAppId(appInfo.appId);
                    if (matchingWindows.length > 0) {
                        slot.remove();
                        resolve(matchingWindows);
                    }
                });
            });
            matchingWindows = await signalPromise;
        }
        return matchingWindows;
    }

    public async ensureRunning(appInfo: Application): Promise<void> {
        if (this.findWindowsByAppId(appInfo.appId).length === 0 && !(await this._environment.isRunning(appInfo))) {
            await this._environment.createApplication(appInfo, this._channelsById[DEFAULT_CHANNEL_ID]);
        }
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
        // TODO: Include apps that should add a listener but haven't yet, where the timeout has not expired (may have no registered windows) [SERVICE-556]
        const liveWindowGroups = groupWindowsByApplication(this.windows);

        const liveAppsForIntent = (await asyncFilter(liveWindowGroups, async (group: WindowGroup) => {
            const {application, windows} = group;

            const hasIntentListener = windows.some(window => window.hasIntentListener(intentType));

            return hasIntentListener && AppDirectory.mightAppSupportIntent(application, intentType, contextType);
        })).map(group => group.application);

        // Get all directory apps that support the given intent and context
        const directoryApps = await asyncFilter(await this._directory.getAllApps(), async (app) => !(await this._environment.isRunning(app)));

        const directoryAppsForIntent = directoryApps.filter(app => AppDirectory.shouldAppSupportIntent(app, intentType, contextType));

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
        // TODO: Include apps that should add a listener but haven't yet, where the timeout has not expired (may have no registered windows) [SERVICE-556]
        this.windows.forEach(window => {
            const intentTypes = window.intentListeners;
            const app = window.appInfo;

            intentTypes.filter(intentType => AppDirectory.mightAppSupportIntent(app, intentType, contextType)).forEach(intentType => {
                appIntentsBuilder.addApplicationForIntent(intentType, window.appInfo);
            });
        });

        // Populate appIntentsBuilder from non-running directory apps
        const directoryApps = await asyncFilter(await this._directory.getAllApps(), async (app) => !(await this._environment.isRunning(app)));

        directoryApps.forEach(app => {
            const intents = app.intents || [];

            intents.filter(intent => AppDirectory.shouldAppSupportIntent(app, intent.name, contextType)).forEach(intent => {
                appIntentsBuilder.addApplicationForIntent(intent.name, app);
            });
        });

        // Build app intents
        const appIntents = appIntentsBuilder.build();

        // Return app intents in consistent order
        appIntents.forEach(appIntent => appIntent.apps.sort((a, b) => this.compareAppsForIntent(a, b, name, contextType)));
        appIntents.sort((a, b) => a.intent.name.localeCompare(b.intent.name, 'en'));

        return appIntents;
    }

    public findWindowsByAppName(name: AppName): AppWindow[] {
        return this.findWindows(appWindow => appWindow.appInfo.name === name);
    }

    private onWindowCreated(identity: Identity): void {
        const expectedWindow = this.getOrCreateExpectedWindow(identity);

        // Only register windows once they are connected to the service
        allowReject(expectedWindow.connected.then(async () => {
            // Attempt to copy appInfo from another appWindow in the model from the same app
            let registered = false;
            let appWindowsFromSameApp: AppWindow[];

            allowReject(untilTrue(this._onWindowRegisteredInternal, () => {
                appWindowsFromSameApp = this.findWindowsByAppId(identity.uuid);
                return appWindowsFromSameApp.length > 0;
            }, expectedWindow.closed).then(() => {
                if (!registered) {
                    this.registerWindow(appWindowsFromSameApp[0].appInfo, identity);
                    registered = true;
                }
            }));

            // If we're unable to copy appInfo from another window, attempt to use the app directory, or infer from environment
            const appInfoFromDirectory = await this._directory.getAppByUuid(identity.uuid);

            const appInfo = appInfoFromDirectory || await this._environment.inferApplication(identity);

            if (!registered) {
                this.registerWindow(appInfo, identity);
                registered = true;
            }
        }));
    }

    private onWindowClosed(identity: Identity): void {
        const id: string = getId(identity);
        const window = this._windowsById[id];

        if (window) {
            delete this._windowsById[id];
            this.onWindowRemoved.emit(window);
        } else if (this._expectedWindowsById[id]) {
            delete this._expectedWindowsById[id];
        }
    }

    private async onApiHandlerConnection(identity: Identity): Promise<void> {
        if (await this._environment.getEntityType(identity) === EntityType.EXTERNAL_CONNECTION) {
            // Any connections to the service from adapters should be immediately registered
            // TODO [SERVICE-737] Store the entity type as part of the registration process, so we can correctly handle disconnects
            this.registerWindow(await this._environment.inferApplication(identity), identity);
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
     * @param appInfo Application info, either from the app directory, or 'crafted' for a non-registered app
     * @param identity Window identity
     */
    private registerWindow(appInfo: Application, identity: Identity): AppWindow {
        const id = getId(identity);

        const appWindow = this._environment.wrapApplication(appInfo, identity, this._channelsById[DEFAULT_CHANNEL_ID]);

        console.info(`Registering window ${appWindow.id}`);
        this._windowsById[appWindow.id] = appWindow;
        delete this._expectedWindowsById[id];

        this.onWindowAdded.emit(appWindow);
        this._onWindowRegisteredInternal.emit();

        return appWindow;
    }

    private findWindowsByAppId(appId: AppId): AppWindow[] {
        return this.findWindows(appWindow => appWindow.appInfo.appId === appId);
    }

    private findWindows(predicate: (appWindow: AppWindow) => boolean): AppWindow[] {
        return this.windows.filter(predicate);
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

        const running1 = this._environment.isRunning(app1);
        const running2 = this._environment.isRunning(app2);

        if (running1 && !running2) {
            return -1;
        } else if (!running1 && running2) {
            return 1;
        }

        return (app1.title || app1.name).localeCompare(app2.title || app2.name, 'en');
    }
}

function groupWindowsByApplication(windows: AppWindow[]): WindowGroup[] {
    return windows.reduce((groups: WindowGroup[], appWindow: AppWindow) => {
        const group = groups.find(group => group.application.appId === appWindow.appInfo.appId);
        if (group) {
            group.windows.push(appWindow);
        } else {
            groups.push({application: appWindow.appInfo, windows: [appWindow]});
        }

        return groups;
    }, []);
}

class AppIntentsBuilder {
    private _appsByIntentType: Map<string, Set<Application>> = new Map();

    public addApplicationForIntent(intentType: string, app: Application): void {
        const appsSet = this._appsByIntentType.get(intentType) || new Set<Application>();
        appsSet.add(app);
        this._appsByIntentType.set(intentType, appsSet);
    }

    public build(): AppIntent[] {
        const appIntents = Array.from(this._appsByIntentType.entries()).map((entry) => {
            const [name, appSet] = entry;

            const apps = Array.from(appSet.values());
            const displayName = AppDirectory.getIntentDisplayName(apps, name) || name;

            return {intent: {name, displayName}, apps};
        });

        return appIntents;
    }
}
