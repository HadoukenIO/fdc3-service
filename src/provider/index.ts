import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';

import {FDC3Error, OpenError, IdentityError} from '../client/errors';
import {RaiseIntentPayload, APIFromClientTopic, OpenPayload, FindIntentPayload, FindIntentsByContextPayload, BroadcastPayload, APIFromClient, AddIntentListenerPayload, RemoveIntentListenerPayload, GetSystemChannelsPayload, GetCurrentChannelPayload, ChannelGetMembersPayload, ChannelJoinPayload, ChannelTransport, SystemChannelTransport, GetChannelByIdPayload, ChannelBroadcastPayload, ChannelGetCurrentContextPayload, ChannelAddContextListenerPayload, ChannelRemoveContextListenerPayload, ChannelAddEventListenerPayload, ChannelRemoveEventListenerPayload, GetOrCreateAppChannelPayload, AppChannelTransport, AddContextListenerPayload, RemoveContextListenerPayload} from '../client/internal';
import {AppIntent, IntentResolution, Application, Context} from '../client/main';
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
import {AppWindow} from './model/AppWindow';
import {Intent} from './intents';
import {ConfigStoreBinding} from './model/ConfigStore';
import {ContextChannel} from './model/ContextChannel';
import {Environment} from './model/Environment';

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

    private async onChannelChangedHandler(appWindow: AppWindow, channel: ContextChannel | null, previousChannel: ContextChannel | null): Promise<void> {
        return this._eventHandler.dispatchEventOnChannelChanged(appWindow, channel, previousChannel);
    }

    private async open(payload: OpenPayload): Promise<void> {
        const context = payload.context && parseContext(payload.context);

        const appInfo: Application|null = await this._directory.getAppByName(payload.name);

        if (!appInfo) {
            throw new FDC3Error(OpenError.AppNotFound, `No app in directory with name: ${payload.name}`);
        }

        const promises: Promise<void>[] = [];

        // Start the application if not already running
        const startedPromise = (await this._model.getOrCreateLiveApp(appInfo)).waitForAppStarted();

        promises.push(startedPromise);

        // If the app has open windows, bring all to front in creation order
        const windows = this._model.findWindowsByAppName(appInfo.name);
        if (windows.length > 0) {
            windows.sort((a, b) => a.appWindowNumber - b.appWindowNumber);

            const bringToFrontPromise = Promise.all(windows.map((window) => window.bringToFront()));
            const focusPromise = bringToFrontPromise.then(() => windows[windows.length - 1].focus());

            promises.push(focusPromise);
        }

        // If a context has been provided, send to listening windows
        if (context) {
            const windowsPromise = this._model.expectWindowsForApp(
                appInfo,
                (window) => window.hasContextListener(),
                (window) => window.waitForReadyToReceiveContext()
            );

            const sendContextPromise = windowsPromise.then(async (expectedWindows) => {
                await Promise.all(expectedWindows.map((window) => this._contextHandler.send(window, context)));
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
        const appWindow = await this.expectWindow(source);

        return this._contextHandler.broadcast(parseContext(payload.context), appWindow);
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
        const appWindow = await this.expectWindow(source);

        appWindow.addIntentListener(payload.intent);
    }

    private removeIntentListener(payload: RemoveIntentListenerPayload, source: ProviderIdentity): void {
        const appWindow = this.attemptGetWindow(source);
        if (appWindow) {
            appWindow.removeIntentListener(payload.intent);
        } else {
            // If for some odd reason the window is not in the model it's still OK to return successfully,
            // as the caller's intention was to remove a listener and the listener is certainly not there.
        }
    }

    private async addContextListener(payload: AddContextListenerPayload, source: ProviderIdentity): Promise<void> {
        const appWindow = await this.expectWindow(source);

        appWindow.addContextListener();
    }

    private removeContextListener(payload: RemoveContextListenerPayload, source: ProviderIdentity): void {
        const appWindow = this.attemptGetWindow(source);
        if (appWindow) {
            appWindow.removeContextListener();
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
        const appWindow = await this.expectWindow(identity);

        return appWindow.channel.serialize();
    }

    private getOrCreateAppChannel(payload: GetOrCreateAppChannelPayload, source: ProviderIdentity): AppChannelTransport {
        const name = parseAppChannelName(payload.name);

        return this._channelHandler.getAppChannelByName(name).serialize();
    }

    private channelGetMembers(payload: ChannelGetMembersPayload, source: ProviderIdentity): ReadonlyArray<Identity> {
        const channel = this._channelHandler.getChannelById(payload.id);

        return this._channelHandler.getChannelMembers(channel).map((appWindow) => parseIdentity(appWindow.identity));
    }

    private async channelJoin(payload: ChannelJoinPayload, source: ProviderIdentity): Promise<void> {
        const appWindow = await this.expectWindow(payload.identity || source);

        const channel = this._channelHandler.getChannelById(payload.id);

        this._channelHandler.joinChannel(appWindow, channel);
        const context = this._channelHandler.getChannelContext(channel);

        if (context) {
            return this._contextHandler.send(appWindow, context);
        }
    }

    private async channelBroadcast(payload: ChannelBroadcastPayload, source: ProviderIdentity): Promise<void> {
        const appWindow = await this.expectWindow(source);
        const channel = this._channelHandler.getChannelById(payload.id);

        return this._contextHandler.broadcastOnChannel(parseContext(payload.context), appWindow, channel);
    }

    private channelGetCurrentContext(payload: ChannelGetCurrentContextPayload, source: ProviderIdentity): Context | null {
        const channel = this._channelHandler.getChannelById(payload.id);

        return this._channelHandler.getChannelContext(channel);
    }

    private async channelAddContextListener(payload: ChannelAddContextListenerPayload, source: ProviderIdentity): Promise<void> {
        const appWindow = await this.expectWindow(source);
        const channel = this._channelHandler.getChannelById(parseChannelId(payload.id));

        appWindow.addChannelContextListener(channel);
    }

    private channelRemoveContextListener(payload: ChannelRemoveContextListenerPayload, source: ProviderIdentity): void {
        const appWindow = this.attemptGetWindow(source);
        const channel = this._channelHandler.getChannelById(parseChannelId(payload.id));

        if (appWindow) {
            appWindow.removeChannelContextListener(channel);
        } else {
            // If for some odd reason the window is not in the model it's still OK to return successfully,
            // as the caller's intention was to remove a listener and the listener is certainly not there.
        }
    }

    private async channelAddEventListener(payload: ChannelAddEventListenerPayload, source: ProviderIdentity): Promise<void> {
        const appWindow = await this.expectWindow(source);
        const channel = this._channelHandler.getChannelById(parseChannelId(payload.id));

        appWindow.addChannelEventListener(channel, payload.eventType);
    }

    private channelRemoveEventListener(payload: ChannelRemoveEventListenerPayload, source: ProviderIdentity): void {
        const appWindow = this.attemptGetWindow(source);
        const channel = this._channelHandler.getChannelById(parseChannelId(payload.id));

        if (appWindow) {
            appWindow.removeChannelEventListener(channel, payload.eventType);
        } else {
            // If for some odd reason the window is not in the model it's still OK to return successfully,
            // as the caller's intention was to remove a listener and the listener is certainly not there.
        }
    }

    private async expectWindow(identity: Identity): Promise<AppWindow> {
        identity = parseIdentity(identity);
        const windowPromise = this._model.expectWindow(identity);

        try {
            return await windowPromise;
        } catch {
            throw new FDC3Error(
                IdentityError.WindowWithIdentityNotFound,
                `No connection to FDC3 service found from window with identity: ${JSON.stringify(identity)}`
            );
        }
    }

    private attemptGetWindow(identity: Identity): AppWindow | null {
        return this._model.getWindow(parseIdentity(identity));
    }
}

// Start service provider
Injector.getClass(Main).register();
