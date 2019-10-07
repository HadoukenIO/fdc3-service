import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Application, AppName, AppId} from '../../client/directory';
import {Inject} from '../common/Injectables';
import {ChannelId, DEFAULT_CHANNEL_ID} from '../../client/main';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic} from '../../client/internal';
import {SYSTEM_CHANNELS, Timeouts} from '../constants';
import {withStrictTimeout, untilTrue, allowReject, untilSignal} from '../utils/async';
import {Boxed} from '../utils/types';

import {AppWindow} from './AppWindow';
import {ContextChannel, DefaultContextChannel, SystemContextChannel} from './ContextChannel';
import {Environment, EntityType} from './Environment';
import {AppDirectory} from './AppDirectory';

interface ExpectedWindow {
    // Resolves when the window has been seen by the environment. Resolves to the `registered` promise wrapped in a timeout
    seen: Promise<Boxed<Promise<AppWindow>>>;

    // Resolves when the window has connected to FDC3
    connected: Promise<void>;

    // Resolves to the AppWindow when the window has been fully registered and is ready for use outside the Model
    registered: Promise<AppWindow>;

    // Rejects when the window is closed
    closed: Promise<void>;
}

const EXPECT_TIMEOUT_MESSAGE = 'Timeout on window registration exceeded';
const EXPECT_CLOSED_MESSAGE = 'Window closed before registration completed';

/**
 * Generates a unique `string` id for a window based on its application's uuid and window name
 * @param identity
 */
export function getId(identity: Identity): string {
    return `${identity.uuid}/${identity.name || identity.uuid}`;
}

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

        this._environment.windowSeen.add(this.onWindowSeen, this);
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

            // Allow a short time between the `expectWindow` call and the window being 'seen'
            const seenWithinTimeout = withStrictTimeout(Timeouts.WINDOW_EXPECT_TO_SEEN, expectedWindow.seen, EXPECT_TIMEOUT_MESSAGE);

            const registeredWithinTimeout = (await seenWithinTimeout).value;
            const appWindow = await registeredWithinTimeout;

            return appWindow;
        }
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

    public getChannel(id: ChannelId): ContextChannel|null {
        return this._channelsById[id] || null;
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
     * @param intentType intent type
     * @param contextType context type
     */
    public async getApplicationsForIntent(intentType: string, contextType?: string): Promise<Application[]> {
        const allAppWindows = this.windows;

        const directoryAppsWithIntent = await this._directory.getAppsByIntent(intentType, contextType);

        // Include appInfos for any appWindows in model that have registered a listener for the intent
        const appsInModelWithIntent = this.extractApplicationsFromWindows(allAppWindows.filter(appWindow => appWindow.hasIntentListener(intentType)));

        // If context is specified don't use apps in model as there's no way to know about the context of non-directory
        // app intents at the moment.
        if (contextType) {
            const appsInModelWithoutIntent = this.extractApplicationsFromWindows(allAppWindows).filter((app) => {
                return !appsInModelWithIntent.some(activeApp => app.appId === activeApp.appId);
            });
            return directoryAppsWithIntent.filter((directoryApp) => {
                return !appsInModelWithoutIntent.some(inactiveApp => directoryApp.appId === inactiveApp.appId);
            });
        } else {
            const directoryAppsNotInModel = directoryAppsWithIntent
                .filter(directoryApp => !allAppWindows.some(appWindow => appWindow.appInfo.appId === directoryApp.appId));

            return [...appsInModelWithIntent, ...directoryAppsNotInModel];
        }
    }

    public findWindowsByAppName(name: AppName): AppWindow[] {
        return this.findWindows(appWindow => appWindow.appInfo.name === name);
    }

    private extractApplicationsFromWindows(windows: AppWindow[]): Application[] {
        return windows.reduce<Application[]>((apps, appWindow) => {
            if (apps.some(app => app.appId === appWindow.appInfo.appId)) {
                // AppInfo has already been added by another window on the same app also listening for the same intent
                return apps;
            }
            return apps.concat([appWindow.appInfo]);
        }, []);
    }

    private onWindowSeen(identity: Identity): void {
        this.getOrCreateExpectedWindow(identity);
    }

    private async onWindowCreated(identity: Identity, manifestUrl: string): Promise<void> {
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
            const appInfoFromDirectory = (await this._directory.getAllApps()).find(app => app.manifest.startsWith(manifestUrl));
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

            // Create a promise that resolves once the window has been seen
            const seen = untilTrue(this._environment.windowSeen, () => {
                return this._environment.isWindowSeen(identity);
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

            const seenThenRegisteredWithinTimeout = seen.then(() => {
                return {value: withStrictTimeout(Timeouts.WINDOW_SEEN_TO_REGISTERED, registered, EXPECT_TIMEOUT_MESSAGE)};
            });

            const expectedWindow: ExpectedWindow = {
                seen: seenThenRegisteredWithinTimeout,
                connected,
                registered,
                closed
            };

            this._expectedWindowsById[id] = expectedWindow;

            return expectedWindow;
        }
    }
}
