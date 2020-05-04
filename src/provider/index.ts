import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';

import {FDC3Error, ConnectionError, ApplicationError, SendContextError} from '../client/errors';
import {RaiseIntentPayload, APIFromClientTopic, OpenPayload, FindIntentPayload, FindIntentsByContextPayload, BroadcastPayload, APIFromClient, AddIntentListenerPayload, RemoveIntentListenerPayload, GetSystemChannelsPayload, GetCurrentChannelPayload, ChannelGetMembersPayload, ChannelJoinPayload, GetChannelByIdPayload, ChannelBroadcastPayload, ChannelGetCurrentContextPayload, ChannelAddContextListenerPayload, ChannelRemoveContextListenerPayload, ChannelAddEventListenerPayload, ChannelRemoveEventListenerPayload, GetOrCreateAppChannelPayload, AddContextListenerPayload, RemoveContextListenerPayload, setServiceIdentity} from '../client/internal';
import {AppIntent, IntentResolution, Application, Context, ChannelTransport, SystemChannelTransport, AppChannelTransport} from '../client/main';
import {parseIdentity, parseContext, parseChannelId, parseAppChannelName} from '../client/validation';

import {Inject} from './common/Injectables';
import {AppDirectory} from './model/AppDirectory';
import {Model} from './model/Model';
import {ContextHandler} from './controller/ContextHandler';
import {IntentHandler} from './controller/IntentHandler';
import {APIHandler} from './APIHandler';
import {EventHandler} from './controller/EventHandler';
import {Injector} from './common/Injector';
import {ChannelHandler} from './controller/ChannelHandler';
import {AppConnection} from './model/AppConnection';
import {Intent} from './intents';
import {ConfigStoreBinding} from './model/ConfigStore';
import {ContextChannel} from './model/ContextChannel';
import {Environment} from './model/Environment';
import {collateClientCalls, ClientCallsResult} from './utils/helpers';

@injectable()
export class Main {
    private readonly _apiHandler: APIHandler<APIFromClientTopic>;
    private readonly _directory: AppDirectory;
    private readonly _channelHandler: ChannelHandler;
    private readonly _configStore: ConfigStoreBinding;
    private readonly _contextHandler: ContextHandler;
    private readonly _environment: Environment;
    private readonly _eventHandler: EventHandler;
    private readonly _intentHandler: IntentHandler;
    private readonly _model: Model;

    constructor(
    // eslint-disable-next-line @typescript-eslint/indent
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>,
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.CHANNEL_HANDLER) channelHandler: ChannelHandler,
        @inject(Inject.CONFIG_STORE) configStore: ConfigStoreBinding,
        @inject(Inject.CONTEXT_HANDLER) contextHandler: ContextHandler,
        @inject(Inject.ENVIRONMENT) environment: Environment,
        @inject(Inject.EVENT_HANDLER) eventHandler: EventHandler,
        @inject(Inject.INTENT_HANDLER) intentHandler: IntentHandler,
        @inject(Inject.MODEL) model: Model
    ) {
        this._apiHandler = apiHandler;
        this._directory = directory;
        this._channelHandler = channelHandler;
        this._configStore = configStore;
        this._contextHandler = contextHandler;
        this._environment = environment;
        this._eventHandler = eventHandler;
        this._intentHandler = intentHandler;
        this._model = model;
    }

    public async register(): Promise<void> {
        Object.assign(window, {
            main: this,
            apiHandler: this._apiHandler,
            directory: this._directory,
            channelHandler: this._channelHandler,
            configStore: this._configStore,
            contextHandler: this._contextHandler,
            environment: this._environment,
            eventHandler: this._eventHandler,
            intentHandler: this._intentHandler,
            model: this._model
        });

        // Fetch our identity, and derive the name of the IAB channel
        await setServiceIdentity();

        // Wait for creation of any injected components that require async initialization
        await Injector.init();

        // Current API
        this._apiHandler.registerListeners<APIFromClient>({
            [APIFromClientTopic.OPEN]: this.open.bind(this),
            [APIFromClientTopic.FIND_INTENT]: this.findIntent.bind(this),
            [APIFromClientTopic.FIND_INTENTS_BY_CONTEXT]: this.findIntentsByContext.bind(this),
            [APIFromClientTopic.BROADCAST]: this.broadcast.bind(this),
            [APIFromClientTopic.RAISE_INTENT]: this.raiseIntent.bind(this),
            [APIFromClientTopic.ADD_INTENT_LISTENER]: this.addIntentListener.bind(this),
            [APIFromClientTopic.REMOVE_INTENT_LISTENER]: this.removeIntentListener.bind(this),
            [APIFromClientTopic.ADD_CONTEXT_LISTENER]: this.addContextListener.bind(this),
            [APIFromClientTopic.REMOVE_CONTEXT_LISTENER]: this.removeContextListener.bind(this),
            [APIFromClientTopic.GET_SYSTEM_CHANNELS]: this.getSystemChannels.bind(this),
            [APIFromClientTopic.GET_CHANNEL_BY_ID]: this.getChannelById.bind(this),
            [APIFromClientTopic.GET_CURRENT_CHANNEL]: this.getCurrentChannel.bind(this),
            [APIFromClientTopic.GET_OR_CREATE_APP_CHANNEL]: this.getOrCreateAppChannel.bind(this),
            [APIFromClientTopic.CHANNEL_GET_MEMBERS]: this.channelGetMembers.bind(this),
            [APIFromClientTopic.CHANNEL_JOIN]: this.channelJoin.bind(this),
            [APIFromClientTopic.CHANNEL_BROADCAST]: this.channelBroadcast.bind(this),
            [APIFromClientTopic.CHANNEL_GET_CURRENT_CONTEXT]: this.channelGetCurrentContext.bind(this),
            [APIFromClientTopic.CHANNEL_ADD_CONTEXT_LISTENER]: this.channelAddContextListener.bind(this),
            [APIFromClientTopic.CHANNEL_REMOVE_CONTEXT_LISTENER]: this.channelRemoveContextListener.bind(this),
            [APIFromClientTopic.CHANNEL_ADD_EVENT_LISTENER]: this.channelAddEventListener.bind(this),
            [APIFromClientTopic.CHANNEL_REMOVE_EVENT_LISTENER]: this.channelRemoveEventListener.bind(this)
        });

        this._channelHandler.onChannelChanged.add(this.onChannelChangedHandler, this);

        console.log('Service Initialised');
    }

    private async onChannelChangedHandler(connection: AppConnection, channel: ContextChannel | null, previousChannel: ContextChannel | null): Promise<void> {
        await this._eventHandler.dispatchEventOnChannelChanged(connection, channel, previousChannel);
    }

    private async open(payload: OpenPayload): Promise<void> {
        const context = payload.context && parseContext(payload.context);

        const appInfo: Application|null = await this._directory.getAppByName(payload.name);

        if (!appInfo) {
            throw new FDC3Error(ApplicationError.NotFound, `No application '${payload.name}' found running or in directory`);
        }

        const promises: Promise<void>[] = [];

        // Start the application if not already running
        const startedPromise = (await this._model.getOrCreateLiveApp(appInfo)).waitForAppStarted();

        promises.push(startedPromise);

        // If the app has open windows, bring all to front in creation order
        const connections = this._model.findConnectionsByAppName(appInfo.name);
        if (connections.length > 0) {
            connections.sort((a, b) => a.entityNumber - b.entityNumber);

            // Some connections may not be windows. Calling bringToFront on these entities is a no-op.
            const bringToFrontPromise = Promise.all(connections.map((connection) => connection.bringToFront()));
            const focusPromise = bringToFrontPromise.then(() => connections[connections.length - 1].focus());

            promises.push(focusPromise);
        }

        // If a context has been provided, send to listening windows
        if (context) {
            const connectionsPromise = this._model.expectConnectionsForApp(
                appInfo,
                (connection) => connection.hasContextListener(),
                (connection) => connection.waitForReadyToReceiveContext()
            );

            const sendContextPromise = connectionsPromise.then(async (expectedConnections) => {
                if (expectedConnections.length === 0) {
                    throw new FDC3Error(SendContextError.NoHandler, 'Context provided, but application has no handler for context');
                }

                const [result] = await collateClientCalls(expectedConnections.map((connection) => this._contextHandler.send(connection, context)));

                if (result === ClientCallsResult.ALL_FAILURE) {
                    throw new FDC3Error(SendContextError.HandlerError, 'Error(s) thrown by application attempting to handle context');
                } else if (result === ClientCallsResult.TIMEOUT) {
                    throw new FDC3Error(SendContextError.HandlerTimeout, 'Timeout waiting for application to handle context');
                }
            });

            promises.push(sendContextPromise);
        }

        await Promise.all(promises);
    }

    /**
     * Find apps that can handle an intent.
     *
     * Includes running apps that are not registered on the directory
     * @param payload Contains the intent type to find information for
     */
    private async findIntent(payload: FindIntentPayload): Promise<AppIntent> {
        let apps: Application[];
        if (payload.intent) {
            apps = await this._model.getApplicationsForIntent(payload.intent, payload.context && parseContext(payload.context).type);
        } else {
            // This is a non-FDC3 workaround to get all directory apps by calling `findIntent` with a falsy intent.
            // Ideally the FDC3 spec would expose an API to access the directory in a more meaningful way
            apps = await this._directory.getAllApps();
        }

        return {
            intent: {
                name: payload.intent,
                displayName: AppDirectory.getIntentDisplayName(apps, payload.intent)
            },
            apps
        };
    }

    private async findIntentsByContext(payload: FindIntentsByContextPayload): Promise<AppIntent[]> {
        return this._model.getAppIntentsByContext(parseContext(payload.context).type);
    }

    private async broadcast(payload: BroadcastPayload, source: ProviderIdentity): Promise<void> {
        const connection = await this.expectConnection(source);

        return this._contextHandler.broadcast(parseContext(payload.context), connection);
    }

    private async raiseIntent(payload: RaiseIntentPayload): Promise<IntentResolution> {
        const intent: Intent = {
            type: payload.intent,
            context: parseContext(payload.context),
            target: payload.target
        };

        return this._intentHandler.raise(intent);
    }

    private async addIntentListener(payload: AddIntentListenerPayload, source: ProviderIdentity): Promise<void> {
        const connection = await this.expectConnection(source);

        connection.addIntentListener(payload.intent);
    }

    private removeIntentListener(payload: RemoveIntentListenerPayload, source: ProviderIdentity): void {
        const connection = this.attemptGetConnection(source);
        if (connection) {
            connection.removeIntentListener(payload.intent);
        } else {
            // If for some odd reason the window is not in the model it's still OK to return successfully,
            // as the caller's intention was to remove a listener and the listener is certainly not there.
        }
    }

    private async addContextListener(payload: AddContextListenerPayload, source: ProviderIdentity): Promise<void> {
        const connection = await this.expectConnection(source);

        connection.addContextListener();
    }

    private removeContextListener(payload: RemoveContextListenerPayload, source: ProviderIdentity): void {
        const connection = this.attemptGetConnection(source);
        if (connection) {
            connection.removeContextListener();
        } else {
            // If for some odd reason the window is not in the model it's still OK to return successfully,
            // as the caller's intention was to remove a listener and the listener is certainly not there.
        }
    }

    private getSystemChannels(payload: GetSystemChannelsPayload, source: ProviderIdentity): ReadonlyArray<SystemChannelTransport> {
        return this._channelHandler.getSystemChannels().map((channel) => channel.serialize());
    }

    private getChannelById(payload: GetChannelByIdPayload, source: ProviderIdentity): ChannelTransport {
        return this._channelHandler.getChannelById(parseChannelId(payload.id));
    }

    private async getCurrentChannel(payload: GetCurrentChannelPayload, source: ProviderIdentity): Promise<ChannelTransport> {
        const identity = payload.identity || source;
        const connection = await this.expectConnection(identity);

        return connection.channel.serialize();
    }

    private getOrCreateAppChannel(payload: GetOrCreateAppChannelPayload, source: ProviderIdentity): AppChannelTransport {
        const name = parseAppChannelName(payload.name);

        return this._channelHandler.getAppChannelByName(name).serialize();
    }

    private channelGetMembers(payload: ChannelGetMembersPayload, source: ProviderIdentity): ReadonlyArray<Identity> {
        const channel = this._channelHandler.getChannelById(payload.id);

        return this._channelHandler.getChannelMembers(channel).map((connection) => parseIdentity(connection.identity));
    }

    private async channelJoin(payload: ChannelJoinPayload, source: ProviderIdentity): Promise<void> {
        const connection = await this.expectConnection(payload.identity || source);

        const channel = this._channelHandler.getChannelById(payload.id);

        await this._channelHandler.joinChannel(connection, channel);
        const context = this._channelHandler.getChannelContext(channel);

        if (context) {
            await collateClientCalls([this._contextHandler.send(connection, context)]).then(([result]) => {
                if (result === ClientCallsResult.ALL_FAILURE) {
                    console.warn(`Error thrown by client connection ${connection.id} attempting to handle context on joining channel, swallowing error`);
                } else if (result === ClientCallsResult.TIMEOUT) {
                    console.warn(`Timeout waiting for client connection ${connection.id} to handle context on joining channel, swallowing error`);
                }
            });
        }
    }

    private async channelBroadcast(payload: ChannelBroadcastPayload, source: ProviderIdentity): Promise<void> {
        const connection = await this.expectConnection(source);
        const channel = this._channelHandler.getChannelById(payload.id);

        return this._contextHandler.broadcastOnChannel(parseContext(payload.context), connection, channel);
    }

    private channelGetCurrentContext(payload: ChannelGetCurrentContextPayload, source: ProviderIdentity): Context | null {
        const channel = this._channelHandler.getChannelById(payload.id);

        return this._channelHandler.getChannelContext(channel);
    }

    private async channelAddContextListener(payload: ChannelAddContextListenerPayload, source: ProviderIdentity): Promise<void> {
        const connection = await this.expectConnection(source);
        const channel = this._channelHandler.getChannelById(parseChannelId(payload.id));

        connection.addChannelContextListener(channel);
    }

    private channelRemoveContextListener(payload: ChannelRemoveContextListenerPayload, source: ProviderIdentity): void {
        const connection = this.attemptGetConnection(source);
        const channel = this._channelHandler.getChannelById(parseChannelId(payload.id));

        if (connection) {
            connection.removeChannelContextListener(channel);
        } else {
            // If for some odd reason the window is not in the model it's still OK to return successfully,
            // as the caller's intention was to remove a listener and the listener is certainly not there.
        }
    }

    private async channelAddEventListener(payload: ChannelAddEventListenerPayload, source: ProviderIdentity): Promise<void> {
        const connection = await this.expectConnection(source);
        const channel = this._channelHandler.getChannelById(parseChannelId(payload.id));

        connection.addChannelEventListener(channel, payload.eventType);
    }

    private channelRemoveEventListener(payload: ChannelRemoveEventListenerPayload, source: ProviderIdentity): void {
        const connection = this.attemptGetConnection(source);
        const channel = this._channelHandler.getChannelById(parseChannelId(payload.id));

        if (connection) {
            connection.removeChannelEventListener(channel, payload.eventType);
        } else {
            // If for some odd reason the window is not in the model it's still OK to return successfully,
            // as the caller's intention was to remove a listener and the listener is certainly not there.
        }
    }

    private async expectConnection(identity: Identity): Promise<AppConnection> {
        identity = parseIdentity(identity);
        const connectionPromise = this._model.expectConnection(identity);

        try {
            return await connectionPromise;
        } catch {
            throw new FDC3Error(
                ConnectionError.WindowWithIdentityNotFound,
                `No connection to FDC3 service found from window with identity: ${JSON.stringify(identity)}`
            );
        }
    }

    private attemptGetConnection(identity: Identity): AppConnection | null {
        return this._model.getConnection(parseIdentity(identity));
    }
}

// Start service provider
Injector.getClass(Main).register();
