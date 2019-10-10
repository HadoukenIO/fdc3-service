import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';

import {FDC3Error, OpenError, IdentityError} from '../client/errors';
import {RaiseIntentPayload, APIFromClientTopic, OpenPayload, FindIntentPayload, FindIntentsByContextPayload, BroadcastPayload, APIFromClient, AddIntentListenerPayload, RemoveIntentListenerPayload, GetSystemChannelsPayload, GetCurrentChannelPayload, ChannelGetMembersPayload, ChannelJoinPayload, ChannelTransport, SystemChannelTransport, GetChannelByIdPayload, ChannelBroadcastPayload, ChannelGetCurrentContextPayload, ChannelAddContextListenerPayload, ChannelRemoveContextListenerPayload, ChannelAddEventListenerPayload, ChannelRemoveEventListenerPayload, GetOrCreateAppChannelPayload, AppChannelTransport} from '../client/internal';
import {AppIntent, IntentResolution, Application, Intent, Context} from '../client/main';
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
import {ConfigStoreBinding} from './model/ConfigStore';
import {ContextChannel} from './model/ContextChannel';
import {withTimeout} from './utils/async';
import {Timeouts} from './constants';

@injectable()
export class Main {
    private readonly _directory: AppDirectory;
    private readonly _model: Model;
    private readonly _contextHandler: ContextHandler;
    private readonly _intentHandler: IntentHandler;
    private readonly _channelHandler: ChannelHandler;
    private readonly _eventHandler: EventHandler;
    private readonly _apiHandler: APIHandler<APIFromClientTopic>;
    private readonly _configStore: ConfigStoreBinding

    constructor(
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.MODEL) model: Model,
        @inject(Inject.CONTEXT_HANDLER) contextHandler: ContextHandler,
        @inject(Inject.INTENT_HANDLER) intentHandler: IntentHandler,
        @inject(Inject.CHANNEL_HANDLER) channelHandler: ChannelHandler,
        @inject(Inject.EVENT_HANDLER) eventHandler: EventHandler,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>,
        @inject(Inject.CONFIG_STORE) configStore: ConfigStoreBinding
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
        const appInfo: Application|null = await this._directory.getAppByName(payload.name);

        if (!appInfo) {
            throw new FDC3Error(OpenError.AppNotFound, `No app in directory with name: ${payload.name}`);
        }

        // This can throw FDC3Errors if app fails to open or times out
        await this._model.ensureRunning(appInfo);

        // Bring-to-front all currently open windows in creation order
        const windowsToFocus = this._model.findWindowsByAppName(appInfo.name).sort((a: AppWindow, b: AppWindow) => a.appWindowNumber - b.appWindowNumber);
        await Promise.all(windowsToFocus.map(window => window.bringToFront()));
        if (windowsToFocus.length > 0) {
            windowsToFocus[windowsToFocus.length - 1].focus();
        }

        if (payload.context) {
            // TODO: Revisit timeout logic [SERVICE-556]
            await withTimeout(Timeouts.ADD_CONTEXT_LISTENER, (async () => {
                const appWindows = await this._model.expectWindowsForApp(appInfo);

                await Promise.all(appWindows.map(window => {
                    return this._contextHandler.send(window, parseContext(payload.context!));
                }));
            })());
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
            apps = await this._model.getApplicationsForIntent(payload.intent, payload.context && parseContext(payload.context).type);
        } else {
            // This is a non-FDC3 workaround to get all directory apps by calling `findIntent` with a falsy intent.
            // Ideally the FDC3 spec would expose an API to access the directory in a more meaningful way
            apps = await this._directory.getAllApps();
        }

        const displayName = AppDirectory.getIntentDisplayName(apps, payload.intent);

        return {
            intent: {
                name: payload.intent,
                displayName: displayName !== undefined ? displayName : payload.intent
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

    private getSystemChannels(payload: GetSystemChannelsPayload, source: ProviderIdentity): ReadonlyArray<SystemChannelTransport> {
        return this._channelHandler.getSystemChannels().map(channel => channel.serialize());
    }

    private getChannelById(payload: GetChannelByIdPayload, source: ProviderIdentity): ChannelTransport {
        return this._channelHandler.getChannelById(parseChannelId(payload.id));
    }

    private async getCurrentChannel(payload: GetCurrentChannelPayload, source: ProviderIdentity): Promise<ChannelTransport> {
        const identity = payload.identity || source;
        const appWindow = await this.expectWindow(identity);

        return appWindow.channel.serialize();
    }

    private async getOrCreateAppChannel(payload: GetOrCreateAppChannelPayload, source: ProviderIdentity): Promise<AppChannelTransport> {
        const name = parseAppChannelName(payload.name);

        return this._channelHandler.getAppChannelByName(name).serialize();
    }

    private channelGetMembers(payload: ChannelGetMembersPayload, source: ProviderIdentity): ReadonlyArray<Identity> {
        const channel = this._channelHandler.getChannelById(payload.id);

        return this._channelHandler.getChannelMembers(channel).map(appWindow => parseIdentity(appWindow.identity));
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
