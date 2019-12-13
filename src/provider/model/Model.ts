import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';
import {withStrictTimeout, allowReject, untilSignal, untilTrue, DeferredPromise, parallelForEach} from 'openfin-service-async';

import {Application, AppName} from '../../client/types/directory';
import {Inject} from '../common/Injectables';
import {ChannelId, DEFAULT_CHANNEL_ID, AppIntent, FDC3Error, ApplicationError} from '../../client/main';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic} from '../../client/internal';
import {SYSTEM_CHANNELS, Timeouts} from '../constants';
import {Boxed} from '../utils/types';
import {getId} from '../utils/getId';

import {AppConnection} from './AppConnection';
import {LiveApp} from './LiveApp';
import {ContextChannel, DefaultContextChannel, SystemContextChannel} from './ContextChannel';
import {Environment, EntityType} from './Environment';
import {AppDirectory} from './AppDirectory';

interface ExpectedConnection {
    // Resolves when the window has been created by the environment, or the named entity connects to the service via the IAB
    // Resolves to the `registered` promise wrapped in a timeout
    created: Promise<Boxed<Promise<AppConnection>>>;

    // Resolves when the entity has connected to FDC3
    connected: Promise<void>;

    // Resolves to the AppConnection when the entity has been fully registered and is ready for use outside the Model
    registered: Promise<AppConnection>;

    // Rejects when the window is closed
    closed: Promise<void>;
}

const EXPECT_TIMEOUT_MESSAGE = 'Timeout on window registration exceeded';
const EXPECT_CLOSED_MESSAGE = 'Window closed before registration completed';

@injectable()
export class Model {
    /**
     * Signal emitted whenever a new application entity connects to the service. This will typically be an OpenFin
     * window, but also includes non-window connections such as those from adapters.
     *
     * The lifecycle of window and non-window connections differ slightly. See `onApiHandlerDisconnection` for details.
     */
    public readonly onConnectionAdded: Signal<[AppConnection]> = new Signal();

    /**
     * Signal emitted whenever an application entity (previously emitted via `onConnecitonAdded`) disconnects from the
     * service.
     *
     * For window-based entities, this is keyed to the window closing rather than the IAB disconnecting.
     */
    public readonly onConnectionRemoved: Signal<[AppConnection]> = new Signal();

    private readonly _directory: AppDirectory;
    private readonly _environment: Environment;
    private readonly _apiHandler: APIHandler<APIFromClientTopic>;

    private readonly _liveAppsByUuid: {[id: string]: LiveApp};
    private readonly _connectionsById: {[id: string]: AppConnection};
    private readonly _channelsById: {[id: string]: ContextChannel};
    private readonly _expectedConnectionsById: {[id: string]: ExpectedConnection};

    private readonly _onConnectionRegisteredInternal: Signal<[AppConnection]> = new Signal();

    constructor(
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.ENVIRONMENT) environment: Environment,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>
    ) {
        this._channelsById = {};
        this._connectionsById = {};
        this._expectedConnectionsById = {};
        this._liveAppsByUuid = {};

        this._directory = directory;
        this._environment = environment;
        this._apiHandler = apiHandler;

        this._environment.onApplicationCreated.add(this.onApplicationCreated, this);
        this._environment.onApplicationClosed.add(this.onApplicationClosed, this);

        this._environment.onWindowCreated.add(this.onWindowOrViewCreated, this);
        this._environment.onWindowClosed.add(this.onWindowOrViewClosed, this);

        this._apiHandler.onConnection.add(this.onApiHandlerConnection, this);
        this._apiHandler.onDisconnection.add(this.onApiHandlerDisconnection, this);

        this._directory.directoryChanged.add(this.onDirectoryChanged, this);

        this._channelsById[DEFAULT_CHANNEL_ID] = new DefaultContextChannel(DEFAULT_CHANNEL_ID);
        for (const channel of SYSTEM_CHANNELS) {
            this._channelsById[channel.id] = new SystemContextChannel(channel.id, channel.visualIdentity);
        }
    }

    public get liveApps(): LiveApp[] {
        return Object.values(this._liveAppsByUuid);
    }

    public get connections(): AppConnection[] {
        return Object.values(this._connectionsById);
    }

    public get channels(): ContextChannel[] {
        return Object.values(this._channelsById);
    }

    public getConnection(identity: Identity): AppConnection|null {
        return this._connectionsById[getId(identity)] || null;
    }

    public async expectConnection(identity: Identity): Promise<AppConnection> {
        const id = getId(identity);

        if (this._connectionsById[id]) {
            return this._connectionsById[id];
        } else {
            const expectedConnection = this.getOrCreateExpectedConnection(identity);

            // Allow a short time between the `expectConnection` call and the window being created
            const createdWithinTimeout = withStrictTimeout(Timeouts.ENTITY_INITIALIZE, expectedConnection.created, EXPECT_TIMEOUT_MESSAGE);

            const registeredWithinTimeout = (await createdWithinTimeout).value;
            const connection = await registeredWithinTimeout;

            return connection;
        }
    }

    /**
     * Returns all registered connections for an app satisfying our predicate, waiting for at least one connection or
     * until the app is mature.
     */
    public async expectConnectionsForLiveApp(
        liveApp: LiveApp,
        isReadyNow: (connection: AppConnection) => boolean,
        waitForReady: (connection: AppConnection) => Promise<void>
    ): Promise<AppConnection[]> {
        const connections = liveApp.connections;

        const result: AppConnection[] = connections.filter(isReadyNow);

        if (result.length > 0) {
            // If we have any connections that immediately satisfy our predicate, return those
            return result;
        } else {
            // Otherwise, wait until we have a single connection that satisfies our predicate
            const deferredPromise = new DeferredPromise<AppConnection>();

            // Apply the async predicate to any incoming connections
            const slot = this._onConnectionRegisteredInternal.add((connection) => {
                if (liveApp.connections.includes(connection)) {
                    waitForReady(connection).then(() => deferredPromise.resolve(connection), () => {});
                }
            });

            // Apply the async predicate to any existing connections
            for (const connection of connections) {
                waitForReady(connection).then(() => deferredPromise.resolve(connection), () => {});
            }

            // Return a connection once we have one, or timeout when the application is mature
            return Promise.race([
                deferredPromise.promise.then((connection) => [connection]),
                liveApp.waitForAppMature().then(() => [], () => [])
            ]).then((connection) => {
                slot.remove();
                return connection;
            });
        }
    }

    public async getOrCreateLiveAppByName(name: AppName): Promise<LiveApp> {
        return this.getOrCreateLiveAppByNameWithPredicate(
            name,
            async () => this._directory.getAppByName(name),
            (appInfo) => appInfo.name === name,
            () => true
        ) as Promise<LiveApp>;
    }

    public async getOrCreateLiveAppByNameForIntent(name: AppName, intentType: string, contextType: string): Promise<LiveApp | undefined> {
        return this.getOrCreateLiveAppByNameWithPredicate(
            name,
            async () => this._directory.getAppByName(name),
            (searchAppInfo) => searchAppInfo.name === name,
            (liveApp) => {
                const hasIntentListener = liveApp.connections.some((connection) => connection.hasIntentListener(intentType));

                if (hasIntentListener && AppDirectory.mightAppSupportIntent(liveApp.appInfo!, intentType, contextType)) {
                    return true;
                }

                if (!liveApp.mature && AppDirectory.shouldAppSupportIntent(liveApp.appInfo!, intentType, contextType)) {
                    return true;
                }

                return false;
            }
        );
    }

    public async getOrCreateLiveAppByAppInfo(appInfo: Application): Promise<LiveApp> {
        return this.getOrCreateLiveAppByNameWithPredicate(
            appInfo.name,
            async () => appInfo,
            (searchAppInfo) => searchAppInfo === appInfo,
            () => true
        ) as Promise<LiveApp>;
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
     * Includes entities that are not in the app directory but have registered a listener for it if contextType is not specified
     *
     * @param intentType The intent type we want to find supporting apps for
     * @param contextType The optional context type that we want apps to support with the given intent
     */
    public async getApplicationsForIntent(intentType: string, contextType?: string): Promise<Application[]> {
        // Get all live apps that support the given intent and context
        const liveApps = Object.values(this._liveAppsByUuid);

        const liveAppsForIntent = liveApps.filter((liveApp: LiveApp) => {
            const {appInfo, connections} = liveApp;

            const hasIntentListener = connections.some((connection) => connection.hasIntentListener(intentType));

            return hasIntentListener && appInfo !== undefined && AppDirectory.mightAppSupportIntent(appInfo, intentType, contextType);
        }).map((liveApp) => liveApp.appInfo!);

        // Get all directory apps that support the given intent and context
        const directoryApps = (await this._directory.getAllApps()).filter((app) => {
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
        this.connections.forEach((connection) => {
            const intentTypes = connection.intentListeners;
            const app = connection.appInfo;

            intentTypes.filter((intentType) => AppDirectory.mightAppSupportIntent(app, intentType, contextType)).forEach((intentType) => {
                appIntentsBuilder.addApplicationForIntent(intentType, connection.appInfo);
            });
        });

        // Populate appIntentsBuilder from non-mature directory apps
        const directoryApps = (await this._directory.getAllApps()).filter((app) => {
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

    public async existsAppForName(name: AppName): Promise<boolean> {
        const directoryApp = await this._directory.getAppByName(name);

        if (directoryApp) {
            return true;
        } else {
            return !!this._liveAppsByUuid[name];
        }
    }

    public async onDirectoryChanged(): Promise<void> {
        const entries = Object.entries(this._liveAppsByUuid);

        await parallelForEach(entries.filter(([, liveApp]) => !liveApp.hasFinalAppInfo()), async ([uuid, liveApp]) => {
            const appInfo = await this._directory.getAppByUuid(uuid);

            if (appInfo) {
                liveApp.setAppInfo(appInfo, true);
            }
        });
    }

    private async onApplicationCreated(identity: Identity, liveApp: LiveApp): Promise<void> {
        const {uuid} = identity;
        this._liveAppsByUuid[uuid] = liveApp;

        await liveApp.waitForAppStarted();

        // Attempt to get appInfo from the app directory, otherwise infer from environment
        const appInfoFromDirectory = await this._directory.getAppByUuid(uuid);
        const appInfo = appInfoFromDirectory || await this._environment.inferApplication(identity);

        liveApp.setAppInfo(appInfo, !!appInfoFromDirectory);
    }

    private onApplicationClosed(identity: Identity): void {
        const {uuid} = identity;
        const app = this._liveAppsByUuid[uuid];

        if (app) {
            app.setClosed();
            delete this._liveAppsByUuid[uuid];
        }
    }

    private onWindowOrViewCreated(identity: Identity, entityType: EntityType): void {
        const connection: ExpectedConnection = this.getOrCreateExpectedConnection(identity);

        const {uuid} = identity;
        const liveApp = this._liveAppsByUuid[uuid];

        // Only register windows once they are connected to the service
        allowReject(connection.connected.then(() => this.registerConnection(liveApp, identity, entityType)));
    }

    private onWindowOrViewClosed(identity: Identity, entityType: EntityType): void {
        this.removeConnection(identity);
    }

    private async onApiHandlerConnection(identity: Identity): Promise<void> {
        const entityType: EntityType = await this._environment.getEntityType(identity);

        if (entityType === EntityType.EXTERNAL_CONNECTION) {
            // Any connections to the service from adapters should be immediately registered
            let liveApp = this._liveAppsByUuid[identity.uuid];

            if (!liveApp) {
                const appInfo = await this._environment.inferApplication(identity);

                liveApp = new LiveApp(undefined);
                liveApp.setAppInfo(appInfo, true);
                this._liveAppsByUuid[identity.uuid] = liveApp;
            }

            this.registerConnection(liveApp, identity, entityType);
        }
    }

    private async onApiHandlerDisconnection(identity: Identity): Promise<void> {
        // Although windows are only registered on connection, we do not unregister on disconnect, so channel membership is preserved on navigation
        const id = getId(identity);

        let connection: AppConnection | undefined;
        if (this._connectionsById[id]) {
            connection = this._connectionsById[id];
        } else if (this._expectedConnectionsById[id]) {
            connection = await this._expectedConnectionsById[id].registered.catch(() => undefined);
        }

        if (connection) {
            // Assume client disconnected due to a page reload, or some other change that resets its listener state
            connection.removeAllListeners();

            // For non-window connections, also treat this as the entity being destroyed
            // There is no `window-closed` equivilant for external connections, so we will do our full clean-up of state here
            if (connection.entityType === EntityType.EXTERNAL_CONNECTION) {
                this.removeConnection(connection.identity);

                const liveApp: LiveApp | undefined = this._liveAppsByUuid[identity.uuid];
                if (liveApp && liveApp.connections.length === 0) {
                    liveApp.setClosed();
                    delete this._liveAppsByUuid[identity.uuid];
                }
            }
        }
    }

    /**
     * Registers an entity in the model
     *
     * @param liveApp Details of the application that the connection belongs to
     * @param identity Window/connection identity
     * @param entityType Indicates the type of entity that is connecting to the service
     */
    private async registerConnection(liveApp: LiveApp, identity: Identity, entityType: EntityType): Promise<void> {
        // Don't register connections for any app until the app's info is known
        await liveApp.waitForAppInfo();

        const connection: AppConnection = this._environment.wrapConnection(liveApp, identity, entityType, this._channelsById[DEFAULT_CHANNEL_ID]);

        console.info(`Registering connection ${connection.id} of type ${entityType}`);

        this._connectionsById[connection.id] = connection;
        delete this._expectedConnectionsById[connection.id];

        liveApp.addConnection(connection);

        this.onConnectionAdded.emit(connection);
        this._onConnectionRegisteredInternal.emit(connection);
    }

    private removeConnection(identity: Identity): void {
        const id: string = getId(identity);
        const connection: AppConnection = this._connectionsById[id];

        if (connection) {
            const liveApp: LiveApp | undefined = this._liveAppsByUuid[identity.uuid];
            if (liveApp) {
                liveApp.removeConnection(connection);
            }

            delete this._connectionsById[id];
            this.onConnectionRemoved.emit(connection);
        } else if (this._expectedConnectionsById[id]) {
            delete this._expectedConnectionsById[id];
        }
    }

    private getOrCreateExpectedConnection(identity: Identity): ExpectedConnection {
        const id = getId(identity);

        if (this._expectedConnectionsById[id]) {
            return this._expectedConnectionsById[id];
        } else {
            // A promise that never resolves but rejects when the window has closed
            const closed = allowReject(untilSignal(this._environment.onWindowClosed, (testIdentity) => {
                return getId(testIdentity) === id;
            }).then(() => {
                throw new Error(EXPECT_CLOSED_MESSAGE);
            }));

            // Create a promise that resolves once the window has been created
            const windowCreated = untilTrue(this._environment.onWindowCreated, () => {
                return this._environment.isKnownEntity(identity);
            });
            const connectionCreated = untilTrue(this._apiHandler.onConnection, () => {
                return this._apiHandler.isClientConnection(identity);
            });
            const created = Promise.race([windowCreated, connectionCreated]);

            // Create a promise that resolves when the entity connects, or rejects when the window closes
            const connected = untilTrue(this._apiHandler.onConnection, () => {
                return this._apiHandler.isClientConnection(identity);
            }, closed);

            // Create a promise that resolves when the entity registers, or rejects when the window closes
            const registered = allowReject(untilTrue(this._onConnectionRegisteredInternal, () => {
                return !!this._connectionsById[id];
            }, closed).then(() => {
                return this._connectionsById[id];
            }));

            const createdThenRegisteredWithinTimeout = created.then(() => {
                return {value: withStrictTimeout(Timeouts.WINDOW_CREATED_TO_REGISTERED, registered, EXPECT_TIMEOUT_MESSAGE)};
            });

            const expectedConnection: ExpectedConnection = {
                created: createdThenRegisteredWithinTimeout,
                connected,
                registered,
                closed
            };

            this._expectedConnectionsById[id] = expectedConnection;

            return expectedConnection;
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

    private async getOrCreateLiveAppByNameWithPredicate(
        name: string,
        getAppInfo: () => Promise<Application | null>,
        matcher: (appInfo: Application) => boolean,
        predicate: (liveApp: LiveApp) => boolean
    ): Promise<LiveApp | undefined> {
        const deferredPromise = new DeferredPromise<LiveApp>();
        let found = false;

        const search = async (liveApp: LiveApp, forceMatchApp: boolean) => {
            const appInfo = liveApp.appInfo || await liveApp.waitForAppInfo().catch(() => undefined);

            if ((appInfo && matcher(appInfo)) || forceMatchApp) {
                found = true;
                if (!predicate || predicate(liveApp)) {
                    deferredPromise.resolve(liveApp);
                } else {
                    deferredPromise.resolve(undefined);
                }
            }
        };

        // Look for the desired name in existing apps
        const searchPromise = parallelForEach(Object.values(this._liveAppsByUuid), (liveApp) => search(liveApp, false));

        // Look for the desired name in apps as they are created
        const slot = this._environment.onApplicationCreated.add(async (identity, liveApp) => search(liveApp, false));
        deferredPromise.promise.then(() => slot.remove(), () => slot.remove());

        // If unable to find the app, the try to start it
        searchPromise.then(async () => {
            if (!found) {
                const appInfo = await getAppInfo();

                if (appInfo && !found) {
                    slot.remove();
                    search(this._environment.createApplication(appInfo), true);
                } else {
                    deferredPromise.reject(new FDC3Error(ApplicationError.NotFound, `No application '${name}' found running or in directory`));
                }
            }
        });

        return deferredPromise.promise;
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
