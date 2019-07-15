import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';

import {RaiseIntentPayload, APIFromClientTopic, OpenPayload, FindIntentPayload, FindIntentsByContextPayload, BroadcastPayload, APIFromClient, IntentListenerPayload, GetDesktopChannelsPayload, GetCurrentChannelPayload, ChannelGetMembersPayload, ChannelJoinPayload, ChannelTransport, DesktopChannelTransport, GetChannelByIdPayload, ChannelBroadcastPayload, ChannelGetCurrentContextPayload, ChannelAddContextListenerPayload, ChannelRemoveContextListenerPayload, ChannelAddEventListenerPayload, ChannelRemoveEventListenerPayload} from '../client/internal';
import {AppIntent, IntentResolution, Application, Intent, Context} from '../client/main';
import {FDC3Error, OpenError, IdentityError} from '../client/errors';
import {parseIdentity, parseContext, parseChannelId} from '../client/validation';

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
import {ConfigStore} from './model/ConfigStore';
import {ContextChannel} from './model/ContextChannel';

@injectable()
export class Main {
    private readonly _directory: AppDirectory;
    private readonly _model: Model;
    private readonly _contextHandler: ContextHandler;
    private readonly _intentHandler: IntentHandler;
    private readonly _channelHandler: ChannelHandler;
    private readonly _eventHandler: EventHandler;
    private readonly _apiHandler: APIHandler<APIFromClientTopic>;
    private readonly _configStore: ConfigStore

    constructor(
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.MODEL) model: Model,
        @inject(Inject.CONTEXT_HANDLER) contextHandler: ContextHandler,
        @inject(Inject.INTENT_HANDLER) intentHandler: IntentHandler,
        @inject(Inject.CHANNEL_HANDLER) channelHandler: ChannelHandler,
        @inject(Inject.EVENT_HANDLER) eventHandler: EventHandler,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>,
        @inject(Inject.CONFIG_STORE) configStore: ConfigStore
    ) {
        this._directory = directory;
        this._model = model;
        this._contextHandler = contextHandler;
        this._intentHandler = intentHandler;
        this._channelHandler = channelHandler;
        this._eventHandler = eventHandler;
        this._apiHandler = apiHandler;
        this._configStore = configStore;
    }

    public async register(): Promise<void> {
        Object.assign(window, {
            main: this,
            directory: this._directory,
            model: this._model,
            contextHandler: this._contextHandler,
            intentHandler: this._intentHandler,
            channelHandler: this._channelHandler,
            configStore: this._configStore
        });

        // Wait for creation of any injected components that require async initialization
        await Injector.initialized;

        // Current API
        this._apiHandler.registerListeners<APIFromClient>({
            [APIFromClientTopic.OPEN]: this.open.bind(this),
            [APIFromClientTopic.FIND_INTENT]: this.findIntent.bind(this),
            [APIFromClientTopic.FIND_INTENTS_BY_CONTEXT]: this.findIntentsByContext.bind(this),
            [APIFromClientTopic.BROADCAST]: this.broadcast.bind(this),
            [APIFromClientTopic.RAISE_INTENT]: this.raiseIntent.bind(this),
            [APIFromClientTopic.ADD_INTENT_LISTENER]: this.addIntentListener.bind(this),
            [APIFromClientTopic.REMOVE_INTENT_LISTENER]: this.removeIntentListener.bind(this),
            [APIFromClientTopic.GET_DESKTOP_CHANNELS]: this.getDesktopChannels.bind(this),
            [APIFromClientTopic.GET_CHANNEL_BY_ID]: this.getChannelById.bind(this),
            [APIFromClientTopic.GET_CURRENT_CHANNEL]: this.getCurrentChannel.bind(this),
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
        const appInfo: Application|null = await this._directory.getAppByName(payload.name);

        if (!appInfo) {
            throw new FDC3Error(OpenError.AppNotFound, `No app in directory with name: ${payload.name}`);
        }

        // This can throw FDC3Errors if app fails to open or times out
        const appWindows = await this._model.findOrCreate(appInfo);

        await Promise.all(appWindows.map(window => window.bringToFront()));
        if (appWindows.length > 0) {
            appWindows[appWindows.length - 1].focus();
        }

        if (payload.context) {
            await Promise.all(appWindows.map(window => {
                return this._contextHandler.send(window, parseContext(payload.context!));
            }));
        }
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
            apps = await this._model.getApplicationsForIntent(payload.intent);
        } else {
            // This is a non-FDC3 workaround to get all directory apps by calling `findIntent` with a falsy intent.
            // Ideally the FDC3 spec would expose an API to access the directory in a more meaningful way
            apps = await this._directory.getAllApps();
        }

        return {
            intent: {
                name: payload.intent,
                displayName: payload.intent
            },
            apps
        };
    }

    private async findIntentsByContext (payload: FindIntentsByContextPayload): Promise<AppIntent[]> {
        return this._directory.getAppIntentsByContext(parseContext(payload.context).type);
    }

    private async broadcast(payload: BroadcastPayload, source: ProviderIdentity): Promise<void> {
        const appWindow = this.getWindow(source);

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

    private async addIntentListener(payload: IntentListenerPayload, source: ProviderIdentity): Promise<void> {
        const appWindow = this.getWindow(source);

        appWindow.addIntentListener(payload.intent);
    }

    private removeIntentListener(payload: IntentListenerPayload, source: ProviderIdentity): void {
        const appWindow = this.attemptGetWindow(source);
        if (appWindow) {
            appWindow.removeIntentListener(payload.intent);
        } else {
            // If for some odd reason the window is not in the model it's still OK to return successfully,
            // as the caller's intention was to remove a listener and the listener is certainly not there.
        }
    }

    private getDesktopChannels(payload: GetDesktopChannelsPayload, source: ProviderIdentity): ReadonlyArray<DesktopChannelTransport> {
        return this._channelHandler.getDesktopChannels().map(channel => channel.serialize());
    }

    private getChannelById(payload: GetChannelByIdPayload, source: ProviderIdentity): ChannelTransport {
        return this._channelHandler.getChannelById(parseChannelId(payload.id));
    }

    private getCurrentChannel(payload: GetCurrentChannelPayload, source: ProviderIdentity): ChannelTransport {
        const identity = payload.identity || source;

        return this.getWindow(identity).channel.serialize();
    }

    private channelGetMembers(payload: ChannelGetMembersPayload, source: ProviderIdentity): ReadonlyArray<Identity> {
        const channel = this._channelHandler.getChannelById(payload.id);

        return this._channelHandler.getChannelMembers(channel).map(appWindow => parseIdentity(appWindow.identity));
    }

    private async channelJoin(payload: ChannelJoinPayload, source: ProviderIdentity): Promise<void> {
        const appWindow = this.getWindow(payload.identity || source);

        const channel = this._channelHandler.getChannelById(payload.id);

        this._channelHandler.joinChannel(appWindow, channel);
        const context = this._channelHandler.getChannelContext(channel);

        if (context) {
            return this._contextHandler.send(appWindow, context);
        }
    }

    private async channelBroadcast(payload: ChannelBroadcastPayload, source: ProviderIdentity): Promise<void> {
        const appWindow = this.getWindow(source);
        const channel = this._channelHandler.getChannelById(payload.id);

        return this._contextHandler.broadcastOnChannel(parseContext(payload.context), appWindow, channel);
    }

    private channelGetCurrentContext(payload: ChannelGetCurrentContextPayload, source: ProviderIdentity): Context | null {
        const channel = this._channelHandler.getChannelById(payload.id);

        return this._channelHandler.getChannelContext(channel);
    }

    private channelAddContextListener(payload: ChannelAddContextListenerPayload, source: ProviderIdentity): void {
        const appWindow = this.getWindow(source);
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

    private channelAddEventListener(payload: ChannelAddEventListenerPayload, source: ProviderIdentity): void {
        const appWindow = this.getWindow(source);
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

    private getWindow(identity: Identity): AppWindow {
        identity = parseIdentity(identity);
        const window = this._model.getWindow(identity);

        if (!window) {
            throw new FDC3Error(
                IdentityError.WindowWithIdentityNotFound,
                `No connection to FDC3 service found from window with identity: ${JSON.stringify(identity)}`
            );
        } else {
            return window;
        }
    }

    private attemptGetWindow(identity: Identity): AppWindow | null {
        return this._model.getWindow(parseIdentity(identity));
    }
}

// Start service provider
Injector.getClass(Main).register();
