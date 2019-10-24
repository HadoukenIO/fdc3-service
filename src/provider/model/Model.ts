import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Application, AppName, AppId} from '../../client/directory';
import {Inject} from '../common/Injectables';
import {ChannelId, DEFAULT_CHANNEL_ID, AppIntent} from '../../client/main';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic} from '../../client/internal';
import {SYSTEM_CHANNELS, Timeouts} from '../constants';
import {withStrictTimeout, untilTrue, allowReject, untilSignal, asyncFilter} from '../utils/async';
import {Boxed} from '../utils/types';
import {getId} from '../utils/getId';

import {AppConnection} from './AppConnection';
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

interface LiveApp {
    application: Application;
    connections: AppConnection[];
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

    private readonly _connectionsById: {[id: string]: AppConnection};
    private readonly _channelsById: {[id: string]: ContextChannel};
    private readonly _expectedConnectionsById: {[id: string]: ExpectedConnection};

    private readonly _onConnectionRegisteredInternal = new Signal<[]>();

    constructor(
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.ENVIRONMENT) environment: Environment,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>
    ) {
        this._connectionsById = {};
        this._channelsById = {};
        this._expectedConnectionsById = {};

        this._directory = directory;
        this._environment = environment;
        this._apiHandler = apiHandler;

        this._environment.onWindowCreated.add(this.onWindowCreated, this);
        this._environment.onWindowClosed.add(this.onWindowClosed, this);

        this._apiHandler.onConnection.add(this.onApiHandlerConnection, this);
        this._apiHandler.onDisconnection.add(this.onApiHandlerDisconnection, this);

        this._channelsById[DEFAULT_CHANNEL_ID] = new DefaultContextChannel(DEFAULT_CHANNEL_ID);
        for (const channel of SYSTEM_CHANNELS) {
            this._channelsById[channel.id] = new SystemContextChannel(channel.id, channel.visualIdentity);
        }
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
            const createdWithinTimeout = withStrictTimeout(Timeouts.WINDOW_EXPECT_TO_CREATED, expectedConnection.created, EXPECT_TIMEOUT_MESSAGE);

            const registeredWithinTimeout = (await createdWithinTimeout).value;
            const connection = await registeredWithinTimeout;

            return connection;
        }
    }

    public getChannel(id: ChannelId): ContextChannel|null {
        return this._channelsById[id] || null;
    }

    public setChannel(channel: ContextChannel): void {
        this._channelsById[channel.id] = channel;
    }

    /**
     * Returns all registered connections for an app, waiting for at least one entity
     */
    public async expectConnectionsForApp(appInfo: Application): Promise<AppConnection[]> {
        // TODO: This dangerous method doesn't give proper timeouts. Will likely be changed extensively/removed when we revisit timeouts [SERVICE-556]
        let connections = this.findConnectionsByAppId(appInfo.appId);

        if (connections.length === 0) {
            const signalPromise = new Promise<AppConnection[]>(resolve => {
                const slot = this._onConnectionRegisteredInternal.add(() => {
                    const matchingConnections = this.findConnectionsByAppId(appInfo.appId);
                    if (matchingConnections.length > 0) {
                        slot.remove();
                        resolve(matchingConnections);
                    }
                });
            });
            connections = await signalPromise;
        }
        return connections;
    }

    public async ensureRunning(appInfo: Application): Promise<void> {
        if (!await this._environment.isRunning(AppDirectory.getUuidFromApp(appInfo))) {
            await this._environment.createApplication(appInfo, this._channelsById[DEFAULT_CHANNEL_ID]);
        }
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
        // TODO: Include apps that should add a listener but haven't yet, where the timeout has not expired (may have no registered windows) [SERVICE-556]
        const liveApps = getLiveApps(this.connections);

        const liveAppsForIntent = (await asyncFilter(liveApps, async (group: LiveApp) => {
            const {application, connections} = group;

            const hasIntentListener = connections.some(connection => connection.hasIntentListener(intentType));

            return hasIntentListener && AppDirectory.mightAppSupportIntent(application, intentType, contextType);
        })).map(group => group.application);

        // Get all directory apps that support the given intent and context
        const directoryApps = await asyncFilter(await this._directory.getAllApps(), async (app) => {
            return !await this._environment.isRunning(AppDirectory.getUuidFromApp(app));
        });

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
        this.connections.forEach(connection => {
            const intentTypes = connection.intentListeners;
            const app = connection.appInfo;

            intentTypes.filter(intentType => AppDirectory.mightAppSupportIntent(app, intentType, contextType)).forEach(intentType => {
                appIntentsBuilder.addApplicationForIntent(intentType, connection.appInfo);
            });
        });

        // Populate appIntentsBuilder from non-running directory apps
        const directoryApps = await asyncFilter(await this._directory.getAllApps(), async (app) => {
            return !await this._environment.isRunning(AppDirectory.getUuidFromApp(app));
        });

        directoryApps.forEach(app => {
            const intents = app.intents || [];

            intents.filter(intent => AppDirectory.shouldAppSupportIntent(app, intent.name, contextType)).forEach(intent => {
                appIntentsBuilder.addApplicationForIntent(intent.name, app);
            });
        });

        // Build app intents
        const appIntents = appIntentsBuilder.build();

        // Normalize result and set display names
        appIntents.forEach(appIntent => {
            appIntent.apps.sort((a, b) => this.compareAppsForIntent(a, b, appIntent.intent.name, contextType));
            appIntent.intent.displayName = AppDirectory.getIntentDisplayName(appIntent.apps, appIntent.intent.name);
        });

        appIntents.sort((a, b) => a.intent.name.localeCompare(b.intent.name, 'en'));

        return appIntents;
    }

    public findConnectionsByAppName(name: AppName): AppConnection[] {
        return this.findConnections(connection => connection.appInfo.name === name);
    }

    private onWindowCreated(identity: Identity): void {
        const connection = this.getOrCreateExpectedConnection(identity);

        // Only register windows once they are connected to the service
        allowReject(connection.connected.then(async () => {
            // Attempt to copy appInfo from another appWindow in the model from the same app
            let registered = false;
            let appWindowsFromSameApp: AppConnection[];

            allowReject(untilTrue(this._onConnectionRegisteredInternal, () => {
                appWindowsFromSameApp = this.findConnectionsByAppId(identity.uuid);
                return appWindowsFromSameApp.length > 0;
            }, connection.closed).then(() => {
                if (!registered) {
                    this.registerConnection(appWindowsFromSameApp[0].appInfo, identity, EntityType.WINDOW);
                    registered = true;
                }
            }));

            // If we're unable to copy appInfo from another window, attempt to use the app directory, or infer from environment
            const appInfoFromDirectory = await this._directory.getAppByUuid(identity.uuid);

            const appInfo = appInfoFromDirectory || await this._environment.inferApplication(identity);

            if (!registered) {
                this.registerConnection(appInfo, identity, EntityType.WINDOW);
                registered = true;
            }
        }));
    }

    private onWindowClosed(identity: Identity): void {
        this.removeConnection(identity);
    }

    private async onApiHandlerConnection(identity: Identity): Promise<void> {
        const entityType: EntityType = await this._environment.getEntityType(identity);
        // console.log('onconnection handler', identity, entityType);
        if (entityType === EntityType.EXTERNAL_CONNECTION) {
            // Any connections to the service from adapters should be immediately registered
            this.registerConnection(await this._environment.inferApplication(identity), identity, entityType);
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
            if (connection.entityType !== EntityType.WINDOW) {
                this.removeConnection(connection.identity);
            }
        }
    }

    /**
     * Registers an entity in the model
     *
     * @param appInfo Application info, either from the app directory, or 'crafted' for a non-registered app
     * @param identity Window/connection identity
     * @param entityType Indicates the type of entity that is connecting to the service
     */
    private registerConnection(appInfo: Application, identity: Identity, entityType: EntityType): void {
        const connection = this._environment.wrapApplication(appInfo, identity, entityType, this._channelsById[DEFAULT_CHANNEL_ID]);

        console.info(`Registering connection ${connection.id}`);

        this._connectionsById[connection.id] = connection;
        delete this._expectedConnectionsById[connection.id];

        this.onConnectionAdded.emit(connection);
        this._onConnectionRegisteredInternal.emit();
    }

    private removeConnection(identity: Identity): void {
        const id: string = getId(identity);
        const connection: AppConnection = this._connectionsById[id];

        if (connection) {
            delete this._connectionsById[id];
            this.onConnectionRemoved.emit(connection);
        } else if (this._expectedConnectionsById[id]) {
            delete this._expectedConnectionsById[id];
        }
    }

    private findConnectionsByAppId(appId: AppId): AppConnection[] {
        return this.findConnections(connection => connection.appInfo.appId === appId);
    }

    private findConnections(predicate: (connection: AppConnection) => boolean): AppConnection[] {
        return this.connections.filter(predicate);
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

        const running1 = this._environment.isRunning(AppDirectory.getUuidFromApp(app1));
        const running2 = this._environment.isRunning(AppDirectory.getUuidFromApp(app2));

        if (running1 && !running2) {
            return -1;
        } else if (!running1 && running2) {
            return 1;
        }

        return (app1.title || app1.name).localeCompare(app2.title || app2.name, 'en');
    }
}

function getLiveApps(connections: AppConnection[]): LiveApp[] {
    return connections.reduce((liveApps: LiveApp[], connection: AppConnection) => {
        const liveApp = liveApps.find(liveApp => liveApp.application.appId === connection.appInfo.appId);
        if (liveApp) {
            liveApp.connections.push(connection);
        } else {
            liveApps.push({application: connection.appInfo, connections: [connection]});
        }

        return liveApps;
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
