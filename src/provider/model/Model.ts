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
        // Temporary work-around until .NET channel aliases are also applied to 'dispatch' calls, same as they are on channel connection events.
        // Note that 'secondWindow' in .NET demo will not fully work whilst this workaround is in place.
        if (identity.name && identity.name.split('-').length === 5) {
            identity.name = 'mainwin';
        }

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

    private onWindowSeen(identity: Identity): void {
        this.getOrCreateExpectedWindow(identity);
    }

    private async onWindowCreated(identity: Identity, manifestUrl: string): Promise<void> {
        const apps = await this._directory.getAllApps();
        const appInfoFromDirectory = apps.find(app => app.manifest.startsWith(manifestUrl));

        if (appInfoFromDirectory) {
            // If the app is in directory, we register it immediately
            this.registerWindow(appInfoFromDirectory, identity, true);
        } else {
            // If the app is not in directory, we'll add it to the model if and when it connects to FDC3
            allowReject(this.getOrCreateExpectedWindow(identity).connected.then(async () => {
                let appInfo: Application;

                // Attempt to copy appInfo from another appWindow in the model from the same app
                const appWindowsFromSameApp = this.findWindowsByAppId(identity.uuid);
                if (appWindowsFromSameApp.length > 0) {
                    appInfo = appWindowsFromSameApp[0].appInfo;
                } else {
                    appInfo = await this._environment.inferApplication(identity);
                }

                this.registerWindow(appInfo, identity, false);
            }));
        }
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
            this.registerWindow(await this._environment.inferApplication(identity), identity, false);
        }
    }

    private async onApiHandlerDisconnection(identity: Identity): Promise<void> {
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
     * @param isInAppDirectory boolean indicating whether the app is registered in the app directory
     */
    private registerWindow(appInfo: Application, identity: Identity, isInAppDirectory: boolean): AppWindow {
        const id = getId(identity);

        const appWindow = this._environment.wrapApplication(appInfo, identity, this._channelsById[DEFAULT_CHANNEL_ID]);

        console.info(`Registering window [${isInAppDirectory ? '' : 'NOT '}in app directory] ${appWindow.id}`);
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
            // Create a promise that resolves once the window has been seen
            const seen = untilTrue(this._environment.windowSeen, () => {
                return this._environment.isWindowSeen(identity);
            });

            // Create a promise that resolves when the window has connected
            const connected = untilTrue(this._apiHandler.onConnection, () => {
                return this._apiHandler.isClientConnection(identity);
            });

            // Create a promise that resolves when the window has registered
            const registered = untilTrue(this._onWindowRegisteredInternal, () => {
                return !!this._windowsById[id];
            }).then(() => {
                return this._windowsById[id];
            });

            // A promise that never resolves but rejects when the window has closed
            const closed = allowReject(untilSignal(this._environment.windowClosed, (testIdentity) => {
                return getId(testIdentity) === id;
            }).then(() => {
                throw new Error(EXPECT_CLOSED_MESSAGE);
            }));

            const connectedOrClosed = allowReject(Promise.race([connected, closed]));
            const registeredOrClosed = allowReject(Promise.race([registered, closed]));

            const seenThenRegisteredWithinTimeout = seen.then(() => {
                return {value: allowReject(withStrictTimeout(Timeouts.WINDOW_SEEN_TO_REGISTERED, registeredOrClosed, EXPECT_TIMEOUT_MESSAGE))};
            });

            const expectedWindow: ExpectedWindow = {
                seen: seenThenRegisteredWithinTimeout,
                connected: connectedOrClosed,
                registered: registeredOrClosed
            };

            this._expectedWindowsById[id] = expectedWindow;

            return expectedWindow;
        }
    }
}
