import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Application, AppName, AppId} from '../../client/directory';
import {Inject} from '../common/Injectables';
import {ChannelId, DEFAULT_CHANNEL_ID} from '../../client/main';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic} from '../../client/internal';
import {SYSTEM_CHANNELS, Timeouts} from '../constants';
import {withStrictTimeout, untilTrue, allowReject, untilSignal, asyncFilter} from '../utils/async';
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

interface WindowGroup {
    application: Application;
    windows: AppWindow[]
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
     * Get apps that can handle an intent and optionally with specified context type
     *
     * Includes windows that are not in the app directory but have registered a listener for it if contextType is not specified
     * @param intentType intent type
     * @param contextType context type
     */
    public async getApplicationsForIntent(intentType: string, contextType?: string): Promise<Application[]> {
        const runningGroups = this.extractApplicationsFromWindows(this.windows);

        const runningAppsToInclude = (await asyncFilter(runningGroups, async (group: WindowGroup) => {
            const {application, windows} = group;

            return windows.some(window => window.hasIntentListener(intentType)) && AppDirectory.mightAppSupportIntent(application, intentType, contextType);
        })).map(group => group.application);

        // TODO: Exclude on the basis of running apps (after SERVICE-552 is merged)
        const directoryAppsToInclude = (await this._directory.getAllAppsThatShouldSupportIntent(intentType, contextType))
            .filter(app => !runningAppsToInclude.some(runningApp => runningApp.appId === app.appId));

        // TODO: Use `AppDirectory.shouldAppSupportIntent` to include apps that we expect to add a listener but haven't yet [SERVICE-556]
        return [...runningAppsToInclude, ...directoryAppsToInclude].sort((a, b) => this.compareAppsForIntent(a, b, intentType, contextType));
    }

    public findWindowsByAppName(name: AppName): AppWindow[] {
        return this.findWindows(appWindow => appWindow.appInfo.name === name);
    }

    private extractApplicationsFromWindows(windows: AppWindow[]): WindowGroup[] {
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
            // TODO [SERVICE-737] Store the entity type as part of the registration process, so we can correctly handle disconnects
            this.registerWindow(await this._environment.inferApplication(identity), identity, false);
        }
    }

    private async onApiHandlerDisconnection(identity: Identity): Promise<void> {
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
                registered
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

        const running1 = this.findWindowsByAppId(app1.appId).length > 0;
        const running2 = this.findWindowsByAppId(app2.appId).length > 0;

        if (running1 && !running2) {
            return -1;
        } else if (!running1 && running2) {
            return 1;
        }

        return (app1.title || app1.name).localeCompare(app2.title || app2.name, 'en');
    }
}
